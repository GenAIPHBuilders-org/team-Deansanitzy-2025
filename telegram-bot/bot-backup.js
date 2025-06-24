const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Import Firebase Admin for backend operations
const admin = require('firebase-admin');

// Load environment variables
require('dotenv').config();

// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

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

// User session storage (in production, use Redis or database)
const userSessions = new Map();

console.log('🤖 Kita-kita Receipt Bot is starting...');

// Bot Commands
const COMMANDS = {
    START: '/start',
    HELP: '/help',
    SCAN: '/scan',
    BALANCE: '/balance',
    TRANSACTIONS: '/transactions',
    LINK: '/link',
    UNLINK: '/unlink'
};

// Welcome message and commands setup
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    console.log(`👋 New user started bot: ${user.first_name} (${user.id})`);
    
    const welcomeMessage = `
🎉 Welcome to *Kita\\-kita AI Assistant*\\! 

I'm your personal Filipino financial assistant\\. Choose what you'd like to do:

📸 *Send Receipt* \\- Log transactions by scanning receipts
🤖 *AI Financial Agents* \\- Get personalized financial insights

*Choose an AI Agent:*
💰 *Ipon Coach* \\- Your savings assistant with Filipino wisdom
🛡️ *Gastos Guardian* \\- Smart expense tracking and analysis  
🗺️ *Pera Planner* \\- Long\\-term financial roadmap planner

🔗 *Link Account* \\- Connect to your Kita\\-kita web app
❓ *Help* \\- Learn how to use all features

🚀 *Quick Start:* Send a receipt photo or choose an AI agent below\\!
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📸 Send Receipt', callback_data: 'scan_receipt' }
            ],
            [
                { text: '💰 Ipon Coach', callback_data: 'ipon_coach' },
                { text: '🛡️ Gastos Guardian', callback_data: 'gastos_guardian' }
            ],
            [
                { text: '🗺️ Pera Planner', callback_data: 'pera_planner' }
            ],
            [
                { text: '🔗 Link Account', callback_data: 'link_account' },
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
🤖 *Kita\\-kita AI Assistant Help*

*Receipt Scanning:*
📸 Send me a photo of your receipt and I'll extract transaction details using AI

*AI Financial Agents:*
💰 *Ipon Coach* \\- Get personalized savings advice and Filipino financial wisdom
🛡️ *Gastos Guardian* \\- Analyze spending patterns and find money leaks
🗺️ *Pera Planner* \\- Create long\\-term financial roadmaps and investment strategies

*Commands:*
${COMMANDS.START} \\- Main menu
${COMMANDS.SCAN} \\- Manual scan prompt
${COMMANDS.BALANCE} \\- View account balance
${COMMANDS.TRANSACTIONS} \\- Recent transactions
${COMMANDS.LINK} \\- Link Kita\\-kita account

*Tips:*
📸 Make sure receipts are clear and well\\-lit
💡 Link your account for personalized AI insights
🔗 Web app integration for full features
⚡ All AI analysis happens in real\\-time

Need more help? Contact support in the Kita\\-kita app\\!
    `;
    
    await bot.sendMessage(chatId, helpMessage, { parse_mode: 'MarkdownV2' });
});

