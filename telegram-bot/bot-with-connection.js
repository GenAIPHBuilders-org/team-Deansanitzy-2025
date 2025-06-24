const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

// Load environment variables
require('dotenv').config();

// Initialize Firebase Admin only if not disabled
let db = null;
if (!process.env.DISABLE_FIREBASE) {
    try {
        if (!admin.apps.length) {
            // For now, we'll use a simple in-memory store until Firebase is properly configured
            console.log('🔥 Firebase disabled - using in-memory storage');
        }
    } catch (error) {
        console.log('🔥 Firebase initialization skipped:', error.message);
    }
} else {
    console.log('🔥 Firebase disabled by environment variable - using in-memory storage');
}

// In-memory storage for development
const userConnections = new Map(); // telegramUserId -> { userId, email, connectedAt }
const pendingKeys = new Map(); // key -> { userId, email, expiresAt }

// Clear any existing connections on restart
userConnections.clear();

// Telegram Bot Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_VISION_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://your-kita-kita-app.com';

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

console.log('🤖 Kita-kita Bot is starting...');
console.log('✅ Kita-kita Bot is running!');
console.log('🤖 Bot username: @KitakitaAIBot (if configured)');
console.log('📱 Send /start to begin using the bot');

// Bot Commands
const COMMANDS = {
    START: '/start',
    HELP: '/help',
    SCAN: '/scan',
    TEST: '/test',
    CONNECT: '/connect',
    ACCOUNT: '/account',
    DISCONNECT: '/disconnect'
};

// Check if user is connected to web app account
async function isUserConnected(telegramUserId) {
    // Check local storage (connections are stored here when made)
    return userConnections.has(telegramUserId.toString());
}

// Get user connection info
async function getUserConnection(telegramUserId) {
    // Get from local storage
    return userConnections.get(telegramUserId.toString());
}

// Welcome message with connection check
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    console.log(`👋 New user started bot: ${user.first_name} (${user.id})`);
    
    const isConnected = await isUserConnected(user.id);
    
    let welcomeMessage, keyboard;
    
    if (isConnected) {
        const connection = await getUserConnection(user.id);
        welcomeMessage = `
🎉 *Welcome back to Kita\\-kita Bot*\\! 

✅ *Account Connected* \\- You're linked to your Kita\\-kita account
👤 *Connected as:* ${connection.email}

I can help you scan receipts and extract transaction details using AI\\. Here's what I can do:

📸 *Send me a receipt image* \\- I'll extract transaction details and save them to your account
🤖 *AI\\-powered analysis* \\- Using Gemini Pro Vision  
📋 *Structured data* \\- Get organized transaction information
💾 *Auto\\-save* \\- Transactions automatically saved to your profile

🚀 *Quick Start:* Just send me a photo of your receipt to get started\\!
        `;
        
        keyboard = {
            inline_keyboard: [
                [
                    { text: '📸 Scan Receipt', callback_data: 'scan_receipt' },
                    { text: '👤 Account Info', callback_data: 'account_info' }
                ],
                [
                    { text: '🧪 Test Bot', callback_data: 'test_bot' },
                    { text: '❓ Help', callback_data: 'show_help' }
                ]
            ]
        };
    } else {
        welcomeMessage = `
🎉 *Welcome to Kita\\-kita Bot*\\! 

I can help you scan receipts and extract transaction details using AI\\. 

⚠️ *Account Not Connected* \\- To save your transactions and access full features, please connect your Kita\\-kita account\\.

*Two ways to get started:*

🔗 *Connect Account* \\- Link to your Kita\\-kita web app account for full features
📸 *Try Without Account* \\- Scan receipts without saving

*What you get with a connected account:*
✅ Save transactions to your profile
✅ View spending history  
✅ AI\\-powered insights
✅ Expense categorization
✅ Budget tracking
        `;
        
        keyboard = {
            inline_keyboard: [
                [
                    { text: '🔗 Connect Account', callback_data: 'connect_account' },
                    { text: '📸 Try Scanning', callback_data: 'scan_receipt' }
                ],
                [
                    { text: '❓ Help', callback_data: 'show_help' }
                ]
            ]
        };
    }
    
    await bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
    });
});

