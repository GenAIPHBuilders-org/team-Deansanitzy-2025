#!/bin/bash

# Kita-kita Telegram Bot Startup Script

echo "🤖 Starting Kita-kita Telegram Receipt Bot..."

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

# Start the bot
echo "🚀 Starting bot..."
npm start 