// Handle text messages (for link codes and commands)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    
    // Skip if not a text message or if it's a command
    if (!text || text.startsWith('/')) {
        return;
    }
    
    // Check if user is awaiting link code
    if (userSessions.get(`${userId}_awaiting_code`)) {
        const code = text.trim().toUpperCase();
        
        // Validate code format (6 characters, alphanumeric)
        if (!/^[A-Z0-9]{6}$/.test(code)) {
            await bot.sendMessage(chatId, '❌ Please enter a valid 6-character code (letters and numbers only).');
            return;
        }
        
        await processLinkCode(chatId, userId, code);
        return;
    }
    
    // If no specific context, provide general help
    await bot.sendMessage(chatId, '❓ I didn\'t understand that. Send /help for available commands or send me a receipt photo to scan!');
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
        
        // Show extracted data with confirmation
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
- Use PHP as currency for Philippine receipts

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
        ? data.items.map(item => `• ${item.name}: ₱${item.price}`).join('\n')
        : 'No individual items detected';
    
    const resultMessage = `
📋 *Receipt Analysis Results*

🏪 *Merchant:* ${data.merchant || data.name || 'Unknown'}
💰 *Amount:* ₱${data.amount || data.total || '0.00'}
📅 *Date:* ${data.date || 'Today'}
🗂️ *Category:* ${data.category || 'other'}
📝 *Type:* ${data.type || 'expense'}

*Items:*
${itemsList}

${data.notes ? `*Notes:* ${data.notes}` : ''}

Please review the details above\\. Are they correct?
    `;
    
    // Store transaction data in session
    userSessions.set(`${userId}_pending_transaction`, data);
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ Confirm & Save', callback_data: 'confirm_transaction' },
                { text: '✏️ Edit Details', callback_data: 'edit_transaction' }
            ],
            [
                { text: '❌ Cancel', callback_data: 'cancel_transaction' }
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
                
            case 'link_account':
                await handleLinkAccount(chatId, userId);
                break;
                
            case 'view_balance':
                await handleViewBalance(chatId, userId);
                break;
                
            case 'view_transactions':
                await handleViewTransactions(chatId, userId);
                break;
                
            case 'show_help':
                await bot.sendMessage(chatId, '❓ Type /help to see all available commands and usage instructions.');
                break;
                
            case 'ipon_coach':
                await handleIponCoach(chatId, userId);
                break;
                
            case 'gastos_guardian':
                await handleGastosGuardian(chatId, userId);
                break;
                
            case 'pera_planner':
                await handlePeraPlanner(chatId, userId);
                break;
                
            case 'confirm_transaction':
                await handleConfirmTransaction(chatId, userId);
                break;
                
            case 'edit_transaction':
                await handleEditTransaction(chatId, userId);
                break;
                
            case 'cancel_transaction':
                userSessions.delete(`${userId}_pending_transaction`);
                await bot.sendMessage(chatId, '❌ Transaction cancelled. Send another receipt to try again!');
                break;
                
            case 'generate_link_code':
                await handleGenerateLinkCode(chatId, userId);
                break;
                
            case 'enter_link_code':
                await handleEnterLinkCode(chatId, userId);
                break;
                
            case 'cancel_linking':
                userSessions.delete(`${userId}_awaiting_code`);
                await bot.sendMessage(chatId, '❌ Linking cancelled.');
                break;
                
            case 'ipon_quick_tip':
                await handleIponQuickTip(chatId, userId);
                break;
                
            case 'ipon_set_goal':
                await handleIponSetGoal(chatId, userId);
                break;
                
            case 'gastos_find_leaks':
                await handleGastosFindLeaks(chatId, userId);
                break;
                
            case 'gastos_tipid_tips':
                await handleGastosTipidTips(chatId, userId);
                break;
                
            case 'pera_goal_check':
                await handlePeraGoalCheck(chatId, userId);
                break;
                
            case 'pera_life_tips':
                await handlePeraLifeTips(chatId, userId);
                break;
                
            case 'back_to_menu':
                // Resend the main menu
                const welcomeMessage = `
🎉 Welcome back to *Kita\\-kita AI Assistant*\\! 

Choose what you'd like to do:

📸 *Send Receipt* \\- Log transactions by scanning receipts
🤖 *AI Financial Agents* \\- Get personalized financial insights

*Choose an AI Agent:*
💰 *Ipon Coach* \\- Your savings assistant with Filipino wisdom
🛡️ *Gastos Guardian* \\- Smart expense tracking and analysis  
🗺️ *Pera Planner* \\- Long\\-term financial roadmap planner
                `;
                
                const mainKeyboard = {
                    inline_keyboard: [
                        [
                            { text: '📸 Send Receipt', callback_data: 'scan_receipt' }
                        ],
                        [
                            { text: '💰 Ipon Coach', callback_data: 'ipon_coach' },
                            { text: '🛡️ Gastos Guardian', callback_data: 'gastos_guardian' }
                        ],
                        [
                            { text: '🗺️ Pera Planner', callback_data: 'pera_planner' }
                        ],
                        [
                            { text: '🔗 Link Account', callback_data: 'link_account' },
                            { text: '❓ Help', callback_data: 'show_help' }
                        ]
                    ]
                };
                
                await bot.sendMessage(chatId, welcomeMessage, {
                    parse_mode: 'MarkdownV2',
                    reply_markup: mainKeyboard
                });
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

// Handle account linking
async function handleLinkAccount(chatId, userId) {
    try {
        const message = `
🔗 *Link Your Kita\\-kita Account*

I'll help you connect your Telegram to your Kita\\-kita account\\. Please choose how you want to proceed:

*Option 1: Generate Link Code*
I'll create a code for you to enter in the Kita\\-kita app\\.

*Option 2: Enter Code from App*
If you already have a code from the app, you can enter it here\\.
        `;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔢 Generate Code', callback_data: 'generate_link_code' },
                    { text: '⌨️ Enter Code', callback_data: 'enter_link_code' }
                ],
                [
                    { text: '❌ Cancel', callback_data: 'cancel_linking' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'MarkdownV2',
            reply_markup: keyboard
        });
        
    } catch (error) {
        console.error('❌ Error in handleLinkAccount:', error);
        await bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
}

// Handle link code entry
async function handleEnterLinkCode(chatId, userId) {
    userSessions.set(`${userId}_awaiting_code`, true);
    
    const message = `
🔗 *Enter Link Code*

Please enter the 6\\-character code from your Kita\\-kita app:

📱 *Steps:*
1\\. Open Kita\\-kita app
2\\. Go to Settings \\> Telegram Integration
3\\. Click "Connect Telegram"
4\\. Copy the code and send it here

⏰ Send the code within the next 2 minutes\\.
    `;
    
    await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    
    // Set timeout for code entry
    setTimeout(() => {
        if (userSessions.get(`${userId}_awaiting_code`)) {
            userSessions.delete(`${userId}_awaiting_code`);
            bot.sendMessage(chatId, '⏰ Code entry timeout. Please try again with /link');
        }
    }, 2 * 60 * 1000); // 2 minutes
}

// Handle incoming link codes
async function processLinkCode(chatId, userId, code) {
    try {
        // Check if code exists and is valid
        const codeDoc = await db.collection('link_codes').doc(code.toUpperCase()).get();
        
        if (!codeDoc.exists) {
            await bot.sendMessage(chatId, '❌ Invalid code. Please check and try again.');
            return;
        }
        
        const codeData = codeDoc.data();
        
        // Check if code is expired
        if (new Date() > codeData.expiresAt.toDate()) {
            await bot.sendMessage(chatId, '⏰ Code has expired. Please generate a new one in the app.');
            return;
        }
        
        // Check if code is already used
        if (codeData.used) {
            await bot.sendMessage(chatId, '❌ Code has already been used.');
            return;
        }
        
        // Get user info from Telegram
        const user = await bot.getChat(userId);
        
        // Create link in Firestore
        const linkData = {
            userId: codeData.userId,
            telegramUserId: userId.toString(),
            telegramUsername: user.username || null,
            telegramFirstName: user.first_name || null,
            linkedAt: admin.firestore.FieldValue.serverTimestamp(),
            active: true
        };
        
        // Save the link
        await db.collection('telegram_links').doc(codeData.userId).set(linkData);
        
        // Mark code as used
        await db.collection('link_codes').doc(code.toUpperCase()).update({
            used: true,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
            telegramUserId: userId.toString()
        });
        
        // Clear session
        userSessions.delete(`${userId}_awaiting_code`);
        
        // Send success message
        const successMessage = `
✅ *Account Linked Successfully\\!*

Your Telegram is now connected to your Kita\\-kita account\\!

*What you can do now:*
📸 Send receipt photos for instant scanning
🤖 AI\\-powered transaction extraction
🔄 Automatic sync with your account
📊 View balance and recent transactions

🚀 *Try it now:* Send me a photo of a receipt to get started\\!
        `;
        
        await bot.sendMessage(chatId, successMessage, { parse_mode: 'MarkdownV2' });
        
        console.log(`✅ Successfully linked Telegram user ${userId} to Kita-kita user ${codeData.userId}`);
        
    } catch (error) {
        console.error('❌ Error processing link code:', error);
        await bot.sendMessage(chatId, '❌ Failed to link account. Please try again.');
    }
}

// Generate 6-digit link code
function generateLinkCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Handle generate link code (bot creates code for user to enter in app)
async function handleGenerateLinkCode(chatId, userId) {
    try {
        // Generate code
        const linkCode = generateLinkCode();
        
        // Get user info
        const user = await bot.getChat(userId);
        
        // Store code in Firestore for the web app to pick up
        const codeData = {
            telegramUserId: userId.toString(),
            telegramUsername: user.username || null,
            telegramFirstName: user.first_name || null,
            code: linkCode,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            used: false,
            generatedByBot: true
        };
        
        await db.collection('telegram_generated_codes').doc(linkCode).set(codeData);
        
        const message = `
🔗 *Your Link Code*

Here's your code to enter in the Kita\\-kita app:

\`${linkCode}\`

📱 *Steps:*
1\\. Open the Kita\\-kita app
2\\. Go to Settings \\> Telegram Integration  
3\\. Click "Connect Telegram"
4\\. Enter this code: \`${linkCode}\`

⏰ This code expires in 10 minutes\\.

I'll notify you once the linking is complete\\!
        `;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
        
        // Store in session for potential cleanup
        userSessions.set(`${userId}_generated_code`, linkCode);
        
        // Set cleanup timer
        setTimeout(() => {
            userSessions.delete(`${userId}_generated_code`);
        }, 10 * 60 * 1000);
        
        console.log(`🔢 Generated link code ${linkCode} for Telegram user ${userId}`);
        
    } catch (error) {
        console.error('❌ Error generating link code:', error);
        await bot.sendMessage(chatId, '❌ Failed to generate link code. Please try again.');
    }
}

// Handle confirm transaction
async function handleConfirmTransaction(chatId, userId) {
    const transactionData = userSessions.get(`${userId}_pending_transaction`);
    
    if (!transactionData) {
        await bot.sendMessage(chatId, '❌ No pending transaction found. Please scan a new receipt.');
        return;
    }
    
    try {
        // Check if user is linked
        const linkedUserId = await getLinkedUserId(userId);
        
        if (!linkedUserId) {
            await bot.sendMessage(chatId, '⚠️ Account not linked. Saving locally for now. Use /link to connect your account.');
            // For now, just confirm without saving to Firestore
        } else {
            // Save to Firestore
            await saveTransactionToFirestore(linkedUserId, transactionData);
        }
        
        // Clear session
        userSessions.delete(`${userId}_pending_transaction`);
        
        const successMessage = `
✅ *Transaction Saved Successfully\\!*

💰 ₱${transactionData.amount || transactionData.total} \\- ${transactionData.name || transactionData.merchant}
📅 ${transactionData.date}

${linkedUserId ? '🔗 Synced to your Kita\\-kita account' : '📱 Saved locally \\(link account to sync\\)'}

Send another receipt or use /balance to check your summary\\!
        `;
        
        await bot.sendMessage(chatId, successMessage, { parse_mode: 'MarkdownV2' });
        
    } catch (error) {
        console.error('❌ Save transaction failed:', error);
        await bot.sendMessage(chatId, '❌ Failed to save transaction. Please try again.');
    }
}

// Save transaction to Firestore
async function saveTransactionToFirestore(userId, transactionData) {
    const docRef = db.collection('users').doc(userId).collection('transactions').doc();
    
    const finalTransactionData = {
        ...transactionData,
        id: docRef.id,
        userId: userId,
        source: 'telegram_bot',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        telegramProcessed: true
    };
    
    await docRef.set(finalTransactionData);
    console.log('✅ Transaction saved to Firestore:', docRef.id);
    
    return docRef.id;
}

// Get linked user ID from Telegram user ID
async function getLinkedUserId(telegramUserId) {
    try {
        const linkDoc = await db.collection('telegram_links').doc(telegramUserId.toString()).get();
        
        if (linkDoc.exists) {
            return linkDoc.data().userId;
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error getting linked user:', error);
        return null;
    }
}

// Handle edit transaction (simplified for now)
async function handleEditTransaction(chatId, userId) {
    await bot.sendMessage(chatId, '✏️ Edit feature coming soon! For now, please scan a new receipt or manually adjust in the app.');
}

// Handle view balance
async function handleViewBalance(chatId, userId) {
    const linkedUserId = await getLinkedUserId(userId);
    
    if (!linkedUserId) {
        await bot.sendMessage(chatId, '⚠️ Please link your account first using /link to view your balance.');
        return;
    }
    
    // This would fetch actual balance from Firestore
    await bot.sendMessage(chatId, '💰 Balance feature coming soon! Check the Kita-kita app for now.');
}

// Handle view transactions
async function handleViewTransactions(chatId, userId) {
    const linkedUserId = await getLinkedUserId(userId);
    
    if (!linkedUserId) {
        await bot.sendMessage(chatId, '⚠️ Please link your account first using /link to view transactions.');
        return;
    }
    
    // This would fetch recent transactions from Firestore
    await bot.sendMessage(chatId, '📋 Recent transactions feature coming soon! Check the Kita-kita app for now.');
}

// Handle Ipon Coach AI Agent
async function handleIponCoach(chatId, userId) {
    try {
        const linkedUserId = await getLinkedUserId(userId);
        
        let message = `
💰 *Ipon Coach \\- Your Filipino Savings Assistant*

Kumusta\\! I'm your personal Ipon Coach, designed to help you save money the Filipino way\\!

🇵🇭 *What I can do:*
• Analyze your spending patterns with cultural context
• Provide personalized savings strategies using Filipino methods
• Give you daily financial wisdom and motivation
• Create achievable savings goals based on your lifestyle

📊 *AI\\-Powered Insights:*
• Smart analysis of your financial habits
• Filipino\\-inspired money\\-saving techniques
• Personalized "tipid" tips and tricks
• Emergency fund building strategies
        `;
        
        if (linkedUserId) {
            message += `\n✅ *Your account is linked\\!* I can provide personalized advice based on your actual financial data\\.`;
        } else {
            message += `\n⚠️ *Link your account* for personalized insights based on your real spending data\\.`;
        }
        
        message += `\n\n🌐 *To access full features:*\n1\\. Open your browser\n2\\. Go to: \`http://127\\.0\\.0\\.1:5500/agents/iponCoach\\.html\`\n3\\. Enjoy the full AI experience\\!`;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '💡 Get Quick Tip', callback_data: 'ipon_quick_tip' },
                    { text: '🎯 Set Savings Goal', callback_data: 'ipon_set_goal' }
                ],
                [
                    { text: '🔗 Link Account', callback_data: 'link_account' },
                    { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'MarkdownV2',
            reply_markup: keyboard
        });
        
    } catch (error) {
        console.error('❌ Error in handleIponCoach:', error);
        await bot.sendMessage(chatId, '❌ Something went wrong accessing Ipon Coach. Please try again.');
    }
}