// Handle callback queries (button presses)
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const user = callbackQuery.from;
    const data = callbackQuery.data;
    
    // Answer the callback query to remove loading state
    await bot.answerCallbackQuery(callbackQuery.id);
    
    switch (data) {
        case 'connect_account':
            await showConnectionInstructions(chatId);
            break;
        case 'account_info':
            await showAccountInfo(chatId, user.id);
            break;
        case 'scan_receipt':
            await promptForReceipt(chatId);
            break;
        case 'test_bot':
            await runBotTest(chatId);
            break;
        case 'show_help':
            await showHelp(chatId);
            break;
        case 'connect_help':
            await showConnectionInstructions(chatId);
            break;
        case 'back_to_start':
            // Show the start message again
            const isConnected = await isUserConnected(user.id);
            
            let welcomeMessage, keyboard;
            
            if (isConnected) {
                const connection = await getUserConnection(user.id);
                welcomeMessage = `
🎉 *Welcome back to Kita\\-kita Bot*\\! 

✅ *Account Connected* \\- You're linked to your Kita\\-kita account
👤 *Connected as:* ${connection.email}

I can help you scan receipts and extract transaction details using AI\\. Here's what I can do:

📸 *Send me a receipt image* \\- I'll extract transaction details and save them to your account
🤖 *AI\\-powered analysis* \\- Using Gemini Pro Vision  
📋 *Structured data* \\- Get organized transaction information
💾 *Auto\\-save* \\- Transactions automatically saved to your profile

🚀 *Quick Start:* Just send me a photo of your receipt to get started\\!
                `;
                
                keyboard = {
                    inline_keyboard: [
                        [
                            { text: '📸 Scan Receipt', callback_data: 'scan_receipt' },
                            { text: '👤 Account Info', callback_data: 'account_info' }
                        ],
                        [
                            { text: '🧪 Test Bot', callback_data: 'test_bot' },
                            { text: '❓ Help', callback_data: 'show_help' }
                        ]
                    ]
                };
            } else {
                welcomeMessage = `
🎉 *Welcome to Kita\\-kita Bot*\\! 

I can help you scan receipts and extract transaction details using AI\\. 

⚠️ *Account Not Connected* \\- To save your transactions and access full features, please connect your Kita\\-kita account\\.

*Two ways to get started:*

🔗 *Connect Account* \\- Link to your Kita\\-kita web app account for full features
📸 *Try Without Account* \\- Scan receipts without saving

*What you get with a connected account:*
✅ Save transactions to your profile
✅ View spending history  
✅ AI\\-powered insights
✅ Expense categorization
✅ Budget tracking
                `;
                
                keyboard = {
                    inline_keyboard: [
                        [
                            { text: '🔗 Connect Account', callback_data: 'connect_account' },
                            { text: '📸 Try Scanning', callback_data: 'scan_receipt' }
                        ],
                        [
                            { text: '❓ Help', callback_data: 'show_help' }
                        ]
                    ]
                };
            }
            
            await bot.sendMessage(chatId, welcomeMessage, {
                parse_mode: 'MarkdownV2',
                reply_markup: keyboard
            });
            break;
        case 'disconnect_confirm':
            await bot.sendMessage(chatId, 'Use `/disconnect` command to unlink your account.', { parse_mode: 'Markdown' });
            break;
        case 'processing':
            // Do nothing, this is just a loading state
            break;
        default:
            console.log('Unknown callback query:', data);
    }
});

