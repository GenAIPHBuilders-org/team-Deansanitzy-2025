// Setup configuration script for Telegram Bot
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Telegram Bot configuration...');

// Configuration from your config.js
const config = {
    TELEGRAM_BOT_TOKEN: '8039075454:AAEOdlNjwP6iG7ueEFEuzmVteXZJN7t0fZU',
    GEMINI_API_KEY: 'AIzaSyC2OxnjdS9mb-dlypkbQ36EQ72LHX5ZwdI',
    FIREBASE_PROJECT_ID: 'deansanitzy',
    NODE_ENV: 'development'
};

// Create .env file content
const envContent = `# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=${config.TELEGRAM_BOT_TOKEN}

# Gemini AI Configuration (from your config.js)
GEMINI_API_KEY=${config.GEMINI_API_KEY}

# Firebase Admin Configuration
FIREBASE_PROJECT_ID=${config.FIREBASE_PROJECT_ID}
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nyour_private_key_here\\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=your_service_account_email@deansanitzy.iam.gserviceaccount.com

# Optional: Environment
NODE_ENV=${config.NODE_ENV}
`;

// Write .env file
const envPath = path.join(__dirname, '.env');

try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created successfully!');
    console.log('📍 Location:', envPath);
    console.log('\n⚠️  IMPORTANT: You still need to add Firebase service account credentials:');
    console.log('1. Go to https://console.firebase.google.com/project/deansanitzy/settings/serviceaccounts/adminsdk');
    console.log('2. Click "Generate new private key"');
    console.log('3. Download the JSON file');
    console.log('4. Replace the FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL in .env file');
    console.log('\n🚀 Then run: npm start');
    
} catch (error) {
    console.error('❌ Error creating .env file:', error.message);
    console.log('\n📝 Manual setup:');
    console.log('Create a .env file in the telegram-bot directory with this content:');
    console.log('\n' + envContent);
} 