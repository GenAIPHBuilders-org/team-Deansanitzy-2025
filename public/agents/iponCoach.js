/**
 * Smart Ipon Coach AI - Intelligent Filipino Financial Assistant
 * Features: Auto-categorization, Overspending detection, Smart budgeting, Real-time alerts
 */

import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { BaseAgent } from "./BaseAgent.js";
import { GEMINI_API_KEY, GEMINI_MODEL, OFFLINE_MODE, configStatus } from "../js/config.js";

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
        
        // Filipino Category Mapping
        this.filipinoCategories = {
            'food': ['kakainin', 'pagkain', 'restaurant', 'grocery', 'tindahan', 'palengke', 'fast food', 'delivery'],
            'transport': ['jeepney', 'bus', 'tricycle', 'grab', 'taxi', 'mrt', 'lrt', 'gas', 'gasolina'],
            'utilities': ['kuryente', 'electricity', 'tubig', 'water', 'internet', 'phone', 'meralco'],
            'rent': ['upa', 'rent', 'dormitory', 'condo', 'apartment'],
            'entertainment': ['sine', 'movie', 'gala', 'gimik', 'bar', 'party', 'shopping'],
            'health': ['gamot', 'medicine', 'doctor', 'hospital', 'checkup'],
            'education': ['tuition', 'school', 'books', 'supplies'],
            'remittance': ['padala', 'family', 'pamilya', 'utang', 'loan']
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
            categorizationContent: document.getElementById('categorization-content'),
            overspendingContent: document.getElementById('overspending-content'),
            budgetContent: document.getElementById('budget-content'),
            alertsContent: document.getElementById('alerts-content')
        };

        // Validate elements
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Element ${key} not found in DOM`);
            }
        });
    }

    // Initialize event listeners
    initializeEventListeners() {
        // No manual event listeners needed - this agent operates autonomously
        console.log("🤖 Autonomous agent initialized - no manual interactions required");
    }

    // Start the Smart AI coach
    async start() {
        try {
            console.log("🧠 Starting Smart Ipon Coach AI...");
            this.showLoadingState();
            
            // Check if config is properly loaded
            if (!this.geminiApiKey && !this.offlineMode) {
                console.warn("No API key configured - switching to offline mode");
                this.offlineMode = true;
            }
            
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

            // Run analysis in offline mode if API is not available
            if (this.offlineMode) {
                console.log("Running in offline mode - using basic analysis");
                await this.runBasicAnalysis();
            } else {
                await this.runSmartAnalysis();
            }
            
            this.showContentState();
            console.log("✅ Smart Ipon Coach AI initialized successfully");
            
        } catch (error) {
            console.error("❌ Error starting Smart Ipon Coach AI:", error);
            this.showErrorMessage("Failed to initialize smart AI coach. Please try again.");
            // Show content in offline mode as fallback
            this.offlineMode = true;
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

    // Run comprehensive smart analysis with batching
    async runSmartAnalysis() {
        console.log("🧠 Running Smart AI Analysis...");

        const features = [
            {
                name: 'Transaction Categorization',
                func: async () => await this.categorizeTransactions(),
                fallback: () => this.fallbackCategorization(this.userTransactions),
                updateUI: (data) => this.updateCategorizationUI(data)
            },
            {
                name: 'Spending Pattern Detection',
                func: async () => await this.detectOverspendingPatterns(),
                fallback: () => this.fallbackPatternDetection(this.calculateMonthlySpending()),
                updateUI: (data) => this.updateOverspendingUI(data)
            },
            {
                name: 'Budget Recommendations',
                func: async () => await this.generateBudgetRecommendations(),
                fallback: () => this.fallbackBudgetRecommendations(this.getFinancialSummary()),
                updateUI: (data) => this.updateBudgetUI(data)
            },
            {
                name: 'Smart Alerts',
                func: async () => await this.setupSmartAlerts(),
                fallback: async () => await this.generateSmartAlerts(),
                updateUI: (data) => this.updateAlertsUI(data)
            }
        ];

        for (const feature of features) {
            try {
                console.log(`Running ${feature.name}...`);
                const result = await feature.func();
                feature.updateUI(result);
                console.log(`✅ ${feature.name} completed successfully`);
            } catch (error) {
                console.warn(`${feature.name} failed, using fallback:`, error);
                const fallbackResult = await feature.fallback();
                feature.updateUI(fallbackResult);
            }
        }

        console.log("✅ Financial analysis completed");
    }

    // Process transactions in batches
    async processBatch(transactions, processor) {
        const results = [];
        for (let i = 0; i < transactions.length; i += this.BATCH_SIZE) {
            const batch = transactions.slice(i, i + this.BATCH_SIZE);
            const batchResults = await processor(batch);
            results.push(...batchResults);
            
            // Add a small delay between batches to help prevent rate limiting
            if (i + this.BATCH_SIZE < transactions.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return results;
    }

    // Smart Transaction Categorization with batching
    async categorizeTransactions() {
        try {
            console.log("🏷️ Starting smart transaction categorization...");
            
            if (!this.userTransactions || this.userTransactions.length === 0) {
                this.updateCategorizationUI([]);
                return;
            }

            const recentTransactions = this.userTransactions
                .slice(-50) // Last 50 transactions for efficiency
                .filter(tx => tx.type === 'expense')
                .map(tx => ({
                    id: tx.id,
                    description: tx.description || tx.notes || 'Unknown',
                    amount: tx.amount || 0,
                    date: tx.date,
                    currentCategory: tx.category || 'Uncategorized'
                }));

            // Process transactions in smaller batches
            const categorizedTransactions = await this.processBatch(
                recentTransactions,
                this.aiCategorizeTransactions.bind(this)
            );

            this.updateCategorizationUI(categorizedTransactions);
            
        } catch (error) {
            console.error("❌ Categorization failed:", error);
            // Fallback to basic categorization
            const fallbackCategories = this.fallbackCategorization(this.userTransactions);
            this.updateCategorizationUI(fallbackCategories);
        }
    }

    // AI-powered transaction categorization with rate limiting
    async aiCategorizeTransactions(transactions) {
        try {
            const prompt = `Please analyze and categorize these financial transactions into appropriate categories. For each transaction, consider the description and amount. Return the results in a clear, structured format.