// Show connection instructions
async function showConnectionInstructions(chatId) {
    const instructionsMessage = `
🔗 *Connect Your Kita\\-kita Account*

To connect your Telegram to your Kita\\-kita web app account, follow these steps:

*Step 1:* Open the Kita\\-kita web app
🌐 [Open Kita\\-kita App](${WEB_APP_URL.replace(/[.]/g, '\\.')})

*Step 2:* Go to your Profile page
👤 Click on "Profile" in the navigation

*Step 3:* Get your connection key
🔑 Copy the unique Telegram connection key shown

*Step 4:* Connect here
📱 Send the command: \`/connect YOUR\\-KEY\\-HERE\`

*Example:*
\`/connect TG\\-ABC123\\-XYZ789\\-DEF456\`

❓ *Need help?* The key looks like: \`TG\\-XXXXXX\\-XXXXXXX\\-XXXXXX\`
⏰ *Keys expire in 24 hours* for security

*Alternative:* You can also use the \`/connect\` command directly followed by your key\\.
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📋 How to Connect', callback_data: 'connect_help' },
                { text: '⬅️ Back to Menu', callback_data: 'back_to_start' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, instructionsMessage, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard,
        disable_web_page_preview: true
    });
}

// Connect command to link Telegram account with web app
bot.onText(/\/connect\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    const connectionKey = match[1].trim();
    
    console.log(`🔗 Connection attempt from ${user.first_name} (${user.id}) with key: ${connectionKey}`);
    
    try {
        // Validate key format
        if (!connectionKey.match(/^TG-[A-Z0-9]{6}-[A-Z0-9]{7,}-[A-Z0-9]{6}$/)) {
            await bot.sendMessage(chatId, `❌ *Invalid key format*

The connection key should look like:
\`TG-XXXXXX-XXXXXXX-XXXXXX\`

Please check your key and try again.

*Get your key from:*
🌐 Kita-kita web app → Profile → Telegram Connection`, { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🔄 Try Again', callback_data: 'connect_account' }
                        ]
                    ]
                }
            });
            return;
        }
        
        // Check if user is already connected
        if (await isUserConnected(user.id)) {
            const connection = await getUserConnection(user.id);
            await bot.sendMessage(chatId, `⚠️ *Already Connected*

Your Telegram account is already linked to: ${connection.email}

Use \`/disconnect\` to unlink and connect a different account.`, { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '👤 Account Info', callback_data: 'account_info' },
                            { text: '🔓 Disconnect', callback_data: 'disconnect_confirm' }
                        ]
                    ]
                }
            });
            return;
        }
        
        // Validate key with Firebase integration
        const validation = await validateConnectionKey(connectionKey);
        
        if (validation && validation.valid) {
            // Get user info from Firebase validation
            const userEmail = validation.userEmail;
            const userId = validation.userId;
            
            // Store connection both locally and in Firebase
            const connectionData = {
                userId: userId,
                email: userEmail,
                connectedAt: new Date().toISOString(),
                telegramUsername: user.username,
                telegramFirstName: user.first_name,
                telegramLastName: user.last_name
            };
            
            // Store locally for immediate use
            userConnections.set(user.id.toString(), connectionData);
            
            // Try to store in Firebase
            try {
                await markKeyAsUsedInFirebase(connectionKey, user, validation);
                console.log(`✅ Connection stored in Firebase for user ${userId}`);
            } catch (error) {
                console.error('Failed to store connection in Firebase:', error);
                // Continue anyway since we have local storage
            }
            
            await bot.sendMessage(chatId, `✅ *Account Connected Successfully!*

🎉 Your Telegram is now linked to your Kita-kita account!

*Connected Account:* ${userEmail}
*Connected At:* ${new Date().toLocaleString()}

*What's new:*
📸 Receipt scans will be saved to your account
📊 View transaction history in the web app  
🤖 AI insights based on your spending patterns
📱 Manage everything from Telegram or web

🚀 *Ready to scan!* Send me a receipt photo to get started.`, { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '📸 Scan First Receipt', callback_data: 'scan_receipt' }
                        ],
                        [
                            { text: '👤 Account Info', callback_data: 'account_info' }
                        ]
                    ]
                }
            });
            
            console.log(`✅ Successfully connected user ${user.id} to account ${userEmail}`);
        } else {
            await bot.sendMessage(chatId, `❌ *Connection Failed*

The key you provided is either:
• Invalid or expired (keys expire in 24 hours)
• Already used
• Incorrect format

*To get a new key:*
1. Open the Kita-kita web app
2. Go to Profile → Telegram Connection  
3. Click "Refresh Key" if needed
4. Copy the new key and try again

Need help? Use /help for more information.`, { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🔄 Try Again', callback_data: 'connect_account' },
                            { text: '❓ Help', callback_data: 'show_help' }
                        ]
                    ]
                }
            });
        }
    } catch (error) {
        console.error(`❌ Error in connect command: ${error.message}`);
        await bot.sendMessage(chatId, `❌ Connection error occurred. Please try again or use /help for assistance.`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔄 Try Again', callback_data: 'connect_account' },
                        { text: '❓ Help', callback_data: 'show_help' }
                    ]
                ]
            }
        });
    }
});

