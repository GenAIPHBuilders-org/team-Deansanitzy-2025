# 🤖 Kita Kita Bot - Continuous Operation with PM2

This guide explains how to run the Kita Kita Telegram bot continuously without needing to manually start it each time.

## 🚀 Quick Start

### Option 1: Using the PM2 Script (Recommended)
```bash
./start-pm2.sh
```

### Option 2: Using npm commands
```bash
# Start the bot with PM2
npm run pm2:start

# Check status
npm run pm2:status
```

## 📋 Prerequisites

1. **Environment Setup**: Make sure you have a `.env` file with all required variables:
   ```bash
   cp env.example .env
   # Edit .env with your actual values
   ```

2. **Dependencies**: Install all dependencies including PM2:
   ```bash
   npm install
   ```

## 🛠️ Available Commands

### Bot Management
- `npm run pm2:start` - Start the bot with PM2
- `npm run pm2:stop` - Stop the bot
- `npm run pm2:restart` - Restart the bot
- `npm run pm2:reload` - Reload the bot (zero-downtime restart)
- `npm run pm2:delete` - Delete the bot process from PM2

### Monitoring & Logs
- `npm run pm2:status` - Check bot status and uptime
- `npm run pm2:logs` - View real-time logs
- `npm run pm2:logs-error` - View error logs only
- `npm run pm2:monit` - Open PM2 monitoring dashboard

### System Integration
- `npm run pm2:startup` - Configure PM2 to start on system boot
- `npm run pm2:save` - Save current PM2 processes to restart on boot

## 🔄 Automatic Restart Features

The bot is configured with the following automatic restart features:

- **Auto-restart on crash**: If the bot crashes, it will automatically restart
- **Memory limit**: Restarts if memory usage exceeds 1GB
- **Minimum uptime**: Must run for at least 10 seconds before being considered stable
- **Max restarts**: Will attempt up to 10 restarts with exponential backoff
- **Graceful shutdown**: 5-second timeout for graceful process termination

## 📊 Monitoring

### Real-time Status
```bash
npm run pm2:status
```

### Live Logs
```bash
npm run pm2:logs
```

### Performance Monitoring
```bash
npm run pm2:monit
```

## 🖥️ System Startup (Optional)

To make the bot start automatically when your system boots:

1. **Configure PM2 startup script**:
   ```bash
   npm run pm2:startup
   ```
   Follow the instructions displayed (may require sudo)

2. **Start your bot**:
   ```bash
   npm run pm2:start
   ```

3. **Save PM2 configuration**:
   ```bash
   npm run pm2:save
   ```

Now the bot will automatically start whenever your system restarts!

## 📁 Log Files

Logs are stored in the `logs/` directory:
- `logs/out.log` - Standard output logs
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs combined

## 🔧 Troubleshooting

### Bot not starting?
1. Check if .env file exists and has correct values
2. Verify all dependencies are installed: `npm install`
3. Check PM2 status: `npm run pm2:status`
4. View error logs: `npm run pm2:logs-error`

### High memory usage?
- The bot will automatically restart if it uses more than 1GB RAM
- Check logs to identify memory leaks
- Consider adjusting `max_memory_restart` in `ecosystem.config.js`

### Too many restarts?
- Check error logs to identify the root cause
- The bot will stop auto-restarting after 10 failed attempts
- Fix the issue and manually restart: `npm run pm2:restart`

## 🆚 PM2 vs Regular Node

| Feature | `npm start` | PM2 |
|---------|-------------|-----|
| Auto-restart on crash | ❌ | ✅ |
| Background operation | ❌ | ✅ |
| Log management | ❌ | ✅ |
| Memory monitoring | ❌ | ✅ |
| Performance metrics | ❌ | ✅ |
| Zero-downtime restart | ❌ | ✅ |
| System startup integration | ❌ | ✅ |

## 🚫 Stopping the Bot

To completely stop the bot:
```bash
npm run pm2:stop
```

To remove from PM2 entirely:
```bash
npm run pm2:delete
```

---

🎉 **Your Kita Kita bot is now ready for 24/7 operation!** 