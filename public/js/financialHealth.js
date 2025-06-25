// Financial Health Module using Gemini API
let GEMINI_API_KEY = null;
let GEMINI_MODEL = 'gemini-1.5-flash';

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
            // Load config dynamically
            try {
                const configModule = await import("./config.js");
                GEMINI_API_KEY = configModule.GEMINI_API_KEY;
                GEMINI_MODEL = configModule.GEMINI_MODEL || 'gemini-1.5-flash';
                console.log('Config loaded successfully, Gemini API available:', !!GEMINI_API_KEY);
            } catch (configError) {
                console.warn('Could not load config.js, using fallbacks:', configError.message);
                GEMINI_API_KEY = null;
                GEMINI_MODEL = 'gemini-1.5-flash';
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
                console.warn('Using enhanced offline analysis due to missing API key or no transactions');
                return enhancedOfflineAnalysis(userData);
            }

            // Check if we've recently hit rate limits
            const rateLimitKey = 'gemini_rate_limit_hit';
            const lastRateLimit = sessionStorage.getItem(rateLimitKey);
            if (lastRateLimit && Date.now() - parseInt(lastRateLimit) < 300000) { // 5 minutes cooldown
                console.warn('⚠️ Rate limit cooldown active. Using enhanced offline analysis...');
                return enhancedOfflineAnalysis(userData);
            }

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
                    console.warn('⚠️ Gemini API rate limit exceeded. Using offline analysis...');
                    // Track rate limit hit for cooldown
                    sessionStorage.setItem('gemini_rate_limit_hit', Date.now().toString());
                    return enhancedOfflineAnalysis(userData);
                } else if (response.status === 403) {
                    console.warn('⚠️ Gemini API access denied. Using offline analysis...');
                    return enhancedOfflineAnalysis(userData);
                } else if (response.status >= 500) {
                    console.warn('⚠️ Gemini API server error. Using offline analysis...');
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
                console.warn('⚠️ API rate limit detected in catch block. Using enhanced offline analysis...');
                // Track rate limit hit for cooldown
                sessionStorage.setItem('gemini_rate_limit_hit', Date.now().toString());
                return enhancedOfflineAnalysis(userData);
            } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                console.warn('⚠️ Network error detected. Using enhanced offline analysis...');
                return enhancedOfflineAnalysis(userData);
            } else if (error.name === 'TypeError' && error.message?.includes('fetch')) {
                console.warn('⚠️ Fetch blocked (likely by ad blocker). Using enhanced offline analysis...');
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
            console.warn('No userData provided to enhancedOfflineAnalysis');
            return {
                score: 0,
                status: "No financial data available",
                insights: [{type: "warning", text: "No financial data found for analysis"}],
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
        
        // Limit insights to a maximum of 5
        const limitedInsights = analysis.insights.slice(0, 5);
        
        // Determine score color and status
        const getScoreColor = (score) => {
            if (score >= 80) return { color: '#10df6f', status: 'Excellent', emoji: '🎉' };
            if (score >= 60) return { color: '#ffd700', status: 'Good', emoji: '👍' };
            if (score >= 40) return { color: '#ff9500', status: 'Fair', emoji: '⚠️' };
            return { color: '#ff4757', status: 'Needs Attention', emoji: '🚨' };
        };
        
        const scoreInfo = getScoreColor(analysis.score);
        
        // Calculate progress percentage for animation
        const progressPercentage = (analysis.score / 100) * 100;
        
        const html = `
            <div class="financial-health-container">
                <!-- Header Section -->
                <div class="financial-health-header">
                    <div class="header-content">
                        <div class="header-title">
                            <i class="fas fa-heartbeat"></i>
                            <span>Financial Health Analysis</span>
                        </div>
                        <button class="refresh-button modern-refresh" id="refresh-financial-health" title="Refresh Analysis">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                    <div class="last-updated">
                        <i class="fas fa-clock"></i>
                        <span>Updated ${new Date().toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        })}</span>
                    </div>
                </div>

                <!-- Score Section -->
                <div class="financial-health-score-section">
                    <div class="score-container">
                        <div class="score-circle">
                            <svg class="progress-ring" width="120" height="120">
                                <circle class="progress-ring-background" cx="60" cy="60" r="50"></circle>
                                <circle class="progress-ring-progress" cx="60" cy="60" r="50" 
                                        style="--progress: ${progressPercentage}; --color: ${scoreInfo.color}"></circle>
                            </svg>
                            <div class="score-content">
                                <div class="score-number" style="color: ${scoreInfo.color}">${analysis.score}</div>
                                <div class="score-max">/100</div>
                            </div>
                        </div>
                        <div class="score-info">
                            <div class="score-status" style="color: ${scoreInfo.color}">
                                <span class="status-emoji">${scoreInfo.emoji}</span>
                                <span class="status-text">${scoreInfo.status}</span>
                            </div>
                            <div class="score-description">${analysis.status}</div>
                        </div>
                    </div>
                </div>

                <!-- Quick Stats -->
                ${userData ? `
                    <div class="quick-stats">
                        <div class="stat-item">
                            <div class="stat-icon income">
                                <i class="fas fa-arrow-up"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-label">Monthly Income</div>
                                <div class="stat-value">₱${userData.monthlyIncome.toLocaleString()}</div>
                            </div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-icon expense">
                                <i class="fas fa-arrow-down"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-label">Monthly Expenses</div>
                                <div class="stat-value">₱${userData.monthlyExpenses.toLocaleString()}</div>
                            </div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-icon balance">
                                <i class="fas fa-wallet"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-label">Net Balance</div>
                                <div class="stat-value ${userData.totalBalance >= 0 ? 'positive' : 'negative'}">
                                    ₱${userData.totalBalance.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}

                <!-- Insights Section -->
                ${limitedInsights.length > 0 ? `
                    <div class="insights-section">
                        <div class="section-header">
                            <h3><i class="fas fa-brain"></i> AI Insights</h3>
                            <span class="insights-count">${limitedInsights.length} insights</span>
                        </div>
                        <div class="insights-grid">
                            ${limitedInsights.map((insight, index) => `
                                <div class="insight-card ${insight.type}" style="animation-delay: ${index * 0.1}s">
                                    <div class="insight-header">
                                        <div class="insight-icon ${insight.type}">
                                            <i class="fas ${getInsightIcon(insight.type)}"></i>
                                        </div>
                                        <div class="insight-type-label">${insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}</div>
                                    </div>
                                    <div class="insight-content">
                                        ${insight.text}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Suggestions Section -->
                ${suggestions.length > 0 ? `
                    <div class="suggestions-section">
                        <div class="section-header">
                            <h3><i class="fas fa-lightbulb"></i> Action Steps</h3>
                            <span class="suggestions-count">${suggestions.length} recommendations</span>
                        </div>
                        <div class="suggestions-list">
                            ${suggestions.map((suggestion, index) => `
                                <div class="suggestion-card" style="animation-delay: ${(limitedInsights.length + index) * 0.1}s">
                                    <div class="suggestion-number">${index + 1}</div>
                                    <div class="suggestion-content">
                                        <p>${suggestion}</p>
                                    </div>
                                    <div class="suggestion-action">
                                        <button class="action-btn" onclick="console.log('Action for suggestion ${index + 1}')">
                                            <i class="fas fa-arrow-right"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

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
        
        // Add inline styles for account overview section
        const accountOverviewStyles = `
            <style>
                .account-overview-section {
                    margin: 1.5rem 0;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .account-overview-section h4 {
                    color: rgba(255, 255, 255, 0.9);
                    margin: 0 0 1rem 0;
                    font-size: 1rem;
                    font-weight: 600;
                }
                .account-overview-section h4 i {
                    margin-right: 0.5rem;
                    color: var(--primary-green);
                }
                .account-types-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }
                .account-type-summary {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .account-type-icon {
                    color: var(--primary-green);
                    font-size: 1.2rem;
                }
                .account-type-info {
                    flex: 1;
                }
                .account-type-name {
                    color: rgba(255, 255, 255, 0.9);
                    font-weight: 600;
                    font-size: 0.9rem;
                    margin-bottom: 0.25rem;
                }
                .account-type-stats {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                .account-count {
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 0.8rem;
                }
                .account-balance {
                    color: var(--primary-green);
                    font-weight: 600;
                    font-size: 0.9rem;
                }
                .quick-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 1rem;
                    margin: 1.5rem 0;
                }
                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .stat-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                }
                .stat-icon.income { background: rgba(16, 223, 111, 0.2); color: var(--primary-green); }
                .stat-icon.expense { background: rgba(233, 109, 31, 0.2); color: #e96d1f; }
                .stat-icon.balance { background: rgba(26, 115, 232, 0.2); color: #1a73e8; }
                .stat-icon.accounts { background: rgba(156, 39, 176, 0.2); color: #9c27b0; }
                .stat-content {
                    flex: 1;
                }
                .stat-label {
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 0.8rem;
                    margin-bottom: 0.25rem;
                }
                .stat-value {
                    color: rgba(255, 255, 255, 0.9);
                    font-weight: 600;
                    font-size: 1rem;
                }
                .stat-value.positive { color: var(--primary-green); }
                .stat-value.negative { color: #e96d1f; }
            </style>
        `;
        
        // Inject styles if not already present
        if (!document.querySelector('#financial-health-styles')) {
            const styleElement = document.createElement('div');
            styleElement.id = 'financial-health-styles';
            styleElement.innerHTML = accountOverviewStyles;
            document.head.appendChild(styleElement);
        }
        
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