Transaction details:
${JSON.stringify(transactions.map(tx => ({
    description: tx.description || tx.notes || 'Unknown',
    amount: tx.amount || 0,
    date: tx.date
})), null, 2)}

Available categories: ${Object.keys(this.filipinoCategories).join(', ')}

Please return the results in this JSON format:
{
    "categories": ["category1", "category2", ...],
    "confidence": [0.95, 0.85, ...],
    "reasoning": ["reason1", "reason2", ...]
}`;
            
            const response = await this.callGeminiAPI(prompt);
            
            if (!response || typeof response !== 'object') {
                console.warn("Invalid AI response, using fallback categorization");
                return this.fallbackCategorization(transactions);
            }

            return transactions.map((tx, index) => ({
                ...tx,
                category: response.categories?.[index] || tx.currentCategory || 'Other',
                confidence: response.confidence?.[index] || 0.5,
                reasoning: response.reasoning?.[index] || 'Fallback categorization'
            }));
            
        } catch (error) {
            console.warn("AI categorization failed, using fallback:", error);
            return this.fallbackCategorization(transactions);
        }
    }

    // 2. Overspending Pattern Detection
    async detectOverspendingPatterns() {
        try {
            console.log("🔍 Detecting overspending patterns...");
            
            if (!this.userTransactions || this.userTransactions.length === 0) {
                this.updateOverspendingUI([]);
                return;
            }

            const patterns = await this.aiDetectSpendingPatterns();
            this.spendingPatterns = new Map(patterns.map(p => [p.category, p]));
            this.updateOverspendingUI(patterns);
            
            console.log("✅ Overspending detection completed");

        } catch (error) {
            console.error("❌ Overspending detection failed:", error);
            this.updateOverspendingUI([]);
        }
    }

    // AI-powered spending pattern detection
    async aiDetectSpendingPatterns() {
        try {
            const monthlyData = this.calculateMonthlySpending();
            
            const prompt = `As a Filipino financial advisor AI, analyze these spending patterns and detect overspending or concerning trends.

Monthly spending data:
${JSON.stringify(monthlyData, null, 2)}

Identify:
1. Categories with increasing spending trends
2. Unusual spending spikes
3. Overspending compared to typical Filipino household budgets
4. Concerning patterns (like increased utang/debt)

Return as JSON array:
[
  {
    "category": "category_name",
    "pattern": "increasing|spike|concerning",
    "severity": "low|medium|high",
    "description": "Clear explanation in Filipino context",
    "recommendation": "Specific actionable advice",
    "currentMonthly": amount,
    "previousMonthly": amount,
    "percentageChange": percentage
  }
]

