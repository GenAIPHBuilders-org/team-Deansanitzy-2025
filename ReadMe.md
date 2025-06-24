# 🏦 Kita-kita - AI Banking Platform

**An intelligent personal finance management platform powered by AI agents and modern web technologies.**

## �� Project Overview

Kita-kita is a comprehensive AI-powered banking and financial management platform that helps users track expenses, manage bank accounts, forecast financial trends, and make informed financial decisions through intelligent AI agents.

### 🎯 Key Features

- **🤖 AI Financial Agents**: Multiple specialized AI assistants for different financial needs
- **💰 Transaction Management**: Add, track, and categorize income/expense transactions
- **🏦 Bank Account Integration**: Manage multiple bank accounts and e-wallets
- **📊 Financial Analytics**: Real-time charts and financial health monitoring
- **🔮 Expense Forecasting**: AI-powered predictions for future expenses
- **📱 Subscription Management**: Track and optimize recurring payments
- **⏰ Financial Time Machine**: Explore alternate financial scenarios
- **💡 Ipon Coach**: Personalized savings guidance and tips

## 👥 Team Members

- **Adriel Magalona** - Lead Developer & Financial Systems Architect
- **James Rafael Mendiola** - Full Stack Developer & AI Integration Specialist
- **Jude Vincent Puti** - Frontend Developer & UI/UX Designer

## 🛠️ Technology Stack

### Frontend

- **HTML5/CSS3/JavaScript (ES6+)** - Core web technologies
- **Chart.js** - Interactive financial charts and data visualization
- **Firebase SDK** - Authentication, Firestore database, and storage
- **Modern CSS Grid/Flexbox** - Responsive layout design

### Backend & Services

- **Firebase Authentication** - Secure user authentication
- **Firebase Firestore** - NoSQL database for real-time data
- **Firebase Storage** - File upload and document storage
- **Google Gemini AI API** - Advanced AI capabilities for financial agents
- **Node.js/Express** - Backend API services (server.js)

### AI & Analytics

- **Google Gemini 1.5 Pro** - Large Language Model for intelligent conversations
- **Custom Financial Algorithms** - Expense forecasting and trend analysis
- **Real-time Data Processing** - Live financial health monitoring

## 🚀 Setup Instructions

### Prerequisites

- **Web Browser** (Chrome, Firefox, Safari, Edge)
- **Internet Connection** (for Firebase and AI services)
- **Text Editor/IDE** (VS Code recommended)
- **Live Server Extension** (for local development)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/team-Deansanitzy-2025.git
cd team-Deansanitzy-2025
```

### 2. API Configuration

The project uses `public/js/config.js` for API configuration. The file is already configured with:

- **Gemini AI API Key**: Pre-configured for AI features
- **Firebase Configuration**: Connected to the Kita-kita Firebase project

### 3. Install Dependencies (Optional)

If using Node.js backend features:

```bash
npm install
```

### 4. Run the Application

#### Option A: Using Live Server (Recommended)

1. Install the "Live Server" extension in VS Code
2. Right-click on `public/index.html`
3. Select "Open with Live Server"
4. Navigate to `http://localhost:5500` (or the port shown)

#### Option B: Using Python HTTP Server

```bash
cd public
python -m http.server 8000
# Navigate to http://localhost:8000
```

#### Option C: Using Node.js (if backend features needed)

```bash
npm start
# Navigate to http://localhost:3000
```

### 5. Environment Variables (Production Only)

For production deployment, create a `.env` file:

```env
NODE_ENV=production
PORT=3000
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_API_KEY=your_firebase_api_key
# ... other configuration
```

## 📖 Usage Guide

### Getting Started

1. **Sign Up/Login**: Create an account or login with existing credentials
2. **Dashboard Overview**: View your financial summary and recent transactions
3. **Add Bank Accounts**: Set up your bank accounts and e-wallets
4. **Record Transactions**: Add income and expense transactions
5. **Explore AI Agents**: Use specialized AI assistants for financial guidance

### 🤖 AI Agents & How to Use Them

#### 1. **Expense Forecaster Agent**

