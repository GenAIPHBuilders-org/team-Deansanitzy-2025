const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

// Load environment variables
require('dotenv').config();

// Telegram Bot Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_VISION_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is required in environment variables');
    process.exit(1);
}

if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is required in environment variables');
    process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// User session storage
const userSessions = new Map();

console.log('🤖 Kita-kita Receipt Bot is starting...');

// Bot Commands
const COMMANDS = {
    START: '/start',
    HELP: '/help',
    SCAN: '/scan',
    TEST: '/test'
};

// Welcome message
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    console.log(`👋 New user started bot: ${user.first_name} (${user.id})`);
    
    const welcomeMessage = `
🎉 *Welcome to Kita\\-kita Receipt Bot*\\! 

I can help you scan receipts and extract transaction details using AI\\. Here's what I can do:

📸 *Send me a receipt image* \\- I'll extract transaction details
🤖 *AI\\-powered analysis* \\- Using Gemini Pro Vision  
📋 *Structured data* \\- Get organized transaction information

*Available Commands:*
${COMMANDS.SCAN} \\- Start receipt scanning
${COMMANDS.TEST} \\- Test bot functionality
${COMMANDS.HELP} \\- Show this help message

🚀 *Quick Start:* Just send me a photo of your receipt to get started\\!
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📸 Scan Receipt', callback_data: 'scan_receipt' },
                { text: '🧪 Test Bot', callback_data: 'test_bot' }
            ],
            [
                { text: '❓ Help', callback_data: 'show_help' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
    });
});

// Help command
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    
    const helpMessage = `
🤖 *Kita\\-kita Receipt Bot Help*

*How to use:*
1\\. Send me a photo of your receipt
2\\. I'll analyze it using AI
3\\. Get structured transaction data
4\\. Copy or use the extracted information

*Commands:*
${COMMANDS.START} \\- Welcome message
${COMMANDS.SCAN} \\- Manual scan prompt
${COMMANDS.TEST} \\- Test bot functionality
${COMMANDS.HELP} \\- Show this help

*Tips:*
📸 Make sure receipts are clear and well\\-lit
💡 Works with Philippine and international receipts
⚡ Processing usually takes 2\\-5 seconds

*Status:* Bot is running in test mode\\. Full Firebase integration coming soon\\!
    `;
    
    await bot.sendMessage(chatId, helpMessage, { parse_mode: 'MarkdownV2' });
});

// Test command
bot.onText(/\/test/, async (msg) => {
    const chatId = msg.chat.id;
    
    const testMessage = `
🧪 *Bot Test Results*

✅ Telegram API: Connected
✅ Bot Token: Valid
✅ Gemini API: ${GEMINI_API_KEY ? 'Configured' : 'Missing'}
✅ Message Handling: Working
✅ Keyboard Buttons: Functional

🚀 *Ready to scan receipts\\!*

Send me a receipt photo to test the AI analysis\\.
    `;
    
    await bot.sendMessage(chatId, testMessage, { parse_mode: 'MarkdownV2' });
});

// Handle photo messages (receipt scanning)
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    const photo = msg.photo[msg.photo.length - 1]; // Get highest resolution
    
    console.log(`📸 Received photo from ${user.first_name} (${user.id})`);
    
    // Send processing message
    const processingMsg = await bot.sendMessage(chatId, '🔄 Processing your receipt...', {
        reply_markup: {
            inline_keyboard: [[
                { text: '⏳ Analyzing...', callback_data: 'processing' }
            ]]
        }
    });
    
    try {
        // Download the photo
        const fileInfo = await bot.getFile(photo.file_id);
        const imageBuffer = await downloadTelegramFile(fileInfo.file_path);
        
        // Convert to base64
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
        
        // Analyze with Gemini
        const extractedData = await analyzeReceiptWithGemini(base64Image);
        
        // Update processing message
        await bot.editMessageText('✅ Receipt analyzed successfully!', {
            chat_id: chatId,
            message_id: processingMsg.message_id
        });
        
        // Show extracted data
        await showReceiptResults(chatId, extractedData, user.id);
        
    } catch (error) {
        console.error('❌ Receipt processing failed:', error);
        
        await bot.editMessageText('❌ Failed to process receipt. Please try again with a clearer image.', {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            reply_markup: {
                inline_keyboard: [[
                    { text: '📸 Try Again', callback_data: 'scan_receipt' },
                    { text: '❓ Help', callback_data: 'show_help' }
                ]]
            }
        });
    }
});

// Download file from Telegram
async function downloadTelegramFile(filePath) {
    const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    return await response.buffer();
}

// Analyze receipt using Gemini Pro Vision
async function analyzeReceiptWithGemini(base64Image) {
    const prompt = `
