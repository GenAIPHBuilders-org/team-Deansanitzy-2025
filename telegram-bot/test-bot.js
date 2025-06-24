const TelegramBot = require('node-telegram-bot-api');

// Load environment variables
require('dotenv').config();

// Telegram Bot Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is required in environment variables');
    process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Test Bot is starting...');

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
                
            case 'ipon_coach':
                await handleIponCoach(chatId, userId);
                break;
                
            case 'gastos_guardian':
                await handleGastosGuardian(chatId, userId);
                break;
                
            case 'pera_planner':
                await handlePeraPlanner(chatId, userId);
                break;
                
            case 'link_account':
                await bot.sendMessage(chatId, '🔗 Account linking feature will be available once Firebase is properly configured!');
                break;
                
            case 'show_help':
                await bot.sendMessage(chatId, '❓ Type /help to see all available commands and usage instructions.');
                break;
                
            case 'back_to_menu':
                // Resend the main menu by calling /start handler
                const startMsg = { chat: { id: chatId }, from: callbackQuery.from };
                await bot.onText(/\/start/, () => {}); // This will trigger the start handler
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

// Handle Ipon Coach AI Agent
async function handleIponCoach(chatId, userId) {
    const message = `
💰 *Ipon Coach \\- Your Filipino Savings Assistant*

Kumusta\\! I'm your personal Ipon Coach, designed to help you save money the Filipino way\\!

🇵🇭 *What I can do:*
• Analyze your spending patterns with cultural context
• Provide personalized savings strategies using Filipino methods
• Give you daily financial wisdom and motivation
• Create achievable savings goals based on your lifestyle

🌐 *To access full features:*
1\\. Open your browser
2\\. Go to: \`http://127\\.0\\.0\\.1:5500/agents/iponCoach\\.html\`
3\\. Enjoy the full AI experience\\!
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '💡 Get Quick Tip', callback_data: 'ipon_quick_tip' },
                { text: '🎯 Set Savings Goal', callback_data: 'ipon_set_goal' }
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

// Handle Gastos Guardian AI Agent
async function handleGastosGuardian(chatId, userId) {
    const message = `
🛡️ *Gastos Guardian \\- Your Expense Tracking Assistant*

Hello\\! I'm Gastos Guardian, your smart expense tracker and spending analyzer\\!

💡 *What I can do:*
• Track and categorize your expenses automatically
• Identify spending leaks and money drains
• Provide Filipino\\-style "tipid" recommendations
• Create visual spending breakdowns and charts

🌐 *To access full features:*
1\\. Open your browser
2\\. Go to: \`http://127\\.0\\.0\\.1:5500/agents/gastosGuardian\\.html\`
3\\. View detailed expense analysis\\!
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '💸 Find Spending Leaks', callback_data: 'gastos_find_leaks' },
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

// Handle Pera Planner AI Agent
async function handlePeraPlanner(chatId, userId) {
    const message = `
🗺️ *Pera Planner \\- Your Financial Roadmap Architect*

Mabuhay\\! I'm Pera Planner, your long\\-term financial strategist and life planner\\!

🎯 *What I can do:*
• Create personalized financial roadmaps from today to retirement
• Plan for major life events \\(wedding, house, education\\)
• Balance personal goals with Filipino family obligations
• Provide investment and career guidance

🌐 *To access full features:*
1\\. Open your browser
2\\. Go to: \`http://127\\.0\\.0\\.1:5500/agents/peraPlanner\\.html\`
3\\. Create your financial roadmap\\!
    `;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🎯 Quick Goal Check', callback_data: 'pera_goal_check' },
                { text: '📊 Life Stage Tips', callback_data: 'pera_life_tips' }
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

console.log('✅ Test Bot is running!');
console.log('🤖 Send /start to begin using the bot'); 