- **Purpose**: Predicts future expenses based on historical data
- **How to Test**:
  - Navigate to Dashboard
  - Click "Expense Forecaster" in the AI Agents section
  - Ask questions like "What will my expenses be next month?"
  - Provide transaction history for accurate predictions

#### 2. **Subscription Manager Agent**

- **Purpose**: Tracks recurring payments and suggests optimizations
- **How to Test**:
  - Add recurring transactions (Netflix, Spotify, etc.)
  - Access Subscription Manager agent
  - Ask "Show me my subscriptions" or "Which subscriptions should I cancel?"

#### 3. **Financial Time Machine Agent**

- **Purpose**: Explores alternate financial scenarios and "what-if" analysis
- **How to Test**:
  - Click on "Financial Time Machine" agent
  - Ask scenarios like "What if I saved ₱5000 more last year?"
  - Explore different financial decisions and their outcomes

#### 4. **Ipon Coach Agent**

- **Purpose**: Provides personalized savings advice and financial tips
- **How to Access**: Navigate to `./agents/iponCoach.html`
- **How to Test**:
  - Ask for savings tips: "How can I save more money?"
  - Request budget advice: "Help me create a monthly budget"
  - Get financial goal guidance: "I want to save for a house"

### 💰 Core Features Testing

#### Transaction Management

1. Click "Add Transaction" button
2. Fill in transaction details (name, amount, category, date)
3. Select account or "No Account" for cash transactions
4. View transactions in the dashboard and transactions page

#### Bank Account Management

1. Navigate to "Accounts" page
2. Click "Add New Account"
3. Choose bank or e-wallet
4. Fill in account details and initial balance
5. View account cards with current balances

#### Financial Analytics

1. Dashboard automatically shows:
   - Total balance calculation
   - Income vs expenses chart
   - Recent transactions widget
   - Financial health indicators

### 🔧 Advanced Features

#### Financial Health Monitoring

- Automatic calculation of income/expense ratios
- Real-time balance updates
- Financial trend analysis
- Spending pattern insights

#### Security Features

- Firebase Authentication integration
- Secure data storage in Firestore
- Input validation and sanitization
- Session management

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Public/)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  index.html │  │ dashboard.js│  │   AI Agents/        │  │
│  │  login.html │  │transactions │  │  - iponCoach.html   │  │
│  │  style.css  │  │   .js       │  │  - indexChatbot.js  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Configuration Layer                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  config.js  │  │ helpers.js  │  │   firestoredb.js    │  │
│  │             │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Firebase  │  │ Gemini AI   │  │    Chart.js         │  │
│  │             │  │   API       │  │   (Visualization)   │  │
│  │ - Auth      │  │             │  │                     │  │
│  │ - Firestore │  │             │  │                     │  │
│  │ - Storage   │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Authentication**: Firebase Auth handles login/signup
2. **Data Storage**: Firestore stores user profiles, transactions, and accounts
3. **AI Processing**: Gemini AI processes natural language queries from agents
4. **Real-time Updates**: Firestore listeners update UI in real-time
5. **Visualization**: Chart.js renders financial data and trends

### File Structure

```
team-Deansanitzy-2025/
├── public/                   # Frontend application files
│   ├── index.html            # Main application entry point
│   ├── css/                  # Stylesheets and themes
│   │   ├── main.css          # Core application styles
│   │   ├── dashboard.css     # Dashboard-specific styles
│   │   └── themes/           # Light/Dark theme files
│   ├── js/                   # JavaScript modules
│   │   ├── config.js         # API configuration (Gemini AI, Firebase)
│   │   ├── auth.js           # Authentication logic
│   │   ├── dashboard.js      # Dashboard functionality
│   │   ├── transactions.js   # Transaction management
│   │   ├── accounts.js       # Account management
│   │   └── agents/           # AI agent modules
│   ├── pages/                # HTML pages
│   │   ├── dashboard.html    # Main dashboard
│   │   ├── transactions.html # Transaction management
│   │   ├── accounts.html     # Account management
│   │   └── agents/           # AI agent interfaces
│   └── assets/               # Images, icons, and static files
├── crew_ai/                  # Python CrewAI backend (optional)
├── server.js                 # Node.js Express server (optional)
├── package.json              # Node.js dependencies
└── README.md                 # This file
```

