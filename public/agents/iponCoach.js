/**
 * Smart Ipon Coach AI - Intelligent Filipino Financial Assistant
 * Features: Auto-categorization, Overspending detection, Smart budgeting, Real-time alerts
 */

import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { BaseAgent } from "./BaseAgent.js";
import { GEMINI_API_KEY, GEMINI_MODEL, OFFLINE_MODE, configStatus } from "../js/config.js";
import { getUserTransactions, getUserBankAccounts } from "../js/firestoredb.js";

// Add rate limiting configuration
const API_CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    RATE_LIMIT_WINDOW: 60000, // 1 minute
    MAX_REQUESTS_PER_WINDOW: 10,
    BACKOFF_MULTIPLIER: 1.5
};

class SmartIponCoachAI extends BaseAgent {
    constructor() {
        super('smartIponCoach', {
            autonomyLevel: 'high',
            planningHorizon: 'long_term',
            learningRate: 0.4,
            riskTolerance: 'adaptive',
            geminiApiKey: GEMINI_API_KEY,
            geminiModel: GEMINI_MODEL,
            offlineMode: OFFLINE_MODE
        });
        
        // AI Configuration
        this.offlineMode = OFFLINE_MODE;
        
        // Batch processing configuration
        this.BATCH_SIZE = 10;
        this.CONCURRENT_REQUESTS = 3;
        
        // Smart Features State
        this.categorizedTransactions = new Map();
        this.spendingPatterns = new Map();
        this.budgetRecommendations = [];
        this.activeAlerts = [];
        this.userBudgets = new Map();
        
        // Enhanced Filipino financial context
        this.filipinoCategories = {
            'food': {
                keywords: ['kakainin', 'pagkain', 'restaurant', 'grocery', 'tindahan', 'palengke', 'fast food', 'delivery', 'karinderia', 'lugawan', 'karinderya'],
                subcategories: {
                    'groceries': ['grocery', 'palengke', 'tindahan', 'supermarket'],
                    'dining_out': ['restaurant', 'fast food', 'delivery'],
                    'street_food': ['karinderia', 'lugawan', 'karinderya', 'street food']
                },
                budgetRatio: 0.3 // 30% of income
            },
            'transport': {
                keywords: ['jeepney', 'bus', 'tricycle', 'grab', 'taxi', 'mrt', 'lrt', 'gas', 'gasolina', 'pamasahe', 'angkas', 'motor'],
                subcategories: {
                    'public_transport': ['jeepney', 'bus', 'tricycle', 'mrt', 'lrt', 'pamasahe'],
                    'private_transport': ['gas', 'gasolina', 'motor'],
                    'ride_hailing': ['grab', 'taxi', 'angkas']
                },
                budgetRatio: 0.15 // 15% of income
            },
            'utilities': {
                keywords: ['kuryente', 'electricity', 'tubig', 'water', 'internet', 'phone', 'meralco', 'maynilad', 'globe', 'pldt', 'smart', 'wifi'],
                subcategories: {
                    'electricity': ['kuryente', 'electricity', 'meralco'],
                    'water': ['tubig', 'water', 'maynilad'],
                    'telecommunications': ['internet', 'phone', 'globe', 'pldt', 'smart', 'wifi']
                },
                budgetRatio: 0.1 // 10% of income
            },
            'housing': {
                keywords: ['upa', 'rent', 'dormitory', 'condo', 'apartment', 'bahay', 'amortization', 'mortgage'],
                subcategories: {
                    'rent': ['upa', 'rent', 'dormitory'],
                    'mortgage': ['amortization', 'mortgage'],
                    'maintenance': ['repair', 'maintenance', 'ayos']
                },
                budgetRatio: 0.25 // 25% of income
            },
            'entertainment': {
                keywords: ['sine', 'movie', 'gala', 'gimik', 'bar', 'party', 'shopping', 'mall', 'lakwatsa', 'concert', 'gig'],
                subcategories: {
                    'movies': ['sine', 'movie', 'cinema'],
                    'shopping': ['shopping', 'mall'],
                    'nightlife': ['bar', 'gimik', 'party', 'gig']
                },
                budgetRatio: 0.1 // 10% of income
            },
            'health': {
                keywords: ['gamot', 'medicine', 'doctor', 'hospital', 'checkup', 'medical', 'dental', 'pharmacy', 'botika'],
                subcategories: {
                    'medication': ['gamot', 'medicine', 'pharmacy', 'botika'],
                    'consultation': ['doctor', 'checkup', 'dental'],
                    'hospitalization': ['hospital', 'medical', 'emergency']
                },
                budgetRatio: 0.1 // 10% of income
            },
            'education': {
                keywords: ['tuition', 'school', 'books', 'supplies', 'uniform', 'baon', 'allowance', 'review', 'training'],
                subcategories: {
                    'tuition': ['tuition', 'school'],
                    'supplies': ['books', 'supplies', 'uniform'],
                    'allowance': ['baon', 'allowance']
                },
                budgetRatio: 0.15 // 15% of income
            },
            'savings': {
                keywords: ['ipon', 'savings', 'investment', 'emergency fund', 'insurance', 'mutual fund', 'stocks'],
                subcategories: {
                    'emergency_fund': ['emergency fund', 'savings'],
                    'investments': ['investment', 'mutual fund', 'stocks'],
                    'insurance': ['insurance', 'protection']
                },
                budgetRatio: 0.2 // 20% of income
            }
        };
        
        // Add rate limiting state
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.requestQueue = [];
        
        this.initializeElements();
        this.initializeEventListeners();
    }