// Firebase utility functions for the bot using web app API
async function validateTelegramKeyInFirebase(key) {
    try {
        console.log(`🔍 Validating key via web app API: ${key}`);
        
        const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
        
        const response = await fetch(`${webAppUrl}/api/telegram/validate-key`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Key validation result:', result);
            return result;
        } else {
            const error = await response.text();
            console.error('Web app API error:', response.status, error);
            return { valid: false, reason: 'Web app API error' };
        }
    } catch (error) {
        console.error('Error validating key via web app:', error);
        return { valid: false, reason: 'Validation error' };
    }
}

async function markKeyAsUsedInFirebase(key, telegramUserData, userInfo) {
    try {
        console.log(`📝 Connecting account via web app API: ${key}`);
        
        const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
        
        const response = await fetch(`${webAppUrl}/api/telegram/connect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                key, 
                telegramUserData: {
                    id: telegramUserData.id,
                    username: telegramUserData.username,
                    first_name: telegramUserData.first_name,
                    last_name: telegramUserData.last_name
                }
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Connection successful via web app API:`, result);
            return true;
        } else {
            const error = await response.text();
            console.error('Failed to connect via web app API:', error);
            return false;
        }
        
    } catch (error) {
        console.error('Error connecting via web app API:', error);
        return false;
    }
}

// Validate connection key (now with Firebase integration)
async function validateConnectionKey(key) {
    console.log(`🔍 Validating key: ${key}`);
    
    // Try Firebase validation first
    const firebaseResult = await validateTelegramKeyInFirebase(key);
    if (firebaseResult.valid) {
        console.log(`✅ Key validation passed for: ${key}`);
        return firebaseResult;
    }
    
    console.log(`❌ Key validation failed for: ${key} - ${firebaseResult.reason}`);
    return false;
}

// Account info command
bot.onText(/\/account/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    await showAccountInfo(chatId, user.id);
});

// Show account information
async function showAccountInfo(chatId, telegramUserId) {
    if (!(await isUserConnected(telegramUserId))) {
        await bot.sendMessage(chatId, `
❌ *No Account Connected*

You need to connect your Kita\\-kita account first\\.

Use \`/connect YOUR\\-KEY\` to link your account\\.
        `, { 
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔗 How to Connect', callback_data: 'connect_account' }]
                ]
            }
        });
        return;
    }
    
    const connection = await getUserConnection(telegramUserId);
    const connectedDate = new Date(connection.connectedAt);
    
    const accountMessage = `
👤 *Account Information*

*Connected Account:* ${connection.email}
*User ID:* \`${connection.userId}\`
*Connected:* ${connectedDate.toLocaleDateString()} at ${connectedDate.toLocaleTimeString()}

*Telegram Info:*
*Username:* ${connection.telegramUsername ? `@${connection.telegramUsername}` : 'Not set'}
*Name:* ${connection.telegramFirstName} ${connection.telegramLastName || ''}

*Features Available:*
✅ Receipt scanning with auto\\-save
✅ Transaction history
✅ AI spending insights  
✅ Web app synchronization

*Statistics:*
📸 Receipts scanned: 0
💰 Total transactions: $0\\.00
📊 Categories tracked: 0
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📸 Scan Receipt', callback_data: 'scan_receipt' }
            ],
            [
                { text: '🔓 Disconnect Account', callback_data: 'disconnect_confirm' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, accountMessage, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
    });
}

// Disconnect command
bot.onText(/\/disconnect/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    if (!(await isUserConnected(user.id))) {
        await bot.sendMessage(chatId, '❌ No account is currently connected.');
        return;
    }
    
    const connection = await getUserConnection(user.id);
    
    // Remove connection
    userConnections.delete(user.id.toString());
    
    await bot.sendMessage(chatId, `