## 🧪 Testing the AI Agents

### Quick Test Scenarios

1. **Expense Forecasting**:

   ```
   User: "Based on my spending, how much will I spend on food next month?"
   Expected: AI analyzes transaction patterns and provides forecast
   ```

2. **Subscription Management**:

   ```
   User: "List all my recurring payments and suggest which ones to cancel"
   Expected: AI identifies subscription patterns and provides recommendations
   ```

3. **Financial Time Machine**:

   ```
   User: "What would happen if I had saved ₱10,000 instead of spending it last year?"
   Expected: AI calculates alternate timeline with compound savings
   ```

4. **Ipon Coach**:
   ```
   User: "I want to save ₱100,000 in 2 years, how should I budget?"
   Expected: AI provides personalized savings plan and budgeting advice
   ```

## 🚀 Deployment

### Production Deployment Steps

1. **Environment Setup**: Configure production environment variables
2. **Firebase Security**: Implement proper security rules
3. **API Security**: Move sensitive keys to backend environment
4. **Build Optimization**: Minify CSS/JS files
5. **CDN Setup**: Serve static assets via CDN

### Hosting Options

- **Firebase Hosting** (Recommended)
- **Netlify**
- **Vercel**
- **Traditional web hosting**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create Pull Request

## 📄 License and Attribution

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for complete details, including comprehensive third-party library attributions and acknowledgments.

### Key Points:

- **Open Source**: MIT License allows public use, modification, and distribution
- **Third-Party Attribution**: All dependencies properly credited with their respective licenses
- **Original Work**: Custom AI agents and Philippine-specific financial algorithms are original contributions
- **Professional Standards**: Full transparency in licensing and attribution for commercial and academic use

For detailed attribution of all libraries, frameworks, and inspirations used in this project, please refer to our comprehensive [LICENSE.md](LICENSE.md) file.

## 📞 Support

For support and questions:

- **Email**: dagsmagalona@gmail.com
- **GitHub Issues**: Create an issue in this repository
- **Documentation**: Refer to inline code comments and this README

---

**Built with ❤️ by the Team Deansanitzt**

## Authentication

The platform implements a multi-level authentication system:

1. **Firebase Authentication**: Secure user authentication for the web application
2. **Streamlit Integration**: Seamless authentication between web app and Streamlit using a shared authentication model
3. **Secure Token Handling**: JWT tokens are securely stored and validated for all API requests

### Using the Streamlit Authentication

The Streamlit applications use a custom authentication module that integrates with Firebase:

```python
# Import the authentication module
from streamlit_auth import get_authenticator

# Get the authenticator
authenticator = get_authenticator()

# Secure a Streamlit page
if authenticator.secure_page():
    # User is authenticated, display content
    st.write(f"Welcome, {st.session_state.user.get('displayName')}")
else:
    # Not authenticated, login form is shown
    pass
```

### Testing Authentication

For testing purposes, you can use the following credentials:



In development mode, the application will also accept credentials from `sample_data.json`.

## 📊 Philippine Financial Context

Kita-Kita is specifically designed to address the unique financial challenges and opportunities in the Philippines:

### Financial Inclusion

- **Unbanked Population**: Helps the 51.2 million unbanked Filipinos (BSP, 2021) access financial services
- **Digital Adoption**: Bridges the gap between traditional banking and digital finance adoption
- **Rural Access**: Provides financial services to underserved rural communities

### Philippine-Specific Features

- **Local Financial Products**: Integration with popular Philippine e-wallets (GCash, Maya, etc.)
- **Peso-Optimized Budgeting**: Budgeting templates tailored to Philippine cost of living
- **BSP Compliance**: All advice follows Bangko Sentral ng Pilipinas regulations
- **Tax Optimization**: Guidance on Philippine tax laws and BIR requirements
- **OFW Support**: Specialized advice for Overseas Filipino Workers on remittances and investments

### Economic Impact

- **Financial Literacy**: Addresses the critical need for improved financial education
- **MSME Support**: Specialized guidance for micro, small, and medium enterprises
- **Sustainable Development**: Aligned with Philippine Development Plan 2023-2028
