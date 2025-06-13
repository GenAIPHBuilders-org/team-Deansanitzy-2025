#!/bin/bash
# Setup script for Kita-Kita AI Banking Platform with CrewAI integration

echo "🚀 Setting up Kita-Kita AI Banking Platform with CrewAI integration"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v14 or higher first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ Node.js version must be v14 or higher. Current version: $(node -v)"
    exit 1
fi

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.9 or higher first."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(sys.version_info.major, sys.version_info.minor)' | awk '{print $1"."$2}')
if (( $(echo "$PYTHON_VERSION < 3.9" | bc -l) )); then
    echo "❌ Python version must be 3.9 or higher. Current version: $PYTHON_VERSION"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOL
# API Keys
GEMINI_API_KEY=your_gemini_api_key_here

# Server settings
PORT=3000
EOL
    echo "✅ .env file created. Please edit it to add your Gemini API key."
else
    echo "🔍 .env file already exists. Skipping..."
fi

# Install npm dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Python dependencies
echo "🐍 Installing Python dependencies for CrewAI..."
pip3 install -r crew_ai/requirements.txt

echo "✅ Setup completed successfully!"
echo ""
echo "🔑 IMPORTANT: Make sure to update your .env file with your Gemini API key"
echo "🚀 To start the application, run: npm run dev" 