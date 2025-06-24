#!/bin/bash

# Kita-kita Telegram Bot PM2 Startup Script
# This script will start the bot with PM2 for continuous operation

echo "🤖 Starting Kita-kita Telegram Bot with PM2..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found! Please copy env.example to .env and configure it."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo "📋 Node.js version: $NODE_VERSION"

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop any existing PM2 process
echo "🛑 Stopping any existing PM2 processes..."
npm run pm2:stop 2>/dev/null || true

# Start the bot with PM2
echo "🚀 Starting bot with PM2..."
npm run pm2:start

# Check if the bot started successfully
sleep 3
if npm run pm2:status | grep -q "kita-kita-bot"; then
    echo "✅ Bot started successfully with PM2!"
    echo ""
    echo "📊 Use these commands to manage the bot:"
    echo "   npm run pm2:status   - Check bot status"
    echo "   npm run pm2:logs     - View bot logs"
    echo "   npm run pm2:restart  - Restart the bot"
    echo "   npm run pm2:stop     - Stop the bot"
    echo "   npm run pm2:monit    - Monitor bot performance"
    echo ""
    echo "🔄 The bot will automatically restart if it crashes!"
    echo "💾 To save PM2 configuration for system startup, run: npm run pm2:save"
else
    echo "❌ Failed to start bot with PM2"
    exit 1
fi 