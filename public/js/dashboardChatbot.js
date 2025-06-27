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
        const suggestionContainer = document.createElement('div');
        suggestionContainer.classList.add('suggestions');
        
        // Use a Set to ensure unique suggestions
        const uniqueSuggestions = new Set();
        while (uniqueSuggestions.size < 4 && financialSuggestions.length > 0) {
            const randomIndex = Math.floor(Math.random() * financialSuggestions.length);
            uniqueSuggestions.add(financialSuggestions[randomIndex]);
        }
        
        uniqueSuggestions.forEach(suggestion => {
            const button = document.createElement('button');
            button.textContent = suggestion;
            button.addEventListener('click', () => {
                userInput.value = suggestion;
                sendUserMessage();
            });
            suggestionContainer.appendChild(button);
        });
        
        chatMessages.appendChild(suggestionContainer);
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
                const contextualPrompt = await generatePrompt(message, userContext);
                
                // Use a try-catch block to handle potential AI errors gracefully
                try {
                    // Use the globally defined callGeminiAI function for consistency
                    console.log('Calling shared callGeminiAI function...');
                    responseText = await callGeminiAI(contextualPrompt, { maxTokens: 500 });
                } catch (error) {
                    console.error('Error getting AI response:', error);
                    responseText = generateFallbackResponse(message, {
                        error: true,
                        errorMessage: error.message
                    });
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
                responseText = responseText.replace(/\\n\\s*\\*\\s*([^\\n*]+)/g, '\n• $1');
                
                // Convert text with double asterisks to bold
                responseText = responseText.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
                
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
    
    // Function to generate the prompt for the AI
    async function generatePrompt(message, context) {
        const { userData, accounts, financialMetrics, transactions, predictions } = context;
        console.log('Using financial context for response generation');
        
        const isTransactionQuery = message.toLowerCase().includes('transaction') || 
                                   message.toLowerCase().includes('spending') || 
                                   message.toLowerCase().includes('expense');
        
        const isCategoryQuery = financialMetrics.topExpenseCategories.some(cat => 
            message.toLowerCase().includes(cat.category.toLowerCase()));
        
        const isPredictionQuery = message.toLowerCase().includes('predict') || 
                                  message.toLowerCase().includes('future') || 
                                  message.toLowerCase().includes('forecast');
        
        let contextualPrompt = '';
        
        if (isTransactionQuery || isCategoryQuery) {
            console.log('Processing transaction-specific query');
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
                ).join('\\n') : 'No expense categories available'}
            
            Recent Transactions: ${transactions.count} total
            ${transactions.recentTransactions.length > 0 ? 
                transactions.recentTransactions.map((t, i) => 
                    `${i+1}. ${t.name}: ${t.type === 'income' ? '+' : '-'}₱${Math.abs(parseFloat(t.amount)).toFixed(2)} (${t.category || 'Uncategorized'}, ${new Date(t.date).toLocaleDateString()})`
                ).slice(0, 3).join('\\n') : 'No recent transactions available'}
            
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
        
        return contextualPrompt;
    }
    
    function generateFallbackResponse(message, context) {
        let response = "I'm having a bit of trouble connecting to my AI brain right now, but I can still help! ";
        
        if (context && context.error) {
            response += `It seems there was an error: ${context.errorMessage}. `;
        }
        
        const randomEmoji = (category) => {
            const emojis = {
                'saving': ['💰', '📈', '💪'],
                'spending': ['💸', '🛍️', '🤔'],
                'budgeting': ['📊', '📝', '🎯'],
                'general': ['💡', '👍', '😊']
            };
            const list = emojis[category] || emojis['general'];
            return list[Math.floor(Math.random() * list.length)];
        };
        
        if (message.toLowerCase().includes('save') || message.toLowerCase().includes('saving')) {
            response += `A great rule of thumb for saving is the 50/30/20 rule: 50% of your income for needs, 30% for wants, and 20% for savings. How does that sound? ${randomEmoji('saving')}`;
        } else if (message.toLowerCase().includes('spend') || message.toLowerCase().includes('expense')) {
            response += `To understand your spending, try reviewing your last month's bank statement and categorizing each expense. You might be surprised where your money goes! ${randomEmoji('spending')}`;
        } else if (message.toLowerCase().includes('budget')) {
            response += `A simple way to start a budget is to list all your income sources and all your fixed expenses (like rent and bills). The amount left over is what you have for flexible spending and saving. Ready to give it a try? ${randomEmoji('budgeting')}`;
        } else {
            response += `You can always review your transactions on the dashboard to get a clear picture of your finances. What's one financial goal you have right now? ${randomEmoji('general')}`;
        }
        
        return response;
    }
    
    function generateGenericFinancialAdvice(message) {
        const lowerCaseMessage = message.toLowerCase();
        
        if (lowerCaseMessage.includes('invest')) {
            return "Investing is a great way to grow your wealth over time. Some common options in the Philippines include stocks, mutual funds, and Pag-IBIG MP2. It's wise to do some research or consult a financial advisor to see what fits your risk tolerance.";
        } else if (lowerCaseMessage.includes('debt')) {
            return "Tackling debt can feel empowering. Two popular methods are the 'Snowball' method (paying off smallest debts first for motivation) and the 'Avalanche' method (paying off debts with the highest interest rates first to save money).";
        } else if (lowerCaseMessage.includes('credit score')) {
            return "While the Philippines is still developing a centralized credit scoring system, paying bills on time, managing credit card debt wisely, and maintaining a healthy relationship with banks are all great habits that will build a positive credit history.";
        } else {
            return "That's a great question! For personalized advice, please log in or sign up so I can understand your financial situation better. For now, a universal tip is to always track your income and expenses to understand your cash flow.";
        }
    }

    async function testAIConnection() {
        try {
            console.log('🧪 Testing AI connection...');
            const testResponse = await callGeminiAI('Hello! Please respond with "AI connection successful" to confirm you are working.', {
                temperature: 0.1,
                maxTokens: 50
            });
            if (testResponse && testResponse.includes('successful')) {
                console.log('✅ AI Connection Test PASSED');
            } else {
                console.warn('⚠️ AI Connection Test FAILED: Unexpected response', testResponse);
            }
        } catch (error) {
            console.error('❌ AI Connection Test FAILED:', error);
        }
    }

    // Initialize the chatbot
    initializeChatbot();
    // Test the AI connection on startup
    testAIConnection();
});
