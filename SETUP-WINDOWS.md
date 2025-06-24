# Windows Setup Guide for Kita-Kita AI Banking Platform

## Prerequisites
- Node.js v14+ (download from [nodejs.org](https://nodejs.org/))
- Python 3.9+ (download from [python.org](https://python.org/))
- Git (download from [git-scm.com](https://git-scm.com/))

## Setup Steps

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd team-Deansanitzy-2025-main
   ```

2. **Run the automated setup**:
   ```bash
   setup.bat
   ```

3. **Configure environment variables**:
   ```bash
   # Copy environment templates
   copy env.example .env
   copy telegram-bot\env.example telegram-bot\.env
   ```

4. **Edit environment files**:
   - Open `.env` in a text editor
   - Add your actual API keys (get these from the project owner)
   - Update Firebase credentials
   
5. **Start the development server**:
   ```bash
   npm run dev
   ```

## Required API Keys
Contact the project owner for these credentials:
- Gemini API Key
- Firebase Project Credentials
- Telegram Bot Token (if using telegram features)

## Troubleshooting

### If Node.js installation fails:
- Download the Windows installer from nodejs.org
- Choose the LTS version
- Restart your terminal after installation

### If Python installation fails:
- Download Python 3.9+ from python.org
- Make sure to check "Add Python to PATH" during installation
- Restart your terminal after installation

### If the app doesn't start:
- Check that all API keys are properly set in `.env`
- Verify Node.js and Python versions: `node -v` and `python --version`
- Run `npm install` if dependencies aren't installed

## Development Commands
- `npm run dev` - Start development server
- `npm test` - Run tests
- `npm run lint` - Check code style
- `npm run security-check` - Run security audit

## Need Help?
Contact the project team if you encounter any issues during setup. 