// Handle Gastos Guardian AI Agent
async function handleGastosGuardian(chatId, userId) {
    try {
        const linkedUserId = await getLinkedUserId(userId);
        
        let message = `
🛡️ *Gastos Guardian \\- Your Expense Tracking Assistant*

Hello\\! I'm Gastos Guardian, your smart expense tracker and spending analyzer\\!

💡 *What I can do:*
• Track and categorize your expenses automatically
• Identify spending leaks and money drains
• Provide Filipino\\-style "tipid" recommendations
• Create visual spending breakdowns and charts

🔍 *AI Analysis Features:*
• Smart expense categorization
• Spending pattern recognition
• Budget optimization suggestions
• Filipino cultural spending insights
        `;
        
        if (linkedUserId) {
            message += `\n✅ *Your account is linked\\!* I'm actively monitoring your expenses and finding ways to save\\.`;
        } else {
            message += `\n⚠️ *Link your account* to unlock full expense tracking and analysis features\\.`;
        }
        
        message += `\n\n🌐 *To access full features:*\n1\\. Open your browser\n2\\. Go to: \`http://127\\.0\\.0\\.1:5500/agents/gastosGuardian\\.html\`\n3\\. View detailed expense analysis\\!`;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '💸 Find Spending Leaks', callback_data: 'gastos_find_leaks' },
                    { text: '💰 Tipid Tips', callback_data: 'gastos_tipid_tips' }
                ],
                [
                    { text: '🔗 Link Account', callback_data: 'link_account' },
                    { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'MarkdownV2',
            reply_markup: keyboard
        });
        
    } catch (error) {
        console.error('❌ Error in handleGastosGuardian:', error);
        await bot.sendMessage(chatId, '❌ Something went wrong accessing Gastos Guardian. Please try again.');
    }
}

