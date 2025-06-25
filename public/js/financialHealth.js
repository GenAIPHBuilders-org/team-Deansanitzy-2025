// Enhanced Financial Health Module using Gemini AI
let GEMINI_API_KEY = null;
let GEMINI_MODEL = 'gemini-1.5-flash';

// Financial Health Configuration
const FINANCIAL_HEALTH_CONFIG = {
    emergencyFundMonthsTarget: 6,
    savingsRateTarget: 20,
    debtToIncomeRatioMax: 36,
    expenseRatioMax: 80,
    animationDuration: 1000,
    refreshInterval: 300000, // 5 minutes
    chartColors: {
        primary: '#10df6f',
        secondary: '#1a73e8',
        warning: '#ff9500',
        danger: '#ff4757',
        success: '#2ed573',
        info: '#3742fa',
        neutral: '#747d8c'
    }
};

// Try to import config, fallback to defaults if not available
try {
    // This will be loaded dynamically in the init function
} catch (configError) {
    console.warn('Config file import will be handled dynamically');
}

// Import necessary Firebase functions
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { 
    getUserBankAccounts,
    getUserTransactions,
    collection,
    db,
    getDocs
} from "./firestoredb.js";

document.addEventListener('DOMContentLoaded', () => {
    const financialHealthContent = document.getElementById('financial-health-content');
    
    if (!financialHealthContent) return;
    
    const auth = getAuth();
    
    // Initialize Financial Health Widget
    initializeFinancialHealth();
    
    // Listen for transaction added events
    document.addEventListener('transactionAdded', async () => {
        console.log('Financial Health Module: Transaction added event received');
        await refreshFinancialHealth(auth.currentUser);
    });
    
    // Listen for bank account added events
    document.addEventListener('bankAccountAdded', async () => {
        console.log('Financial Health Module: Bank account added event received');
        await refreshFinancialHealth(auth.currentUser);
    });
    
    // Listen for custom refresh events
    document.addEventListener('refreshFinancialHealth', async () => {
        console.log('Financial Health Module: Refresh event received');
        await refreshFinancialHealth(auth.currentUser);
    });

    
    // Helper function to show loading state
    function showLoading(element) {
        if (!element) return;
        element.innerHTML = `
            <div class="loading-state">
                <div class="pulse-loader"></div>
                <p>Analyzing your financial health...</p>
            </div>
        `;
    }
    
    // Helper function to show error state
    function showError(message) {
        if (!financialHealthContent) return;
        financialHealthContent.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 2rem;">
                <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: var(--error-color); margin-bottom: 1.5rem;"></i>
                <h3>Something went wrong</h3>
                <p>${message}</p>
                <button id="retry-financial-health" class="btn btn-secondary mt-3">
                    <i class="fas fa-sync-alt"></i> Try Again
                </button>
            </div>
        `;
        
        const retryBtn = document.getElementById('retry-financial-health');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => refreshFinancialHealth(auth.currentUser));
        }
    }
    
    async function initializeFinancialHealth() {
        try {
            // Load config dynamically with better error handling
            try {
                const configModule = await import("./config.js");
                GEMINI_API_KEY = configModule.GEMINI_API_KEY;
                GEMINI_MODEL = configModule.GEMINI_MODEL || 'gemini-1.5-flash';
                console.log('Config loaded successfully, Gemini API available:', !!GEMINI_API_KEY);
            } catch (configError) {
                // Silently handle missing config.js - this is expected in many setups
                GEMINI_API_KEY = null;
                GEMINI_MODEL = 'gemini-1.5-flash';
                console.log('Using offline analysis mode (config.js not found)');
            }
            
            showLoading(financialHealthContent);
            
            // Check if user is logged in
            const user = auth.currentUser;
            if (!user) {
                // If no user yet, wait for auth state to change
                const unsubscribe = auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        unsubscribe(); // Stop listening once we have a user
                        try {
                            const userData = await getUserFinancialData(user);
                            processFinancialData(userData);
                        } catch (dataError) {
                            console.error('Error loading user data after auth:', dataError);
                            showError("Failed to load financial data. Please try again.");
                        }
                    } else {
                        showError("Please log in to view your financial health analysis.");
                    }
                });
                return;
            }
            
            // Get financial data from user's account
            try {
                const userData = await getUserFinancialData(user);
                processFinancialData(userData);
            } catch (dataError) {
                console.error('Error loading user financial data:', dataError);
                showError("Failed to load financial data. Please try again.");
            }
        } catch (error) {
            console.error('Error initializing financial health widget:', error);
            showError("Something went wrong. Please try again later.");
        }
    }
    
    // Refresh financial health data
    async function refreshFinancialHealth(user) {
        try {
            if (!user) user = auth.currentUser;
            if (!user) {
                console.error('No user for refreshing financial health');
                return;
            }

            console.log('Refreshing financial health with latest data...');
            showLoading(financialHealthContent);
            
            // Clear any cached data to ensure fresh analysis
            sessionStorage.removeItem('financialHealthAnalysis');
            
            // Get fresh financial data
            const userData = await getUserFinancialData(user);
            
            if (!userData) {
                console.error('Failed to get user financial data for refresh');
                showError("Failed to refresh financial health data.");
                return;
            }
            
            processFinancialData(userData);
            
            console.log('Financial health data refreshed successfully');
        } catch (error) {
            console.error('Error refreshing financial health data:', error);
            showError("Failed to refresh financial health data: " + (error.message || 'Unknown error'));
        }
    }
    
    async function processFinancialData(userData) {
        if (!userData) {
            console.log('No user data available, showing placeholder');
            showPlaceholderData();
            return;
        }
        
        try {
            console.log('Processing financial data:', {
                hasAccounts: userData.accounts > 0,
                hasTransactions: userData.recentTransactions?.length > 0,
                monthlyIncome: userData.monthlyIncome,
                monthlyExpenses: userData.monthlyExpenses
            });
            
            showLoading(financialHealthContent);
            
            // Analyze financial data with timeout
            const analysisPromise = analyzeFinancialHealth(userData);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Analysis timeout')), 15000)
            );
            
            const analysis = await Promise.race([analysisPromise, timeoutPromise]);
            
            // Render the widget with analysis results
            renderFinancialHealthWidget(analysis, userData);
            console.log('Financial health widget rendered successfully');
            
        } catch (error) {
            console.error('Error processing financial data:', error);
            if (error.message === 'Analysis timeout') {
                showError("Analysis is taking too long. Using offline analysis instead.");
                // Fallback to enhanced offline analysis
                try {
                    const fallbackAnalysis = enhancedOfflineAnalysis(userData);
                    renderFinancialHealthWidget(fallbackAnalysis, userData);
                } catch (fallbackError) {
                    console.error('Even fallback analysis failed:', fallbackError);
                    showPlaceholderData();
                }
            } else {
                showError("Failed to analyze financial data. Please try refreshing.");
            }
        }
    }
    
    function showPlaceholderData() {
        // Show empty state message instead of default analysis
        financialHealthContent.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 2rem;">
                <i class="fas fa-chart-line" style="font-size: 3rem; color: rgba(255, 255, 255, 0.3); margin-bottom: 1.5rem;"></i>
                <h3>No Financial Data Available</h3>
                <p>To see your financial health analysis:</p>
                <ul style="list-style: none; padding: 0; margin-top: 1rem; text-align: left; display: inline-block;">
                    <li style="margin-bottom: 0.5rem;"><i class="fas fa-plus-circle" style="margin-right: 0.5rem;"></i> Add bank accounts</li>
                    <li style="margin-bottom: 0.5rem;"><i class="fas fa-exchange-alt" style="margin-right: 0.5rem;"></i> Record transactions</li>
                </ul>
                <p style="margin-top: 1rem;">Once you have some financial activity, we'll analyze your data and provide personalized insights.</p>
            </div>
        `;
    }
    
    async function getUserFinancialData(user) {
        try {
            if (!user) {
                console.log('No user provided to getUserFinancialData');
                return null;
            }
            
            console.log('Fetching fresh financial data for user:', user.uid);
            
            // Wait a bit for auth state to fully settle
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // First check if there's fresh transaction data in sessionStorage
            let transactions = [];
            const cachedTransactions = sessionStorage.getItem('userTransactions');
            if (cachedTransactions) {
                try {
                    const parsed = JSON.parse(cachedTransactions);
                    if (parsed.timestamp && (Date.now() - parsed.timestamp < 5 * 60 * 1000)) { // 5 minute cache
                        console.log('Using cached transactions from sessionStorage');
                        transactions = parsed.data || [];
                    }
                } catch (e) {
                    console.error('Error parsing cached transactions:', e);
                }
            }
            
            // If no cached transactions, get fresh data from Firestore
            if (!transactions || transactions.length === 0) {
                console.log('No cached transactions, fetching from Firestore');
                try {
                    transactions = await getUserTransactions(user.uid);
                    console.log(`Fetched ${transactions.length} transactions from Firestore`);
                } catch (transactionError) {
                    console.error('Error fetching transactions:', transactionError);
                    // Continue with empty transactions array
                    transactions = [];
                }
            }
            
            // Get all bank accounts from Firestore
            let accounts = [];
            try {
                accounts = await getUserBankAccounts(user.uid);
                console.log(`Fetched ${accounts.length} bank accounts from Firestore`);
            } catch (accountError) {
                console.error('Error fetching bank accounts:', accountError);
                // Continue with empty accounts array
                accounts = [];
            }
            
            // Calculate total balance from accounts if they exist
            const totalBalance = accounts && accounts.length > 0 ? 
                accounts.reduce((sum, account) => sum + parseFloat(account.balance || 0), 0) : 0;
            
            // If no accounts and no transactions, return null
            if ((!accounts || accounts.length === 0) && transactions.length === 0) {
                return null;
            }
            
            // If there are transactions but no accounts, we can still analyze spending patterns
            if ((!accounts || accounts.length === 0) && transactions.length > 0) {
                // Calculate financial data based on transactions only
                const allTransactions = transactions;

                const totalIncome = allTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

                const totalExpenses = allTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);

                // Get transaction categories for all transactions
                const expenseCategories = {};
                allTransactions
                    .filter(t => t.type === 'expense')
                    .forEach(t => {
                        const category = t.category || 'other';
                        expenseCategories[category] = (expenseCategories[category] || 0) + Math.abs(parseFloat(t.amount || 0));
                    });

                // Format categories for analysis
                const formattedCategories = Object.entries(expenseCategories)
                    .map(([category, amount]) => ({ 
                        category, 
                        amount,
                        percentage: totalExpenses > 0 ? (amount / totalExpenses * 100).toFixed(1) : 0
                    }))
                    .sort((a, b) => b.amount - a.amount);

                // Check for recent unusual expenses (last 7 days)
                const lastWeek = new Date();
                lastWeek.setDate(lastWeek.getDate() - 7);
                const recentTransactions = allTransactions
                    .filter(t => new Date(t.date) >= lastWeek)
                    .sort((a, b) => Math.abs(parseFloat(b.amount)) - Math.abs(parseFloat(a.amount)));
                const largeExpenses = recentTransactions
                    .filter(t => t.type === 'expense' && Math.abs(parseFloat(t.amount)) > (totalIncome * 0.1))
                    .slice(0, 3);

                return {
                    totalBalance: totalIncome - totalExpenses, // Net balance from transactions
                    accounts: 0,
                    accountDetails: [], // No account details available
                    monthlyIncome: totalIncome,
                    monthlyExpenses: totalExpenses,
                    expenseCategories: formattedCategories,
                    recentTransactions: allTransactions, // Use all transactions for AI analysis
                    largeExpenses,
                    hasOnlyTransactions: true
                };
            }
            
            // If there are accounts but no transactions, return basic account data
            if (transactions.length === 0) {
                return {
                    totalBalance,
                    accounts: accounts.length,
                    accountDetails: accounts, // Include account details for analysis
                    monthlyIncome: 0,
                    monthlyExpenses: 0,
                    hasOnlyAccounts: true,
                    expenseCategories: []
                };
            }
            
            // Use ALL transactions, not just this month
            const allTransactions = transactions;

            // Calculate total income and expenses from all transactions
            const totalIncome = allTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

            const totalExpenses = allTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);

            // Get transaction categories for all transactions
            const expenseCategories = {};
            allTransactions
                .filter(t => t.type === 'expense')
                .forEach(t => {
                    const category = t.category || 'other';
                    expenseCategories[category] = (expenseCategories[category] || 0) + Math.abs(parseFloat(t.amount || 0));
                });

            // Format categories for analysis
            const formattedCategories = Object.entries(expenseCategories)
                .map(([category, amount]) => ({ 
                    category, 
                    amount,
                    percentage: totalExpenses > 0 ? (amount / totalExpenses * 100).toFixed(1) : 0
                }))
                .sort((a, b) => b.amount - a.amount);

            // Check for recent unusual expenses (last 7 days)
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            const recentTransactions = allTransactions
                .filter(t => new Date(t.date) >= lastWeek)
                .sort((a, b) => Math.abs(parseFloat(b.amount)) - Math.abs(parseFloat(a.amount)));
            const largeExpenses = recentTransactions
                .filter(t => t.type === 'expense' && Math.abs(parseFloat(t.amount)) > (totalIncome * 0.1))
                .slice(0, 3);

            return {
                totalBalance,
                accounts: accounts.length,
                accountDetails: accounts, // Include account details for analysis
                monthlyIncome: totalIncome,
                monthlyExpenses: totalExpenses,
                expenseCategories: formattedCategories,
                recentTransactions: allTransactions, // Use all transactions for AI analysis
                largeExpenses
            };
        } catch (error) {
            console.error('Error getting user financial data:', error);
            return null;
        }
    }
    
    async function analyzeFinancialHealth(userData) {
        console.log('Analyzing financial health with userData:', {
            totalBalance: userData.totalBalance,
            accounts: userData.accounts,
            hasAccountDetails: userData.accountDetails?.length > 0,
            monthlyIncome: userData.monthlyIncome,
            monthlyExpenses: userData.monthlyExpenses,
            transactionCount: userData.recentTransactions?.length || 0
        });
        
        // Skip cache and always recalculate to ensure we have the latest transaction data
        console.log('Forcing fresh analysis to include latest transactions');
        
        try {
            // Prepare detailed transaction data for AI analysis
            const detailedTransactions = (userData.recentTransactions || []).map((t, index) => ({
                id: index + 1,
                name: t.name || t.description || 'Unnamed Transaction',
                amount: t.amount,
                type: t.type,
                date: t.date,
                category: t.category || 'Other',
                channel: t.channel || 'N/A',
                notes: t.notes || '',
                timestamp: t.timestamp || t.date
            }));

            // Calculate basic metrics
            let savingsRate = null;
            if (userData.monthlyIncome > 0) {
                savingsRate = ((userData.monthlyIncome - userData.monthlyExpenses) / userData.monthlyIncome * 100).toFixed(2);
            }

            const emergencyFundMonths = userData.monthlyExpenses > 0 ? 
                (userData.totalBalance / userData.monthlyExpenses).toFixed(1) : 'N/A';

            // Enhanced prompt for critical transaction analysis
            const generateFinancialPrompt = () => {
                return `
                You are an expert Filipino financial advisor. Analyze this user's financial situation by examining EACH INDIVIDUAL TRANSACTION critically. Provide a comprehensive assessment.

                ## User's Financial Overview:
                - Total Balance: ₱${userData.totalBalance.toFixed(2)}
                - Monthly Income: ₱${userData.monthlyIncome.toFixed(2)}
                - Monthly Expenses: ₱${userData.monthlyExpenses.toFixed(2)}
                - Net Cash Flow: ₱${(userData.monthlyIncome - userData.monthlyExpenses).toFixed(2)}
                - Savings Rate: ${savingsRate || 'N/A'}%
                - Emergency Fund Coverage: ${emergencyFundMonths} months

                ## DETAILED TRANSACTION ANALYSIS:
                Please examine EACH transaction below individually and assess:
                - Spending necessity (needs vs wants)
                - Transaction timing patterns
                - Amount reasonableness for the category
                - Potential red flags or concerning patterns
                - Opportunities for optimization

                ${detailedTransactions.map(t => `
                Transaction #${t.id}:
                - Name: "${t.name}"
                - Amount: ₱${Math.abs(parseFloat(t.amount)).toFixed(2)} (${t.type})
                - Category: ${t.category}
                - Date: ${new Date(t.date).toLocaleDateString('en-PH')}
                - Channel: ${t.channel}
                - Notes: ${t.notes || 'None'}
                `).join('\n')}

                ## Expense Category Breakdown:
                ${userData.expenseCategories.map(c => 
                    `- ${c.category}: ₱${c.amount.toFixed(2)} (${c.percentage}% of total expenses)`
                ).join('\n')}

                ## INSTRUCTIONS FOR ANALYSIS:
                1. **Financial Health Score (0-100)**: Base this on:
                   - Income vs expenses ratio
                   - Spending patterns from individual transactions
                   - Emergency fund adequacy
                   - Quality of spending decisions
                   - Financial discipline observed in transactions

                2. **Critical Insights**: Provide 3-5 specific insights that reference:
                   - Specific transactions by name/amount
                   - Patterns you observe across multiple transactions
                   - Red flags or concerning spending behaviors
                   - Positive financial habits you notice
                   - Context-specific advice for Filipino financial situation

                3. **Actionable Recommendations**: Give 2-3 specific, practical suggestions that:
                   - Address specific transactions or categories you analyzed
                   - Are relevant to Filipino financial context
                   - Provide concrete next steps

                Label each insight as: "positive", "negative", "warning", "opportunity", or "neutral"

                Respond in valid JSON format:
                {
                    "score": 75,
                    "status": "Brief summary of their financial situation",
                    "insights": [
                        {"type": "negative", "text": "Your ₱1,200 spend at Restaurant ABC on Dec 15 represents 8% of your monthly income - consider meal planning to reduce dining costs."},
                        {"type": "warning", "text": "I notice 3 ATM withdrawals of ₱500 each in one week, suggesting potential impulse spending with cash."},
                        {"type": "opportunity", "text": "Your consistent ₱2,000 monthly savings shows good discipline - consider investing this in Pag-IBIG MP2 for better returns."}
                    ],
                    "suggestions": [
                        "Specific suggestion based on transaction analysis",
                        "Another specific suggestion with actionable steps"
                    ]
                }

                BE SPECIFIC: Reference actual transaction names, amounts, and dates. Don't give generic advice - analyze the real data provided.
                `;
            };

            // Minimal fallback only for extreme cases
            const minimalFallback = () => {
                const netFlow = userData.monthlyIncome - userData.monthlyExpenses;
                const score = netFlow > 0 ? Math.min(85, 50 + (netFlow / Math.max(userData.monthlyIncome, 1) * 35)) : Math.max(15, 50 + (netFlow / Math.max(userData.monthlyExpenses, 1) * 35));
                
                return {
                    score: Math.round(score),
                    status: `Based on your transaction analysis, you have a ${netFlow >= 0 ? 'positive' : 'negative'} cash flow of ₱${Math.abs(netFlow).toFixed(2)}`,
                    insights: [
                        {type: netFlow > 0 ? "positive" : "negative", text: `Your spending ${netFlow >= 0 ? 'is within' : 'exceeds'} your income by ₱${Math.abs(netFlow).toFixed(2)}.`},
                        {type: "neutral", text: `You have recorded ${detailedTransactions.length} transactions for analysis.`},
                        {type: "opportunity", text: "Enable detailed AI analysis by ensuring your Gemini API is properly configured."}
                    ],
                    suggestions: [
                        "Review your largest expense categories to identify potential savings.",
                        "Track your spending patterns more consistently for better insights."
                    ]
                };
            };

            // If no API key or no transactions, use enhanced offline analysis
            if (!GEMINI_API_KEY || detailedTransactions.length === 0) {
                console.log('Using enhanced offline analysis due to missing API key or no transactions');
                return enhancedOfflineAnalysis(userData);
            }

            // Check if we've recently hit rate limits (extended cooldown)
            const rateLimitKey = 'gemini_rate_limit_hit';
            const lastRateLimit = sessionStorage.getItem(rateLimitKey);
            if (lastRateLimit && Date.now() - parseInt(lastRateLimit) < 900000) { // 15 minutes cooldown
                console.log('⚠️ Rate limit cooldown active. Using enhanced offline analysis...');
                return enhancedOfflineAnalysis(userData);
            }
            
            // Check API call frequency to prevent spam
            const callCountKey = 'gemini_call_count';
            const callTimestampsStr = sessionStorage.getItem(callCountKey);
            let callTimestamps = [];
            if (callTimestampsStr) {
                try {
                    callTimestamps = JSON.parse(callTimestampsStr);
                } catch (e) {
                    callTimestamps = [];
                }
            }
            
            // Remove timestamps older than 1 hour
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            callTimestamps = callTimestamps.filter(timestamp => timestamp > oneHourAgo);
            
            // If more than 3 calls in the last hour, use offline analysis
            if (callTimestamps.length >= 3) {
                console.log('⚠️ API call limit reached for this hour. Using enhanced offline analysis...');
                return enhancedOfflineAnalysis(userData);
            }
            
            // Record this API call
            callTimestamps.push(Date.now());
            sessionStorage.setItem(callCountKey, JSON.stringify(callTimestamps));

            // Call Gemini API for detailed analysis
            const prompt = generateFinancialPrompt();
            console.log(`Using Gemini model: ${GEMINI_MODEL} for detailed transaction analysis`);
            
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        topP: 0.9,
                        topK: 40,
                        maxOutputTokens: 4096,
                        responseMimeType: "application/json"
                    }
                })
            });
            
            if (!response.ok) {
                console.error('Gemini API error:', response.status);
                
                // Handle specific error codes with user-friendly messages
                if (response.status === 429) {
                    console.log('⚠️ Gemini API rate limit exceeded. Using offline analysis...');
                    // Track rate limit hit for extended cooldown
                    sessionStorage.setItem('gemini_rate_limit_hit', Date.now().toString());
                    // Clear call count to reset tracking
                    sessionStorage.removeItem('gemini_call_count');
                    return enhancedOfflineAnalysis(userData);
                } else if (response.status === 403) {
                    console.log('⚠️ Gemini API access denied. Using offline analysis...');
                    return enhancedOfflineAnalysis(userData);
                } else if (response.status >= 500) {
                    console.log('⚠️ Gemini API server error. Using offline analysis...');
                    return enhancedOfflineAnalysis(userData);
                }
                
                return minimalFallback();
            }
            
            const data = await response.json();
            
            if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                const aiResponse = data.candidates[0].content.parts[0].text;
                
                try {
                    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const analysis = JSON.parse(jsonMatch[0]);
                        
                        // Validate required fields
                        if (analysis && typeof analysis.score === 'number' && 
                            analysis.status && Array.isArray(analysis.insights) && 
                            Array.isArray(analysis.suggestions)) {
                            
                            // Cache the result
                            sessionStorage.setItem('financialHealthAnalysis', JSON.stringify(analysis));
                            console.log('AI Analysis completed successfully:', analysis);
                            return analysis;
                        }
                    }
                    throw new Error('Invalid AI response format');
                } catch (parseError) {
                    console.error('Error parsing AI response:', parseError);
                    return minimalFallback();
                }
            }
            
            return minimalFallback();
                
        } catch (error) {
            console.error('Error in financial health analysis:', error);
            
            // Handle different types of errors
            if (error.message?.includes('rate limit') || error.message?.includes('429')) {
                console.log('⚠️ API rate limit detected in catch block. Using enhanced offline analysis...');
                // Track rate limit hit for extended cooldown
                sessionStorage.setItem('gemini_rate_limit_hit', Date.now().toString());
                // Clear call count to reset tracking
                sessionStorage.removeItem('gemini_call_count');
                return enhancedOfflineAnalysis(userData);
            } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                console.log('⚠️ Network error detected. Using enhanced offline analysis...');
                return enhancedOfflineAnalysis(userData);
            } else if (error.name === 'TypeError' && error.message?.includes('fetch')) {
                console.log('⚠️ Fetch blocked (likely by ad blocker). Using enhanced offline analysis...');
                return enhancedOfflineAnalysis(userData);
            }
            
            // Return enhanced offline analysis for any other error
            return enhancedOfflineAnalysis(userData);
        }
    }

    
    // Enhanced offline analysis function
    function enhancedOfflineAnalysis(userData) {
        console.log('🔄 Performing enhanced offline financial analysis...');
        
        if (!userData) {
            console.log('No userData provided to enhancedOfflineAnalysis');
            return {
                score: 0,
                status: "No financial data available",
                insights: [
                    {type: "info", text: "Running in offline analysis mode for privacy and reliability"},
                    {type: "warning", text: "No financial data found for analysis"}
                ],
                suggestions: ["Add bank accounts and transactions to get started"]
            };
        }
        
        const transactions = userData.recentTransactions || [];
        const accounts = userData.accountDetails || [];
        const totalIncome = userData.monthlyIncome || 0;
        const totalExpenses = userData.monthlyExpenses || 0;
        const netFlow = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? (netFlow / totalIncome) * 100 : 0;
        
        // Calculate score based on multiple factors
        let score = 50;
        const factors = [];
        
        // Savings rate factor (40% weight)
        if (savingsRate >= 30) {
            score += 20;
            factors.push('Excellent savings rate');
        } else if (savingsRate >= 20) {
            score += 15;
            factors.push('Good savings rate');
        } else if (savingsRate >= 10) {
            score += 10;
            factors.push('Moderate savings rate');
        } else if (savingsRate >= 0) {
            score += 5;
            factors.push('Low savings rate');
        } else {
            score -= 10;
            factors.push('Negative cash flow');
        }
        
        // Account diversification analysis (20% weight)
        if (accounts.length > 0) {
            const accountTypes = [...new Set(accounts.map(acc => acc.category || acc.accountType))];
            const digitalWallets = accounts.filter(acc => acc.category === 'digital-wallet').length;
            const traditionalBanks = accounts.filter(acc => acc.category === 'traditional-bank').length;
            
            if (accountTypes.length >= 3) {
                score += 15;
                factors.push('Well-diversified account portfolio');
            } else if (accountTypes.length >= 2) {
                score += 10;
                factors.push('Good account diversification');
            } else {
                score -= 5;
                factors.push('Limited account diversification');
            }
            
            if (digitalWallets > 0 && traditionalBanks > 0) {
                score += 5;
                factors.push('Good mix of digital and traditional banking');
            }
        }
        
        // Transaction patterns analysis (10% weight)
        if (transactions.length > 0) {
            const expenseTransactions = transactions.filter(t => t.type === 'expense');
            const avgExpense = expenseTransactions.length > 0 ? 
                expenseTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0) / expenseTransactions.length : 0;
            
            const largeExpenses = expenseTransactions.filter(t => Math.abs(parseFloat(t.amount) || 0) > avgExpense * 2).length;
            const smallFrequentExpenses = expenseTransactions.filter(t => Math.abs(parseFloat(t.amount) || 0) < 100).length;
            
            if (largeExpenses < expenseTransactions.length * 0.1) {
                score += 5;
                factors.push('Controlled spending patterns');
            } else if (largeExpenses > expenseTransactions.length * 0.3) {
                score -= 5;
                factors.push('Several large expenses detected');
            }
            
            if (smallFrequentExpenses > expenseTransactions.length * 0.7) {
                score -= 3;
                factors.push('Many small frequent expenses');
            }
        }
        
        // Income stability factor (20% weight)
        if (totalIncome > 0) {
            if (totalIncome >= 50000) {
                score += 10;
                factors.push('Good income level');
            } else if (totalIncome >= 25000) {
                score += 5;
                factors.push('Moderate income level');
            }
        }
        
        // Expense ratio factor (10% weight)
        const expenseRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 100;
        if (expenseRatio < 50) {
            score += 10;
            factors.push('Low expense ratio');
        } else if (expenseRatio > 90) {
            score -= 10;
            factors.push('High expense ratio');
        }
        
        // Clamp score between 0 and 100
        score = Math.max(0, Math.min(100, score));
        
        // Generate insights based on analysis
        const insights = [];
        
        // Add offline mode notice
        insights.push({
            type: "info",
            text: "🔒 Analysis running in offline mode for enhanced privacy and reliability. Your data stays secure on your device."
        });
        
        // Net flow insight
        if (netFlow > 0) {
            insights.push({
                type: "positive", 
                text: `Positive monthly cash flow: ₱${netFlow.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            });
        } else if (netFlow < 0) {
            insights.push({
                type: "negative", 
                text: `Monthly overspending: ₱${Math.abs(netFlow).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            });
        } else {
            insights.push({
                type: "neutral", 
                text: "Breaking even - income equals expenses"
            });
        }
        
        // Savings rate insight
        if (savingsRate >= 20) {
            insights.push({
                type: "positive", 
                text: `Strong savings rate: ${savingsRate.toFixed(1)}% of income`
            });
        } else if (savingsRate >= 10) {
            insights.push({
                type: "neutral", 
                text: `Moderate savings rate: ${savingsRate.toFixed(1)}% of income`
            });
        } else if (savingsRate >= 0) {
            insights.push({
                type: "warning", 
                text: `Low savings rate: ${savingsRate.toFixed(1)}% of income`
            });
        } else {
            insights.push({
                type: "negative", 
                text: `Negative savings rate: ${savingsRate.toFixed(1)}%`
            });
        }
        
        // Account diversity insight
        if (accounts.length > 0) {
            const accountTypes = [...new Set(accounts.map(acc => acc.category || acc.accountType))];
            const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
            
            if (accountTypes.length >= 3) {
                insights.push({
                    type: "positive", 
                    text: `Excellent account diversification with ${accountTypes.length} different account types`
                });
            } else if (accountTypes.length >= 2) {
                insights.push({
                    type: "neutral", 
                    text: `Good account setup with ${accountTypes.length} account types`
                });
            } else {
                insights.push({
                    type: "opportunity", 
                    text: "Consider diversifying with additional account types for better financial management"
                });
            }
            
            insights.push({
                type: "neutral", 
                text: `Managing ${accounts.length} accounts with total balance of ₱${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            });
        }
        
        // Transaction volume insight
        if (transactions.length > 0) {
            insights.push({
                type: "neutral", 
                text: `${transactions.length} transactions analyzed this period`
            });
            
            const expenseTransactions = transactions.filter(t => t.type === 'expense');
            if (expenseTransactions.length > 20) {
                insights.push({
                    type: "warning", 
                    text: "High transaction frequency - consider consolidating purchases"
                });
            }
        }
        
        // Generate suggestions based on analysis
        const suggestions = [];
        
        if (savingsRate < 10) {
            suggestions.push("Aim to save at least 10-20% of your income for financial security");
        }
        
        if (netFlow < 0) {
            suggestions.push("Review your expenses to identify areas where you can reduce spending");
        }
        
        if (transactions.length > 0) {
            const categories = [...new Set(transactions.map(t => t.category).filter(Boolean))];
            if (categories.length > 0) {
                suggestions.push(`Track spending by category: ${categories.slice(0, 3).join(', ')}${categories.length > 3 ? '...' : ''}`);
            }
        }
        
        if (totalIncome > 0 && totalExpenses / totalIncome > 0.8) {
            suggestions.push("Consider creating a stricter budget to increase your savings");
        }
        
        suggestions.push("Continue tracking transactions for better financial insights");
        
        // Determine status based on score
        let status;
        if (score >= 80) status = "Strong Financial Health";
        else if (score >= 60) status = "Good Financial Health";
        else if (score >= 40) status = "Fair Financial Health";
        else status = "Needs Improvement";
        
        console.log('✅ Enhanced offline analysis completed:', { score, status, insights: insights.length, suggestions: suggestions.length });
        
        return {
            score: Math.round(score),
            status: status,
            insights: insights.slice(0, 6), // Limit to 6 insights
            suggestions: suggestions.slice(0, 4) // Limit to 4 suggestions
        };
    }

    // Function to analyze transaction patterns
    function analyzeTransactionPatterns(transactions) {
        if (!transactions || transactions.length === 0) {
            return {
                frequentSmallTransactions: false,
                weekendSpending: false,
                impulseTransactions: false,
                lateNightTransactions: false
            };
        }
        
        // Count small transactions (less than ₱500)
        const smallTransactions = transactions.filter(t => 
            t.type === 'expense' && Math.abs(parseFloat(t.amount)) < 500
        );
        const frequentSmallTransactions = smallTransactions.length >= 5;
        
        // Check for weekend spending pattern
        const weekendTransactions = transactions.filter(t => {
            const date = new Date(t.date);
            const day = date.getDay();
            return t.type === 'expense' && (day === 0 || day === 6); // 0 is Sunday, 6 is Saturday
        });
        const weekendSpending = weekendTransactions.length >= 3;
        
        // Check for potential impulse transactions (small amounts, entertainment/shopping categories)
        const impulseCategories = ['entertainment', 'shopping', 'dining', 'food'];
        const impulseTransactions = transactions.filter(t => 
            t.type === 'expense' && 
            Math.abs(parseFloat(t.amount)) < 1000 && 
            impulseCategories.some(cat => t.category?.toLowerCase().includes(cat))
        ).length >= 3;
        
        // Check for late-night transactions (10 PM - 5 AM)
        const lateNightTransactions = transactions.filter(t => {
            const date = new Date(t.date);
            const hour = date.getHours();
            return t.type === 'expense' && (hour >= 22 || hour <= 5);
        }).length >= 2;
        
        return {
            frequentSmallTransactions,
            weekendSpending,
            impulseTransactions,
            lateNightTransactions
        };
    }
    
    // Function to identify recurring expenses
    function identifyRecurringExpenses(transactions) {
        if (!transactions || transactions.length === 0) {
            return [];
        }
        
        // Group transactions by name and category
        const groups = {};
        transactions.forEach(t => {
            if (t.type !== 'expense') return;
            
            const key = `${t.name?.toLowerCase() || ''}|${t.category?.toLowerCase() || ''}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push({
                amount: Math.abs(parseFloat(t.amount)),
                date: new Date(t.date),
                name: t.name || t.description || 'Unknown',
                category: t.category || 'Other'
            });
        });
        
        // Find recurring transactions (same name/category, similar amount)
        const recurringExpenses = [];
        Object.keys(groups).forEach(key => {
            const group = groups[key];
            if (group.length >= 2) {
                // Check if amounts are similar (within 20% of each other)
                const amounts = group.map(t => t.amount);
                const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
                const similarAmounts = amounts.every(amount => 
                    Math.abs(amount - avgAmount) / avgAmount <= 0.2
                );
                
                if (similarAmounts) {
                    // Determine frequency
                    let frequency = 'Unknown';
                    if (group.length >= 3) {
                        // Sort by date
                        group.sort((a, b) => a.date - b.date);
                        
                        // Calculate average days between transactions
                        let totalDays = 0;
                        for (let i = 1; i < group.length; i++) {
                            const daysDiff = (group[i].date - group[i-1].date) / (1000 * 60 * 60 * 24);
                            totalDays += daysDiff;
                        }
                        const avgDays = totalDays / (group.length - 1);
                        
                        if (avgDays <= 3) {
                            frequency = 'Daily';
                        } else if (avgDays <= 10) {
                            frequency = 'Weekly';
                        } else if (avgDays <= 35) {
                            frequency = 'Monthly';
                        } else {
                            frequency = 'Periodic';
                        }
                    } else {
                        frequency = 'Recurring';
                    }
                    
                    recurringExpenses.push({
                        name: group[0].name,
                        category: group[0].category,
                        amount: avgAmount,
                        frequency: frequency,
                        occurrences: group.length
                    });
                }
            }
        });
        
        return recurringExpenses;
    }
    
    function renderFinancialHealthWidget(analysis, userData) {
        // Ensure we have suggestions array (backward compatibility)
        const suggestions = analysis.suggestions || (analysis.suggestion ? [analysis.suggestion] : []);
        
        // Limit insights to a maximum of 6
        const limitedInsights = analysis.insights.slice(0, 6);
        
        // Calculate detailed financial metrics
        const detailedMetrics = calculateDetailedMetrics(userData);
        const financialGoals = calculateFinancialGoals(userData);
        const trendAnalysis = calculateTrendAnalysis(userData);
        
        // Determine score color and status with more granular levels
        const getScoreColor = (score) => {
            if (score >= 90) return { color: '#2ed573', status: 'Outstanding', emoji: '🌟', description: 'Exceptional financial health' };
            if (score >= 80) return { color: '#10df6f', status: 'Excellent', emoji: '🎉', description: 'Strong financial foundation' };
            if (score >= 70) return { color: '#26de81', status: 'Very Good', emoji: '✨', description: 'Solid financial position' };
            if (score >= 60) return { color: '#ffd700', status: 'Good', emoji: '👍', description: 'On the right track' };
            if (score >= 50) return { color: '#ffa502', status: 'Fair', emoji: '📈', description: 'Room for improvement' };
            if (score >= 40) return { color: '#ff9500', status: 'Needs Work', emoji: '⚠️', description: 'Requires attention' };
            if (score >= 30) return { color: '#ff6348', status: 'Poor', emoji: '🚨', description: 'Needs immediate action' };
            return { color: '#ff4757', status: 'Critical', emoji: '🆘', description: 'Urgent financial review needed' };
        };
        
        const scoreInfo = getScoreColor(analysis.score);
        
        // Calculate progress percentage for animation
        const progressPercentage = (analysis.score / 100) * 100;
        
        // Generate comprehensive charts data
        const chartsData = generateChartsData(userData, detailedMetrics);
        
        const html = `
            <div class="financial-health-container">
                <!-- Header Section -->
                <div class="financial-health-header">
                    <div class="header-content">
                        <div class="header-title">
                            <div class="title-icon-wrapper">
                                <i class="fas fa-heartbeat pulsing"></i>
                                <div class="pulse-ring"></div>
                        </div>
                            <div class="title-text">
                                <span class="main-title">Financial Health Dashboard</span>
                                <span class="sub-title">AI-Powered Analysis & Insights</span>
                            </div>
                        </div>
                        <div class="header-actions">
                            <button class="action-btn export-btn" id="export-report" title="Export Report">
                                <i class="fas fa-download"></i>
                                <span>Export</span>
                            </button>
                            <button class="action-btn refresh-btn" id="refresh-financial-health" title="Refresh Analysis">
                            <i class="fas fa-sync-alt"></i>
                                <span>Refresh</span>
                        </button>
                    </div>
                    </div>
                    <div class="header-stats">
                        <div class="stat-pill">
                        <i class="fas fa-clock"></i>
                        <span>Updated ${new Date().toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        })}</span>
                        </div>
                        <div class="stat-pill">
                            <i class="fas fa-database"></i>
                            <span>${userData?.recentTransactions?.length || 0} Transactions</span>
                        </div>
                        <div class="stat-pill">
                            <i class="fas fa-university"></i>
                            <span>${userData?.accounts || 0} Accounts</span>
                        </div>
                    </div>
                </div>

                <!-- Main Dashboard Layout -->
                <div class="dashboard-layout">
                <!-- Score Section -->
                    <div class="score-section">
                        <div class="score-circle-container">
                            <div class="score-circle-wrapper">
                        <div class="score-circle">
                                    <svg class="progress-ring" width="160" height="160" viewBox="0 0 160 160">
                                        <defs>
                                            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" style="stop-color:${scoreInfo.color};stop-opacity:0.3" />
                                                <stop offset="100%" style="stop-color:${scoreInfo.color};stop-opacity:1" />
                                            </linearGradient>
                                            <filter id="glow">
                                                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                                <feMerge> 
                                                    <feMergeNode in="coloredBlur"/>
                                                    <feMergeNode in="SourceGraphic"/> 
                                                </feMerge>
                                            </filter>
                                        </defs>
                                        <circle class="progress-ring-background" cx="80" cy="80" r="70" 
                                                fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="10"></circle>
                                        <circle class="progress-ring-progress" cx="80" cy="80" r="70" 
                                                fill="none" stroke="url(#scoreGradient)" stroke-width="10" 
                                                stroke-linecap="round" filter="url(#glow)"
                                                style="--progress: ${progressPercentage}; 
                                                       transform: rotate(-90deg); 
                                                       transform-origin: 80px 80px;
                                                       stroke-dasharray: ${2 * Math.PI * 70};
                                                       stroke-dashoffset: ${2 * Math.PI * 70 * (1 - progressPercentage / 100)};
                                                       transition: stroke-dashoffset 2s ease-in-out;"></circle>
                            </svg>
                            <div class="score-content">
                                        <div class="score-number animate-score" style="color: ${scoreInfo.color}" data-target="${analysis.score}">0</div>
                                <div class="score-max">/100</div>
                                        <div class="score-label">Health Score</div>
                            </div>
                        </div>
                                <div class="score-particles"></div>
                            </div>
                            <div class="score-status-card" style="background: linear-gradient(135deg, ${scoreInfo.color}20, ${scoreInfo.color}10);">
                                <span class="status-emoji animate-bounce">${scoreInfo.emoji}</span>
                                <div class="status-content">
                                    <span class="status-text" style="color: ${scoreInfo.color}">${scoreInfo.status}</span>
                                    <span class="status-description">${scoreInfo.description}</span>
                                </div>
                        </div>
                    </div>
                </div>

                    <!-- Metrics Section -->
                    <div class="metrics-section">
                        <div class="section-title">
                            <h3><i class="fas fa-chart-bar"></i> Financial Health Metrics</h3>
                        </div>
                        ${generateHealthMetricsBar(detailedMetrics, scoreInfo.color)}
                    </div>
                </div>

                <!-- Financial Overview Section -->
                <div class="financial-overview-section">
                    <div class="section-title">
                        <h3><i class="fas fa-chart-line"></i> Financial Overview</h3>
                        <span class="overview-period">Current Period</span>
                    </div>
                    
                ${userData ? `
                        <div class="overview-grid">
                            <div class="overview-card primary">
                                <div class="card-header">
                                    <div class="card-icon income-icon">
                                <i class="fas fa-arrow-up"></i>
                            </div>
                                    <div class="card-trend positive">
                                        <i class="fas fa-trending-up"></i>
                                        <span>+5.2%</span>
                            </div>
                        </div>
                                <div class="card-content">
                                    <div class="card-label">Monthly Income</div>
                                    <div class="card-value">₱${userData.monthlyIncome.toLocaleString()}</div>
                                    <div class="card-subtitle">Average: ₱${Math.round(userData.monthlyIncome * 0.95).toLocaleString()}</div>
                                </div>
                            </div>

                            <div class="overview-card secondary">
                                <div class="card-header">
                                    <div class="card-icon expense-icon">
                                <i class="fas fa-arrow-down"></i>
                            </div>
                                    <div class="card-trend ${userData.monthlyExpenses > userData.monthlyIncome ? 'negative' : 'neutral'}">
                                        <i class="fas fa-${userData.monthlyExpenses > userData.monthlyIncome ? 'trending-up' : 'minus'}"></i>
                                        <span>${userData.monthlyExpenses > userData.monthlyIncome ? '+' : ''}${((userData.monthlyExpenses / Math.max(userData.monthlyIncome, 1) - 1) * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                                <div class="card-content">
                                    <div class="card-label">Monthly Expenses</div>
                                    <div class="card-value">₱${userData.monthlyExpenses.toLocaleString()}</div>
                                    <div class="card-subtitle">${userData.monthlyIncome > 0 ? Math.round((userData.monthlyExpenses / userData.monthlyIncome) * 100) : 0}% of income</div>
                                </div>
                            </div>

                            <div class="overview-card balance">
                                <div class="card-header">
                                    <div class="card-icon balance-icon">
                                <i class="fas fa-wallet"></i>
                            </div>
                                    <div class="card-trend ${userData.totalBalance >= 0 ? 'positive' : 'negative'}">
                                        <i class="fas fa-${userData.totalBalance >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                                        <span>${userData.totalBalance >= 0 ? 'Positive' : 'Negative'}</span>
                                    </div>
                                </div>
                                <div class="card-content">
                                    <div class="card-label">Net Balance</div>
                                    <div class="card-value ${userData.totalBalance >= 0 ? 'positive' : 'negative'}">
                                    ₱${userData.totalBalance.toLocaleString()}
                                </div>
                                    <div class="card-subtitle">${userData.accounts || 0} accounts tracked</div>
                            </div>
                        </div>

                            <div class="overview-card savings">
                                <div class="card-header">
                                    <div class="card-icon savings-icon">
                                        <i class="fas fa-piggy-bank"></i>
                    </div>
                                    <div class="card-trend ${(userData.monthlyIncome - userData.monthlyExpenses) > 0 ? 'positive' : 'negative'}">
                                        <i class="fas fa-${(userData.monthlyIncome - userData.monthlyExpenses) > 0 ? 'plus' : 'minus'}"></i>
                                        <span>${userData.monthlyIncome > 0 ? Math.round(((userData.monthlyIncome - userData.monthlyExpenses) / userData.monthlyIncome) * 100) : 0}%</span>
                                    </div>
                                </div>
                                <div class="card-content">
                                    <div class="card-label">Monthly Savings</div>
                                    <div class="card-value ${(userData.monthlyIncome - userData.monthlyExpenses) >= 0 ? 'positive' : 'negative'}">
                                        ₱${Math.abs(userData.monthlyIncome - userData.monthlyExpenses).toLocaleString()}
                                    </div>
                                    <div class="card-subtitle">${(userData.monthlyIncome - userData.monthlyExpenses) >= 0 ? 'Surplus' : 'Deficit'}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Financial Goals Progress -->
                        <div class="goals-progress-section">
                            <div class="section-subtitle">
                                <h4><i class="fas fa-target"></i> Financial Goals Progress</h4>
                            </div>
                            ${generateGoalsProgress(financialGoals, userData)}
                        </div>
                    ` : `
                        <div class="no-data-message">
                            <i class="fas fa-chart-line"></i>
                            <h4>No Financial Data Available</h4>
                            <p>Connect your accounts and add transactions to see detailed insights</p>
                        </div>
                    `}
                </div>

                <!-- AI Analysis Section -->
                <div class="ai-analysis-section">
                    <div class="analysis-header">
                        <div class="section-title">
                            <h3><i class="fas fa-brain"></i> AI-Powered Analysis</h3>
                            <span class="analysis-badge">Powered by Gemini AI</span>
                        </div>
                        <div class="analysis-summary">
                            <div class="summary-card">
                                <div class="summary-icon">
                                    <i class="fas fa-robot"></i>
                                </div>
                                <div class="summary-content">
                                    <div class="summary-title">Analysis Status</div>
                                    <div class="summary-value">${analysis.status}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                ${limitedInsights.length > 0 ? `
                        <!-- Insights Grid -->
                        <div class="insights-container">
                            <div class="insights-header">
                                <h4><i class="fas fa-lightbulb"></i> Key Insights</h4>
                                <span class="insights-count">${limitedInsights.length} insights discovered</span>
                        </div>
                        <div class="insights-grid">
                            ${limitedInsights.map((insight, index) => `
                                <div class="insight-card ${insight.type}" style="animation-delay: ${index * 0.1}s">
                                    <div class="insight-header">
                                        <div class="insight-icon ${insight.type}">
                                            <i class="fas ${getInsightIcon(insight.type)}"></i>
                                        </div>
                                            <div class="insight-meta">
                                        <div class="insight-type-label">${insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}</div>
                                                <div class="insight-priority">${getInsightPriority(insight.type)}</div>
                                            </div>
                                    </div>
                                    <div class="insight-content">
                                            <p>${insight.text}</p>
                                        </div>
                                        <div class="insight-actions">
                                            <button class="insight-action-btn" onclick="handleInsightAction('${insight.type}', ${index})">
                                                <i class="fas fa-arrow-right"></i>
                                                <span>Learn More</span>
                                            </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : `
                        <div class="no-insights-message">
                            <i class="fas fa-search"></i>
                            <h4>Analyzing Your Financial Data</h4>
                            <p>Add more transactions to receive personalized insights</p>
                        </div>
                    `}
                </div>

                <!-- Action Plan Section -->
                <div class="action-plan-section">
                    <div class="section-title">
                        <h3><i class="fas fa-tasks"></i> Personalized Action Plan</h3>
                        <div class="plan-meta">
                            <span class="plan-priority">High Priority</span>
                            <span class="plan-timeline">30-day focus</span>
                        </div>
                    </div>

                ${suggestions.length > 0 ? `
                        <div class="action-roadmap">
                            <div class="roadmap-header">
                                <h4><i class="fas fa-route"></i> Your Financial Roadmap</h4>
                                <span class="roadmap-count">${suggestions.length} action items</span>
                        </div>
                            <div class="roadmap-timeline">
                            ${suggestions.map((suggestion, index) => `
                                    <div class="timeline-item" style="animation-delay: ${(limitedInsights.length + index) * 0.1}s">
                                        <div class="timeline-marker">
                                            <div class="timeline-number">${index + 1}</div>
                                            <div class="timeline-connector ${index === suggestions.length - 1 ? 'last' : ''}"></div>
                                        </div>
                                        <div class="timeline-content">
                                            <div class="timeline-card">
                                                <div class="card-header">
                                                    <div class="action-priority ${getActionPriority(index)}">
                                                        <i class="fas ${getActionIcon(index)}"></i>
                                                        <span>${getActionPriorityLabel(index)}</span>
                                                    </div>
                                                    <div class="action-timeline">
                                                        <i class="fas fa-clock"></i>
                                                        <span>${getActionTimeline(index)}</span>
                                                    </div>
                                                </div>
                                                <div class="action-content">
                                                    <h5>Action Step ${index + 1}</h5>
                                        <p>${suggestion}</p>
                                    </div>
                                                <div class="action-footer">
                                                    <div class="action-difficulty">
                                                        <span>Difficulty: </span>
                                                        <div class="difficulty-bars">
                                                            ${Array.from({length: 5}, (_, i) => 
                                                                `<div class="difficulty-bar ${i < getActionDifficulty(index) ? 'active' : ''}"></div>`
                                                            ).join('')}
                                                        </div>
                                                    </div>
                                                    <button class="action-btn primary" onclick="handleActionStart(${index}, '${suggestion.replace(/'/g, "\\'")}')">
                                                        <i class="fas fa-play"></i>
                                                        <span>Start Now</span>
                                        </button>
                                                </div>
                                            </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                        <!-- Quick Actions -->
                        <div class="quick-actions-section">
                            <h4><i class="fas fa-zap"></i> Quick Actions</h4>
                            <div class="quick-actions-grid">
                                <button class="quick-action-btn" onclick="handleQuickAction('budget')">
                                    <i class="fas fa-calculator"></i>
                                    <span>Create Budget</span>
                                </button>
                                <button class="quick-action-btn" onclick="handleQuickAction('goal')">
                                    <i class="fas fa-target"></i>
                                    <span>Set Goal</span>
                                </button>
                                <button class="quick-action-btn" onclick="handleQuickAction('emergency')">
                                    <i class="fas fa-shield-alt"></i>
                                    <span>Emergency Fund</span>
                                </button>
                                <button class="quick-action-btn" onclick="handleQuickAction('invest')">
                                    <i class="fas fa-chart-line"></i>
                                    <span>Start Investing</span>
                                </button>
                            </div>
                        </div>
                    ` : `
                        <div class="no-actions-message">
                            <i class="fas fa-clipboard-list"></i>
                            <h4>No Action Items Yet</h4>
                            <p>Complete your financial profile to receive personalized recommendations</p>
                            <button class="setup-btn" onclick="handleSetupProfile()">
                                <i class="fas fa-user-cog"></i>
                                <span>Complete Profile</span>
                            </button>
                        </div>
                    `}
                </div>

                <!-- Footer -->
                <div class="financial-health-footer">
                    <div class="powered-by">
                        <i class="fas fa-robot"></i>
                        <span>Powered by AI Analysis</span>
                    </div>
                    <div class="next-update">
                        <i class="fas fa-calendar-alt"></i>
                        <span>Next update in 24h</span>
                    </div>
                </div>
            </div>
        `;
        
        // Update the widget content
        financialHealthContent.innerHTML = html;
        
        // Add comprehensive inline styles for enhanced financial health widget
        const enhancedFinancialHealthStyles = `
            <style>
                /* Enhanced Financial Health Widget Styles */
                .financial-health-container {
                    background: linear-gradient(135deg, rgba(16, 223, 111, 0.05), rgba(26, 115, 232, 0.03));
                    border-radius: 20px;
                    padding: 2rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    position: relative;
                    overflow: hidden;
                    animation: containerFadeIn 0.8s ease-out;
                    max-width: none;
                    width: 100%;
                }

                /* Main Dashboard Layout */
                .dashboard-layout {
                    display: grid;
                    grid-template-columns: 1fr 2fr;
                    gap: 2rem;
                    margin-bottom: 2rem;
                    align-items: start;
                }

                .score-section {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .score-circle-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                }

                .score-status-card {
                    padding: 1.5rem;
                    border-radius: 15px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    width: 100%;
                    text-align: left;
                }

                .metrics-section {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .section-title {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .section-title h3 {
                    color: rgba(255, 255, 255, 0.95);
                    font-size: 1.2rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin: 0;
                }

                .section-title h3 i {
                    color: #10df6f;
                }

                .financial-health-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, #10df6f, #1a73e8, #10df6f);
                    background-size: 200% 100%;
                    animation: headerGlow 3s linear infinite;
                }

                @keyframes containerFadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes headerGlow {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }

                /* Header Styles */
                .financial-health-header {
                    margin-bottom: 2rem;
                }

                .header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .title-icon-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .title-icon-wrapper .fa-heartbeat {
                    font-size: 2rem;
                    color: #10df6f;
                    z-index: 2;
                    position: relative;
                }

                .pulse-ring {
                    position: absolute;
                    border: 2px solid #10df6f;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: pulse 2s infinite;
                    opacity: 0.3;
                }

                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.3; }
                    50% { transform: scale(1.2); opacity: 0.1; }
                    100% { transform: scale(1.4); opacity: 0; }
                }

                .pulsing {
                    animation: heartbeat 1.5s ease-in-out infinite;
                }

                @keyframes heartbeat {
                    0%, 50%, 100% { transform: scale(1); }
                    25% { transform: scale(1.1); }
                }

                .title-text {
                    display: flex;
                    flex-direction: column;
                }

                .main-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.95);
                    margin-bottom: 0.25rem;
                }

                .sub-title {
                    font-size: 0.9rem;
                    color: rgba(255, 255, 255, 0.6);
                    font-weight: 400;
                }

                .header-actions {
                    display: flex;
                    gap: 0.75rem;
                }

                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    backdrop-filter: blur(5px);
                }

                .action-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.2);
                    color: rgba(255, 255, 255, 0.95);
                    transform: translateY(-1px);
                }

                .header-stats {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .stat-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 25px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    font-size: 0.8rem;
                    color: rgba(255, 255, 255, 0.7);
                }

                .stat-pill i {
                    color: #10df6f;
                }

                /* Enhanced Score Section */
                .financial-health-score-section {
                    margin: 2rem 0;
                }

                .score-main {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 2rem;
                    align-items: center;
                }

                .score-circle-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .score-circle {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .score-content {
                    position: absolute;
                    text-align: center;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                }

                .score-number {
                    font-size: 2.5rem;
                    font-weight: 800;
                    line-height: 1;
                    margin-bottom: 0.25rem;
                }

                .score-max {
                    font-size: 1rem;
                    color: rgba(255, 255, 255, 0.5);
                    font-weight: 400;
                }

                .score-label {
                    font-size: 0.8rem;
                    color: rgba(255, 255, 255, 0.6);
                    margin-top: 0.25rem;
                }

                .animate-score {
                    transition: all 0.5s ease-out;
                }

                .score-particles {
                    position: absolute;
                    width: 200px;
                    height: 200px;
                    pointer-events: none;
                }

                .score-details {
                    flex: 1;
                }

                .score-status {
                    padding: 1.5rem;
                    border-radius: 15px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .status-emoji {
                    font-size: 2rem;
                }

                .animate-bounce {
                    animation: bounce 2s infinite;
                }

                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-10px); }
                    60% { transform: translateY(-5px); }
                }

                .status-content {
                    flex: 1;
                }

                .status-text {
                    font-size: 1.2rem;
                    font-weight: 700;
                    margin-bottom: 0.25rem;
                    display: block;
                }

                .status-description {
                    font-size: 0.9rem;
                    color: rgba(255, 255, 255, 0.7);
                    display: block;
                }

                .score-description {
                    font-size: 1rem;
                    color: rgba(255, 255, 255, 0.8);
                    line-height: 1.5;
                }

                /* Health Metrics Bar */
                .health-metrics-bar {
                    margin: 2rem 0;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }

                .metric-card {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    padding: 1.25rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .metric-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, transparent, var(--primary-green), transparent);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .metric-card:hover {
                    background: rgba(255, 255, 255, 0.05);
                    transform: translateY(-2px);
                }

                .metric-card:hover::before {
                    opacity: 1;
                }

                .metric-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                }

                .metric-header i {
                    color: #10df6f;
                    font-size: 1.2rem;
                }

                .metric-label {
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 0.9rem;
                }

                .metric-value {
                    margin-bottom: 0.75rem;
                }

                .metric-value .value {
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.95);
                }

                .metric-value .target {
                    font-size: 0.9rem;
                    color: rgba(255, 255, 255, 0.5);
                    margin-left: 0.25rem;
                }

                .metric-progress {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .progress-bar {
                    flex: 1;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    border-radius: 3px;
                    transition: width 1s ease-out;
                    position: relative;
                }

                .progress-fill::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                    animation: shimmer 2s infinite;
                }

                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }

                .progress-text {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.8);
                }

                /* Quick Stats Enhanced */
                .quick-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 1.25rem;
                    margin: 2rem 0;
                }

                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.25rem;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 15px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .stat-item::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 4px;
                    height: 100%;
                    background: linear-gradient(180deg, transparent, var(--primary-green), transparent);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .stat-item:hover {
                    background: rgba(255, 255, 255, 0.05);
                    transform: translateY(-2px);
                }

                .stat-item:hover::before {
                    opacity: 1;
                }

                .stat-icon {
                    width: 50px;
                    height: 50px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.4rem;
                    position: relative;
                }

                .stat-icon::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: 12px;
                    padding: 2px;
                    background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
                    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    mask-composite: exclude;
                }

                .stat-icon.income { 
                    background: linear-gradient(135deg, rgba(16, 223, 111, 0.2), rgba(16, 223, 111, 0.1)); 
                    color: #10df6f; 
                }
                .stat-icon.expense { 
                    background: linear-gradient(135deg, rgba(233, 109, 31, 0.2), rgba(233, 109, 31, 0.1)); 
                    color: #e96d1f; 
                }
                .stat-icon.balance { 
                    background: linear-gradient(135deg, rgba(26, 115, 232, 0.2), rgba(26, 115, 232, 0.1)); 
                    color: #1a73e8; 
                }

                .stat-content {
                    flex: 1;
                }

                .stat-label {
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 0.85rem;
                    margin-bottom: 0.5rem;
                    font-weight: 500;
                }

                .stat-value {
                    color: rgba(255, 255, 255, 0.95);
                    font-weight: 700;
                    font-size: 1.1rem;
                }

                .stat-value.positive { color: #10df6f; }
                .stat-value.negative { color: #e96d1f; }

                /* Insights Section Enhanced */
                .insights-section, .suggestions-section {
                    margin: 2rem 0;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .section-header h3 {
                    color: rgba(255, 255, 255, 0.95);
                    font-size: 1.2rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .section-header h3 i {
                    color: #10df6f;
                }

                .insights-count, .suggestions-count {
                    background: rgba(16, 223, 111, 0.2);
                    color: #10df6f;
                    padding: 0.25rem 0.75rem;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .insights-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1rem;
                }

                .insight-card {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    padding: 1.25rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    transition: all 0.3s ease;
                    animation: slideInUp 0.5s ease-out forwards;
                    opacity: 0;
                    transform: translateY(20px);
                }

                .insight-card:hover {
                    background: rgba(255, 255, 255, 0.05);
                    transform: translateY(-2px);
                }

                @keyframes slideInUp {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .insight-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 0.75rem;
                }

                .insight-icon {
                    width: 35px;
                    height: 35px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1rem;
                }

                .insight-icon.positive { background: rgba(46, 213, 115, 0.2); color: #2ed573; }
                .insight-icon.negative { background: rgba(255, 71, 87, 0.2); color: #ff4757; }
                .insight-icon.warning { background: rgba(255, 149, 0, 0.2); color: #ff9500; }
                .insight-icon.opportunity { background: rgba(58, 123, 213, 0.2); color: #3a7bd5; }
                .insight-icon.neutral { background: rgba(116, 125, 140, 0.2); color: #747d8c; }

                .insight-type-label {
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: rgba(255, 255, 255, 0.7);
                }

                .insight-content {
                    color: rgba(255, 255, 255, 0.85);
                    line-height: 1.5;
                    font-size: 0.9rem;
                }

                /* Suggestions Section */
                .suggestions-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .suggestion-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    padding: 1.25rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    transition: all 0.3s ease;
                    animation: slideInLeft 0.5s ease-out forwards;
                    opacity: 0;
                    transform: translateX(-20px);
                }

                .suggestion-card:hover {
                    background: rgba(255, 255, 255, 0.05);
                    transform: translateX(0) translateY(-2px);
                }

                @keyframes slideInLeft {
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                .suggestion-number {
                    width: 35px;
                    height: 35px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #10df6f, #26de81);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.9rem;
                    flex-shrink: 0;
                }

                .suggestion-content {
                    flex: 1;
                }

                .suggestion-content p {
                    margin: 0;
                    color: rgba(255, 255, 255, 0.85);
                    line-height: 1.5;
                }

                .suggestion-action .action-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(16, 223, 111, 0.1);
                    border: 1px solid rgba(16, 223, 111, 0.3);
                    color: #10df6f;
                    transition: all 0.3s ease;
                }

                .suggestion-action .action-btn:hover {
                    background: rgba(16, 223, 111, 0.2);
                    transform: rotate(45deg);
                }

                /* Footer */
                .financial-health-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 2rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }

                .powered-by, .next-update {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 0.8rem;
                }

                .powered-by i, .next-update i {
                    color: #10df6f;
                }

                /* Financial Overview Section */
                .financial-overview-section {
                    margin: 2rem 0;
                }

                .overview-period {
                    background: rgba(16, 223, 111, 0.2);
                    color: #10df6f;
                    padding: 0.25rem 0.75rem;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .overview-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.25rem;
                    margin-bottom: 2rem;
                }

                .overview-card {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 15px;
                    padding: 1.5rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .overview-card:hover {
                    background: rgba(255, 255, 255, 0.05);
                    transform: translateY(-2px);
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .card-icon {
                    width: 45px;
                    height: 45px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.3rem;
                }

                .income-icon { background: linear-gradient(135deg, rgba(16, 223, 111, 0.2), rgba(16, 223, 111, 0.1)); color: #10df6f; }
                .expense-icon { background: linear-gradient(135deg, rgba(233, 109, 31, 0.2), rgba(233, 109, 31, 0.1)); color: #e96d1f; }
                .balance-icon { background: linear-gradient(135deg, rgba(26, 115, 232, 0.2), rgba(26, 115, 232, 0.1)); color: #1a73e8; }
                .savings-icon { background: linear-gradient(135deg, rgba(156, 39, 176, 0.2), rgba(156, 39, 176, 0.1)); color: #9c27b0; }

                .card-trend {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.8rem;
                    font-weight: 600;
                    padding: 0.25rem 0.5rem;
                    border-radius: 8px;
                }

                .card-trend.positive { background: rgba(46, 213, 115, 0.2); color: #2ed573; }
                .card-trend.negative { background: rgba(255, 71, 87, 0.2); color: #ff4757; }
                .card-trend.neutral { background: rgba(116, 125, 140, 0.2); color: #747d8c; }

                .card-content {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .card-label {
                    color: rgba(255, 255, 255, 0.7);
                    font-size: 0.9rem;
                    font-weight: 500;
                }

                .card-value {
                    color: rgba(255, 255, 255, 0.95);
                    font-size: 1.5rem;
                    font-weight: 700;
                    line-height: 1;
                }

                .card-subtitle {
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 0.8rem;
                }

                /* Goals Progress */
                .goals-progress-section {
                    margin-top: 2rem;
                }

                .section-subtitle h4 {
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 1rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0 0 1rem 0;
                }

                .goals-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1rem;
                }

                .goal-card {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    padding: 1.25rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .goal-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .goal-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    background: rgba(16, 223, 111, 0.2);
                    color: #10df6f;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.1rem;
                }

                .goal-info h5 {
                    color: rgba(255, 255, 255, 0.9);
                    margin: 0 0 0.25rem 0;
                    font-size: 0.9rem;
                    font-weight: 600;
                }

                .goal-target {
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 0.8rem;
                }

                .goal-progress {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .progress-value {
                    display: flex;
                    align-items: baseline;
                    gap: 0.25rem;
                }

                .progress-value .current {
                    color: rgba(255, 255, 255, 0.9);
                    font-weight: 600;
                    font-size: 1rem;
                }

                .progress-value .target {
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 0.8rem;
                }

                /* AI Analysis Section */
                .ai-analysis-section {
                    margin: 2rem 0;
                }

                .analysis-header {
                    margin-bottom: 2rem;
                }

                .analysis-badge {
                    background: linear-gradient(135deg, #10df6f, #26de81);
                    color: white;
                    padding: 0.25rem 0.75rem;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .analysis-summary {
                    margin-top: 1rem;
                }

                .summary-card {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    padding: 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .summary-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    background: rgba(58, 123, 213, 0.2);
                    color: #3a7bd5;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.1rem;
                }

                .summary-title {
                    color: rgba(255, 255, 255, 0.7);
                    font-size: 0.8rem;
                    margin-bottom: 0.25rem;
                }

                .summary-value {
                    color: rgba(255, 255, 255, 0.9);
                    font-weight: 600;
                    font-size: 0.9rem;
                }

                /* Insights Container */
                .insights-container {
                    margin-top: 2rem;
                }

                .insights-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .insights-header h4 {
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 1.1rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0;
                }

                .insights-count {
                    background: rgba(16, 223, 111, 0.2);
                    color: #10df6f;
                    padding: 0.25rem 0.75rem;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .insight-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .insight-priority {
                    font-size: 0.7rem;
                    color: rgba(255, 255, 255, 0.6);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .insight-actions {
                    margin-top: 1rem;
                    display: flex;
                    justify-content: flex-end;
                }

                .insight-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: rgba(16, 223, 111, 0.1);
                    border: 1px solid rgba(16, 223, 111, 0.3);
                    border-radius: 8px;
                    color: #10df6f;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .insight-action-btn:hover {
                    background: rgba(16, 223, 111, 0.2);
                    transform: translateX(5px);
                }

                /* Action Plan Section */
                .action-plan-section {
                    margin: 2rem 0;
                }

                .plan-meta {
                    display: flex;
                    gap: 1rem;
                }

                .plan-priority, .plan-timeline {
                    background: rgba(255, 149, 0, 0.2);
                    color: #ff9500;
                    padding: 0.25rem 0.75rem;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .plan-timeline {
                    background: rgba(58, 123, 213, 0.2);
                    color: #3a7bd5;
                }

                /* Action Roadmap */
                .action-roadmap {
                    margin-top: 2rem;
                }

                .roadmap-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }

                .roadmap-header h4 {
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 1.1rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0;
                }

                .roadmap-count {
                    background: rgba(16, 223, 111, 0.2);
                    color: #10df6f;
                    padding: 0.25rem 0.75rem;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                /* Timeline */
                .roadmap-timeline {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .timeline-item {
                    display: flex;
                    gap: 1rem;
                    animation: slideInLeft 0.5s ease-out forwards;
                    opacity: 0;
                    transform: translateX(-20px);
                }

                .timeline-marker {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    flex-shrink: 0;
                }

                .timeline-number {
                    width: 35px;
                    height: 35px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #10df6f, #26de81);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.9rem;
                    z-index: 2;
                }

                .timeline-connector {
                    width: 2px;
                    height: 60px;
                    background: linear-gradient(180deg, #10df6f, rgba(16, 223, 111, 0.3));
                    margin-top: 0.5rem;
                }

                .timeline-connector.last {
                    display: none;
                }

                .timeline-content {
                    flex: 1;
                }

                .timeline-card {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    padding: 1.25rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    transition: all 0.3s ease;
                }

                .timeline-card:hover {
                    background: rgba(255, 255, 255, 0.05);
                    transform: translateY(-2px);
                }

                .timeline-card .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .action-priority {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .action-priority.high { background: rgba(255, 71, 87, 0.2); color: #ff4757; }
                .action-priority.medium { background: rgba(255, 149, 0, 0.2); color: #ff9500; }
                .action-priority.low { background: rgba(58, 123, 213, 0.2); color: #3a7bd5; }

                .action-timeline {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 0.8rem;
                }

                .action-content h5 {
                    color: rgba(255, 255, 255, 0.9);
                    margin: 0 0 0.5rem 0;
                    font-size: 1rem;
                    font-weight: 600;
                }

                .action-content p {
                    color: rgba(255, 255, 255, 0.8);
                    margin: 0;
                    line-height: 1.5;
                }

                .action-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }

                .action-difficulty {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 0.8rem;
                }

                .difficulty-bars {
                    display: flex;
                    gap: 2px;
                }

                .difficulty-bar {
                    width: 4px;
                    height: 12px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 2px;
                }

                .difficulty-bar.active {
                    background: #ff9500;
                }

                .action-btn.primary {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: linear-gradient(135deg, #10df6f, #26de81);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .action-btn.primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(16, 223, 111, 0.3);
                }

                /* Quick Actions */
                .quick-actions-section {
                    margin-top: 2rem;
                }

                .quick-actions-section h4 {
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 1rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0 0 1rem 0;
                }

                .quick-actions-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 1rem;
                }

                .quick-action-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .quick-action-btn:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: rgba(255, 255, 255, 0.95);
                    transform: translateY(-2px);
                }

                .quick-action-btn i {
                    font-size: 1.2rem;
                    color: #10df6f;
                }

                /* No Data Messages */
                .no-data-message, .no-insights-message, .no-actions-message {
                    text-align: center;
                    padding: 2rem;
                    color: rgba(255, 255, 255, 0.6);
                }

                .no-data-message i, .no-insights-message i, .no-actions-message i {
                    font-size: 2rem;
                    color: rgba(255, 255, 255, 0.3);
                    margin-bottom: 1rem;
                }

                .setup-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.5rem;
                    background: rgba(16, 223, 111, 0.1);
                    border: 1px solid rgba(16, 223, 111, 0.3);
                    border-radius: 10px;
                    color: #10df6f;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    margin: 1rem auto 0;
                }

                .setup-btn:hover {
                    background: rgba(16, 223, 111, 0.2);
                    transform: translateY(-2px);
                }

                /* Responsive Design */
                @media (max-width: 1200px) {
                    .dashboard-layout {
                        grid-template-columns: 1fr;
                        gap: 2rem;
                    }

                    .score-circle-container {
                        flex-direction: row;
                        justify-content: center;
                        align-items: center;
                        gap: 2rem;
                    }

                    .score-status-card {
                        max-width: 400px;
                    }
                }

                @media (max-width: 768px) {
                    .financial-health-container {
                        padding: 1.5rem;
                    }

                    .dashboard-layout {
                        grid-template-columns: 1fr;
                        gap: 1.5rem;
                    }

                    .score-circle-container {
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .header-content {
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .insights-grid {
                        grid-template-columns: 1fr;
                    }

                    .metrics-grid {
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    }

                    .overview-grid {
                        grid-template-columns: 1fr;
                    }

                    .goals-grid {
                        grid-template-columns: 1fr;
                    }

                    .quick-actions-grid {
                        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    }
                }

                /* Loading States */
                .loading-state {
                    text-align: center;
                    padding: 3rem;
                    color: rgba(255, 255, 255, 0.7);
                }

                .pulse-loader {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #10df6f, #1a73e8);
                    margin: 0 auto 1rem;
                    animation: pulseLoader 1.5s ease-in-out infinite;
                }

                @keyframes pulseLoader {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.7; }
                }

                /* Error States */
                .error-state {
                    text-align: center;
                    padding: 3rem;
                    color: rgba(255, 255, 255, 0.7);
                }

                .error-state .btn {
                    margin-top: 1rem;
                    padding: 0.75rem 1.5rem;
                    background: rgba(16, 223, 111, 0.1);
                    border: 1px solid rgba(16, 223, 111, 0.3);
                    border-radius: 10px;
                    color: #10df6f;
                    transition: all 0.3s ease;
                }

                .error-state .btn:hover {
                    background: rgba(16, 223, 111, 0.2);
                    transform: translateY(-2px);
                }
            </style>
        `;
        
        // Inject enhanced styles if not already present
        if (!document.querySelector('#enhanced-financial-health-styles')) {
            const styleElement = document.createElement('div');
            styleElement.id = 'enhanced-financial-health-styles';
            styleElement.innerHTML = enhancedFinancialHealthStyles;
            document.head.appendChild(styleElement);
        }

        // Initialize animations and interactive elements
        initializeAnimations();
        initializeInteractions();
        
        // Add event listener to refresh button
        const refreshButton = document.getElementById('refresh-financial-health');
        if (refreshButton) {
            refreshButton.addEventListener('click', (e) => {
                e.preventDefault();
                const button = e.currentTarget;
                const icon = button.querySelector('i');
                
                // Add spinning animation
                icon.style.animation = 'spin 1s linear infinite';
                button.disabled = true;
                
                const user = auth.currentUser;
                if (user) {
                    refreshFinancialHealth(user).finally(() => {
                        // Remove spinning animation after refresh
                        setTimeout(() => {
                            icon.style.animation = '';
                            button.disabled = false;
                        }, 1000);
                    });
                }
            });
        }

        // Add entrance animations
        setTimeout(() => {
            const container = document.querySelector('.financial-health-container');
            if (container) {
                container.classList.add('loaded');
            }
        }, 100);
    }
    
    function getInsightIcon(type) {
        switch (type) {
            case 'positive': return 'fa-arrow-up';
            case 'negative': return 'fa-arrow-down';
            case 'neutral': return 'fa-minus';
            case 'warning': return 'fa-exclamation-triangle';
            case 'opportunity': return 'fa-star';
            default: return 'fa-info-circle';
        }
    }

    // Enhanced utility functions for detailed financial analysis
    function calculateDetailedMetrics(userData) {
        if (!userData) return {};
        
        const income = userData.monthlyIncome || 0;
        const expenses = userData.monthlyExpenses || 0;
        const balance = userData.totalBalance || 0;
        const accounts = userData.accounts || 0;
        
        // Calculate savings rate
        const savingsRate = income > 0 ? ((income - expenses) / income * 100) : 0;
        
        // Calculate emergency fund coverage
        const emergencyFundMonths = expenses > 0 ? (balance / expenses) : 0;
        
        // Calculate expense ratio
        const expenseRatio = income > 0 ? (expenses / income * 100) : 0;
        
        // Calculate account diversification score
        const diversificationScore = Math.min(accounts * 20, 100);
        
        // Calculate financial stability score
        const stabilityScore = calculateStabilityScore(userData);
        
        // Calculate debt-to-income ratio (estimated)
        const debtToIncomeRatio = calculateDebtToIncomeRatio(userData);
        
        return {
            savingsRate: Math.round(savingsRate * 10) / 10,
            emergencyFundMonths: Math.round(emergencyFundMonths * 10) / 10,
            expenseRatio: Math.round(expenseRatio),
            diversificationScore: Math.round(diversificationScore),
            stabilityScore: Math.round(stabilityScore),
            debtToIncomeRatio: Math.round(debtToIncomeRatio),
            netWorth: balance,
            monthlyNetFlow: income - expenses
        };
    }
    
    function calculateFinancialGoals(userData) {
        if (!userData) return {};
        
        const income = userData.monthlyIncome || 0;
        const expenses = userData.monthlyExpenses || 0;
        const balance = userData.totalBalance || 0;
        
        // Emergency fund goal
        const emergencyFundGoal = expenses * FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget;
        const emergencyFundProgress = Math.min((balance / emergencyFundGoal) * 100, 100);
        
        // Savings goal
        const monthlySavingsGoal = income * (FINANCIAL_HEALTH_CONFIG.savingsRateTarget / 100);
        const currentSavings = income - expenses;
        const savingsGoalProgress = monthlySavingsGoal > 0 ? Math.min((currentSavings / monthlySavingsGoal) * 100, 100) : 0;
        
        // Investment goal (10% of income)
        const monthlyInvestmentGoal = income * 0.10;
        const investmentProgress = 0; // Would need investment data
        
        return {
            emergencyFund: {
                current: balance,
                goal: emergencyFundGoal,
                progress: Math.round(emergencyFundProgress),
                timeToGoal: calculateTimeToGoal(balance, emergencyFundGoal, currentSavings)
            },
            savings: {
                current: currentSavings,
                goal: monthlySavingsGoal,
                progress: Math.round(savingsGoalProgress)
            },
            investment: {
                current: 0,
                goal: monthlyInvestmentGoal,
                progress: Math.round(investmentProgress)
            }
        };
    }
    
    function calculateTrendAnalysis(userData) {
        if (!userData || !userData.recentTransactions) return {};
        
        const transactions = userData.recentTransactions;
        const now = new Date();
        
        // Analyze last 30 days vs previous 30 days
        const last30Days = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const daysDiff = (now - transactionDate) / (1000 * 60 * 60 * 24);
            return daysDiff <= 30;
        });
        
        const previous30Days = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const daysDiff = (now - transactionDate) / (1000 * 60 * 60 * 24);
            return daysDiff > 30 && daysDiff <= 60;
        });
        
        const currentSpending = last30Days
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
        
        const previousSpending = previous30Days
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
        
        const spendingTrend = previousSpending > 0 ? 
            ((currentSpending - previousSpending) / previousSpending * 100) : 0;
        
        return {
            spendingTrend: Math.round(spendingTrend * 10) / 10,
            transactionFrequency: last30Days.length,
            averageTransactionSize: last30Days.length > 0 ? 
                (currentSpending / last30Days.filter(t => t.type === 'expense').length) : 0
        };
    }
    
    function calculateStabilityScore(userData) {
        let score = 50; // Base score
        
        if (!userData) return score;
        
        const income = userData.monthlyIncome || 0;
        const expenses = userData.monthlyExpenses || 0;
        const balance = userData.totalBalance || 0;
        
        // Income stability (estimated)
        if (income > 0) score += 20;
        if (income > 25000) score += 10;
        if (income > 50000) score += 10;
        
        // Expense control
        const expenseRatio = income > 0 ? (expenses / income) : 1;
        if (expenseRatio < 0.8) score += 10;
        if (expenseRatio < 0.6) score += 10;
        
        // Emergency fund
        const emergencyMonths = expenses > 0 ? (balance / expenses) : 0;
        if (emergencyMonths >= 3) score += 10;
        if (emergencyMonths >= 6) score += 10;
        
        return Math.min(Math.max(score, 0), 100);
    }
    
    function calculateDebtToIncomeRatio(userData) {
        // This is estimated based on expense patterns
        // In a real application, you'd have actual debt data
        if (!userData || !userData.recentTransactions) return 0;
        
        const debtRelatedTransactions = userData.recentTransactions.filter(t => 
            t.type === 'expense' && (
                t.category?.toLowerCase().includes('loan') ||
                t.category?.toLowerCase().includes('credit') ||
                t.category?.toLowerCase().includes('debt') ||
                t.name?.toLowerCase().includes('payment') ||
                t.name?.toLowerCase().includes('installment')
            )
        );
        
        const estimatedMonthlyDebt = debtRelatedTransactions
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
        
        const income = userData.monthlyIncome || 0;
        return income > 0 ? (estimatedMonthlyDebt / income * 100) : 0;
    }
    
    function calculateTimeToGoal(current, goal, monthlyContribution) {
        if (monthlyContribution <= 0 || current >= goal) return 0;
        return Math.ceil((goal - current) / monthlyContribution);
    }
    
    function generateHealthMetricsBar(metrics, primaryColor) {
        if (!metrics) return '';
        
        const metricsData = [
            { label: 'Savings Rate', value: metrics.savingsRate, target: 20, unit: '%', icon: 'fa-piggy-bank' },
            { label: 'Emergency Fund', value: metrics.emergencyFundMonths, target: 6, unit: ' months', icon: 'fa-shield-alt' },
            { label: 'Diversification', value: metrics.diversificationScore, target: 100, unit: '%', icon: 'fa-chart-pie' },
            { label: 'Stability', value: metrics.stabilityScore, target: 100, unit: '%', icon: 'fa-balance-scale' }
        ];
        
        return `
            <div class="metrics-grid">
                ${metricsData.map(metric => {
                    const progress = Math.min((metric.value / metric.target) * 100, 100);
                    const status = progress >= 80 ? 'excellent' : progress >= 60 ? 'good' : progress >= 40 ? 'fair' : 'poor';
                    
                    return `
                        <div class="metric-card ${status}">
                            <div class="metric-header">
                                <i class="fas ${metric.icon}"></i>
                                <span class="metric-label">${metric.label}</span>
                            </div>
                            <div class="metric-value">
                                <span class="value">${metric.value}${metric.unit}</span>
                                <span class="target">/ ${metric.target}${metric.unit}</span>
                            </div>
                            <div class="metric-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${progress}%; background: ${primaryColor};"></div>
                                </div>
                                <span class="progress-text">${Math.round(progress)}%</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    function generateChartsData(userData, metrics) {
        if (!userData) return {};
        
        // Generate expense breakdown chart data
        const expenseCategories = userData.expenseCategories || [];
        const categoryData = expenseCategories.slice(0, 6).map((cat, index) => ({
            category: cat.category,
            amount: cat.amount,
            percentage: cat.percentage,
            color: FINANCIAL_HEALTH_CONFIG.chartColors[Object.keys(FINANCIAL_HEALTH_CONFIG.chartColors)[index % 7]]
        }));
        
        // Generate financial health over time (simulated)
        const healthOverTime = generateHealthTimelineData(userData);
        
        return {
            expenseBreakdown: categoryData,
            healthTimeline: healthOverTime
        };
    }
    
    function generateHealthTimelineData(userData) {
        // This would typically come from historical data
        // For now, we'll generate sample trend data
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const baseScore = 60;
        
        return months.map((month, index) => ({
            month,
            score: baseScore + (Math.random() * 20 - 10) + (index * 2), // Slight upward trend
            income: (userData.monthlyIncome || 0) * (0.9 + Math.random() * 0.2),
            expenses: (userData.monthlyExpenses || 0) * (0.8 + Math.random() * 0.4)
        }));
    }

    // Enhanced animation functions
    function initializeAnimations() {
        // Animate score counter
        const scoreElement = document.querySelector('.animate-score');
        if (scoreElement) {
            const targetScore = parseInt(scoreElement.getAttribute('data-target'));
            animateScore(scoreElement, 0, targetScore, 2000);
        }

        // Add particle effects for high scores
        const score = parseInt(scoreElement?.getAttribute('data-target') || 0);
        if (score >= 80) {
            createParticleEffect();
        }

        // Stagger insight card animations
        const insightCards = document.querySelectorAll('.insight-card');
        insightCards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });

        // Stagger suggestion card animations
        const suggestionCards = document.querySelectorAll('.suggestion-card');
        suggestionCards.forEach((card, index) => {
            card.style.animationDelay = `${(insightCards.length + index) * 0.1}s`;
        });

        // Initialize progress bars with animation
        setTimeout(() => {
            const progressBars = document.querySelectorAll('.progress-fill');
            progressBars.forEach(bar => {
                const width = bar.style.width;
                bar.style.width = '0%';
                setTimeout(() => {
                    bar.style.width = width;
                }, 100);
            });
        }, 500);
    }

    function initializeInteractions() {
        // Add hover effects for metric cards
        const metricCards = document.querySelectorAll('.metric-card');
        metricCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-4px) scale(1.02)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(-2px) scale(1)';
            });
        });

        // Add click-to-expand functionality for insight cards
        const insightCards = document.querySelectorAll('.insight-card');
        insightCards.forEach(card => {
            card.addEventListener('click', () => {
                card.classList.toggle('expanded');
                // Could add more detailed content here
            });
        });

        // Initialize tooltips for metric cards
        initializeTooltips();

        // Add export functionality
        const exportBtn = document.getElementById('export-report');
        if (exportBtn) {
            exportBtn.addEventListener('click', handleExportReport);
        }
    }

    function animateScore(element, start, end, duration) {
        const startTime = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            const currentScore = Math.round(start + (end - start) * easeOutCubic);
            
            element.textContent = currentScore;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        
        requestAnimationFrame(update);
    }

    function createParticleEffect() {
        const particleContainer = document.querySelector('.score-particles');
        if (!particleContainer) return;

        const colors = ['#10df6f', '#26de81', '#2ed573', '#1a73e8'];
        
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.style.cssText = `
                    position: absolute;
                    width: 4px;
                    height: 4px;
                    background: ${colors[Math.floor(Math.random() * colors.length)]};
                    border-radius: 50%;
                    pointer-events: none;
                    animation: particle-float ${2 + Math.random() * 2}s ease-out forwards;
                `;
                
                const startX = Math.random() * 200;
                const startY = Math.random() * 200;
                particle.style.left = startX + 'px';
                particle.style.top = startY + 'px';
                
                particleContainer.appendChild(particle);
                
                // Remove particle after animation
                setTimeout(() => {
                    if (particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                    }
                }, 4000);
            }, i * 100);
        }

        // Add particle animation CSS if not already present
        if (!document.querySelector('#particle-styles')) {
            const particleStyles = document.createElement('style');
            particleStyles.id = 'particle-styles';
            particleStyles.textContent = `
                @keyframes particle-float {
                    0% {
                        transform: translateY(0) scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(-100px) scale(0);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(particleStyles);
        }
    }

    function initializeTooltips() {
        const metricCards = document.querySelectorAll('.metric-card');
        
        metricCards.forEach(card => {
            const label = card.querySelector('.metric-label')?.textContent;
            const value = card.querySelector('.value')?.textContent;
            const progress = card.querySelector('.progress-text')?.textContent;
            
            if (label && value && progress) {
                card.title = `${label}: ${value} (${progress} of target)`;
            }
        });
    }

    function handleExportReport() {
        const exportBtn = document.getElementById('export-report');
        const originalContent = exportBtn.innerHTML;
        
        // Show loading state
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Exporting...</span>';
        exportBtn.disabled = true;
        
        // Simulate export process
        setTimeout(() => {
            try {
                const reportData = generateReportData();
                downloadReport(reportData);
                
                // Show success state briefly
                exportBtn.innerHTML = '<i class="fas fa-check"></i><span>Exported!</span>';
                
                setTimeout(() => {
                    exportBtn.innerHTML = originalContent;
                    exportBtn.disabled = false;
                }, 2000);
            } catch (error) {
                console.error('Export failed:', error);
                exportBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Failed</span>';
                
                setTimeout(() => {
                    exportBtn.innerHTML = originalContent;
                    exportBtn.disabled = false;
                }, 2000);
            }
        }, 1500);
    }

    function generateReportData() {
        const container = document.querySelector('.financial-health-container');
        if (!container) throw new Error('No financial health data found');
        
        const score = document.querySelector('.score-number')?.textContent || '0';
        const status = document.querySelector('.status-text')?.textContent || 'Unknown';
        const description = document.querySelector('.score-description')?.textContent || '';
        
        const insights = Array.from(document.querySelectorAll('.insight-content')).map(
            element => element.textContent.trim()
        );
        
        const suggestions = Array.from(document.querySelectorAll('.suggestion-content p')).map(
            element => element.textContent.trim()
        );
        
        const metrics = Array.from(document.querySelectorAll('.metric-card')).map(card => ({
            label: card.querySelector('.metric-label')?.textContent || '',
            value: card.querySelector('.value')?.textContent || '',
            progress: card.querySelector('.progress-text')?.textContent || ''
        }));
        
        return {
            timestamp: new Date().toISOString(),
            score: score,
            status: status,
            description: description,
            insights: insights,
            suggestions: suggestions,
            metrics: metrics
        };
    }

    function downloadReport(data) {
        const reportContent = `
# Financial Health Report
**Generated:** ${new Date(data.timestamp).toLocaleString()}

## Overall Health Score: ${data.score}/100
**Status:** ${data.status}
${data.description}

## Key Metrics
${data.metrics.map(metric => `- **${metric.label}:** ${metric.value} (${metric.progress})`).join('\n')}

## AI Insights
${data.insights.map((insight, index) => `${index + 1}. ${insight}`).join('\n\n')}

## Recommended Actions
${data.suggestions.map((suggestion, index) => `${index + 1}. ${suggestion}`).join('\n\n')}

---
*Report generated by PesoSense Financial Health Dashboard*
        `.trim();
        
        const blob = new Blob([reportContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `financial-health-report-${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Helper functions for enhanced UI
    function generateGoalsProgress(financialGoals, userData) {
        if (!financialGoals || !userData) return '';
        
        return `
            <div class="goals-grid">
                <div class="goal-card emergency-fund">
                    <div class="goal-header">
                        <div class="goal-icon">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div class="goal-info">
                            <h5>Emergency Fund</h5>
                            <span class="goal-target">Target: 6 months expenses</span>
                        </div>
                    </div>
                    <div class="goal-progress">
                        <div class="progress-value">
                            <span class="current">₱${(userData.totalBalance || 0).toLocaleString()}</span>
                            <span class="target">/ ₱${((userData.monthlyExpenses || 0) * 6).toLocaleString()}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(((userData.totalBalance || 0) / Math.max((userData.monthlyExpenses || 1) * 6, 1)) * 100, 100)}%"></div>
                        </div>
                        <div class="progress-text">${Math.min(Math.round(((userData.totalBalance || 0) / Math.max((userData.monthlyExpenses || 1) * 6, 1)) * 100), 100)}% complete</div>
                    </div>
                </div>

                <div class="goal-card savings-rate">
                    <div class="goal-header">
                        <div class="goal-icon">
                            <i class="fas fa-piggy-bank"></i>
                        </div>
                        <div class="goal-info">
                            <h5>Savings Rate</h5>
                            <span class="goal-target">Target: 20% of income</span>
                        </div>
                    </div>
                    <div class="goal-progress">
                        <div class="progress-value">
                            <span class="current">${userData.monthlyIncome > 0 ? Math.round(((userData.monthlyIncome - userData.monthlyExpenses) / userData.monthlyIncome) * 100) : 0}%</span>
                            <span class="target">/ 20%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min((userData.monthlyIncome > 0 ? ((userData.monthlyIncome - userData.monthlyExpenses) / userData.monthlyIncome) * 100 / 20 * 100 : 0), 100)}%"></div>
                        </div>
                        <div class="progress-text">${Math.min(Math.round(userData.monthlyIncome > 0 ? ((userData.monthlyIncome - userData.monthlyExpenses) / userData.monthlyIncome) * 100 / 20 * 100 : 0), 100)}% of target</div>
                    </div>
                </div>
            </div>
        `;
    }

    function getInsightPriority(type) {
        const priorities = {
            'negative': 'High Priority',
            'warning': 'Medium Priority',
            'opportunity': 'Low Priority',
            'positive': 'Keep Going',
            'neutral': 'Monitor'
        };
        return priorities[type] || 'Standard';
    }

    function getActionPriority(index) {
        return index === 0 ? 'high' : index === 1 ? 'medium' : 'low';
    }

    function getActionPriorityLabel(index) {
        const labels = ['Critical', 'Important', 'Recommended'];
        return labels[Math.min(index, 2)];
    }

    function getActionIcon(index) {
        const icons = ['fa-exclamation-circle', 'fa-info-circle', 'fa-lightbulb'];
        return icons[Math.min(index, 2)];
    }

    function getActionTimeline(index) {
        const timelines = ['1-7 days', '1-2 weeks', '2-4 weeks'];
        return timelines[Math.min(index, 2)];
    }

    function getActionDifficulty(index) {
        return Math.min(index + 2, 5); // Difficulty from 2-5 bars
    }

    // Interactive handlers
    function handleInsightAction(type, index) {
        console.log(`Insight action for ${type} insight #${index}`);
        // Could show modal with detailed information
    }

    function handleActionStart(index, suggestion) {
        console.log(`Starting action ${index}: ${suggestion}`);
        // Could integrate with task management or calendar
    }

    function handleQuickAction(action) {
        console.log(`Quick action: ${action}`);
        // Could redirect to relevant page or show modal
        switch(action) {
            case 'budget':
                // Redirect to budget creation
                break;
            case 'goal':
                // Show goal setting modal
                break;
            case 'emergency':
                // Show emergency fund calculator
                break;
            case 'invest':
                // Show investment options
                break;
        }
    }

    function handleSetupProfile() {
        console.log('Setup profile clicked');
        // Redirect to profile setup
    }
    
    // Listen for custom refresh events from dashboard.js
    document.addEventListener('refreshFinancialHealth', () => {
        console.log('Financial health refresh event received');
        const user = auth.currentUser;
        if (user) {
            refreshFinancialHealth(user);
        }
    });
    
    // Handle page visibility changes - refresh when user returns to page
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const user = auth.currentUser;
            if (user) {
                refreshFinancialHealth(user);
            }
        }
    });
});
