#!/usr/bin/env node
/**
 * Secure Configuration Setup for Kita-kita AI Banking Platform
 * This script helps set up environment variables securely for development
 */

const fs = require('fs');
const path = require('path');

console.log('🔐 Setting up secure configuration...\n');

// Check if env-loader.js already exists
const envLoaderPath = path.join(__dirname, 'public', 'js', 'env-loader.js');
const envLoaderExamplePath = path.join(__dirname, 'public', 'js', 'env-loader.example.js');

if (!fs.existsSync(envLoaderPath)) {
    console.log('📋 Creating env-loader.js from template...');
    
    if (fs.existsSync(envLoaderExamplePath)) {
        fs.copyFileSync(envLoaderExamplePath, envLoaderPath);
        console.log('✅ Created public/js/env-loader.js');
        console.log('⚠️  Please edit this file and add your actual API keys');
    } else {
        console.error('❌ Template file not found!');
        process.exit(1);
    }
} else {
    console.log('✅ env-loader.js already exists');
}

console.log('\n🔧 Configuration Setup Instructions:');
console.log('');
console.log('1. Edit public/js/env-loader.js and replace:');
console.log('   - YOUR_GEMINI_API_KEY_HERE with your Gemini API key');
console.log('   - YOUR_FIREBASE_API_KEY_HERE with your Firebase API key');  
console.log('   - YOUR_FIREBASE_APP_ID_HERE with your Firebase App ID');
console.log('');
console.log('2. Get your API keys from:');
console.log('   - Gemini API: https://ai.google.dev/');
console.log('   - Firebase: https://console.firebase.google.com/');
console.log('');
console.log('3. IMPORTANT: The env-loader.js file is gitignored and will not be committed');
console.log('');
console.log('4. For production deployment, set these environment variables:');
console.log('   - GEMINI_API_KEY');
console.log('   - FIREBASE_API_KEY');
console.log('   - FIREBASE_APP_ID');
console.log('   - (See env.example for full list)');
console.log('');
console.log('🚀 Ready to start development!');
console.log('');
console.log('Security Notes:');
console.log('- Never commit API keys to version control');
console.log('- env-loader.js is gitignored to prevent accidental commits');
console.log('- Use environment variables in production');
console.log('- Regularly rotate your API keys'); 