// Handle Pera Planner AI Agent
async function handlePeraPlanner(chatId, userId) {
    try {
        const linkedUserId = await getLinkedUserId(userId);
        
        let message = `
🗺️ *Pera Planner \\- Your Financial Roadmap Architect*

Mabuhay\\! I'm Pera Planner, your long\\-term financial strategist and life planner\\!

🎯 *What I can do:*
• Create personalized financial roadmaps from today to retirement
• Plan for major life events \\(wedding, house, education\\)
• Balance personal goals with Filipino family obligations
• Provide investment and career guidance

📈 *Strategic Planning Features:*
• Life\\-stage financial planning
• Investment portfolio recommendations
• Career path simulation and growth projections
• Filipino\\-context life balance optimization
        `;
        
        if (linkedUserId) {
            message += `\n✅ *Your account is linked\\!* I can create detailed financial roadmaps based on your current situation\\.`;
        } else {
            message += `\n⚠️ *Link your account* for comprehensive financial planning based on your real data\\.`;
        }
        
        message += `\n\n🌐 *To access full features:*\n1\\. Open your browser\n2\\. Go to: \`http://127\\.0\\.0\\.1:5500/agents/peraPlanner\\.html\`\n3\\. Create your financial roadmap\\!`;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🎯 Quick Goal Check', callback_data: 'pera_goal_check' },
                    { text: '📊 Life Stage Tips', callback_data: 'pera_life_tips' }
                ],
                [
                    { text: '🔗 Link Account', callback_data: 'link_account' },
                    { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'MarkdownV2',
            reply_markup: keyboard
        });
        
    } catch (error) {
        console.error('❌ Error in handlePeraPlanner:', error);
        await bot.sendMessage(chatId, '❌ Something went wrong accessing Pera Planner. Please try again.');
    }
}