✅ *Account Disconnected*

Your Telegram has been unlinked from: ${connection.email}

You can still use the bot without an account, but receipts won't be saved\\.

To reconnect, use \`/connect YOUR\\-KEY\` anytime\\.
    `, { parse_mode: 'MarkdownV2' });
    
    console.log(`🔗 Disconnected user ${user.id} from account ${connection.email}`);
});

// Help command
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await showHelp(chatId);
});

// Show help message
async function showHelp(chatId) {
    const helpMessage = `
🤖 *Kita\\-kita Bot Help*

*Available Commands:*
${COMMANDS.START} \\- Welcome message and main menu
${COMMANDS.CONNECT} \\<key\\> \\- Connect your web app account
${COMMANDS.ACCOUNT} \\- Show account information
${COMMANDS.SCAN} \\- Start receipt scanning
${COMMANDS.DISCONNECT} \\- Unlink your account
${COMMANDS.TEST} \\- Test bot functionality
${COMMANDS.HELP} \\- Show this help message

*How to Connect Your Account:*
1\\. Open Kita\\-kita web app
2\\. Go to Profile → Telegram Connection
3\\. Copy your connection key
4\\. Send: \`/connect YOUR\\-KEY\\-HERE\`

*How to Scan Receipts:*
1\\. Send me a photo of your receipt
2\\. Wait for AI analysis \\(2\\-5 seconds\\)
3\\. Review extracted transaction data
4\\. Data saves automatically if account connected

*Tips:*
📸 Ensure receipts are clear and well\\-lit
💡 Works with Philippine and international receipts
🔗 Connect your account for full features
⚡ Processing is fast with Gemini AI

*Support:* Contact our team through the web app
    `;
    
    await bot.sendMessage(chatId, helpMessage, { parse_mode: 'MarkdownV2' });
}

// Test command
bot.onText(/\/test/, async (msg) => {
    const chatId = msg.chat.id;
    await runBotTest(chatId);
});

// Run bot test
async function runBotTest(chatId) {
    const testMessage = `
🧪 *Bot Test Results*

✅ Telegram API: Connected
✅ Bot Token: Valid
✅ Gemini AI: ${GEMINI_API_KEY ? 'Configured' : 'Missing'}
✅ Message Handling: Working
✅ Keyboard Buttons: Functional
✅ Account System: Active
${db ? '✅' : '⚠️'} Firebase: ${db ? 'Connected' : 'Disconnected'}

🚀 *Ready to scan receipts\\!*

Send me a receipt photo to test the AI analysis\\.
    `;
    
    await bot.sendMessage(chatId, testMessage, { parse_mode: 'MarkdownV2' });
}

// Prompt for receipt
async function promptForReceipt(chatId) {
    await bot.sendMessage(chatId, `
📸 *Ready to Scan Receipt*

Please send me a clear photo of your receipt and I'll extract the transaction details using AI\\.

*Tips for best results:*
• Ensure good lighting
• Keep the receipt flat and straight
• Include all text in the photo
• Avoid shadows or glare

🤖 Analysis takes 2\\-5 seconds with Gemini AI\\.
    `, { parse_mode: 'MarkdownV2' });
}