Consider Filipino financial habits and cultural context.`;

            const response = await this.callGeminiAPI(prompt);
            
            try {
                const patterns = JSON.parse(response);
                return Array.isArray(patterns) ? patterns : [];
            } catch (parseError) {
                return this.fallbackPatternDetection(monthlyData);
            }

        } catch (error) {
            console.error("AI pattern detection failed:", error);
            return this.fallbackPatternDetection(this.calculateMonthlySpending());
        }
    }

    // Calculate monthly spending by category
    calculateMonthlySpending() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const previousMonth = currentMonth - 1;
        
        const categorizeSpending = (month) => {
            const spending = {};
            
            this.userTransactions
                .filter(tx => {
                    const txDate = new Date(tx.date);
                    return tx.type === 'expense' && txDate.getMonth() === month;
                })
                .forEach(tx => {
                    const category = tx.category || 'Others';
                    spending[category] = (spending[category] || 0) + parseFloat(tx.amount || 0);
                });
                
            return spending;
        };

        return {
            current: categorizeSpending(currentMonth),
            previous: categorizeSpending(previousMonth)
        };
    }

    // Fallback pattern detection
    fallbackPatternDetection(monthlyData) {
        const patterns = [];
        
        Object.keys(monthlyData.current).forEach(category => {
            const current = monthlyData.current[category];
            const previous = monthlyData.previous[category] || 0;
            
            if (previous > 0) {
                const change = ((current - previous) / previous) * 100;
                
                if (change > 50) {
                    patterns.push({
                        category,
                        pattern: 'spike',
                        severity: change > 100 ? 'high' : 'medium',
                        description: `${category} spending increased by ${change.toFixed(1)}%`,
                        recommendation: `Consider reviewing your ${category} expenses`,
                        currentMonthly: current,
                        previousMonthly: previous,
                        percentageChange: change
                    });
                }
            }
        });

        return patterns;
    }

    // 3. Smart Budget Recommendations
    async generateBudgetRecommendations() {
        try {
            console.log("💡 Generating smart budget recommendations...");
            
            const budgetData = await this.aiGenerateBudgetRecommendations();
            this.budgetRecommendations = budgetData;
            this.updateBudgetUI(budgetData);
            
            console.log("✅ Budget recommendations generated");

        } catch (error) {
            console.error("❌ Budget generation failed:", error);
            this.updateBudgetUI([]);
        }
    }

    // AI-powered budget recommendations
    async aiGenerateBudgetRecommendations() {
        try {
            const financialSummary = this.getFinancialSummary();
            
            const prompt = `As a Filipino financial advisor AI, create a personalized budget recommendation based on this financial data.

Financial Summary:
${JSON.stringify(financialSummary, null, 2)}

Create budget recommendations considering:
1. Filipino 50/30/20 rule adaptation (50% needs, 30% wants, 20% savings)
2. Family obligations and remittances
3. Current spending patterns
4. Emergency fund priority

