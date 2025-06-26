// Dashboard Chatbot Module - Personalized Financial Assistant
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { 
    getUserBankAccounts,
    getUserTransactions,
    getUserData
} from "./firestoredb.js";
import { GEMINI_API_KEY, GEMINI_MODEL } from "./config.js";
import { 
    formatCurrency, 
    formatDate, 
    callGeminiAI 
} from "./agentCommon.js";
import { 
    getTransactionInsights, 
    analyzeTransaction, 
    predictFutureTransactions 
} from "./agentTransactions.js";

// Enhanced implementation of callGeminiAI with better error handling and logging
async function localCallGeminiAI(prompt, options = {}) {
    console.log('🤖 Using enhanced local Gemini AI implementation');
    console.log('📝 Prompt preview:', prompt.substring(0, 150) + '...');
    console.log('🔑 API Key status:', GEMINI_API_KEY ? 'Present' : 'Missing');
    console.log('🎯 Model:', GEMINI_MODEL);
    
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key is not configured');
    }
    
    if (!GEMINI_MODEL) {
        throw new Error('Gemini model is not configured');
    }
    
    // Ensure we're using the latest model from config
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    // Enhanced request body with more configuration options
    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            maxOutputTokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7,
            topP: options.topP || 0.95,
            topK: options.topK || 40,
            candidateCount: 1,
            stopSequences: []
        },
        safetySettings: [
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]
    };
    
    try {
        console.log('🚀 Sending request to Gemini API...');
        console.log('🌐 Endpoint:', endpoint.replace(GEMINI_API_KEY, '[API_KEY_HIDDEN]'));
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Kita-kita-Financial-Assistant/1.0'
            },
            body: JSON.stringify(body)
        });
        
        console.log('📡 Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ HTTP error details:', errorText);
            
            // Try to parse error for more specific information
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error && errorData.error.message) {
                    throw new Error(`Gemini API Error: ${errorData.error.message}`);
                }
            } catch (parseError) {
                // If we can't parse the error, use the original text
            }
            
            throw new Error(`Gemini API HTTP error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('✅ Received response from Gemini API');
        console.log('📊 Response structure check:', {
            hasCandidates: !!data.candidates,
            candidatesLength: data.candidates?.length || 0,
            hasContent: !!(data.candidates?.[0]?.content),
            hasParts: !!(data.candidates?.[0]?.content?.parts),
            partsLength: data.candidates?.[0]?.content?.parts?.length || 0
        });
        
        if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && data.candidates[0].content.parts && 
            data.candidates[0].content.parts.length > 0) {
            
            const responseText = data.candidates[0].content.parts[0].text;
            console.log('💬 Response preview:', responseText.substring(0, 100) + '...');
            return responseText;
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
            console.error('🚫 Gemini API blocked:', data.promptFeedback.blockReason);
            throw new Error('Content was blocked by Gemini AI safety filters. Please try rephrasing your question.');
        } else {
            console.error('⚠️ Unexpected API response structure:', JSON.stringify(data, null, 2));
            throw new Error('Received unexpected response format from Gemini API');
        }
    } catch (error) {
        console.error('💥 Error calling Gemini API:', error);
        
        // Provide more user-friendly error messages
        if (error.message.includes('fetch')) {
            throw new Error('Network error: Unable to connect to AI service. Please check your internet connection.');
        } else if (error.message.includes('API_KEY')) {
            throw new Error('AI service configuration error. Please contact support.');
        } else if (error.message.includes('quota')) {
            throw new Error('AI service is temporarily unavailable due to high demand. Please try again later.');
        }
        
        throw error;
    }
}

// Add immediate console log to verify script loading
console.log('🚀 dashboardChatbot.js script loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 dashboardChatbot.js DOMContentLoaded fired');
    
    const chatbotToggle = document.getElementById('chatbotToggle');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const closeChatbot = document.getElementById('closeChatbot');
    const sendMessage = document.getElementById('sendMessage');
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');

    console.log('🔍 Element check in dashboardChatbot.js:', {
        chatbotToggle: !!chatbotToggle,
        chatbotWindow: !!chatbotWindow,
        closeChatbot: !!closeChatbot,
        sendMessage: !!sendMessage,
        userInput: !!userInput,
        chatMessages: !!chatMessages
    });

    if (!chatbotToggle || !chatbotWindow || !closeChatbot || !sendMessage || !userInput || !chatMessages) {
        console.error('❌ Dashboard chatbot elements not found, missing:', {
            chatbotToggle: !chatbotToggle,
            chatbotWindow: !chatbotWindow,
            closeChatbot: !closeChatbot,
            sendMessage: !sendMessage,
            userInput: !userInput,
            chatMessages: !chatMessages
        });
        return;
    }
    
    console.log('✅ All chatbot elements found, initializing...');
    
    const auth = getAuth();
    let userContext = null;
    
    // Enhanced financial advice suggestions with more variety and personalization
    const financialSuggestions = [
        "How can I improve my spending habits?",
        "What should my savings goal be?",
        "Analyze my recent transactions",
        "Predict my finances for next 3 months",
        "How's my financial health looking?",
        "Give me tips to reduce expenses",
        "Help me budget better",
        "Where am I spending too much?",
        "How can I increase my savings?",
        "What are my recurring expenses?"
    ];
    
    // Conversation memory to track topics discussed
    let conversationMemory = {
        lastQuery: '',
        discussedTopics: [],
        interactionCount: 0
    };
    
    // Initialize chatbot with user data
    async function initializeChatbot() {
        try {
            // Get user data when authenticated
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    userContext = await collectUserFinancialData(user);
                    
                    // Clear previous messages
                    chatMessages.innerHTML = '';
                    
                    // Add engaging welcome message with typing effect
                    setTimeout(() => {
                        const firstName = userContext?.userData?.firstName || 'there';
                        const hour = new Date().getHours();
                        let greeting = "Hello";
                        if (hour < 12) greeting = "Good morning";
                        else if (hour < 18) greeting = "Good afternoon";
                        else greeting = "Good evening";
                        
                        // More engaging welcome message with emoji and financial context
                        const welcomeEmojis = ['✨', '👋', '🌟', '💼', '🚀'];
                        const welcomeEmoji = welcomeEmojis[Math.floor(Math.random() * welcomeEmojis.length)];
                        
                        // Create personalized welcome based on financial data
                        let personalizedWelcome = '';
                        if (userContext && userContext.accounts && userContext.accounts.totalBalance > 0) {
                            personalizedWelcome = ` I can see you have ₱${userContext.accounts.totalBalance.toLocaleString()} across your accounts.`;
                        }
                        
                        const welcomeMessage = `${greeting}, ${firstName}! ${welcomeEmoji} I'm your AI financial assistant powered by advanced AI technology.${personalizedWelcome} I can analyze your transactions, provide personalized insights, and help you make smarter financial decisions. What would you like to explore today?`;
                        
                        addMessage('bot', welcomeMessage, { withSuggestions: true });
                    }, 500);
                }
            });
            
            // Toggle chatbot window with enhanced animation
            chatbotToggle.addEventListener('click', () => {
                console.log('Chatbot toggle clicked from dashboardChatbot.js');
                const isActive = chatbotWindow.classList.contains('active');
                
                if (!isActive) {
                    // Opening chatbot
                    chatbotWindow.style.display = 'flex';
                    chatbotWindow.classList.add('active');
                    
                    // Add a slight delay for smooth animation
                    setTimeout(() => {
                        chatbotWindow.style.opacity = '1';
                        chatbotWindow.style.transform = 'translateY(0) scale(1)';
                    }, 10);
                } else {
                    // Closing chatbot
                    chatbotWindow.classList.remove('active');
                    chatbotWindow.style.opacity = '0';
                    chatbotWindow.style.transform = 'translateY(20px) scale(0.95)';
                    
                    setTimeout(() => {
                        chatbotWindow.style.display = 'none';
                    }, 400);
                }
            });
            
            // Close chatbot window
            closeChatbot.addEventListener('click', () => {
                chatbotWindow.classList.remove('active');
                chatbotWindow.style.opacity = '0';
                chatbotWindow.style.transform = 'translateY(20px) scale(0.95)';
                
                setTimeout(() => {
                    chatbotWindow.style.display = 'none';
                }, 400);
            });
            
            // Close chatbot when clicking outside
            document.addEventListener('click', (e) => {
                if (!chatbotWindow.contains(e.target) && !chatbotToggle.contains(e.target)) {
                    if (chatbotWindow.classList.contains('active')) {
                        chatbotWindow.classList.remove('active');
                        chatbotWindow.style.opacity = '0';
                        chatbotWindow.style.transform = 'translateY(20px) scale(0.95)';
                        
                        setTimeout(() => {
                            chatbotWindow.style.display = 'none';
                        }, 400);
                    }
                }
            });
            
            // Send message with enhanced interaction tracking
            sendMessage.addEventListener('click', () => {
                sendUserMessage();
            });
            
            // Add event listener for Enter key in the input field
            userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendUserMessage();
                }
            });
            
        } catch (error) {
            console.error('Error initializing dashboard chatbot:', error);
        }
    }
    
    // Function to collect user's financial data for context
    async function collectUserFinancialData(user) {
        try {
            console.log('Collecting financial data for user:', user.uid);
            
            // Get user data with error handling
            let userData;
            try {
                userData = await getUserData(user.uid);
                console.log('User data retrieved:', userData ? 'success' : 'empty');
            } catch (userDataError) {
                console.error('Error retrieving user data:', userDataError);
                userData = { firstName: 'User', lastName: '' };
            }
            
            // Get bank accounts with error handling
            let accounts = [];
            try {
                accounts = await getUserBankAccounts(user.uid) || [];
                console.log('Bank accounts retrieved:', accounts.length);
            } catch (accountsError) {
                console.error('Error retrieving bank accounts:', accountsError);
            }
            
            // Get transactions with error handling
            let transactions = [];
            try {
                transactions = await getUserTransactions(user.uid) || [];
                console.log('Transactions retrieved:', transactions.length);
            } catch (transactionsError) {
                console.error('Error retrieving transactions:', transactionsError);
            }
            
            // Calculate total balance with validation
            const totalBalance = accounts.reduce((sum, account) => {
                const balance = parseFloat(account.balance || 0);
                return isNaN(balance) ? sum : sum + balance;
            }, 0);
            
            // Calculate monthly income and expenses
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            
            const monthlyTransactions = transactions.filter(t => {
                try {
                    const transactionDate = new Date(t.date);
                    return transactionDate >= firstDayOfMonth;
                } catch (dateError) {
                    console.warn('Invalid transaction date:', t.date);
                    return false;
                }
            });
            
            const monthlyIncome = monthlyTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => {
                    const amount = parseFloat(t.amount || 0);
                    return isNaN(amount) ? sum : sum + amount;
                }, 0);
                
            const monthlyExpenses = monthlyTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => {
                    const amount = Math.abs(parseFloat(t.amount || 0));
                    return isNaN(amount) ? sum : sum + amount;
                }, 0);
            
            // Calculate savings rate with validation
            const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome * 100).toFixed(1) : 0;
            
            // Get top expense categories with validation
            const expenseCategories = {};
            monthlyTransactions
                .filter(t => t.type === 'expense')
                .forEach(t => {
                    const category = t.category || 'other';
                    const amount = Math.abs(parseFloat(t.amount || 0));
                    if (!isNaN(amount)) {
                        expenseCategories[category] = (expenseCategories[category] || 0) + amount;
                    }
                });
                
            const topCategories = Object.entries(expenseCategories)
                .map(([category, amount]) => ({ 
                    category, 
                    amount,
                    percentage: monthlyExpenses > 0 ? (amount / monthlyExpenses * 100).toFixed(1) : 0
                }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 3);
            
            // Get transaction insights using agentTransactions module with error handling
            let transactionInsights = {
                topCategories: [],
                unusualSpending: [],
                savingsOpportunities: [],
                recurringExpenses: [],
                incomeStreams: [],
                summary: 'No transaction insights available.'
            };
            
            try {
                if (transactions.length > 0) {
                    console.log('Getting transaction insights...');
                    transactionInsights = await getTransactionInsights(transactions, { generateAISummary: true });
                    console.log('Transaction insights retrieved successfully');
                }
            } catch (insightsError) {
                console.error('Error getting transaction insights:', insightsError);
            }
            
            // Get future predictions with error handling
            let predictions = {
                predictedMonthlyIncome: monthlyIncome,
                recurringExpenses: 0,
                nonRecurringExpenses: 0,
                predictedSavings: 0,
                predictedEndingBalance: totalBalance,
                summary: 'No prediction data available.'
            };
            
            try {
                if (transactions.length > 0) {
                    console.log('Getting future predictions...');
                    predictions = await predictFutureTransactions(transactions, 3);
                    console.log('Future predictions retrieved successfully');
                }
            } catch (predictionsError) {
                console.error('Error getting future predictions:', predictionsError);
            }
            
            const financialData = {
                userData,
                accounts: {
                    count: accounts.length,
                    totalBalance
                },
                financialMetrics: {
                    monthlyIncome,
                    monthlyExpenses,
                    savingsRate,
                    topExpenseCategories: topCategories
                },
                transactions: {
                    count: transactions.length,
                    recentTransactions: transactions
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .slice(0, 5),
                    allTransactions: transactions,
                    insights: transactionInsights
                },
                predictions: predictions
            };
            
            console.log('Financial data collection complete');
            return financialData;
        } catch (error) {
            console.error('Error collecting user financial data:', error);
            // Return a minimal context object instead of null to avoid errors
            return {
                userData: { firstName: 'User', lastName: '' },
                accounts: { count: 0, totalBalance: 0 },
                financialMetrics: {
                    monthlyIncome: 0,
                    monthlyExpenses: 0,
                    savingsRate: 0,
                    topExpenseCategories: []
                },
                transactions: {
                    count: 0,
                    recentTransactions: [],
                    allTransactions: [],
                    insights: {
                        topCategories: [],
                        unusualSpending: [],
                        savingsOpportunities: [],
                        recurringExpenses: [],
                        incomeStreams: [],
                        summary: 'No transaction data available.'
                    }
                },
                predictions: {
                    predictedMonthlyIncome: 0,
                    recurringExpenses: 0,
                    nonRecurringExpenses: 0,
                    predictedSavings: 0,
                    predictedEndingBalance: 0,
                    summary: 'No prediction data available.'
                }
            };
        }
    }
    
    // Enhanced function to send user message with conversation memory
    function sendUserMessage() {
        const message = userInput.value.trim();
        if (message) {
            // Add user message to chat
            addMessage('user', message);
            
            // Clear input field
            userInput.value = '';
            
            // Update conversation memory
            conversationMemory.lastQuery = message;
            conversationMemory.discussedTopics.push(message.toLowerCase());
            conversationMemory.interactionCount++;
            
            console.log('Updated conversation memory:', conversationMemory);
            
            // Get AI response
            getAIResponse(message);
        }
    }
    
    // Enhanced message display with typing effect for bot messages
    function addMessage(sender, text, options = {}) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        
        // Add timestamp for messages
        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Create message content
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        
        if (sender === 'bot') {
            // For bot messages, add a typing effect
            messageContent.innerHTML = '';
            messageElement.appendChild(messageContent);
            
            // Add timestamp for bot messages
            const timestampElement = document.createElement('div');
            timestampElement.classList.add('message-timestamp');
            timestampElement.textContent = timestamp;
            timestampElement.style.cssText = `
                font-size: 0.7rem;
                color: rgba(255, 255, 255, 0.4);
                margin-top: 0.25rem;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            messageElement.appendChild(timestampElement);
            
            chatMessages.appendChild(messageElement);
            
            // Scroll to bottom immediately to show the message is coming
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Add typing effect
            const typingSpeed = options.fastTyping ? 8 : 15; // ms per character
            const formattedText = text.replace(/\n/g, '<br>');
            
            // Function to handle HTML tags in the typing effect
            let i = 0;
            let inTag = false;
            let currentHTML = '';
            
            const typeNextCharacter = () => {
                if (i < formattedText.length) {
                    const char = formattedText.charAt(i);
                    
                    // Check if we're entering or exiting an HTML tag
                    if (char === '<') inTag = true;
                    if (char === '>') {
                        inTag = false;
                        currentHTML += char;
                        messageContent.innerHTML = currentHTML;
                        i++;
                        setTimeout(typeNextCharacter, 1); // Process tags quickly
                        return;
                    }
                    
                    currentHTML += char;
                    
                    // Only update the DOM and add delay when not in a tag
                    if (!inTag) {
                        messageContent.innerHTML = currentHTML;
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                        setTimeout(typeNextCharacter, typingSpeed);
                    } else {
                        // Process tag characters quickly
                        i++;
                        typeNextCharacter();
                        return;
                    }
                    
                    i++;
                } else {
                    // Typing complete, show timestamp and maybe add suggestions
                    timestampElement.style.opacity = '1';
                    
                    if (options.withSuggestions) {
                        setTimeout(addSuggestions, 500);
                    }
                }
            };
            
            // Start typing effect
            setTimeout(typeNextCharacter, 200);
        } else {
            // For user messages, display immediately
            messageContent.innerHTML = text.replace(/\n/g, '<br>');
            messageElement.appendChild(messageContent);
            
            // Add timestamp for user messages
            const timestampElement = document.createElement('div');
            timestampElement.classList.add('message-timestamp');
            timestampElement.textContent = timestamp;
            timestampElement.style.cssText = `
                font-size: 0.7rem;
                color: rgba(255, 255, 255, 0.6);
                margin-top: 0.25rem;
                text-align: right;
            `;
            messageElement.appendChild(timestampElement);
            
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    // Add more engaging and personalized suggestion buttons
    function addSuggestions() {
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'suggestions-container';
        
        // Get personalized suggestions based on financial data
        let personalizedSuggestions = [...financialSuggestions];
        
        // Add contextual suggestions if we have user data
        if (userContext) {
            const { financialMetrics, transactions } = userContext;
            
            // Add savings-focused suggestions if savings rate is low
            if (financialMetrics.savingsRate < 10) {
                personalizedSuggestions.push(
                    "How can I improve my savings rate?",
                    "Give me a savings plan",
                    "Tips to save more money"
                );
            }
            
            // Add spending-focused suggestions if expenses are high relative to income
            if (financialMetrics.monthlyExpenses > financialMetrics.monthlyIncome * 0.8) {
                personalizedSuggestions.push(
                    "Help me reduce my expenses",
                    "Where can I cut spending?",
                    "Budget planning assistance"
                );
            }
            
            // Add transaction-specific suggestions if we have transactions
            if (transactions && transactions.recentTransactions && transactions.recentTransactions.length > 0) {
                personalizedSuggestions.push(
                    "Analyze my spending patterns",
                    "Find unusual transactions",
                    "Identify my recurring expenses"
                );
            }
        }
        
        // Prioritize suggestions not in conversation memory
        const unusedSuggestions = personalizedSuggestions.filter(s => 
            !conversationMemory.discussedTopics.includes(s.toLowerCase()));
        
        // Randomly select 3-4 suggestions, preferring unused ones
        let selected = [];
        if (unusedSuggestions.length >= 3) {
            const shuffled = [...unusedSuggestions].sort(() => 0.5 - Math.random());
            selected = shuffled.slice(0, Math.min(4, shuffled.length));
        } else {
            const shuffled = [...personalizedSuggestions].sort(() => 0.5 - Math.random());
            selected = shuffled.slice(0, Math.min(4, shuffled.length));
        }
        
        // Create buttons with a staggered animation effect
        selected.forEach((suggestion, index) => {
            const button = document.createElement('button');
            button.className = 'suggestion-button';
            button.style.animationDelay = `${index * 0.1}s`;
            button.textContent = suggestion;
            button.addEventListener('click', () => {
                userInput.value = suggestion;
                sendUserMessage();
                
                // Remove suggestions after clicking
                if (chatMessages.contains(suggestionsContainer)) {
                    chatMessages.removeChild(suggestionsContainer);
                }
            });
            suggestionsContainer.appendChild(button);
        });
        
        chatMessages.appendChild(suggestionsContainer);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Gemini AI function
    async function getAIResponse(message) {
        // Show loading indicator
        const loadingMessage = document.createElement('div');
        loadingMessage.classList.add('message', 'bot-message', 'typing-indicator');
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.classList.add('typing-dot');
            loadingMessage.appendChild(dot);
        }
        chatMessages.appendChild(loadingMessage);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            console.log('Getting AI response for message:', message);
            
            // Check if we have user context
            if (!userContext) {
                console.log('No user context found, collecting financial data...');
                const user = auth.currentUser;
                if (user) {
                    userContext = await collectUserFinancialData(user);
                } else {
                    console.warn('No authenticated user found');
                }
            }
            
            // Create context-aware prompt
            let responseText = '';
            
            if (userContext) {
                const { userData, accounts, financialMetrics, transactions, predictions } = userContext;
                console.log('Using financial context for response generation');
                
                // Check if the message is about a specific transaction or category
                const isTransactionQuery = message.toLowerCase().includes('transaction') || 
                                          message.toLowerCase().includes('spending') || 
                                          message.toLowerCase().includes('expense');
                
                const isCategoryQuery = financialMetrics.topExpenseCategories.some(cat => 
                    message.toLowerCase().includes(cat.category.toLowerCase()));
                
                const isPredictionQuery = message.toLowerCase().includes('predict') || 
                                         message.toLowerCase().includes('future') || 
                                         message.toLowerCase().includes('forecast');
                
                let contextualPrompt = '';
                let aiOptions = {
                    temperature: 0.3,
                    maxTokens: 1000
                };
                
                if (isTransactionQuery || isCategoryQuery) {
                    console.log('Processing transaction-specific query');
                    // Enhanced prompt for transaction-specific queries with personality
                    contextualPrompt = `
                    You are Kita-kita, a friendly and engaging financial assistant with a warm, supportive personality. You're talking to ${userData?.firstName || 'User'} about their finances. Your goal is to provide personalized, actionable advice while being conversational and encouraging.
                    
                    USER INFO:
                    Name: ${userData?.firstName || 'User'} ${userData?.lastName || ''}
                    
                    FINANCIAL DATA:
                    Total Balance: ₱${accounts.totalBalance.toFixed(2)}
                    Monthly Income: ₱${financialMetrics.monthlyIncome.toFixed(2)}
                    Monthly Expenses: ₱${financialMetrics.monthlyExpenses.toFixed(2)}
                    Savings Rate: ${financialMetrics.savingsRate}%
                    
                    TRANSACTION INSIGHTS:
                    Top Categories: ${transactions.insights.topCategories.map(c => c.category).join(', ') || 'No categories available'}
                    Unusual Spending: ${transactions.insights.unusualSpending.length} transactions identified
                    Savings Opportunities: ${transactions.insights.savingsOpportunities.length} opportunities found
                    Recurring Expenses: ${transactions.insights.recurringExpenses.length} recurring expenses detected
                    
                    Transaction Summary: ${transactions.insights.summary || 'No transaction summary available'}
                    
                    Based on this transaction data, answer the user's question: "${message}"
                    
                    PERSONALITY GUIDELINES:
                    - Be friendly and conversational, like you're chatting with a friend
                    - Use occasional emojis where appropriate (1-2 per message)
                    - Refer to the user by their first name
                    - Be encouraging and positive, even when discussing financial challenges
                    - Ask a follow-up question at the end to keep the conversation going
                    - Vary your responses and never sound repetitive or robotic
                    
                    Provide specific, actionable advice based on their actual transaction patterns.
                    Keep your response under 250 words and make it engaging.
                    `;
                } else if (isPredictionQuery) {
                    console.log('Processing prediction query');
                    // Enhanced prompt for prediction queries with personality and engagement
                    contextualPrompt = `
                    You are Kita-kita, a friendly and insightful financial assistant with a warm, supportive personality. You're talking to ${userData?.firstName || 'User'} about their future finances. Your goal is to provide forward-looking advice that's both helpful and encouraging.
                    
                    USER INFO:
                    Name: ${userData?.firstName || 'User'} ${userData?.lastName || ''}
                    
                    CURRENT FINANCIAL DATA:
                    Total Balance: ₱${accounts.totalBalance.toFixed(2)}
                    Monthly Income: ₱${financialMetrics.monthlyIncome.toFixed(2)}
                    Monthly Expenses: ₱${financialMetrics.monthlyExpenses.toFixed(2)}
                    Savings Rate: ${financialMetrics.savingsRate}%
                    
                    FINANCIAL PREDICTIONS (Next 3 Months):
                    Predicted Monthly Income: ₱${predictions.predictedMonthlyIncome.toFixed(2)}
                    Predicted Recurring Expenses: ₱${predictions.recurringExpenses.toFixed(2)}
                    Predicted Non-Recurring Expenses: ₱${predictions.nonRecurringExpenses.toFixed(2)}
                    Predicted Savings: ₱${predictions.predictedSavings.toFixed(2)}
                    Predicted Balance After 3 Months: ₱${predictions.predictedEndingBalance.toFixed(2)}
                    
                    Prediction Summary: ${predictions.summary || 'No prediction summary available'}
                    
                    Based on these financial predictions, answer the user's question: "${message}"
                    
                    PERSONALITY GUIDELINES:
                    - Be optimistic but realistic about financial futures
                    - Use occasional emojis where appropriate (1-2 per message)
                    - Refer to the user by their first name
                    - Frame challenges as opportunities for growth
                    - Ask a follow-up question at the end to encourage planning
                    - Use vivid language to help the user visualize their financial future
                    - Vary your responses and never sound repetitive or robotic
                    
                    Be specific about future financial trends. Provide actionable advice based on predicted financial patterns.
                    Keep your response under 250 words and make it engaging and motivational.
                    `;
                } else {
                    console.log('Processing general financial query');
                    // Enhanced prompt for general financial queries with personality and engagement
                    contextualPrompt = `
                    You are Kita-kita, a friendly and knowledgeable financial assistant with a warm, supportive personality. You're having a conversation with ${userData?.firstName || 'User'} about their overall financial situation. Your goal is to provide holistic financial guidance that's personalized, actionable, and delivered in a friendly way.
                    
                    USER INFO:
                    Name: ${userData?.firstName || 'User'} ${userData?.lastName || ''}
                    
                    FINANCIAL DATA:
                    Total Balance: ₱${accounts.totalBalance.toFixed(2)}
                    Number of Accounts: ${accounts.count}
                    Monthly Income: ₱${financialMetrics.monthlyIncome.toFixed(2)}
                    Monthly Expenses: ₱${financialMetrics.monthlyExpenses.toFixed(2)}
                    Savings Rate: ${financialMetrics.savingsRate}%
                    
                    Top expense categories:
                    ${financialMetrics.topExpenseCategories.length > 0 ? 
                        financialMetrics.topExpenseCategories.map(c => 
                            `- ${c.category}: ₱${c.amount.toFixed(2)} (${c.percentage}% of expenses)`
                        ).join('\n') : 'No expense categories available'}
                    
                    Recent Transactions: ${transactions.count} total
                    ${transactions.recentTransactions.length > 0 ? 
                        transactions.recentTransactions.map((t, i) => 
                            `${i+1}. ${t.name}: ${t.type === 'income' ? '+' : '-'}₱${Math.abs(parseFloat(t.amount)).toFixed(2)} (${t.category || 'Uncategorized'}, ${new Date(t.date).toLocaleDateString()})`
                        ).slice(0, 3).join('\n') : 'No recent transactions available'}
                    
                    TRANSACTION INSIGHTS:
                    ${transactions.insights.summary || 'No transaction insights available'}
                    
                    FINANCIAL PREDICTIONS (Next 3 Months):
                    ${predictions.summary || 'No prediction data available'}
                    
                    Based on this comprehensive financial information, give a personalized response to the user's question/request: "${message}"
                    
                    PERSONALITY GUIDELINES:
                    - Be friendly and conversational, like you're chatting with a friend
                    - Use occasional emojis where appropriate (1-2 per message)
                    - Refer to the user by their first name frequently
                    - Celebrate financial wins, no matter how small
                    - Provide gentle guidance for financial challenges
                    - Ask a relevant follow-up question at the end
                    - Use analogies or examples to make financial concepts relatable
                    - Vary your responses and never sound repetitive or robotic
                    
                    Focus on providing specific, actionable advice based on the user's actual financial data.
                    Keep your response under 250 words and make it engaging, supportive, and motivational.
                    `;
                }
                
                // Enhanced API call with better error handling and variety
                try {
                    console.log('Calling Gemini API with enhanced implementation...');
                    console.log('Using API key:', GEMINI_API_KEY ? 'Valid key present' : 'Missing key');
                    console.log('Using model:', GEMINI_MODEL);
                    
                    // Adjust temperature for more varied responses
                    aiOptions.temperature = 0.7 + (Math.random() * 0.2); // Between 0.7 and 0.9 for more variety
                    aiOptions.maxTokens = 1000; // Ensure we get longer, more detailed responses
                    
                    // Add conversation context to the prompt for more coherent responses
                    if (conversationMemory && conversationMemory.lastQuery) {
                        contextualPrompt = `Previous question: "${conversationMemory.lastQuery}"

Current question: "${message}"

${contextualPrompt}`;
                    }
                    
                    // Add a direct instruction to vary responses
                    contextualPrompt += "\n\nIMPORTANT: Provide a unique, varied response each time. Never repeat the same generic advice. Be conversational and engaging.";
                    
                    // Log the prompt length for debugging
                    console.log('Prompt length:', contextualPrompt.length, 'characters');
                    
                    // Try the local implementation first (which has been enhanced)
                    responseText = await localCallGeminiAI(contextualPrompt, aiOptions);
                    console.log('Successfully received response from enhanced Gemini implementation');
                    console.log('Response preview:', responseText.substring(0, 100) + '...');
                    
                    // Check if we got a valid response
                    if (!responseText || responseText.length < 20) {
                        console.warn('Received suspiciously short response, trying fallback...');
                        throw new Error('Response too short');
                    }
                } catch (error) {
                    console.error('Error with enhanced Gemini implementation:', error);
                    
                    // Try the imported function as a backup
                    try {
                        console.log('Trying imported callGeminiAI as backup...');
                        responseText = await callGeminiAI(contextualPrompt, aiOptions);
                        console.log('Successfully received response from imported callGeminiAI');
                    } catch (backupError) {
                        console.error('Both Gemini implementations failed:', backupError);
                        
                        // Generate a varied fallback response based on the financial data
                        responseText = generateFallbackResponse(message, userContext);
                        console.log('Using fallback response mechanism');
                    }
                }
            } else {
                console.log('No user context available, providing general advice');
                // No user context available
                const contextualPrompt = `As a financial assistant, respond to: "${message}"\n\nProvide general financial advice since you don't have access to this user's specific financial data.`;
                
                try {
                    responseText = await callGeminiAI(contextualPrompt, {
                        temperature: 0.7,
                        maxTokens: 800
                    });
                } catch (error) {
                    console.error('Error calling Gemini API for general advice:', error);
                    responseText = generateGenericFinancialAdvice(message);
                }
            }
            
            // Remove loading indicator
            if (chatMessages.contains(loadingMessage)) {
                chatMessages.removeChild(loadingMessage);
            }
            
            if (responseText) {
                console.log('Response generated successfully');
                // Format the response text
                // Convert text with single asterisks to bullet points
                responseText = responseText.replace(/\n\s*\*\s*([^\n*]+)/g, '\n• $1');
                
                // Convert text with double asterisks to bold
                responseText = responseText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                
                addMessage('bot', responseText);
            } else {
                console.warn('Empty response received');
                addMessage('bot', 'I apologize, but I couldn\'t generate a specific response based on your financial data. Please try asking in a different way or check your financial information in the dashboard.');
            }
        } catch (error) {
            console.error('Critical error in getAIResponse:', error);
            
            // Remove loading indicator if it exists
            if (chatMessages.contains(loadingMessage)) {
                chatMessages.removeChild(loadingMessage);
            }
            
            addMessage('bot', `I apologize for the inconvenience. I'm having trouble analyzing your financial data right now. Please try again in a moment or check your financial information in the dashboard.`);
        }
    }
    
    // Generate a varied and personalized fallback response based on financial data when AI fails
    function generateFallbackResponse(message, context) {
        console.log('Generating enhanced fallback response based on financial data');
        const { userData, accounts, financialMetrics, transactions } = context;
        const firstName = userData?.firstName || 'there';
        
        // Get current time for time-based greetings
        const hour = new Date().getHours();
        let greeting = "Hi";
        if (hour < 12) greeting = "Good morning";
        else if (hour < 18) greeting = "Good afternoon";
        else greeting = "Good evening";
        
        // Add some variety with random emoji selection
        const emojis = {
            positive: ['✨', '👍', '🌟', '💪', '🚀'],
            money: ['💰', '💵', '💸', '🏦', '💹'],
            savings: ['🔐', '🏆', '💎', '🛡️', '🌱'],
            warning: ['⚠️', '🔔', '📊', '🔍', '📈']
        };
        
        const randomEmoji = (category) => {
            const options = emojis[category] || emojis.positive;
            return options[Math.floor(Math.random() * options.length)];
        };
        
        // Generate different response templates for variety
        const responseTemplates = [
            // Spending related templates
            () => `${greeting}, ${firstName}! ${randomEmoji('money')} I notice you've spent ₱${financialMetrics.monthlyExpenses.toFixed(2)} this month. ${financialMetrics.topExpenseCategories.length > 0 ? `Your biggest spending area is ${financialMetrics.topExpenseCategories[0].category} (₱${financialMetrics.topExpenseCategories[0].amount.toFixed(2)}). Maybe we could look at ways to optimize that?` : 'Would you like some tips on tracking your expenses more effectively?'}`,
            
            // Savings related templates
            () => `${greeting}, ${firstName}! ${randomEmoji('savings')} Your savings rate is currently at ${financialMetrics.savingsRate}%. ${financialMetrics.savingsRate < 15 ? "That's a bit below the recommended 15-20%. I have some ideas that might help boost your savings!" : "That's pretty good! Want to explore ways to make your savings work harder for you?"}`,
            
            // Income related templates
            () => `${greeting}, ${firstName}! ${randomEmoji('money')} With a monthly income of ₱${financialMetrics.monthlyIncome.toFixed(2)}, you have a good foundation. ${financialMetrics.monthlyIncome > financialMetrics.monthlyExpenses ? "You're earning more than you spend - that's excellent!" : "Let's look at ways to increase your income-to-expense ratio."}`,
            
            // Balance related templates
            () => `${greeting}, ${firstName}! ${randomEmoji('positive')} Your current balance across all accounts is ₱${accounts.totalBalance.toFixed(2)}. ${accounts.totalBalance > financialMetrics.monthlyExpenses * 3 ? "That's a healthy emergency fund!" : "Working toward a 3-6 month emergency fund would be a good goal."}`,
            
            // Transaction related templates
            () => {
                if (transactions && transactions.recentTransactions && transactions.recentTransactions.length > 0) {
                    const latest = transactions.recentTransactions[0];
                    return `${greeting}, ${firstName}! ${randomEmoji('money')} I see your most recent transaction was ${latest.name} for ₱${Math.abs(parseFloat(latest.amount)).toFixed(2)}. Looking at your overall financial picture, you have ₱${accounts.totalBalance.toFixed(2)} total with a ${financialMetrics.savingsRate}% savings rate.`;
                } else {
                    return `${greeting}, ${firstName}! ${randomEmoji('warning')} I don't see any recent transactions. Your overall financial picture shows ₱${accounts.totalBalance.toFixed(2)} total balance with a ${financialMetrics.savingsRate}% savings rate.`;
                }
            },
            
            // General financial health template
            () => `${greeting}, ${firstName}! ${randomEmoji('positive')} Here's a quick snapshot of your finances: Income: ₱${financialMetrics.monthlyIncome.toFixed(2)}, Expenses: ₱${financialMetrics.monthlyExpenses.toFixed(2)}, Savings rate: ${financialMetrics.savingsRate}%. ${financialMetrics.savingsRate < 10 ? "We should work on improving your savings rate." : "You're making good progress!"}`
        ];
        
        // Keyword matching for more relevant responses
        if (message.toLowerCase().includes('spend') || message.toLowerCase().includes('expense')) {
            return responseTemplates[0]();
        } else if (message.toLowerCase().includes('save') || message.toLowerCase().includes('saving')) {
            return responseTemplates[1]();
        } else if (message.toLowerCase().includes('income') || message.toLowerCase().includes('earn')) {
            return responseTemplates[2]();
        } else if (message.toLowerCase().includes('balance') || message.toLowerCase().includes('account')) {
            return responseTemplates[3]();
        } else if (message.toLowerCase().includes('transaction') || message.toLowerCase().includes('purchase')) {
            return responseTemplates[4]();
        } else {
            // For general queries, pick a random template for variety
            const randomIndex = Math.floor(Math.random() * responseTemplates.length);
            return responseTemplates[randomIndex]();
        }
    }
    
    // Generate generic financial advice when no user context is available
    function generateGenericFinancialAdvice(message) {
        console.log('Generating generic financial advice');
        
        if (message.toLowerCase().includes('spend') || message.toLowerCase().includes('expense')) {
            return "To improve your spending habits, consider using the 50/30/20 rule: allocate 50% of your income to needs, 30% to wants, and 20% to savings and debt repayment. Track your expenses for a month to identify areas where you can cut back.";
        } else if (message.toLowerCase().includes('save') || message.toLowerCase().includes('saving')) {
            return "For effective saving, start by building an emergency fund with 3-6 months of expenses. Then, set specific savings goals with timeframes. Automate your savings by setting up automatic transfers on payday to ensure consistency.";
        } else if (message.toLowerCase().includes('invest')) {
            return "When starting to invest, first ensure you have an emergency fund and have paid off high-interest debt. Consider low-cost index funds for beginners, and remember that diversification is key to managing risk. Start small and increase your investments as you learn more.";
        } else if (message.toLowerCase().includes('budget')) {
            return "Creating a budget starts with tracking all income and expenses. Categorize your spending, set realistic limits for each category, and review your budget regularly. Use digital tools or apps to make budgeting easier and more consistent.";
        } else {
            return "To improve your overall financial health, follow these key principles: spend less than you earn, build an emergency fund, pay off high-interest debt, save for retirement, and invest for long-term growth. Regular financial check-ups can help you stay on track with your goals.";
        }
    }
    
    // Test AI connection function
    async function testAIConnection() {
        try {
            console.log('🧪 Testing AI connection...');
            const testResponse = await localCallGeminiAI('Hello! Please respond with "AI connection successful" to confirm you are working.', {
                temperature: 0.1,
                maxTokens: 50
            });
            console.log('✅ AI Connection Test Result:', testResponse);
            return true;
        } catch (error) {
            console.error('❌ AI Connection Test Failed:', error);
            return false;
        }
    }
    
    // Add a debug function to window for manual testing
    window.testChatbotAI = testAIConnection;
    
    // Call the initialize function
    initializeChatbot();
    
    // Test AI connection on load (optional)
    setTimeout(() => {
        if (window.location.hash === '#test-ai') {
            testAIConnection();
        }
    }, 2000);
});