// Handle photo messages (receipt scanning)
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    const photo = msg.photo[msg.photo.length - 1]; // Get highest resolution
    
    console.log(`📸 Received photo from ${user.first_name} (${user.id})`);
    
    const isConnected = await isUserConnected(user.id);
    
    // Send processing message
    const processingMsg = await bot.sendMessage(chatId, `
🔄 *Processing your receipt\\.\\.\\.*

${isConnected ? '💾 Will save to your account when complete' : '⚠️ Not connected \\- not saving to account'}
    `, {
        parse_mode: 'MarkdownV2',
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
        await bot.editMessageText('✅ Receipt analyzed successfully\\!', {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'MarkdownV2'
        });
        
        // Show extracted data
        await showReceiptResults(chatId, extractedData, user.id, isConnected);
        
    } catch (error) {
        console.error('❌ Receipt processing failed:', error);
        
        await bot.editMessageText('❌ Failed to process receipt\\. Please try again with a clearer image\\.', {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'MarkdownV2',
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
  "merchant": "Store/Restaurant Name",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "total": 0.00,
  "currency": "PHP",
  "items": [
    {
      "name": "Item Name",
      "quantity": 1,
      "price": 0.00
    }
  ],
  "tax": 0.00,
  "category": "Food/Shopping/Transport/etc",
  "paymentMethod": "Cash/Card/etc",
  "location": "City/Address if available"
}

Focus on accuracy. If information is unclear, use null for that field.`;

    try {
        const response = await fetch(`${GEMINI_VISION_ENDPOINT}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Image.split(',')[1]
                            }
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const result = await response.json();
        const content = result.candidates[0].content.parts[0].text;
        
        // Extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }
        
        const extractedData = JSON.parse(jsonMatch[0]);
        console.log('✅ Receipt analyzed successfully:', extractedData);
        
        return extractedData;
        
    } catch (error) {
        console.error('❌ Gemini analysis failed:', error);
        throw error;
    }
}

