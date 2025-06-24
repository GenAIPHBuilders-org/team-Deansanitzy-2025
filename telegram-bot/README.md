# Kita-kita AI Assistant Telegram Bot 🤖

A comprehensive Telegram bot that integrates with your Kita-kita financial app to scan receipts and access AI-powered financial agents for personalized financial guidance.

## Features

### 📸 Receipt Scanning
- Send receipt photos directly to the bot
- AI-powered text extraction using Gemini Pro Vision
- Auto-sync transactions to your Kita-kita account

### 🤖 AI Financial Agents
- **💰 Ipon Coach**: Filipino savings assistant with cultural financial wisdom
- **🛡️ Gastos Guardian**: Smart expense tracking and spending analysis
- **🗺️ Pera Planner**: Long-term financial roadmap and investment planning

### 🔗 Integration Features
- Account linking with your Kita-kita web app
- Seamless access to all AI agents via web interface
- Real-time sync between Telegram and web app
- Mobile-friendly interface for all devices
- Secure Firebase authentication and data handling

## Setup Instructions

### 1. Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Choose a name (e.g., "Kita-kita Receipt Bot")
4. Choose a username (e.g., "kitakita_receipt_bot")
5. Copy the bot token provided

### 2. Get Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/project/deansanitzy/settings/serviceaccounts/adminsdk)
2. Click "Generate new private key"
3. Download the JSON file
4. Extract the following values:
   - `project_id`
   - `private_key`
   - `client_email`

### 3. Environment Setup

1. Copy `env.example` to `.env`:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` with your credentials:
   ```bash
   TELEGRAM_BOT_TOKEN=1234567890:YOUR_BOT_TOKEN_HERE
   GEMINI_API_KEY=your_gemini_api_key_here
   FIREBASE_PROJECT_ID=deansanitzy
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----"
   FIREBASE_CLIENT_EMAIL=your_service_account@deansanitzy.iam.gserviceaccount.com
   WEB_APP_URL=https://your-kita-kita-app.com
   ```

### 4. Install Dependencies

```bash
cd telegram-bot
npm install
```

### 5. Run the Bot

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Main menu with AI agents and receipt scanning |
| `/help` | Show help and usage instructions |
| `/scan` | Prompt to send receipt photo |
| `/link` | Link your Kita-kita account |
| `/balance` | View account balance |
| `/transactions` | Show recent transactions |

## How to Use

### 1. Start the Bot
Send `/start` to see the main menu with options for:
- 📸 **Receipt Scanning**: Log transactions from photos
- 💰 **Ipon Coach**: Access savings assistant
- 🛡️ **Gastos Guardian**: View expense analysis
- 🗺️ **Pera Planner**: Get financial roadmaps

### 2. Link Your Account (Recommended)
- Send `/link` to get a linking code
- Open your Kita-kita app
- Go to Settings > Connect Telegram
- Enter the 6-digit code
- Unlock personalized AI insights

### 3. Use AI Financial Agents

#### 💰 Ipon Coach
- Get Filipino-inspired savings strategies
- Analyze spending patterns with cultural context
- Receive daily financial wisdom and motivation
- Create achievable savings goals

#### 🛡️ Gastos Guardian
- Track and categorize expenses automatically
- Identify spending leaks and money drains
- Get Filipino "tipid" recommendations
- View visual spending breakdowns

#### 🗺️ Pera Planner
- Create financial roadmaps from today to retirement
- Plan for major life events (wedding, house, education)
- Balance personal goals with family obligations
- Get investment and career guidance

### 4. Scan Receipts
- Simply send a photo of your receipt
- The bot will analyze it using AI
- Review the extracted information
- Confirm to save the transaction

### 5. Web Integration
- Each AI agent opens in your browser for full features
- Seamless sync between Telegram and web app
- All data automatically synchronized when linked

## Technical Details

### Architecture
- **Node.js** with Express.js framework
- **Telegram Bot API** for messaging
- **Gemini Pro Vision** for receipt analysis
- **Firebase Admin SDK** for database operations
- **Firebase Firestore** for data storage

### Data Flow
1. User sends receipt photo
2. Bot downloads and processes image
3. Gemini AI extracts transaction data
4. User reviews and confirms details
5. Transaction saved to Firestore
6. Confirmation sent to user

### Error Handling
- Network timeouts and retries
- Invalid image format detection
- AI analysis failures with fallbacks
- Authentication and permission errors
- Rate limiting and usage quotas

## Development

### Project Structure
```
telegram-bot/
├── bot.js              # Main bot logic
├── package.json        # Dependencies
├── env.example         # Environment template
├── README.md           # This file
└── .env               # Your actual environment (not in git)
```

### Key Functions
- `analyzeReceiptWithGemini()` - AI image analysis
- `saveTransactionToFirestore()` - Database operations
- `handleLinkAccount()` - Account linking
- `showReceiptResults()` - User interface

### Debugging
Enable debug logging by setting:
```bash
NODE_ENV=development
```

## Deployment

### Local Development
```bash
npm run dev
```

### Production Deployment

#### Option 1: PM2 (Recommended)
```bash
npm install -g pm2
pm2 start bot.js --name kita-kita-bot
pm2 save
pm2 startup
```

#### Option 2: Docker
```bash
# Build image
docker build -t kita-kita-bot .

# Run container
docker run -d --name kita-kita-bot --env-file .env kita-kita-bot
```

#### Option 3: Cloud Services
- Deploy to Heroku, Railway, or similar
- Set environment variables in platform dashboard
- Ensure bot token and Firebase credentials are secure

## Security Considerations

- 🔐 **Environment Variables**: Never commit `.env` files
- 🛡️ **Bot Token**: Keep your Telegram bot token secure
- 🔑 **Firebase Keys**: Protect your Firebase service account keys
- 📝 **Logging**: Avoid logging sensitive user data
- 🚫 **Rate Limiting**: Implement usage limits for production

## Troubleshooting

### Common Issues

**Bot Not Responding**
- Check bot token is correct
- Ensure bot is running with `npm start`
- Verify network connectivity

**Firebase Errors**
- Confirm service account credentials
- Check Firestore security rules
- Verify project ID matches

**Gemini API Errors**
- Validate API key is correct
- Check quota limits
- Ensure image format is supported

**Receipt Analysis Issues**
- Use clear, well-lit photos
- Ensure receipt text is readable
- Try different image angles

### Debug Mode
Run with debug logging:
```bash
NODE_ENV=development npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see main project for details.

## Support

For issues or questions:
- Check this README first
- Review error logs
- Contact the Kita-kita development team
- Create an issue in the main repository

---

Built with ❤️ for the Kita-kita financial management platform. 