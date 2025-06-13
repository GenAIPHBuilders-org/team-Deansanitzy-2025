@echo off
echo 🚀 Setting up Kita-Kita AI Banking Platform with CrewAI integration

REM Check for Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js v14 or higher first.
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1,2,3 delims=." %%a in ('node -v') do (
    set NODE_VERSION=%%a
)
set NODE_VERSION=%NODE_VERSION:~1%
if %NODE_VERSION% LSS 14 (
    echo ❌ Node.js version must be v14 or higher. Current version: %NODE_VERSION%
    exit /b 1
)

REM Check for Python
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Python is not installed. Please install Python 3.9 or higher first.
    exit /b 1
)

REM Check Python version
for /f "tokens=1,2 delims=." %%a in ('python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"') do (
    set PYTHON_MAJOR=%%a
    set PYTHON_MINOR=%%b
)

if %PYTHON_MAJOR% LSS 3 (
    echo ❌ Python version must be 3.9 or higher. Current version: %PYTHON_MAJOR%.%PYTHON_MINOR%
    exit /b 1
)

if %PYTHON_MAJOR%==3 (
    if %PYTHON_MINOR% LSS 9 (
        echo ❌ Python version must be 3.9 or higher. Current version: %PYTHON_MAJOR%.%PYTHON_MINOR%
        exit /b 1
    )
)

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file...
    (
        echo # API Keys
        echo GEMINI_API_KEY=your_gemini_api_key_here
        echo.
        echo # Server settings
        echo PORT=3000
    ) > .env
    echo ✅ .env file created. Please edit it to add your Gemini API key.
) else (
    echo 🔍 .env file already exists. Skipping...
)

REM Install npm dependencies
echo 📦 Installing Node.js dependencies...
call npm install

REM Install Python dependencies
echo 🐍 Installing Python dependencies for CrewAI...
call pip install -r crew_ai/requirements.txt

echo ✅ Setup completed successfully!
echo.
echo 🔑 IMPORTANT: Make sure to update your .env file with your Gemini API key
echo 🚀 To start the application, run: npm run dev

pause 