Analyze this receipt image and extract transaction information. Return ONLY a valid JSON object with the following structure:

{
    "name": "Store name or main item description",
    "amount": 0.00,
    "type": "expense",
    "category": "food|shopping|bills|transportation|entertainment|health|housing|education|other",
    "date": "YYYY-MM-DD",
    "notes": "Any additional details from the receipt",
    "items": [
        {
            "name": "Item name",
            "price": 0.00,
            "quantity": 1
        }
    ],
    "merchant": "Store/merchant name",
    "total": 0.00,
    "currency": "PHP"
}

Rules:
- Extract the total amount as a number (no currency symbols)
- Use ISO date format (YYYY-MM-DD)
- If date is unclear, use today's date
- Choose the most appropriate category
- Set type to "expense" for purchases
- Include merchant name if visible
- List individual items if clearly visible
- Ensure all JSON is properly formatted and valid
- Use PHP as currency for Philippine receipts, USD for others

Return ONLY the JSON object, no additional text.
    `;

    const requestBody = {
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            data: base64Image.split(',')[1],
                            mimeType: 'image/jpeg'
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 1,
            maxOutputTokens: 1024,
        }
    };

    const response = await fetch(`${GEMINI_VISION_ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.text();
        console.error('Gemini API error:', errorData);
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini API');
    }

    const extractedText = data.candidates[0].content.parts[0].text;
    console.log('🎯 Raw Gemini response:', extractedText);

    // Parse the JSON response
    const cleanedJson = extractedText.replace(/```json\n?|\n?```/g, '').trim();
    const parsedData = JSON.parse(cleanedJson);
    
    console.log('✅ Parsed receipt data:', parsedData);
    return parsedData;
}

// Show receipt analysis results
async function showReceiptResults(chatId, data, userId) {
    const itemsList = data.items && data.items.length > 0 
        ? data.items.map(item => `• ${item.name}: ${data.currency || '₱'}${item.price}`).join('\n')
        : 'No individual items detected';
    
    const resultMessage = `
📋 *Receipt Analysis Results*

🏪 *Merchant:* ${data.merchant || data.name || 'Unknown'}
💰 *Amount:* ${data.currency || '₱'}${data.amount || data.total || '0.00'}
📅 *Date:* ${data.date || 'Today'}
🗂️ *Category:* ${data.category || 'other'}
📝 *Type:* ${data.type || 'expense'}

*Items:*
\`\`\`
${itemsList}
\`\`\`

${data.notes ? `*Notes:* ${data.notes}` : ''}

*JSON Data:*
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📸 Scan Another', callback_data: 'scan_receipt' },
                { text: '❓ Help', callback_data: 'show_help' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, resultMessage, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
    });
}

// Handle callback queries (button presses)
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    console.log(`🔘 Button pressed: ${data} by user ${userId}`);
    
    try {
        switch (data) {
            case 'scan_receipt':
                await bot.sendMessage(chatId, '📸 Please send me a clear photo of your receipt to analyze!');
                break;
                
            case 'test_bot':
                await bot.sendMessage(chatId, '🧪 Bot is working! Send me a receipt photo to test AI analysis.');
                break;
                
            case 'show_help':
                await bot.sendMessage(chatId, '❓ Type /help to see all available commands and usage instructions.');
                break;
                
            default:
                await bot.sendMessage(chatId, '❓ Unknown action. Please try again.');
        }
        
        // Answer the callback query to remove loading state
        await bot.answerCallbackQuery(callbackQuery.id);
        
    } catch (error) {
        console.error('❌ Callback query error:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Something went wrong. Please try again.',
            show_alert: true
        });
    }
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

console.log('✅ Kita-kita Receipt Bot is running!');
console.log('🤖 Bot username: @kitakita_receipt_bot (if configured)');
console.log('📱 Send /start to begin using the bot');

module.exports = bot; 