// Quick action handlers for AI agents

// Ipon Coach Quick Actions
async function handleIponQuickTip(chatId, userId) {
    const tips = [
        {
            tip: "Try the 'Alkansya Challenge' - save all your loose change in a traditional coin bank!",
            savings: "₱100-300 per week"
        },
        {
            tip: "Use the '50-30-20 Filipino Rule': 50% needs, 30% wants, 20% savings and family support",
            savings: "Structured budgeting"
        },
        {
            tip: "Practice 'Baon Strategy' - bring home-cooked meals instead of buying food outside",
            savings: "₱200-500 per day"
        },
        {
            tip: "Start a 'Paluwagan' with friends or family - forced savings with social accountability",
            savings: "Consistent monthly savings"
        },
        {
            tip: "Apply 'Tawad Power' - always negotiate prices, especially in markets and local shops",
            savings: "10-30% on purchases"
        }
    ];
    
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    
    const message = `
💡 *Ipon Coach Quick Tip*

${randomTip.tip}

💰 *Potential Savings:* ${randomTip.savings}

🎯 *Filipino Wisdom:* "Ang pag-iimpok ay parang pagtatanim - maliit sa umpisa, pero lumalaki sa paglipas ng panahon!"

Want more personalized tips? Open the full Ipon Coach on your browser at \`http://127.0.0.1:5500/agents/iponCoach.html\`
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔄 Another Tip', callback_data: 'ipon_quick_tip' },
                { text: '🎯 Set Goal', callback_data: 'ipon_set_goal' }
            ],
            [
                { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
    });
}

async function handleIponSetGoal(chatId, userId) {
    const goals = [
        { name: "Emergency Fund", amount: "₱50,000", timeline: "6 months", strategy: "Save ₱300/day using Alkansya method" },
        { name: "Vacation Fund", amount: "₱30,000", timeline: "4 months", strategy: "Use Paluwagan with friends" },
        { name: "Phone Upgrade", amount: "₱25,000", timeline: "3 months", strategy: "Baon Challenge + weekend sideline" },
        { name: "Investment Capital", amount: "₱100,000", timeline: "12 months", strategy: "50-30-20 rule with strict discipline" }
    ];
    
    const randomGoal = goals[Math.floor(Math.random() * goals.length)];
    
    const message = `
🎯 *Suggested Savings Goal*

**Goal:** ${randomGoal.name}
**Target:** ${randomGoal.amount}
**Timeline:** ${randomGoal.timeline}

📋 **Strategy:** ${randomGoal.strategy}

💪 **Filipino Motivation:** "Kapag may tiyaga, may nilaga!"

For detailed goal tracking and personalized roadmaps, visit: \`http://127.0.0.1:5500/agents/iponCoach.html\`
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔄 Another Goal', callback_data: 'ipon_set_goal' },
                { text: '💡 Get Tip', callback_data: 'ipon_quick_tip' }
            ],
            [
                { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
    });
}

// Gastos Guardian Quick Actions
async function handleGastosFindLeaks(chatId, userId) {
    const leaks = [
        {
            category: "Food Delivery",
            leak: "Frequent food delivery orders",
            solution: "Try meal prepping on Sundays - save ₱200-500/day",
            impact: "High"
        },
        {
            category: "Transportation",
            leak: "Taking Grab/taxi for short distances",
            solution: "Use jeepney + walk combo for nearby destinations",
            impact: "Medium"
        },
        {
            category: "Subscriptions",
            leak: "Unused streaming services",
            solution: "Audit and cancel unused subscriptions monthly",
            impact: "Low but consistent"
        },
        {
            category: "Impulse Shopping",
            leak: "Buying items without planning",
            solution: "Use 24-hour rule - wait before purchasing wants",
            impact: "High"
        }
    ];
    
    const randomLeak = leaks[Math.floor(Math.random() * leaks.length)];
    
    const message = `
💸 *Potential Spending Leak Detected*

**Category:** ${randomLeak.category}
**Issue:** ${randomLeak.leak}
**Impact:** ${randomLeak.impact}

🛡️ **Guardian's Solution:** ${randomLeak.solution}

💡 **Tipid Tip:** Small leaks sink great ships - even ₱50/day adds up to ₱18,000/year!

For detailed expense analysis, visit: \`http://127.0.0.1:5500/agents/gastosGuardian.html\`
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔍 Find Another Leak', callback_data: 'gastos_find_leaks' },
                { text: '💰 Tipid Tips', callback_data: 'gastos_tipid_tips' }
            ],
            [
                { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
    });
}

async function handleGastosTipidTips(chatId, userId) {
    const tipidTips = [
        {
            category: "Food",
            tip: "Cook 'ulam' in bulk and freeze portions - saves time and money!",
            savings: "₱300-500/week"
        },
        {
            category: "Transportation",
            tip: "Use 'sakay.ph' app to find cheapest route combinations",
            savings: "₱50-150/day"
        },
        {
            category: "Shopping",
            tip: "Shop at public markets in the morning for fresh, cheaper produce",
            savings: "20-40% on groceries"
        },
        {
            category: "Utilities",
            tip: "Unplug appliances when not in use - 'phantom loads' add up!",
            savings: "₱200-500/month"
        },
        {
            category: "Entertainment",
            tip: "Enjoy free weekend activities - parks, museums, festivals!",
            savings: "₱500-1000/weekend"
        }
    ];
    
    const randomTip = tipidTips[Math.floor(Math.random() * tipidTips.length)];
    
    const message = `
💰 *Guardian's Tipid Tip*

**Category:** ${randomTip.category}
**Tip:** ${randomTip.tip}
**Potential Savings:** ${randomTip.savings}

🇵🇭 **Filipino Wisdom:** "Ang marunong magtipid, hindi nababaon sa utang!"

For more personalized tipid strategies, check: \`http://127.0.0.1:5500/agents/gastosGuardian.html\`
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔄 Another Tip', callback_data: 'gastos_tipid_tips' },
                { text: '🔍 Find Leaks', callback_data: 'gastos_find_leaks' }
            ],
            [
                { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
    });
}

// Pera Planner Quick Actions
async function handlePeraGoalCheck(chatId, userId) {
    const ageRanges = [
        {
            age: "20s",
            goals: ["Build emergency fund", "Start investing", "Develop career skills"],
            focus: "Foundation building and learning"
        },
        {
            age: "30s", 
            goals: ["House down payment", "Family planning", "Increase investments"],
            focus: "Major life decisions and wealth building"
        },
        {
            age: "40s",
            goals: ["Children's education fund", "Expand investments", "Career peak"],
            focus: "Peak earning and family obligations"
        },
        {
            age: "50s+",
            goals: ["Retirement planning", "Health insurance", "Legacy planning"],
            focus: "Preparing for retirement and succession"
        }
    ];
    
    const randomRange = ageRanges[Math.floor(Math.random() * ageRanges.length)];
    
    const message = `
🎯 *Life Stage Goal Check \\(${randomRange.age}\\)*

**Priority Goals:**
${randomRange.goals.map(goal => `• ${goal}`).join('\n')}

**Life Focus:** ${randomRange.focus}

💡 **Planner's Advice:** Balance personal ambitions with Filipino family values - success includes helping those who helped you grow!

For your personalized roadmap, visit: \`http://127.0.0.1:5500/agents/peraPlanner.html\`
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔄 Other Life Stage', callback_data: 'pera_goal_check' },
                { text: '📊 Life Tips', callback_data: 'pera_life_tips' }
            ],
            [
                { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
    });
}

async function handlePeraLifeTips(chatId, userId) {
    const lifeTips = [
        {
            area: "Career Growth",
            tip: "Invest 10% of income in skills development - courses, certifications, networking",
            impact: "Long-term earning potential"
        },
        {
            area: "Family Balance",
            tip: "Set aside 15-20% for family support, but don't sacrifice your own future",
            impact: "Sustainable family relationships"
        },
        {
            area: "Investment Timing",
            tip: "Start investing early, even with small amounts - time is your biggest asset",
            impact: "Compound growth advantage"
        },
        {
            area: "Risk Management",
            tip: "Get health insurance before you need it - medical emergencies can drain savings",
            impact: "Financial protection"
        },
        {
            area: "Filipino Context",
            tip: "Plan for 'pasalip' and family events - budget for cultural obligations",
            impact: "Realistic financial planning"
        }
    ];
    
    const randomTip = lifeTips[Math.floor(Math.random() * lifeTips.length)];
    
    const message = `
📊 *Pera Planner Life Tip*

**Area:** ${randomTip.area}
**Advice:** ${randomTip.tip}
**Impact:** ${randomTip.impact}

🗺️ **Strategic Insight:** Life is a marathon, not a sprint - plan for the long haul while enjoying the journey!

For comprehensive life planning, explore: \`http://127.0.0.1:5500/agents/peraPlanner.html\`
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔄 Another Tip', callback_data: 'pera_life_tips' },
                { text: '🎯 Goal Check', callback_data: 'pera_goal_check' }
            ],
            [
                { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
    });
}

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
console.log('🤖 Send /start to begin using the bot');

module.exports = bot; 