Return as JSON object:
{
  "monthlyIncome": estimated_income,
  "recommendedBudget": {
    "needs": {"amount": number, "percentage": number, "categories": ["Food", "Utilities", "Rent"]},
    "wants": {"amount": number, "percentage": number, "categories": ["Entertainment", "Shopping"]},
    "savings": {"amount": number, "percentage": number, "purpose": "Emergency fund and goals"}
  },
  "categoryBudgets": {
    "Food": {"recommended": amount, "current": amount, "status": "over|under|good"},
    "Transport": {"recommended": amount, "current": amount, "status": "over|under|good"}
  },
  "recommendations": [
    {
      "priority": "high|medium|low",
      "action": "specific_action",
      "reason": "explanation",
      "expectedSavings": amount
    }
  ],
  "emergencyFundGoal": amount,
  "timeToGoal": "months"
}`;

            const response = await this.callGeminiAPI(prompt);
            
            try {
                return JSON.parse(response);
            } catch (parseError) {
                return this.fallbackBudgetRecommendations(financialSummary);
            }

        } catch (error) {
            console.error("AI budget generation failed:", error);
            return this.fallbackBudgetRecommendations(this.getFinancialSummary());
        }
    }

    // Get financial summary
    getFinancialSummary() {
        const totalBalance = this.userAccounts ? 
            this.userAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0) : 0;
        
        const monthlyExpenses = this.userTransactions ?
            this.userTransactions
                .filter(tx => tx.type === 'expense' && this.isWithinLastMonth(tx.date))
                .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0) : 0;

        const monthlyIncome = this.userTransactions ?
            this.userTransactions
                .filter(tx => tx.type === 'income' && this.isWithinLastMonth(tx.date))
                .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0) : 0;

        const categorySpending = {};
        this.userTransactions
            .filter(tx => tx.type === 'expense' && this.isWithinLastMonth(tx.date))
            .forEach(tx => {
                const category = tx.category || 'Others';
                categorySpending[category] = (categorySpending[category] || 0) + parseFloat(tx.amount || 0);
            });

        return {
            totalBalance,
            monthlyIncome,
            monthlyExpenses,
            categorySpending,
            savingsRate: monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0
        };
    }

    // Helper method to check if date is within last month
    isWithinLastMonth(dateString) {
        if (!dateString) return false;
        const date = new Date(dateString);
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return date >= lastMonth;
    }

    // Fallback budget recommendations
    fallbackBudgetRecommendations(summary) {
        const { monthlyIncome, categorySpending } = summary;
        const estimatedIncome = monthlyIncome || Object.values(categorySpending).reduce((sum, amount) => sum + amount, 0) * 1.2;

        return {
            monthlyIncome: estimatedIncome,
            recommendedBudget: {
                needs: { amount: estimatedIncome * 0.5, percentage: 50, categories: ["Food", "Utilities", "Rent"] },
                wants: { amount: estimatedIncome * 0.3, percentage: 30, categories: ["Entertainment", "Shopping"] },
                savings: { amount: estimatedIncome * 0.2, percentage: 20, purpose: "Emergency fund and goals" }
            },
            categoryBudgets: {},
            recommendations: [
                {
                    priority: "high",
                    action: "Create an emergency fund",
                    reason: "Financial security is crucial",
                    expectedSavings: estimatedIncome * 0.1
                }
            ],
            emergencyFundGoal: estimatedIncome * 3,
            timeToGoal: "6-12 months"
        };
    }

    // 4. Smart Alerts Setup
    async setupSmartAlerts() {
        try {
            console.log("⚡ Setting up smart alerts...");
            
            const alerts = await this.generateSmartAlerts();
            this.activeAlerts = alerts;
            this.updateAlertsUI(alerts);
            
            // Set up real-time monitoring
            this.startAlertMonitoring();
            
            console.log("✅ Smart alerts configured");

        } catch (error) {
            console.error("❌ Smart alerts setup failed:", error);
            this.updateAlertsUI([]);
        }
    }

    // Generate smart alerts based on spending patterns
    async generateSmartAlerts() {
        const alerts = [];
        
        // Check for overspending
        const monthlyData = this.calculateMonthlySpending();
        Object.entries(monthlyData.current).forEach(([category, amount]) => {
            const budget = this.userBudgets.get(category) || amount * 0.8; // 80% of current as default budget
            
            if (amount > budget) {
                alerts.push({
                    type: 'overspending',
                    category,
                    severity: amount > budget * 1.5 ? 'high' : 'medium',
                    message: `You're overspending on ${category}. Current: ₱${amount.toLocaleString()}, Budget: ₱${budget.toLocaleString()}`,
                    suggestion: `Consider reducing ${category} expenses by ₱${(amount - budget).toLocaleString()}`,
                    timestamp: new Date()
                });
            }
        });

        // Check for unusual patterns
        this.spendingPatterns.forEach(pattern => {
            if (pattern.severity === 'high') {
                alerts.push({
                    type: 'pattern',
                    category: pattern.category,
                    severity: 'high',
                    message: pattern.description,
                    suggestion: pattern.recommendation,
                    timestamp: new Date()
                });
            }
        });

        return alerts;
    }

    // Start real-time autonomous monitoring
    startAlertMonitoring() {
        // Enhanced autonomous monitoring with intervention generation
        setInterval(async () => {
            await this.checkForNewAlerts();
            await this.generateProactiveInterventions();
        }, 300000); // Check every 5 minutes
        
        // More frequent pattern analysis for immediate interventions
        setInterval(async () => {
            await this.runContinuousAnalysis();
        }, 60000); // Every minute for critical patterns
        
        console.log("🔄 Autonomous monitoring system activated");
    }

    // Check for new alerts
    async checkForNewAlerts() {
        const newAlerts = await this.generateSmartAlerts();
        
        // Find new alerts
        const existingAlertKeys = new Set(this.activeAlerts.map(a => `${a.type}_${a.category}`));
        const newAlertsList = newAlerts.filter(alert => 
            !existingAlertKeys.has(`${alert.type}_${alert.category}`)
        );

        if (newAlertsList.length > 0) {
            this.activeAlerts = [...this.activeAlerts, ...newAlertsList];
            this.updateAlertsUI(this.activeAlerts);
            
            // Show notification for new alerts
            newAlertsList.forEach(alert => {
                this.showNotification(alert);
            });
        }
    }

    // Continuous autonomous analysis for immediate interventions
    async runContinuousAnalysis() {
        try {
            // Check for critical spending patterns that need immediate intervention
            const recentTransactions = this.userTransactions
                .filter(tx => {
                    const txDate = new Date(tx.date);
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    return txDate > oneHourAgo && tx.type === 'expense';
                });

            if (recentTransactions.length > 0) {
                // Analyze recent spending for immediate intervention needs
                const urgentPatterns = await this.detectUrgentSpendingPatterns(recentTransactions);
                
                for (const pattern of urgentPatterns) {
                    if (pattern.severity === 'critical') {
                        await this.executeImmediateIntervention(pattern);
                    }
                }
            }

        } catch (error) {
            console.error("❌ Continuous analysis failed:", error);
        }
    }

    // Detect urgent spending patterns requiring immediate intervention
    async detectUrgentSpendingPatterns(recentTransactions) {
        const patterns = [];
        
        // Check for rapid consecutive spending
        if (recentTransactions.length >= 3) {
            const totalAmount = recentTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
            
            if (totalAmount > 5000) { // Threshold for rapid spending alert
                patterns.push({
                    type: 'rapid_spending',
                    severity: 'critical',
                    description: `Rapid spending detected: ₱${totalAmount.toLocaleString()} in the last hour`,
                    transactions: recentTransactions.length,
                    amount: totalAmount,
                    intervention: 'immediate_spending_freeze_recommendation'
                });
            }
        }

        return patterns;
    }

    // Execute immediate intervention for critical patterns
    async executeImmediateIntervention(pattern) {
        const intervention = {
            type: 'critical_intervention',
            pattern: pattern.type,
            severity: 'critical',
            action: `URGENT: ${pattern.description}. Consider pausing non-essential spending.`,
            reasoning: `Detected ${pattern.intervention} based on ${pattern.transactions} transactions totaling ₱${pattern.amount.toLocaleString()}`,
            impact: `Potential savings of ₱${(pattern.amount * 0.3).toLocaleString()} if spending is controlled`,
            timestamp: new Date()
        };

        // Trigger immediate alert
        this.triggerFinancialAlert(intervention);
        
        // Log the critical decision
        this.logAutonomousDecision(intervention);
        
        console.log(`🚨 CRITICAL INTERVENTION EXECUTED: ${pattern.type}`);
    }

    // Check authentication status
    async checkAuthentication() {
        if (this.offlineMode || !this.geminiApiKey) {
            console.log("Running in offline mode - AI features will be limited");
            this.offlineMode = true;
            return true;
        }
        
        try {
            // Test API connection
            const testResponse = await this.callGeminiAPI("test");
            return testResponse !== null;
        } catch (error) {
            console.warn("API authentication failed - switching to offline mode. To enable AI features, please configure a valid API key in config.js");
            this.offlineMode = true;
            return true; // Continue in offline mode
        }
    }

    // Add rate limiting helper
    async rateLimitRequest() {
        const now = Date.now();
        
        // Reset counter if window has passed
        if (now - this.lastRequestTime > API_CONFIG.RATE_LIMIT_WINDOW) {
            this.requestCount = 0;
            this.lastRequestTime = now;
        }
        
        // Check if we're at the limit
        if (this.requestCount >= API_CONFIG.MAX_REQUESTS_PER_WINDOW) {
            const waitTime = API_CONFIG.RATE_LIMIT_WINDOW - (now - this.lastRequestTime);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.requestCount = 0;
            this.lastRequestTime = Date.now();
        }
        
        this.requestCount++;
        this.lastRequestTime = now;
    }

    // Update API call with retries and rate limiting
    async callGeminiAPI(prompt, options = {}) {
        let retries = 0;
        let delay = API_CONFIG.RETRY_DELAY;

        while (retries < API_CONFIG.MAX_RETRIES) {
            try {
                // Check rate limiting
                await this.rateLimitRequest();

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }],
                        ...options
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    
                    // Handle rate limiting specifically
                    if (response.status === 429) {
                        console.warn(`Rate limited, attempt ${retries + 1} of ${API_CONFIG.MAX_RETRIES}`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= API_CONFIG.BACKOFF_MULTIPLIER;
                        retries++;
                        continue;
                    }
                    
                    throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
                }

                const data = await response.json();
                return data;

            } catch (error) {
                console.error(`API call failed, attempt ${retries + 1} of ${API_CONFIG.MAX_RETRIES}:`, error);
                
                if (retries === API_CONFIG.MAX_RETRIES - 1) {
                    throw error;
                }
                
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= API_CONFIG.BACKOFF_MULTIPLIER;
                retries++;
            }
        }
    }

    // Enhanced autonomous intervention system
    async generateProactiveInterventions() {
        try {
            const insights = await this.analyzeFinancialBehavior();
            const interventions = await this.planFinancialActions(insights);
            
            // Execute autonomous interventions
            for (const intervention of interventions) {
                await this.executeAutonomousAction(intervention);
            }
            
            console.log(`🎯 Generated ${interventions.length} autonomous interventions`);
            
        } catch (error) {
            console.error("❌ Autonomous intervention generation failed:", error);
        }
    }

    // Analyze financial behavior patterns for autonomous decision making
    async analyzeFinancialBehavior() {
        const financialData = this.getFinancialSummary();
        const patterns = Array.from(this.spendingPatterns.values());
        
        const prompt = `As an autonomous Filipino financial AI agent, analyze this financial behavior and identify actionable insights:

Financial Data: ${JSON.stringify(financialData, null, 2)}
Spending Patterns: ${JSON.stringify(patterns, null, 2)}

Provide autonomous action recommendations in JSON format:
{
  "criticalActions": [
    {
      "priority": "high|medium|low",
      "action": "specific_autonomous_action",
      "reasoning": "data_driven_explanation",
      "expectedImpact": "quantified_benefit",
      "triggerConditions": "when_to_execute"
    }
  ],
  "opportunities": [
    {
      "category": "savings|investment|optimization",
      "description": "opportunity_description",
      "potentialValue": "estimated_value",
      "confidence": "0-100"
    }
  ]
}

Focus on autonomous actions the agent can take without user input.`;

        try {
            const response = await this.callGeminiAPI(prompt);
            return JSON.parse(response);
        } catch (error) {
            console.error("Behavior analysis failed:", error);
            return { criticalActions: [], opportunities: [] };
        }
    }

    // Plan autonomous financial actions based on insights
    async planFinancialActions(insights) {
        const actions = [];
        
        // Convert insights to executable actions
        insights.criticalActions?.forEach(action => {
            if (action.priority === 'high') {
                actions.push({
                    type: 'immediate_intervention',
                    action: action.action,
                    reasoning: action.reasoning,
                    impact: action.expectedImpact,
                    timestamp: new Date()
                });
            }
        });

        insights.opportunities?.forEach(opportunity => {
            if (opportunity.confidence > 70) {
                actions.push({
                    type: 'optimization_opportunity',
                    description: opportunity.description,
                    value: opportunity.potentialValue,
                    category: opportunity.category,
                    timestamp: new Date()
                });
            }
        });

        return actions;
    }

    // Execute autonomous actions
    async executeAutonomousAction(action) {
        switch (action.type) {
            case 'immediate_intervention':
                this.triggerFinancialAlert(action);
                this.logAutonomousDecision(action);
                break;
            case 'optimization_opportunity':
                this.presentOptimizationSuggestion(action);
                this.updateUserBudgets(action);
                break;
            default:
                console.log(`🤖 Autonomous action executed: ${action.type}`);
        }
    }

    // UI Update Methods
    updateCategorizationUI(categorizedData) {
        if (!this.elements.categorizationContent) return;

        if (categorizedData.length === 0) {
            this.elements.categorizationContent.innerHTML = `
                <div class="empty-message">
                    <p>No recent transactions to categorize. Add some expenses to see smart categorization in action!</p>
                </div>
            `;
            return;
        }

        const categoryStats = {};
        categorizedData.forEach(item => {
            const cat = item.suggestedCategory;
            if (!categoryStats[cat]) {
                categoryStats[cat] = { count: 0, total: 0 };
            }
            categoryStats[cat].count++;
            categoryStats[cat].total += parseFloat(item.amount || 0);
        });

        this.elements.categorizationContent.innerHTML = `
            <div class="categorization-summary">
                <h4>Smart Categorization Results</h4>
                <p>Analyzed ${categorizedData.length} recent transactions</p>
                
                <div class="category-breakdown">
                    ${Object.entries(categoryStats).map(([category, stats]) => `
                        <div class="category-item">
                            <div class="category-info">
                                <span class="category-name">${category}</span>
                                <span class="category-count">${stats.count} transactions</span>
                            </div>
                            <span class="category-amount">₱${stats.total.toLocaleString()}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="recent-categorizations">
                    <h5>Recent Auto-Categorizations:</h5>
                    ${categorizedData.slice(0, 5).map(item => `
                        <div class="categorization-item">
                            <div class="item-description">${item.originalDescription}</div>
                            <div class="item-category">
                                <span class="suggested-category">${item.suggestedCategory}</span>
                                <span class="confidence">${item.confidence}% confident</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    updateOverspendingUI(patterns) {
        if (!this.elements.overspendingContent) return;

        if (patterns.length === 0) {
            this.elements.overspendingContent.innerHTML = `
                <div class="good-news">
                    <i class="fas fa-check-circle"></i>
                    <p>Great job! No concerning spending patterns detected.</p>
                </div>
            `;
            return;
        }

        this.elements.overspendingContent.innerHTML = `
            <div class="patterns-detected">
                <h4>Spending Patterns Detected</h4>
                ${patterns.map(pattern => `
                    <div class="pattern-item severity-${pattern.severity}">
                        <div class="pattern-header">
                            <h5>${pattern.category}</h5>
                            <span class="severity-badge ${pattern.severity}">${pattern.severity.toUpperCase()}</span>
                        </div>
                        <p class="pattern-description">${pattern.description}</p>
                        <p class="pattern-recommendation">💡 ${pattern.recommendation}</p>
                        ${pattern.percentageChange ? `
                            <div class="pattern-stats">
                                <span>Change: ${pattern.percentageChange > 0 ? '+' : ''}${pattern.percentageChange.toFixed(1)}%</span>
                                <span>Current: ₱${pattern.currentMonthly?.toLocaleString()}</span>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    updateBudgetUI(budgetData) {
        if (!this.elements.budgetContent) return;

        if (!budgetData || !budgetData.recommendedBudget) {
            this.elements.budgetContent.innerHTML = `
                <div class="loading-goals">
                    <i class="fas fa-chart-pie"></i> Analyzing your spending to create a personalized budget...
                </div>
            `;
            return;
        }

        this.elements.budgetContent.innerHTML = `
            <div class="budget-recommendations">
                <div class="budget-overview">
                    <h4>Your Personalized Budget Plan</h4>
                    <div class="income-display">
                        <span>Monthly Income: ₱${budgetData.monthlyIncome?.toLocaleString()}</span>
                    </div>
                </div>

                <div class="budget-allocation">
                    <div class="allocation-item needs">
                        <div class="allocation-header">
                            <h5>Needs (${budgetData.recommendedBudget.needs.percentage}%)</h5>
                            <span>₱${budgetData.recommendedBudget.needs.amount?.toLocaleString()}</span>
                        </div>
                        <div class="allocation-categories">
                            ${budgetData.recommendedBudget.needs.categories.join(', ')}
                        </div>
                    </div>

                    <div class="allocation-item wants">
                        <div class="allocation-header">
                            <h5>Wants (${budgetData.recommendedBudget.wants.percentage}%)</h5>
                            <span>₱${budgetData.recommendedBudget.wants.amount?.toLocaleString()}</span>
                        </div>
                        <div class="allocation-categories">
                            ${budgetData.recommendedBudget.wants.categories.join(', ')}
                        </div>
                    </div>

                    <div class="allocation-item savings">
                        <div class="allocation-header">
                            <h5>Savings (${budgetData.recommendedBudget.savings.percentage}%)</h5>
                            <span>₱${budgetData.recommendedBudget.savings.amount?.toLocaleString()}</span>
                        </div>
                        <div class="allocation-categories">
                            ${budgetData.recommendedBudget.savings.purpose}
                        </div>
                    </div>
                </div>

                ${budgetData.recommendations && budgetData.recommendations.length > 0 ? `
                    <div class="action-recommendations">
                        <h5>Priority Actions:</h5>
                        ${budgetData.recommendations.map(rec => `
                            <div class="recommendation-item priority-${rec.priority}">
                                <div class="rec-action">${rec.action}</div>
                                <div class="rec-reason">${rec.reason}</div>
                                ${rec.expectedSavings ? `<div class="rec-savings">Potential savings: ₱${rec.expectedSavings.toLocaleString()}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${budgetData.emergencyFundGoal ? `
                    <div class="emergency-fund-goal">
                        <h5>Emergency Fund Goal</h5>
                        <p>Target: ₱${budgetData.emergencyFundGoal.toLocaleString()} (${budgetData.timeToGoal})</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    updateAlertsUI(alerts) {
        if (!this.elements.alertsContent) return;

        if (alerts.length === 0) {
            this.elements.alertsContent.innerHTML = `
                <div class="no-alerts">
                    <i class="fas fa-shield-check"></i>
                    <p>All good! No spending alerts at the moment.</p>
                    <small>I'm monitoring your spending patterns and will alert you to any concerns.</small>
                </div>
            `;
            return;
        }

        this.elements.alertsContent.innerHTML = `
            <div class="active-alerts">
                <h4>Active Alerts (${alerts.length})</h4>
                ${alerts.map(alert => `
                    <div class="alert-item severity-${alert.severity}">
                        <div class="alert-header">
                            <i class="fas fa-${alert.type === 'overspending' ? 'exclamation-triangle' : 'chart-line'}"></i>
                            <span class="alert-type">${alert.category}</span>
                            <span class="alert-time">${this.formatTime(alert.timestamp)}</span>
                        </div>
                        <div class="alert-message">${alert.message}</div>
                        <div class="alert-suggestion">💡 ${alert.suggestion}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Autonomous Action Methods
    triggerFinancialAlert(action) {
        const alert = {
            type: 'autonomous_intervention',
            severity: 'high',
            message: action.action,
            reasoning: action.reasoning,
            impact: action.impact,
            timestamp: action.timestamp
        };
        
        this.activeAlerts.unshift(alert);
        this.updateAlertsUI(this.activeAlerts);
        this.showNotification(alert);
        
        console.log(`🚨 Autonomous alert triggered: ${action.action}`);
    }

    presentOptimizationSuggestion(action) {
        // Update budget recommendations with new optimization
        this.budgetRecommendations.recommendations = this.budgetRecommendations.recommendations || [];
        this.budgetRecommendations.recommendations.unshift({
            priority: 'high',
            action: action.description,
            reason: `Autonomous optimization: ${action.category}`,
            expectedSavings: action.value,
            source: 'autonomous_agent'
        });
        
        this.updateBudgetUI(this.budgetRecommendations);
        console.log(`💡 Optimization suggestion: ${action.description}`);
    }

    updateUserBudgets(action) {
        // Autonomously adjust budget allocations based on insights
        if (action.category === 'savings' && action.value) {
            const currentBudget = this.budgetRecommendations.recommendedBudget;
            if (currentBudget) {
                // Increase savings allocation
                const additionalSavings = parseFloat(action.value) || 0;
                currentBudget.savings.amount += additionalSavings;
                currentBudget.wants.amount -= additionalSavings; // Reduce wants to accommodate
                
                console.log(`📊 Budget autonomously updated: +₱${additionalSavings} to savings`);
            }
        }
    }

    logAutonomousDecision(action) {
        const decision = {
            timestamp: new Date(),
            type: action.type,
            action: action.action,
            reasoning: action.reasoning,
            impact: action.impact,
            executionStatus: 'completed'
        };
        
        // Store decision for learning and audit trail
        if (!this.autonomousDecisions) {
            this.autonomousDecisions = [];
        }
        this.autonomousDecisions.push(decision);
        
        console.log(`📝 Autonomous decision logged:`, decision);
    }

    showNotification(alert) {
        const notification = document.createElement('div');
        notification.className = `smart-notification severity-${alert.severity}`;
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${alert.type === 'overspending' ? 'exclamation-triangle' : 'chart-line'}"></i>
            </div>
            <div class="notification-content">
                <h4>Smart Alert: ${alert.category}</h4>
                <p>${alert.message}</p>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 8000);
    }

    formatTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return time.toLocaleDateString();
    }

    // State management
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
            if (message) {
                const p = this.elements.emptyState.querySelector('p');
                if (p) p.textContent = message;
            }
        }
    }

    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${message}</p>
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // Fallback categorization using keyword matching
    fallbackCategorization(transactions) {
        if (!Array.isArray(transactions)) {
            console.warn("Invalid transactions array in fallback categorization");
            return [];
        }

        return transactions.map(tx => {
            const description = (tx.description || '').toLowerCase();
            let category = 'Others';
            let confidence = 0.6;
            let subcategory = '';

            // Simple keyword matching against Filipino categories
            for (const [mainCategory, keywords] of Object.entries(this.filipinoCategories)) {
                if (keywords.some(keyword => description.includes(keyword.toLowerCase()))) {
                    category = mainCategory.charAt(0).toUpperCase() + mainCategory.slice(1);
                    confidence = 0.75;
                    subcategory = keywords.find(k => description.includes(k.toLowerCase())) || '';
                    break;
                }
            }

            // Amount-based categorization hints
            const amount = parseFloat(tx.amount || 0);
            if (amount > 10000) {
                confidence = Math.max(confidence, 0.65); // Higher confidence for significant amounts
            }

            return {
                id: tx.id,
                description: tx.description || 'Unknown',
                amount: amount,
                date: tx.date,
                category: category,
                confidence: confidence,
                subcategory: subcategory,
                reasoning: subcategory ? `Matched Filipino keyword: "${subcategory}"` : 'Default categorization'
            };
        });
    }

    // Basic analysis without AI
    async runBasicAnalysis() {
        try {
            console.log("🔍 Running basic analysis...");
            
            // Use fallback categorization
            const categorizedTransactions = this.fallbackCategorization(this.userTransactions);
            this.updateCategorizationUI(categorizedTransactions);
            
            // Use basic pattern detection
            const patterns = this.fallbackPatternDetection(this.calculateMonthlySpending());
            this.updateOverspendingUI(patterns);
            
            // Use fallback budget recommendations
            const budgetData = this.fallbackBudgetRecommendations(this.getFinancialSummary());
            this.updateBudgetUI(budgetData);
            
            // Set up basic alerts
            const alerts = await this.generateSmartAlerts();
            this.updateAlertsUI(alerts);
            
            console.log("✅ Basic analysis completed");
            
        } catch (error) {
            console.error("❌ Basic analysis failed:", error);
            this.showErrorMessage("Failed to analyze your financial data. Please try again.");
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Starting Smart Ipon Coach AI...");
    const smartCoach = new SmartIponCoachAI();
    smartCoach.start();
});

export default SmartIponCoachAI;