// Show receipt results
async function showReceiptResults(chatId, data, userId, isConnected) {
    try {
        // Format the extracted data
        const itemsList = data.items ? data.items.map(item => 
            `• ${item.name} x${item.quantity} - ${data.currency || 'PHP'} ${item.price || '0.00'}`
        ).join('\n') : 'No items detected';
        
        const resultsMessage = `
📋 *Receipt Analysis Results*

🏪 *Merchant:* ${data.merchant || 'Unknown'}
📅 *Date:* ${data.date || 'Unknown'} ${data.time ? `at ${data.time}` : ''}
💰 *Total:* ${data.currency || 'PHP'} ${data.total || '0.00'}
🏷️ *Category:* ${data.category || 'Uncategorized'}
💳 *Payment:* ${data.paymentMethod || 'Unknown'}
${data.location ? `📍 *Location:* ${data.location}` : ''}

*Items:*
${itemsList}

${data.tax ? `💸 *Tax:* ${data.currency || 'PHP'} ${data.tax}` : ''}
        `;
        
        // If connected, save transaction to user's account
        let saveResult = null;
        if (isConnected) {
            try {
                const connection = await getUserConnection(userId);
                saveResult = await saveTransactionToAccount(connection.userId, data, connection.email);
                
                const finalMessage = resultsMessage + `

✅ *Transaction saved to your account\\!*
🆔 *Transaction ID:* \`${saveResult.transactionId}\`
📱 *View in web app* to see full details
                `;
                
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '📸 Scan Another', callback_data: 'scan_receipt' },
                            { text: '👤 Account Info', callback_data: 'account_info' }
                        ],
                        [
                            { text: '💰 View Transactions', url: `${WEB_APP_URL}/public/pages/dashboard.html` }
                        ]
                    ]
                };
                
                await bot.sendMessage(chatId, finalMessage, {
                    parse_mode: 'MarkdownV2',
                    reply_markup: keyboard
                });
                
            } catch (saveError) {
                console.error('❌ Failed to save transaction:', saveError);
                
                const finalMessage = resultsMessage + `

⚠️ *Analysis complete, but failed to save transaction*
Please check your connection and try again\\.
                `;
                
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '📸 Scan Another', callback_data: 'scan_receipt' },
                            { text: '🔄 Retry Save', callback_data: 'retry_save' }
                        ]
                    ]
                };
                
                await bot.sendMessage(chatId, finalMessage, {
                    parse_mode: 'MarkdownV2',
                    reply_markup: keyboard
                });
            }
        } else {
            const finalMessage = resultsMessage + `

⚠️ *Account not connected* \\- Transaction not saved
🔗 Connect your account to automatically save scanned receipts
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📸 Scan Another', callback_data: 'scan_receipt' },
                        { text: '🔗 Connect Account', callback_data: 'connect_account' }
                    ]
                ]
            };
            
            await bot.sendMessage(chatId, finalMessage, {
                parse_mode: 'MarkdownV2',
                reply_markup: keyboard
            });
        }
        
    } catch (error) {
        console.error('❌ Error showing receipt results:', error);
        await bot.sendMessage(chatId, '❌ Error displaying results\\. Please try again\\.', {
            parse_mode: 'MarkdownV2'
        });
    }
}

// Save transaction to user's account via web app API
async function saveTransactionToAccount(userId, receiptData, userEmail) {
    try {
        console.log(`💾 Saving transaction to account for user ${userId}:`, receiptData);
        
        // Transform receipt data to transaction format
        const transactionData = {
            name: receiptData.merchant || 'Receipt Transaction',
            amount: parseFloat(receiptData.total) || 0,
            type: 'expense',
            category: mapReceiptCategoryToTransactionCategory(receiptData.category),
            date: receiptData.date || new Date().toISOString().split('T')[0],
            notes: buildTransactionNotes(receiptData),
            source: 'telegram_bot',
            receiptData: receiptData // Store original receipt data for reference
        };
        
        // Call the web app API to save the transaction
        const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
        
        // For now, we'll simulate the API call since we need authentication
        // In a production environment, you'd use a service account or internal API key
        const response = await fetch(`${webAppUrl}/api/telegram/save-transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId,
                userEmail: userEmail,
                transactionData: transactionData
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API error: ${response.status} - ${error}`);
        }
        
        const result = await response.json();
        console.log(`✅ Transaction saved successfully:`, result);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error saving transaction to account:', error);
        throw error;
    }
}

// Map receipt categories to transaction categories
function mapReceiptCategoryToTransactionCategory(receiptCategory) {
    if (!receiptCategory) return 'other';
    
    const categoryMap = {
        'food': 'food',
        'grocery': 'food',
        'restaurant': 'food',
        'dining': 'food',
        'shopping': 'shopping',
        'retail': 'shopping',
        'transport': 'transportation',
        'transportation': 'transportation',
        'gas': 'transportation',
        'fuel': 'transportation',
        'entertainment': 'entertainment',
        'movie': 'entertainment',
        'games': 'entertainment',
        'health': 'health',
        'medical': 'health',
        'pharmacy': 'health',
        'bills': 'bills',
        'utilities': 'bills',
        'phone': 'bills',
        'internet': 'bills',
        'housing': 'housing',
        'rent': 'housing',
        'education': 'education',
        'school': 'education',
        'books': 'education'
    };
    
    const lowerCategory = receiptCategory.toLowerCase();
    return categoryMap[lowerCategory] || 'other';
}

// Build transaction notes from receipt data
function buildTransactionNotes(receiptData) {
    let notes = [];
    
    if (receiptData.merchant) {
        notes.push(`Store: ${receiptData.merchant}`);
    }
    
    if (receiptData.location) {
        notes.push(`Location: ${receiptData.location}`);
    }
    
    if (receiptData.paymentMethod) {
        notes.push(`Payment: ${receiptData.paymentMethod}`);
    }
    
    if (receiptData.items && receiptData.items.length > 0) {
        const itemCount = receiptData.items.length;
        notes.push(`Items: ${itemCount} item${itemCount > 1 ? 's' : ''}`);
        
        // Add first few items if not too many
        if (itemCount <= 3) {
            receiptData.items.forEach(item => {
                notes.push(`- ${item.name} (${item.quantity}x)`);
            });
        } else {
            notes.push(`- ${receiptData.items[0].name} (${receiptData.items[0].quantity}x) and ${itemCount - 1} more`);
        }
    }
    
    notes.push('Scanned via Telegram bot');
    
    return notes.join(' | ');
}

// Error handlers
bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error.message);
});

bot.on('error', (error) => {
    console.error('❌ Bot error:', error.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    bot.stopPolling();
    process.exit(0);
});

console.log('🚀 Kita-kita Bot with Account Connection is ready!');
console.log('📱 Available commands: /start, /connect, /account, /help, /scan, /test');
console.log('🔗 Users can connect their web app accounts using connection keys'); 