    // Initialize DOM elements
    initializeElements() {
        this.elements = {
            loadingState: document.getElementById('loading-state'),
            contentLoaded: document.getElementById('content-loaded'),
            emptyState: document.getElementById('empty-state'),
            monthlyValue: document.getElementById('monthly-savings'),
            savingsRate: document.getElementById('savings-rate'),
            potentialSavings: document.getElementById('potential-savings'),
            emergencyFund: document.getElementById('emergency-fund'),
            spendingPatterns: document.getElementById('spending-patterns'),
            categoryAnalysis: document.getElementById('category-analysis'),
            trendInsights: document.getElementById('trend-insights'),
            budgetStats: document.getElementById('budget-stats'),
            budgetCategories: document.getElementById('budget-categories'),
            budgetRecommendations: document.getElementById('budget-recommendations'),
            alertsContent: document.getElementById('alerts-content'),
            savingsGoals: document.getElementById('savings-goals'),
            financialHealthScore: document.getElementById('financial-health-score'),
            financialHealthFactors: document.getElementById('financial-health-factors')
        };

        // Validate elements
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Element ${key} not found in DOM`);
            }
        });

        // Initialize event listeners
        this.initializeEventListeners();
    }

    // Initialize event listeners
    initializeEventListeners() {
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Alert filters
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                const priority = button.getAttribute('data-priority');
                this.filterAlerts(priority);
            });
        });

        // Refresh data
        const refreshButton = document.querySelector('.refresh-data');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => this.refreshData());
        }
    }

    async refreshData() {
        try {
            this.showLoadingState();
            await this.loadUserFinancialData();
            await this.runSmartAnalysis();
            this.showContentState();
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showErrorMessage('Failed to refresh data');
        }
    }

    // Update UI with financial data
    updateFinancialOverview() {
        if (!this.userTransactions?.length) return;

        // Calculate monthly values
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        const monthlyTransactions = this.userTransactions.filter(t => {
            const transDate = new Date(t.date);
            return transDate.getMonth() === currentMonth && transDate.getFullYear() === currentYear;
        });

        const monthlyIncome = monthlyTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const monthlyExpenses = monthlyTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const monthlySavings = monthlyIncome - monthlyExpenses;
        const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome * 100) : 0;

        // Calculate emergency fund
        const monthlyExpenseAvg = monthlyExpenses || 0;
        const totalSavings = this.userAccounts
            ?.filter(a => a.category === 'savings')
            .reduce((sum, a) => sum + a.balance, 0) || 0;
        const emergencyFundRatio = monthlyExpenseAvg > 0 ? (totalSavings / (monthlyExpenseAvg * 6) * 100) : 0;

        // Update UI elements
        if (this.elements.monthlyValue) {
            this.elements.monthlyValue.textContent = `₱${monthlySavings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
            const trend = document.createElement('div');
            trend.className = `metric-trend ${monthlySavings > 0 ? 'positive' : 'negative'}`;
            trend.textContent = `${monthlySavings > 0 ? '+' : ''}${monthlySavings.toLocaleString('en-PH', { minimumFractionDigits: 2 })} from last month`;
            this.elements.monthlyValue.parentNode.appendChild(trend);
        }

        if (this.elements.savingsRate) {
            this.elements.savingsRate.textContent = `${savingsRate.toFixed(1)}%`;
            const trend = document.createElement('div');
            trend.className = `metric-trend ${savingsRate >= 20 ? 'positive' : 'negative'}`;
            trend.textContent = `${savingsRate >= 20 ? '+' : '-'}${Math.abs(savingsRate - 20).toFixed(1)}% from target`;
            this.elements.savingsRate.parentNode.appendChild(trend);
        }

        if (this.elements.emergencyFund) {
            this.elements.emergencyFund.textContent = `${emergencyFundRatio.toFixed(1)}%`;
            const trend = document.createElement('div');
            trend.className = `metric-trend ${emergencyFundRatio >= 100 ? 'positive' : 'neutral'}`;
            trend.textContent = `of 6-month goal`;
            this.elements.emergencyFund.parentNode.appendChild(trend);
        }

        // Initialize savings chart
        this.initializeSavingsChart();
    }

    // Switch between tabs
    switchTab(tabName) {
        const tabs = document.querySelectorAll('.tab-content');
        const buttons = document.querySelectorAll('.tab-btn');

        tabs.forEach(tab => {
            tab.classList.add('hidden');
            if (tab.id === `${tabName}-content`) {
                tab.classList.remove('hidden');
            }
        });

        buttons.forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('data-tab') === tabName) {
                button.classList.add('active');
            }
        });
    }

    // Filter alerts by priority
    filterAlerts(priority) {
        const alerts = document.querySelectorAll('.alert-item');
        const buttons = document.querySelectorAll('.filter-btn');

        buttons.forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('data-priority') === priority) {
                button.classList.add('active');
            }
        });

        alerts.forEach(alert => {
            if (priority === 'all' || alert.getAttribute('data-priority') === priority) {
                alert.style.display = 'flex';
            } else {
                alert.style.display = 'none';
            }
        });
    }

    // Update UI methods with actual data
    updateCategorizationUI(data) {
        if (!this.elements.categoryAnalysis) return;

        const content = [];
        this.categorizedTransactions.forEach((transactions, category) => {
            const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
            const count = transactions.length;
            
            content.push(`
                <div class="category-item">
                    <div class="category-icon">
                        <i class="fas ${this.getCategoryIcon(category)}"></i>
                    </div>
                    <div class="category-details">
                        <div class="category-name">${this.formatCategoryName(category)}</div>
                        <div class="category-stats">
                            <span class="amount">₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                            <span class="count">${count} transactions</span>
                        </div>
                        <div class="category-progress">
                            <div class="category-progress-bar" style="width: ${this.calculateCategoryPercentage(total)}%"></div>
                        </div>
                    </div>
                </div>
            `);
        });

        this.elements.categoryAnalysis.innerHTML = content.join('') || 'No transactions to analyze';
    }

    // Helper methods
    getCategoryIcon(category) {
        const icons = {
            food: 'fa-utensils',
            transport: 'fa-car',
            utilities: 'fa-bolt',
            housing: 'fa-home',
            entertainment: 'fa-film',
            health: 'fa-heartbeat',
            education: 'fa-graduation-cap',
            savings: 'fa-piggy-bank'
        };
        return icons[category] || 'fa-tag';
    }

    formatCategoryName(category) {
        return category.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    calculateCategoryPercentage(amount) {
        const totalExpenses = Array.from(this.categorizedTransactions.values())
            .flat()
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return totalExpenses > 0 ? (amount / totalExpenses * 100) : 0;
    }

    // Start the Smart AI coach
    async start() {
        try {
            console.log("🧠 Starting Smart Ipon Coach AI...");
            this.showLoadingState();
            
            // Wait for user authentication
            await this.waitForAuth();
            
            if (!this.currentUser) {
                this.showEmptyState("Please log in to access your smart financial coach.");
                return;
            }

            // Initialize and load data
            await this.waitForInitialization();
            await this.loadUserFinancialData();
            
            // Check if we have data
            if (!this.userTransactions?.length && !this.userAccounts?.length) {
                this.showEmptyState("No financial data found. Please add some transactions to get started.");
                return;
            }

            // Run analysis
            await this.runSmartAnalysis();
            
            this.showContentState();
            console.log("✅ Smart Ipon Coach AI initialized successfully");
            
        } catch (error) {
            console.error("❌ Error starting Smart Ipon Coach AI:", error);
            this.showErrorMessage("Failed to initialize smart AI coach. Please try again.");
            // Show content in offline mode as fallback
            await this.runBasicAnalysis();
            this.showContentState();
        }
    }

    // Wait for authentication
    async waitForAuth() {
        const auth = getAuth();
        return new Promise((resolve) => {
            if (auth.currentUser) {
                this.currentUser = auth.currentUser;
                resolve();
            } else {
                const unsubscribe = auth.onAuthStateChanged((user) => {
                    this.currentUser = user;
                    unsubscribe();
                    resolve();
                });
            }
        });
    }

    // Wait for BaseAgent initialization
    async waitForInitialization() {
        const maxWait = 10000;
        const checkInterval = 100;
        let waited = 0;

        while (!this.initialized && waited < maxWait) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
        }

        return this.initialized;
    }

    // Run analysis
    async runSmartAnalysis() {
        try {
            console.log("🧠 Running Smart AI Analysis...");

            // Initialize chart first
            this.initializeSavingsChart();

            const features = [
                {
                    name: 'Transaction Categorization',
                    func: async () => {
                        const prompt = "Analyze and categorize these transactions with Filipino context...";
                        const result = await this.callGeminiForReasoning(prompt, { transactions: this.userTransactions });
                        return this.processGeminiResponse(result);
                    },
                    fallback: () => this.fallbackCategorization(this.userTransactions),
                    updateUI: (data) => this.updateCategorizationUI(data)
                },
                {
                    name: 'Spending Pattern Detection',
                    func: async () => {
                        const prompt = "Detect spending patterns and potential issues...";
                        const result = await this.callGeminiForReasoning(prompt, { transactions: this.userTransactions });
                        return this.processGeminiResponse(result);
                    },
                    fallback: () => this.fallbackPatternDetection(this.calculateMonthlySpending()),
                    updateUI: (data) => this.updateOverspendingUI(data)
                },
                {
                    name: 'Budget Recommendations',
                    func: async () => {
                        const prompt = "Generate personalized budget recommendations...";
                        const result = await this.callGeminiForReasoning(prompt, { 
                            transactions: this.userTransactions,
                            accounts: this.userAccounts 
                        });
                        return this.processGeminiResponse(result);
                    },
                    fallback: () => this.fallbackBudgetRecommendations(this.getFinancialSummary()),
                    updateUI: (data) => this.updateBudgetUI(data)
                },
                {
                    name: 'Smart Alerts',
                    func: async () => {
                        const prompt = "Generate relevant financial alerts and notifications...";
                        const result = await this.callGeminiForReasoning(prompt, {
                            transactions: this.userTransactions,
                            accounts: this.userAccounts
                        });
                        return this.processGeminiResponse(result);
                    },
                    fallback: async () => await this.generateSmartAlerts(),
                    updateUI: (data) => this.updateAlertsUI(data)
                }
            ];

            // Process features
            for (const feature of features) {
                try {
                    console.log(`Processing ${feature.name}...`);
                    let data;
                    try {
                        data = await feature.func();
                    } catch (error) {
                        console.warn(`Failed to process ${feature.name} with AI, using fallback:`, error);
                        data = await feature.fallback();
                    }
                    feature.updateUI(data);
                } catch (error) {
                    console.error(`Error in ${feature.name}:`, error);
                    // Continue with other features even if one fails
                }
            }
        } catch (error) {
            console.error("Error in runSmartAnalysis:", error);
            throw error;
        }
    }

    // UI update methods
    updateOverspendingUI(data) {
        if (!this.elements.spendingPatterns) return;

        const content = [];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];

        // Add spending pattern insights
        this.spendingPatterns.forEach((pattern, key) => {
            const [month, category] = key.split('-');
            const monthName = monthNames[parseInt(month)];
            const avgPerTransaction = pattern.total / pattern.count;

            content.push(`
                <div class="recommendation-item">
                    <i class="fas fa-chart-line"></i>
                    <div class="recommendation-content">
                        <div class="recommendation-title">${category.charAt(0).toUpperCase() + category.slice(1)} - ${monthName}</div>
                        <div class="recommendation-desc">
                            Total spent: ₱${pattern.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            <br>Average per transaction: ₱${avgPerTransaction.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            `);
        });

        this.elements.spendingPatterns.innerHTML = content.join('') || 'No spending patterns to analyze';
    }

    updateBudgetUI(data) {
        if (!this.elements.budgetContent) return;

        // Calculate total income and expenses
        const totals = this.userTransactions.reduce((acc, transaction) => {
            if (transaction.type === 'income') {
                acc.income += transaction.amount;
            } else {
                acc.expenses += Math.abs(transaction.amount);
            }
            return acc;
        }, { income: 0, expenses: 0 });

        // Calculate savings rate
        const savingsRate = totals.income > 0 ? 
            ((totals.income - totals.expenses) / totals.income * 100).toFixed(1) : 0;

        const content = `
            <div class="recommendation-item">
                <i class="fas fa-piggy-bank"></i>
                <div class="recommendation-content">
                    <div class="recommendation-title">Financial Summary</div>
                    <div class="recommendation-desc">
                        Total Income: ₱${totals.income.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        <br>Total Expenses: ₱${totals.expenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        <br>Savings Rate: ${savingsRate}%
                    </div>
                </div>
            </div>
            <div class="recommendation-item">
                <i class="fas fa-chart-pie"></i>
                <div class="recommendation-content">
                    <div class="recommendation-title">Budget Recommendation</div>
                    <div class="recommendation-desc">
                        Based on the 50/30/20 rule:
                        <br>Needs (50%): ₱${(totals.income * 0.5).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        <br>Wants (30%): ₱${(totals.income * 0.3).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        <br>Savings (20%): ₱${(totals.income * 0.2).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>
        `;

        this.elements.budgetContent.innerHTML = content;
    }

    updateAlertsUI(data) {
        if (!this.elements.alertsContent) return;

        const alerts = [];

        // Check for low balance alerts
        this.userAccounts.forEach(account => {
            if (account.balance < 1000) {
                alerts.push(`
                    <div class="alert-item severity-high">
                        <i class="fas fa-exclamation-circle alert-icon"></i>
                        <div class="alert-content">
                            <div class="alert-title">Low Balance Alert</div>
                            <div class="alert-desc">Account "${account.name}" has a low balance of ₱${account.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                            <div class="alert-meta">Priority: High</div>
                        </div>
                    </div>
                `);
            }
        });

        // Check for unusual spending
        this.spendingPatterns.forEach((pattern, key) => {
            const [month, category] = key.split('-');
            const avgPerTransaction = pattern.total / pattern.count;
            
            if (avgPerTransaction > 5000) {
                alerts.push(`
                    <div class="alert-item severity-medium">
                        <i class="fas fa-chart-line alert-icon"></i>
                        <div class="alert-content">
                            <div class="alert-title">High Spending Alert</div>
                            <div class="alert-desc">High average spending of ₱${avgPerTransaction.toLocaleString('en-PH', { minimumFractionDigits: 2 })} per transaction in ${category}</div>
                            <div class="alert-meta">Priority: Medium</div>
                        </div>
                    </div>
                `);
            }
        });

        this.elements.alertsContent.innerHTML = alerts.join('') || 'No alerts at this time';
    }

    // UI state management
    showLoadingState() {
        if (this.elements.loadingState) this.elements.loadingState.style.display = 'block';
        if (this.elements.contentLoaded) this.elements.contentLoaded.style.display = 'none';
        if (this.elements.emptyState) this.elements.emptyState.style.display = 'none';
    }

    showContentState() {
        if (this.elements.loadingState) this.elements.loadingState.style.display = 'none';
        if (this.elements.contentLoaded) this.elements.contentLoaded.style.display = 'block';
        if (this.elements.emptyState) this.elements.emptyState.style.display = 'none';
    }

    showEmptyState(message = null) {
        if (this.elements.loadingState) this.elements.loadingState.style.display = 'none';
        if (this.elements.contentLoaded) this.elements.contentLoaded.style.display = 'none';
        if (this.elements.emptyState) {
            this.elements.emptyState.style.display = 'block';
            if (message && this.elements.emptyState.querySelector('p')) {
                this.elements.emptyState.querySelector('p').textContent = message;
            }
        }
    }

    showErrorMessage(message) {
        console.error(message);
        // Implement error message display
    }

    // Basic analysis without AI
    async runBasicAnalysis() {
        // Implement basic analysis logic
        console.log("Running basic analysis without AI...");
    }

    // Load user's financial data
    async loadUserFinancialData() {
        try {
            console.log("📊 Loading user financial data...");
            
            if (!this.currentUser) {
                console.warn("No authenticated user found");
                return;
            }

            // Load transactions and accounts in parallel
            const [transactions, accounts] = await Promise.all([
                getUserTransactions(this.currentUser.uid),
                getUserBankAccounts(this.currentUser.uid)
            ]);

            this.userTransactions = transactions || [];
            this.userAccounts = accounts || [];

            console.log(`✅ Loaded ${this.userTransactions.length} transactions and ${this.userAccounts.length} accounts`);

            // Process and categorize transactions
            this.processTransactions();

            return {
                transactions: this.userTransactions,
                accounts: this.userAccounts
            };
        } catch (error) {
            console.error("❌ Error loading user financial data:", error);
            throw error;
        }
    }

    // Process and categorize transactions
    processTransactions() {
        if (!this.userTransactions?.length) return;

        // Reset categorization maps
        this.categorizedTransactions.clear();
        this.spendingPatterns.clear();

        // Process each transaction
        this.userTransactions.forEach(transaction => {
            // Categorize transaction
            const category = this.categorizeTransaction(transaction);
            if (!this.categorizedTransactions.has(category)) {
                this.categorizedTransactions.set(category, []);
            }
            this.categorizedTransactions.get(category).push(transaction);

            // Analyze spending patterns
            this.analyzeSpendingPattern(transaction);
        });
    }

    // Categorize a single transaction using Filipino context
    categorizeTransaction(transaction) {
        const description = transaction.name.toLowerCase();
        
        // Check against Filipino category keywords
        for (const [category, keywords] of Object.entries(this.filipinoCategories)) {
            if (keywords.keywords.some(keyword => description.includes(keyword))) {
                return category;
            }
        }

        // Default categorization based on transaction properties
        if (transaction.category) return transaction.category;
        if (transaction.type === 'income') return 'income';
        return 'other';
    }

    // Analyze spending pattern for a transaction
    analyzeSpendingPattern(transaction) {
        const month = new Date(transaction.date).getMonth();
        const category = this.categorizeTransaction(transaction);
        
        const key = `${month}-${category}`;
        if (!this.spendingPatterns.has(key)) {
            this.spendingPatterns.set(key, {
                total: 0,
                count: 0,
                transactions: []
            });
        }

        const pattern = this.spendingPatterns.get(key);
        pattern.total += Math.abs(transaction.amount);
        pattern.count++;
        pattern.transactions.push(transaction);
    }

    // Initialize and update savings chart
    initializeSavingsChart() {
        const canvas = document.getElementById('savingsChart');
        if (!canvas) return;

        // Prepare data
        const monthlyData = new Map();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];

        // Process transactions by month
        this.userTransactions.forEach(transaction => {
            const date = new Date(transaction.date);
            const monthKey = date.getMonth();
            
            if (!monthlyData.has(monthKey)) {
                monthlyData.set(monthKey, {
                    income: 0,
                    expenses: 0
                });
            }

            const data = monthlyData.get(monthKey);
            if (transaction.type === 'income') {
                data.income += transaction.amount;
            } else {
                data.expenses += Math.abs(transaction.amount);
            }
        });

        // Prepare chart data
        const labels = [];
        const incomeData = [];
        const expenseData = [];
        const savingsData = [];

        // Sort months and calculate savings
        Array.from(monthlyData.entries())
            .sort(([a], [b]) => a - b)
            .forEach(([month, data]) => {
                labels.push(monthNames[month]);
                incomeData.push(data.income);
                expenseData.push(data.expenses);
                savingsData.push(data.income - data.expenses);
            });

        // Create chart
        if (this.savingsChart) {
            this.savingsChart.destroy();
        }

        this.savingsChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        borderColor: '#10df6f',
                        backgroundColor: 'rgba(16, 223, 111, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        borderColor: '#e96d1f',
                        backgroundColor: 'rgba(233, 109, 31, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Savings',
                        data: savingsData,
                        borderColor: '#ffd740',
                        backgroundColor: 'rgba(255, 215, 64, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#ffffff'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += new Intl.NumberFormat('en-PH', {
                                    style: 'currency',
                                    currency: 'PHP'
                                }).format(context.parsed.y);
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#ffffff'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#ffffff',
                            callback: function(value) {
                                return '₱' + value.toLocaleString('en-PH');
                            }
                        }
                    }
                }
            }
        });
    }

    // Enhanced transaction analysis
    analyzeTransactionPatterns() {
        const patterns = {
            frequency: new Map(), // Track transaction frequency
            timing: new Map(),    // Track transaction timing
            amount: new Map(),    // Track amount patterns
            location: new Map(),  // Track location patterns
            correlation: new Map() // Track correlated transactions
        };

        // Group transactions by date
        const transactionsByDate = new Map();
        this.userTransactions.forEach(transaction => {
            const date = new Date(transaction.date);
            const dateKey = date.toISOString().split('T')[0];
            if (!transactionsByDate.has(dateKey)) {
                transactionsByDate.set(dateKey, []);
            }
            transactionsByDate.get(dateKey).push(transaction);
        });

        // Analyze patterns
        this.userTransactions.forEach(transaction => {
            const date = new Date(transaction.date);
            const category = this.categorizeTransaction(transaction);
            const amount = Math.abs(transaction.amount);

            // Frequency analysis
            const dayOfWeek = date.getDay();
            const weekKey = `${category}-${dayOfWeek}`;
            patterns.frequency.set(weekKey, (patterns.frequency.get(weekKey) || 0) + 1);

            // Timing analysis
            const hour = date.getHours();
            const timeKey = `${category}-${hour}`;
            patterns.timing.set(timeKey, (patterns.timing.get(timeKey) || 0) + 1);

            // Amount analysis
            if (!patterns.amount.has(category)) {
                patterns.amount.set(category, {
                    min: amount,
                    max: amount,
                    total: amount,
                    count: 1,
                    amounts: [amount]
                });
            } else {
                const stats = patterns.amount.get(category);
                stats.min = Math.min(stats.min, amount);
                stats.max = Math.max(stats.max, amount);
                stats.total += amount;
                stats.count++;
                stats.amounts.push(amount);
            }
        });

        // Calculate standard deviations and identify outliers
        patterns.amount.forEach((stats, category) => {
            const mean = stats.total / stats.count;
            const variance = stats.amounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / stats.count;
            stats.stdDev = Math.sqrt(variance);
            stats.outliers = stats.amounts.filter(amount => Math.abs(amount - mean) > 2 * stats.stdDev);
        });

        return patterns;
    }

    // Enhanced budget analysis
    analyzeBudget() {
        const budget = {
            actual: {},
            recommended: {},
            warnings: [],
            suggestions: []
        };

        // Calculate total income
        const totalIncome = this.userTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        // Calculate actual spending by category
        this.categorizedTransactions.forEach((transactions, category) => {
            const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
            const ratio = totalIncome > 0 ? total / totalIncome : 0;
            budget.actual[category] = {
                amount: total,
                ratio: ratio
            };

            // Get recommended ratio
            const recommendedRatio = this.filipinoCategories[category]?.budgetRatio || 0.1;
            budget.recommended[category] = {
                amount: totalIncome * recommendedRatio,
                ratio: recommendedRatio
            };

            // Generate warnings and suggestions
            if (ratio > recommendedRatio * 1.2) { // 20% over budget
                budget.warnings.push({
                    category,
                    severity: 'high',
                    message: `Spending in ${category} is ${Math.round((ratio/recommendedRatio - 1) * 100)}% over recommended budget`
                });

                // Generate specific suggestions based on category
                if (category === 'food') {
                    budget.suggestions.push({
                        category,
                        title: 'Reduce Food Expenses',
                        tips: [
                            'Plan your meals for the week',
                            'Buy groceries in bulk',
                            'Cook meals at home instead of eating out',
                            'Bring baon to work/school'
                        ]
                    });
                }
                // Add more category-specific suggestions...
            }
        });

        return budget;
    }

    // Enhanced savings analysis
    analyzeSavingsPotential() {
        const analysis = {
            currentSavings: 0,
            potentialSavings: 0,
            opportunities: [],
            recommendations: []
        };

        // Calculate current savings
        const income = this.userTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        const expenses = this.userTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        analysis.currentSavings = income - expenses;

        // Analyze spending patterns for savings opportunities
        this.categorizedTransactions.forEach((transactions, category) => {
            const categoryTotal = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
            const recommendedAmount = income * (this.filipinoCategories[category]?.budgetRatio || 0.1);
            
            if (categoryTotal > recommendedAmount) {
                const potentialSaving = categoryTotal - recommendedAmount;
                analysis.potentialSavings += potentialSaving;
                analysis.opportunities.push({
                    category,
                    currentAmount: categoryTotal,
                    recommendedAmount,
                    potentialSaving,
                    tips: this.generateSavingsTips(category, potentialSaving)
                });
            }
        });

        // Generate personalized recommendations
        if (analysis.currentSavings < income * 0.2) { // Less than 20% savings
            analysis.recommendations.push({
                priority: 'high',
                title: 'Increase Emergency Fund',
                description: 'Build 3-6 months of expenses as emergency fund',
                steps: [
                    'Set up automatic transfer to savings account',
                    'Save 13th month pay and bonuses',
                    'Look for additional income sources'
                ]
            });
        }

        return analysis;
    }

    // Generate category-specific savings tips
    generateSavingsTips(category, amount) {
        const tips = {
            food: [
                'Plan your meals weekly to avoid impulse buying',
                'Buy groceries in bulk from local markets',
                'Bring baon instead of eating out',
                'Use food delivery apps only during promotions'
            ],
            transport: [
                'Consider carpooling or using public transport',
                'Plan your routes to save on fuel',
                'Maintain your vehicle regularly',
                'Use transport apps during off-peak hours'
            ],
            entertainment: [
                'Look for free local events and activities',
                'Use movie streaming services instead of cinema',
                'Set a fixed entertainment budget',
                'Use discount apps and vouchers'
            ]
            // Add more categories...
        };

        return tips[category] || ['Track your expenses regularly', 'Set a budget and stick to it'];
    }

    async generateSmartAlerts() {
        // Implement smart alerts generation
        return [];
    }
}

// Initialize and start the agent
const iponCoach = new SmartIponCoachAI();
iponCoach.start().catch(console.error);

