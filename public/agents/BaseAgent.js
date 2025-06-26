/**
 * BaseAgent - Foundational class for autonomous financial AI agents
 * Implements core agentic behaviors: autonomy, reasoning, planning, learning
 * Production-ready with comprehensive error handling, logging, and monitoring
 * 
 * @version 2.0.0
 * @author Kita-kita AI Team
 * @copyright 2025 Kita-kita Platform
 */

import { GEMINI_API_KEY, GEMINI_MODEL, firebaseConfig } from "../js/config.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserData, getUserTransactions, getUserBankAccounts, storeUserData } from "../js/firestoredb.js";
import { devLog, devWarn, prodError, prodLog, isProduction, getEnvironmentConfig } from "../js/utils/environment.js";

// Rate limiting configuration
const RATE_LIMIT = {
    MAX_REQUESTS_PER_MINUTE: 60,
    BACKOFF_INITIAL_DELAY: 1000,
    BACKOFF_MAX_DELAY: 32000,
    BACKOFF_FACTOR: 2
};

/**
 * Abstract base class implementing autonomous agentic behaviors
 * All financial AI agents inherit from this class
 */
export class BaseAgent {
    /**
     * Initialize the autonomous agent
     * @param {string} agentType - Type of agent (iponCoach, gastosGuardian, peraPlanner)
     * @param {Object} config - Agent-specific configuration
     */
    constructor(agentType, config = {}) {
        // Agent Identity & Core Properties
        this.agentType = agentType;
        this.agentId = `${agentType}_${Date.now()}`;
        this.version = "2.0.0";
        this.initialized = false;
        
        // Environment-aware configuration
        this.envConfig = getEnvironmentConfig();
        
        // Autonomous Behavior Systems
        this.autonomyLevel = config.autonomyLevel || 'medium';
        this.decisionThreshold = config.decisionThreshold || 0.7;
        this.learningRate = config.learningRate || 0.3;
        
        // Memory & Learning Systems
        this.shortTermMemory = new Map(); // Current session data
        this.longTermMemory = new Map();  // Persistent knowledge
        this.episodicMemory = [];         // Experience history
        this.semanticMemory = new Map();  // Factual knowledge
        
        // User Financial Data Cache
        this.userAccounts = [];           // User's bank accounts and wallets
        this.userTransactions = [];       // User's transaction history
        this.userFinancialProfile = null; // User's profile data
        this.accountInsights = new Map(); // Account-specific insights
        this.lastAccountsUpdate = null;   // Track when accounts were last loaded
        
        // Goal & Planning Systems
        this.currentGoals = [];
        this.completedGoals = [];
        this.goalHierarchy = new Map();
        this.planningHorizon = config.planningHorizon || 'medium_term'; // short, medium, long
        
        // Decision Making & Reasoning
        this.decisionHistory = [];
        this.reasoningChains = [];
        this.confidenceScores = [];
        this.feedbackLoop = [];
        
        // State Management
        this.currentState = 'initializing';
        this.previousStates = [];
        this.stateTransitions = [];
        
        // Performance Monitoring
        this.performanceMetrics = {
            decisionsCount: 0,
            successfulRecommendations: 0,
            userSatisfactionScore: 0,
            learningIterations: 0,
            autonomousActions: 0,
            accountAnalysisCount: 0
        };
        
        // Error Handling & Resilience
        this.errorCount = 0;
        this.recoveryStrategies = new Map();
        this.fallbackMechanisms = [];
        
        // Firebase & External APIs
        this.auth = getAuth();
        this.currentUser = null;
        this.geminiModel = config.geminiModel || 'gemini-pro';
        this.geminiApiKey = config.geminiApiKey;
        
        // Rate limiting state
        this.requestCount = 0;
        this.requestTimestamps = [];
        this.lastRequestTime = 0;
        
        // Add error tracking
        this.errors = {
            apiErrors: 0,
            rateLimitErrors: 0,
            lastErrorTime: null,
            consecutiveErrors: 0
        };
        
        // Initialize with error thresholds
        this.errorThresholds = {
            maxConsecutiveErrors: 3,
            maxApiErrors: 5,
            errorResetTime: 300000 // 5 minutes
        };
        
        // Initialize core systems
        this.initializeCoreSystemsAsync();
    }

    /**
     * Initialize all core autonomous systems
     * @private
     */
    async initializeCoreSystemsAsync() {
        try {
            await this.initializeMemorySystems();
            await this.initializeGoalFramework();
            await this.initializeReasoningEngine();
            await this.initializeUserContext();
            await this.initializeLearningSystem();
            await this.loadUserFinancialData();
            
            this.initialized = true;
            this.currentState = 'ready';
            this.logAgentAction('initialization_complete', { 
                agentType: this.agentType,
                accountsLoaded: this.userAccounts.length,
                transactionsLoaded: this.userTransactions.length
            });
            
        } catch (error) {
            this.handleError('initialization_failed', error);
            await this.activateRecoveryMode();
        }
    }

    /**
     * Load comprehensive user financial data including accounts
     * @param {Object} user - Firebase user object (optional, will use current auth state if not provided)
     */
    async loadUserFinancialData(user = null) {
        try {
            devLog(`🔄 [${this.agentType}] Loading user financial data...`);
            
            // Use provided user or current auth state
            const currentUser = user || this.auth.currentUser;
            if (!currentUser) {
                devLog(`⚠️ [${this.agentType}] No authenticated user found`);
                this.userFinancialProfile = null;
                this.userTransactions = [];
                this.userAccounts = [];
                return;
            }

            this.currentUser = currentUser;
            devLog(`👤 [${this.agentType}] Loading data for user: ${currentUser.uid}`);

            // Load all financial data in parallel with better error handling
            const results = await Promise.allSettled([
                getUserData(currentUser.uid),
                getUserTransactions(currentUser.uid),
                getUserBankAccounts(currentUser.uid)
            ]);

            // Process user profile data
            if (results[0].status === 'fulfilled') {
                this.userFinancialProfile = results[0].value;
            } else {
                devLog(`⚠️ Failed to load user data: ${results[0].reason}`);
                this.userFinancialProfile = null;
            }
            
            // Process transactions
            if (results[1].status === 'fulfilled') {
                this.userTransactions = results[1].value || [];
            } else {
                devLog(`⚠️ Failed to load transactions: ${results[1].reason}`);
                this.userTransactions = [];
            }
            
            // Process accounts
            if (results[2].status === 'fulfilled') {
                this.userAccounts = results[2].value || [];
            } else {
                devLog(`⚠️ Failed to load accounts: ${results[2].reason}`);
                this.userAccounts = [];
            }

            // Check if we have any data
            if (!this.userAccounts.length && !this.userTransactions.length) {
                devLog(`⚠️ [${this.agentType}] No financial data found for user: ${currentUser.uid}`);
            }

            // Generate account-specific insights
            await this.generateAccountInsights();

            // Store in memory systems
            this.storeInShortTermMemory('userAccounts', this.userAccounts);
            this.storeInShortTermMemory('userTransactions', this.userTransactions);
            this.storeInShortTermMemory('userProfile', this.userFinancialProfile);

            this.lastAccountsUpdate = new Date().toISOString();
            
            devLog(`✅ [${this.agentType}] Financial data loaded:`, {
                accounts: this.userAccounts.length,
                transactions: this.userTransactions.length,
                hasProfile: !!this.userFinancialProfile,
                userId: currentUser.uid
            });

        } catch (error) {
            prodError(`❌ [${this.agentType}] Error loading financial data:`, error);
            this.handleError('financial_data_load_failed', error);
            
            // Ensure we have empty arrays even on error
            this.userTransactions = [];
            this.userAccounts = [];
            this.userFinancialProfile = null;
        }
    }

    /**
     * Refresh financial data when user authentication state changes
     * @param {Object} user - Firebase user object
     */
    async refreshFinancialData(user) {
        if (user) {
            devLog(`🔄 [${this.agentType}] Refreshing data for authenticated user: ${user.uid}`);
            await this.loadUserFinancialData(user);
            
            // Update initialization status if we now have data
            if (!this.initialized && (this.userAccounts.length > 0 || this.userTransactions.length > 0)) {
                this.initialized = true;
                this.currentState = 'ready';
                devLog(`✅ [${this.agentType}] Initialization completed after auth state change`);
            }
        } else {
            devLog(`❌ [${this.agentType}] User logged out, clearing financial data`);
            this.userFinancialProfile = null;
            this.userTransactions = [];
            this.userAccounts = [];
            this.accountInsights.clear();
            this.currentUser = null;
        }
    }

    /**
     * Generate insights for each account
     * @private
     */
    async generateAccountInsights() {
        try {
            if (!this.userAccounts || this.userAccounts.length === 0) {
                devLog(`⚠️ [${this.agentType}] No accounts available for insights generation`);
                this.accountInsights.clear();
                return;
            }

            devLog(`🔄 [${this.agentType}] Generating insights for ${this.userAccounts.length} accounts...`);
            
            // Clear existing insights
            this.accountInsights.clear();
            
            // Generate insights for each account
            for (const account of this.userAccounts) {
                if (!account || !account.id) continue;
                
                try {
                    const insight = await this.analyzeAccount(account);
                    if (insight) {
                        this.accountInsights.set(account.id, insight);
                    }
                } catch (accountError) {
                    devLog(`⚠️ Failed to analyze account ${account.id}:`, accountError);
                }
            }
            
            devLog(`✅ [${this.agentType}] Generated insights for ${this.accountInsights.size} accounts`);
            
        } catch (error) {
            prodError(`❌ [${this.agentType}] Error generating account insights:`, error);
            this.handleError('insights_generation_failed', error);
            this.accountInsights.clear();
        }
    }

    /**
     * Analyze a specific account for insights
     * @param {Object} account - Account data
     * @returns {Promise<Object>} Account insights
     */
    async analyzeAccount(account) {
        const accountTransactions = this.getAccountTransactions(account.id);
        const monthlyFlow = this.calculateMonthlyFlow(accountTransactions);
        const usagePattern = this.analyzeUsagePattern(accountTransactions);
        const balanceTrend = this.calculateBalanceTrend(account, accountTransactions);

        return {
            accountId: account.id,
            accountName: account.name,
            accountType: account.accountType || account.category,
            provider: account.provider || account.bank,
            
            // Financial metrics
            currentBalance: parseFloat(account.balance || 0),
            monthlyInflow: monthlyFlow.inflow,
            monthlyOutflow: monthlyFlow.outflow,
            netMonthlyFlow: monthlyFlow.net,
            averageTransactionAmount: this.calculateAverageTransaction(accountTransactions),
            
            // Usage patterns
            usageFrequency: usagePattern.frequency,
            primaryUsage: usagePattern.primaryUsage,
            transactionCount: accountTransactions.length,
            lastActivityDate: this.getLastActivityDate(accountTransactions),
            
            // Risk and optimization
            balanceTrend: balanceTrend.trend,
            balanceStability: balanceTrend.stability,
            riskLevel: await this.assessAccountRisk(account, accountTransactions),
            recommendations: await this.generateAccountRecommendations(account, accountTransactions),
            optimizationOpportunities: this.identifyOptimizationOpportunities(account, accountTransactions),
            
            // Behavioral insights
            spendingVelocity: this.calculateAccountSpendingVelocity(accountTransactions),
            savingsContribution: this.calculateSavingsContribution(account, accountTransactions),
            liquidityScore: this.calculateLiquidityScore(account),
            
            // Account efficiency
            utilizationRate: this.calculateUtilizationRate(account, accountTransactions),
            efficiencyScore: this.calculateAccountEfficiency(account, accountTransactions),
            
            // Metadata
            analysisDate: new Date().toISOString(),
            dataQuality: this.assessAccountDataQuality(account, accountTransactions)
        };
    }

    /**
     * Get transactions for a specific account
     * @param {string} accountId - Account ID
     * @returns {Array} Filtered transactions
     */
    getAccountTransactions(accountId) {
        return this.userTransactions.filter(tx => tx.accountId === accountId);
    }

    /**
     * Calculate monthly cash flow for an account
     * @param {Array} transactions - Account transactions
     * @returns {Object} Monthly flow data
     */
    calculateMonthlyFlow(transactions) {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        const monthlyTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
        });

        let inflow = 0;
        let outflow = 0;

        monthlyTransactions.forEach(tx => {
            const amount = parseFloat(tx.amount || 0);
            if (tx.type === 'income' || tx.type === 'deposit') {
                inflow += amount;
            } else if (tx.type === 'expense' || tx.type === 'withdrawal') {
                outflow += amount;
            }
        });

        return {
            inflow,
            outflow,
            net: inflow - outflow,
            transactionCount: monthlyTransactions.length
        };
    }

    /**
     * Analyze usage patterns for an account
     * @param {Array} transactions - Account transactions
     * @returns {Object} Usage pattern analysis
     */
    analyzeUsagePattern(transactions) {
        if (transactions.length === 0) {
            return {
                frequency: 'inactive',
                primaryUsage: 'dormant',
                pattern: 'no_activity',
                recommendation: 'Consider activating this account or consolidating with active accounts'
            };
        }

        // Calculate frequency
        const daysSinceLastTransaction = this.getDaysSinceLastTransaction(transactions);
        const monthlyTransactionCount = this.getMonthlyTransactionCount(transactions);
        
        let frequency;
        if (monthlyTransactionCount > 20) frequency = 'very_active';
        else if (monthlyTransactionCount > 10) frequency = 'active';
        else if (monthlyTransactionCount > 5) frequency = 'moderate';
        else if (monthlyTransactionCount > 0) frequency = 'low';
        else frequency = 'inactive';

        // Determine primary usage
        const transactionTypes = this.analyzeTransactionTypes(transactions);
        let primaryUsage;
        
        if (transactionTypes.incomeRatio > 0.7) primaryUsage = 'income_receiving';
        else if (transactionTypes.expenseRatio > 0.8) primaryUsage = 'spending';
        else if (transactionTypes.savingsRatio > 0.5) primaryUsage = 'savings';
        else primaryUsage = 'mixed_usage';

        return {
            frequency,
            primaryUsage,
            monthlyTransactionCount,
            daysSinceLastTransaction,
            transactionTypes,
            averageTransactionValue: transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0) / transactions.length,
            pattern: this.identifyTransactionPattern(transactions)
        };
    }

    /**
     * Calculate balance trend for an account
     * @param {Object} account - Account data
     * @param {Array} transactions - Account transactions
     * @returns {Object} Balance trend analysis
     */
    calculateBalanceTrend(account, transactions) {
        const currentBalance = parseFloat(account.balance || 0);
        
        // Calculate historical balance trend based on transactions
        const sortedTransactions = transactions
            .sort((a, b) => new Date(a.date || a.timestamp) - new Date(b.date || b.timestamp));
        
        let balanceHistory = [currentBalance];
        let runningBalance = currentBalance;
        
        // Work backwards from current balance
        for (let i = sortedTransactions.length - 1; i >= 0; i--) {
            const tx = sortedTransactions[i];
            const amount = parseFloat(tx.amount || 0);
            
            if (tx.type === 'income' || tx.type === 'deposit') {
                runningBalance -= amount;
            } else if (tx.type === 'expense' || tx.type === 'withdrawal') {
                runningBalance += amount;
            }
            
            balanceHistory.unshift(runningBalance);
        }

        // Calculate trend
        const balanceChange = balanceHistory.length > 1 ? 
            balanceHistory[balanceHistory.length - 1] - balanceHistory[0] : 0;
        
        let trend;
        if (Math.abs(balanceChange) < 1000) trend = 'stable';
        else if (balanceChange > 0) trend = 'increasing';
        else trend = 'decreasing';

        // Calculate stability (variance in balance changes)
        const balanceChanges = [];
        for (let i = 1; i < balanceHistory.length; i++) {
            balanceChanges.push(balanceHistory[i] - balanceHistory[i - 1]);
        }
        
        const variance = this.calculateVariance(balanceChanges);
        let stability;
        if (variance < 10000) stability = 'very_stable';
        else if (variance < 50000) stability = 'stable';
        else if (variance < 100000) stability = 'moderate';
        else stability = 'volatile';

        return {
            trend,
            stability,
            balanceChange,
            currentBalance,
            historicalLow: Math.min(...balanceHistory),
            historicalHigh: Math.max(...balanceHistory),
            variance,
            balanceHistory: balanceHistory.slice(-30) // Last 30 data points
        };
    }

    /**
     * Generate comprehensive account recommendations
     * @param {Object} account - Account data
     * @param {Array} transactions - Account transactions
     * @returns {Promise<Array>} Account recommendations
     */
    async generateAccountRecommendations(account, transactions) {
        const recommendations = [];
        const currentBalance = parseFloat(account.balance || 0);
        const monthlyFlow = this.calculateMonthlyFlow(transactions);
        const usagePattern = this.analyzeUsagePattern(transactions);

        // Balance-based recommendations
        if (currentBalance < 1000 && account.accountType !== 'credit-card') {
            recommendations.push({
                type: 'low_balance',
                priority: 'high',
                title: 'Low Account Balance',
                description: `Your ${account.name} balance is below ₱1,000. Consider transferring funds or setting up automatic transfers.`,
                action: 'Increase account balance',
                targetAmount: 5000
            });
        }

        // Activity-based recommendations
        if (usagePattern.frequency === 'inactive') {
            recommendations.push({
                type: 'inactive_account',
                priority: 'medium',
                title: 'Inactive Account',
                description: `${account.name} shows minimal activity. Consider consolidating or closing if unnecessary.`,
                action: 'Review account necessity',
                potentialSavings: this.calculatePotentialSavings(account)
            });
        }

        // Cash flow recommendations
        if (monthlyFlow.net < -5000) {
            recommendations.push({
                type: 'negative_flow',
                priority: 'high',
                title: 'Negative Cash Flow',
                description: `${account.name} has consistent outflow. Monitor spending or increase income deposits.`,
                action: 'Optimize cash flow',
                monthlyImpact: Math.abs(monthlyFlow.net)
            });
        }

        // Account-specific recommendations
        if (account.category === 'digital-wallet' && currentBalance > 50000) {
            recommendations.push({
                type: 'excess_digital_balance',
                priority: 'medium',
                title: 'High Digital Wallet Balance',
                description: `Consider transferring excess funds from ${account.name} to a higher-yield savings account.`,
                action: 'Optimize fund allocation',
                potentialGain: this.calculatePotentialInterestGain(currentBalance - 50000)
            });
        }

        if (account.category === 'traditional-bank' && usagePattern.frequency === 'very_active' && currentBalance < 10000) {
            recommendations.push({
                type: 'low_primary_balance',
                priority: 'medium',
                title: 'Primary Account Underfunded',
                description: `${account.name} is heavily used but underfunded. Consider maintaining a higher balance.`,
                action: 'Increase primary account balance',
                targetAmount: 25000
            });
        }

        return recommendations;
    }

    /**
     * Assess risk level for an account
     * @param {Object} account - Account data
     * @param {Array} transactions - Account transactions
     * @returns {Object} Risk assessment
     */
    assessAccountRisk(account, transactions) {
        let riskScore = 0;
        const riskFactors = [];
        
        const currentBalance = parseFloat(account.balance || 0);
        const monthlyFlow = this.calculateMonthlyFlow(transactions);
        const usagePattern = this.analyzeUsagePattern(transactions);

        // Balance risk
        if (currentBalance < 1000) {
            riskScore += 30;
            riskFactors.push('Very low balance');
        } else if (currentBalance < 5000) {
            riskScore += 15;
            riskFactors.push('Low balance');
        }

        // Cash flow risk
        if (monthlyFlow.net < -10000) {
            riskScore += 25;
            riskFactors.push('High monthly outflow');
        } else if (monthlyFlow.net < -5000) {
            riskScore += 15;
            riskFactors.push('Moderate monthly outflow');
        }

        // Activity risk
        if (usagePattern.frequency === 'inactive' && currentBalance > 0) {
            riskScore += 10;
            riskFactors.push('Unused funds');
        }

        // Account type specific risks
        if (account.category === 'digital-wallet' && currentBalance > 100000) {
            riskScore += 20;
            riskFactors.push('Excessive funds in digital wallet');
        }

        if (account.category === 'cash' && currentBalance > 20000) {
            riskScore += 15;
            riskFactors.push('High cash holdings');
        }

        // Determine risk level
        let riskLevel;
        if (riskScore >= 50) riskLevel = 'high';
        else if (riskScore >= 25) riskLevel = 'medium';
        else riskLevel = 'low';

        return {
            riskLevel,
            riskScore,
            riskFactors,
            description: this.getRiskDescription(riskLevel),
            recommendations: this.getRiskMitigationRecommendations(riskLevel, riskFactors)
        };
    }

    /**
     * Get risk level description
     * @param {string} riskLevel - Risk level
     * @returns {string} Risk description
     */
    getRiskDescription(riskLevel) {
        const descriptions = {
            low: 'This account appears to be well-managed with minimal risk factors.',
            medium: 'This account has some areas that could be optimized to reduce risk.',
            high: 'This account requires attention to address significant risk factors.'
        };
        return descriptions[riskLevel] || 'Unknown risk level';
    }

    /**
     * Get risk mitigation recommendations
     * @param {string} riskLevel - Risk level
     * @param {Array} riskFactors - List of risk factors
     * @returns {Array} Mitigation recommendations
     */
    getRiskMitigationRecommendations(riskLevel, riskFactors) {
        const recommendations = [];
        
        riskFactors.forEach(factor => {
            switch (factor) {
                case 'Very low balance':
                    recommendations.push('Transfer funds to maintain minimum balance');
                    break;
                case 'High monthly outflow':
                    recommendations.push('Review and reduce unnecessary expenses');
                    break;
                case 'Excessive funds in digital wallet':
                    recommendations.push('Transfer excess to savings or investment account');
                    break;
                case 'High cash holdings':
                    recommendations.push('Deposit cash into interest-bearing account');
                    break;
                default:
                    recommendations.push(`Address: ${factor}`);
            }
        });

        return recommendations;
    }

    /**
     * Identify optimization opportunities for an account
     * @param {Object} account - Account data
     * @param {Array} transactions - Account transactions
     * @returns {Array} Optimization opportunities
     */
    identifyOptimizationOpportunities(account, transactions) {
        const opportunities = [];
        const currentBalance = parseFloat(account.balance || 0);
        const monthlyFlow = this.calculateMonthlyFlow(transactions);
        const usagePattern = this.analyzeUsagePattern(transactions);

        // Interest optimization
        if (account.category === 'traditional-bank' && account.accountType === 'savings' && currentBalance > 25000) {
            const potentialGain = this.calculateHighYieldPotential(currentBalance);
            if (potentialGain > 100) {
                opportunities.push({
                    type: 'interest_optimization',
                    title: 'Higher Yield Opportunity',
                    description: 'Consider moving funds to a higher-yield savings account',
                    potentialMonthlyGain: potentialGain,
                    difficulty: 'easy',
                    timeToImplement: '1-2 days'
                });
            }
        }

        // Fee optimization
        if (usagePattern.frequency === 'low' && account.category === 'traditional-bank') {
            opportunities.push({
                type: 'fee_optimization',
                title: 'Reduce Account Fees',
                description: 'Low usage account may be incurring unnecessary maintenance fees',
                potentialMonthlySavings: 150,
                difficulty: 'medium',
                timeToImplement: '1 week'
            });
        }

        // Liquidity optimization
        if (currentBalance > 100000 && usagePattern.frequency === 'low') {
            opportunities.push({
                type: 'liquidity_optimization',
                title: 'Optimize Fund Allocation',
                description: 'Large balance could be earning more in time deposits or investments',
                potentialMonthlyGain: this.calculateInvestmentPotential(currentBalance),
                difficulty: 'medium',
                timeToImplement: '1-2 weeks'
            });
        }

        // Digital wallet optimization
        if (account.category === 'digital-wallet' && currentBalance > 25000) {
            opportunities.push({
                type: 'digital_optimization',
                title: 'Digital Wallet Optimization',
                description: 'Transfer excess funds to earn interest while maintaining transaction capability',
                potentialMonthlyGain: this.calculateInterestEarnings(currentBalance - 10000),
                difficulty: 'easy',
                timeToImplement: 'Same day'
            });
        }

        return opportunities;
    }

    /**
     * Get comprehensive financial overview from all accounts
     * @returns {Object} Financial overview
     */
    getFinancialOverview() {
        const overview = {
            totalBalance: 0,
            monthlyIncome: 0,
            monthlyExpenses: 0,
            netMonthlyCashFlow: 0,
            accountsByCategory: {},
            savingsRate: 0,
            liquidityRatio: 0,
            riskDistribution: {},
            totalAccounts: this.userAccounts.length
        };

        // Calculate totals and categorize accounts
        this.userAccounts.forEach(account => {
            const balance = parseFloat(account.balance || 0);
            overview.totalBalance += balance;

            const category = account.category || 'unknown';
            if (!overview.accountsByCategory[category]) {
                overview.accountsByCategory[category] = {
                    count: 0,
                    totalBalance: 0,
                    accounts: []
                };
            }
            overview.accountsByCategory[category].count++;
            overview.accountsByCategory[category].totalBalance += balance;
            overview.accountsByCategory[category].accounts.push(account);
        });

        // Calculate monthly flows from transactions
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        const monthlyTransactions = this.userTransactions.filter(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
        });

        monthlyTransactions.forEach(tx => {
            const amount = parseFloat(tx.amount || 0);
            if (tx.type === 'income' || tx.type === 'deposit') {
                overview.monthlyIncome += amount;
            } else if (tx.type === 'expense' || tx.type === 'withdrawal') {
                overview.monthlyExpenses += amount;
            }
        });

        overview.netMonthlyCashFlow = overview.monthlyIncome - overview.monthlyExpenses;
        overview.savingsRate = overview.monthlyIncome > 0 ? 
            ((overview.monthlyIncome - overview.monthlyExpenses) / overview.monthlyIncome) * 100 : 0;

        // Calculate liquidity ratio
        const liquidAccounts = ['traditional-bank', 'digital-wallet', 'cash'];
        const liquidBalance = Object.entries(overview.accountsByCategory)
            .filter(([category]) => liquidAccounts.includes(category))
            .reduce((sum, [, data]) => sum + data.totalBalance, 0);
        
        overview.liquidityRatio = overview.totalBalance > 0 ? (liquidBalance / overview.totalBalance) * 100 : 0;

        return overview;
    }

    // Helper methods for calculations
    calculateAverageTransaction(transactions) {
        if (transactions.length === 0) return 0;
        const total = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        return total / transactions.length;
    }

    getLastActivityDate(transactions) {
        if (transactions.length === 0) return null;
        const dates = transactions.map(tx => new Date(tx.date || tx.timestamp));
        return new Date(Math.max(...dates)).toISOString();
    }

    getDaysSinceLastTransaction(transactions) {
        const lastDate = this.getLastActivityDate(transactions);
        if (!lastDate) return Infinity;
        return Math.floor((new Date() - new Date(lastDate)) / (1000 * 60 * 60 * 24));
    }

    getMonthlyTransactionCount(transactions) {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        return transactions.filter(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
        }).length;
    }

    analyzeTransactionTypes(transactions) {
        let incomeCount = 0, expenseCount = 0, savingsCount = 0;
        
        transactions.forEach(tx => {
            if (tx.type === 'income' || tx.type === 'deposit') incomeCount++;
            else if (tx.type === 'expense' || tx.type === 'withdrawal') expenseCount++;
            else if (tx.type === 'savings' || tx.type === 'transfer') savingsCount++;
        });

        const total = transactions.length;
        return {
            incomeRatio: total > 0 ? incomeCount / total : 0,
            expenseRatio: total > 0 ? expenseCount / total : 0,
            savingsRatio: total > 0 ? savingsCount / total : 0
        };
    }

    identifyTransactionPattern(transactions) {
        if (transactions.length < 5) return 'insufficient_data';
        
        const amounts = transactions.map(tx => parseFloat(tx.amount || 0));
        const variance = this.calculateVariance(amounts);
        const mean = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
        
        const coefficientOfVariation = variance > 0 ? Math.sqrt(variance) / mean : 0;
        
        if (coefficientOfVariation < 0.3) return 'consistent';
        else if (coefficientOfVariation < 0.7) return 'moderate_variation';
        else return 'highly_variable';
    }

    calculateVariance(numbers) {
        if (numbers.length === 0) return 0;
        const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
        const squaredDifferences = numbers.map(num => Math.pow(num - mean, 2));
        return squaredDifferences.reduce((sum, diff) => sum + diff, 0) / numbers.length;
    }

    calculateAccountSpendingVelocity(transactions) {
        const expenseTransactions = transactions.filter(tx => 
            tx.type === 'expense' || tx.type === 'withdrawal'
        );
        
        if (expenseTransactions.length === 0) return 0;
        
        const totalExpenses = expenseTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        const daysSinceFirst = this.getDaysBetweenTransactions(expenseTransactions);
        
        return daysSinceFirst > 0 ? totalExpenses / daysSinceFirst : 0;
    }

    calculateSavingsContribution(account, transactions) {
        const savingsTransactions = transactions.filter(tx => 
            tx.type === 'deposit' || tx.type === 'savings' || tx.type === 'income'
        );
        
        return savingsTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    }

    calculateLiquidityScore(account) {
        const balance = parseFloat(account.balance || 0);
        const category = account.category;
        
        let baseScore = 0;
        if (category === 'cash') baseScore = 100;
        else if (category === 'digital-wallet') baseScore = 95;
        else if (category === 'traditional-bank') baseScore = 85;
        else if (category === 'investment') baseScore = 30;
        
        // Adjust based on balance
        if (balance > 50000) baseScore *= 1.1;
        else if (balance < 1000) baseScore *= 0.8;
        
        return Math.min(100, Math.max(0, baseScore));
    }

    calculateUtilizationRate(account, transactions) {
        const currentBalance = parseFloat(account.balance || 0);
        const monthlyFlow = this.calculateMonthlyFlow(transactions);
        
        if (currentBalance === 0) return 0;
        return Math.min(100, (Math.abs(monthlyFlow.outflow) / currentBalance) * 100);
    }

    calculateAccountEfficiency(account, transactions) {
        const balance = parseFloat(account.balance || 0);
        const usagePattern = this.analyzeUsagePattern(transactions);
        const liquidityScore = this.calculateLiquidityScore(account);
        
        let efficiencyScore = 50; // Base score
        
        // Adjust for usage frequency
        if (usagePattern.frequency === 'very_active') efficiencyScore += 20;
        else if (usagePattern.frequency === 'active') efficiencyScore += 10;
        else if (usagePattern.frequency === 'inactive') efficiencyScore -= 20;
        
        // Adjust for balance optimization
        if (balance > 0 && balance < 100000) efficiencyScore += 10;
        else if (balance > 100000) efficiencyScore -= 5;
        
        // Adjust for account type appropriateness
        if (account.category === 'digital-wallet' && usagePattern.frequency === 'very_active') {
            efficiencyScore += 15;
        }
        
        return Math.min(100, Math.max(0, efficiencyScore));
    }

    assessAccountDataQuality(account, transactions) {
        let qualityScore = 0;
        const qualityFactors = [];
        
        // Account information completeness
        if (account.name) qualityScore += 20;
        if (account.balance !== undefined) qualityScore += 20;
        if (account.category) qualityScore += 15;
        if (account.provider || account.bank) qualityScore += 10;
        
        // Transaction data quality
        if (transactions.length > 0) {
            qualityScore += 20;
            if (transactions.length > 10) qualityScore += 10;
            if (transactions.length > 50) qualityScore += 5;
        }
        
        // Data recency
        const lastActivity = this.getLastActivityDate(transactions);
        if (lastActivity) {
            const daysSinceActivity = this.getDaysSinceLastTransaction(transactions);
            if (daysSinceActivity < 30) qualityScore += 10;
            else if (daysSinceActivity < 90) qualityScore += 5;
        }
        
        let qualityLevel;
        if (qualityScore >= 80) qualityLevel = 'excellent';
        else if (qualityScore >= 60) qualityLevel = 'good';
        else if (qualityScore >= 40) qualityLevel = 'fair';
        else qualityLevel = 'poor';
        
        return {
            score: qualityScore,
            level: qualityLevel,
            factors: qualityFactors
        };
    }

    // Financial calculation helpers
    calculatePotentialSavings(account) {
        // Estimate potential savings from account optimization
        const balance = parseFloat(account.balance || 0);
        return balance * 0.01; // 1% potential monthly savings
    }

    calculatePotentialInterestGain(amount) {
        // Calculate potential interest gain at 2.5% annual rate
        return (amount * 0.025) / 12;
    }

    calculateHighYieldPotential(balance) {
        // Assume 2% higher yield potential
        return (balance * 0.02) / 12;
    }

    calculateInvestmentPotential(balance) {
        // Conservative investment return estimate (5% annual)
        return (balance * 0.05) / 12;
    }

    calculateInterestEarnings(amount) {
        // Standard savings rate calculation
        return (amount * 0.015) / 12;
    }

    getDaysBetweenTransactions(transactions) {
        if (transactions.length < 2) return 0;
        
        const dates = transactions
            .map(tx => new Date(tx.date || tx.timestamp))
            .sort((a, b) => a - b);
        
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];
        
        return Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));
    }

    /**
     * Store data in short-term memory
     * @param {string} key - Memory key
     * @param {*} value - Value to store
     */
    storeInShortTermMemory(key, value) {
        this.shortTermMemory.set(key, {
            value,
            timestamp: new Date().toISOString(),
            accessCount: 0
        });
    }

    /**
     * Get data from short-term memory
     * @param {string} key - Memory key
     * @returns {*} Stored value
     */
    getFromShortTermMemory(key) {
        const item = this.shortTermMemory.get(key);
        if (item) {
            item.accessCount++;
            return item.value;
        }
        return null;
    }

    /**
     * AUTONOMOUS BEHAVIOR IMPLEMENTATION
     */

    /**
     * Make autonomous decisions based on context and goals
     * Core agentic behavior - full autonomy in decision making
     * @param {Object} context - Current context/situation
     * @param {Array} options - Available decision options
     * @returns {Promise<Object>} Autonomous decision with reasoning
     */
    async makeAutonomousDecision(context, options = []) {
        try {
            // Step 1: Analyze current situation with reasoning
            const situationAnalysis = await this.analyzeSituation(context);
            
            // Step 2: Generate possible actions based on agent's goals
            const possibleActions = await this.generateActionOptions(context, situationAnalysis);
            
            // Step 3: Evaluate each option using multi-criteria decision analysis
            const evaluatedOptions = await this.evaluateOptions([...options, ...possibleActions], context);
            
            // Step 4: Apply autonomous decision making logic
            const decision = await this.selectOptimalAction(evaluatedOptions, context);
            
            // Step 5: Create comprehensive reasoning chain
            const reasoningChain = await this.buildReasoningChain(context, evaluatedOptions, decision);
            
            // Step 6: Store decision for learning
            this.storeDecisionExperience(context, decision, reasoningChain);
            
            // Step 7: Plan follow-up actions
            const followUpPlan = await this.planFollowUpActions(decision, context);
            
            const autonomousDecision = {
                decision: decision,
                reasoning: reasoningChain,
                confidence: decision.confidence,
                autonomyLevel: this.autonomyLevel,
                followUpPlan: followUpPlan,
                timestamp: new Date().toISOString(),
                agentId: this.agentId,
                decisionId: `decision_${Date.now()}`
            };
            
            this.performanceMetrics.decisionsCount++;
            this.performanceMetrics.autonomousActions++;
            
            return autonomousDecision;
            
        } catch (error) {
            this.handleError('autonomous_decision_failed', error, context);
            return await this.makeEmergencyDecision(context);
        }
    }

    /**
     * Advanced reasoning engine using multi-step logical analysis
     * @param {Object} problem - Problem to reason about
     * @returns {Promise<Object>} Reasoning result with step-by-step logic
     */
    async performAdvancedReasoning(problem) {
        try {
            const reasoningSteps = [];
            
            // Step 1: Problem decomposition
            const subProblems = await this.decomposeComplex(problem);
            reasoningSteps.push({ step: 'decomposition', result: subProblems });
            
            // Step 2: Evidence gathering from memory and context
            const evidence = await this.gatherRelevantEvidence(problem);
            reasoningSteps.push({ step: 'evidence_gathering', result: evidence });
            
            // Step 3: Pattern recognition from past experiences
            const patterns = await this.recognizePatterns(problem, evidence);
            reasoningSteps.push({ step: 'pattern_recognition', result: patterns });
            
            // Step 4: Logical inference using AI and rule-based reasoning
            const inferences = await this.performLogicalInference(subProblems, evidence, patterns);
            reasoningSteps.push({ step: 'logical_inference', result: inferences });
            
            // Step 5: Synthesis and conclusion formation
            const conclusion = await this.synthesizeConclusion(reasoningSteps, problem);
            reasoningSteps.push({ step: 'synthesis', result: conclusion });
            
            // Step 6: Confidence assessment
            const confidence = this.assessReasoningConfidence(reasoningSteps);
            
            const reasoningResult = {
                problem: problem,
                reasoningSteps: reasoningSteps,
                conclusion: conclusion,
                confidence: confidence,
                reasoningType: 'advanced_multi_step',
                timestamp: new Date().toISOString()
            };
            
            this.reasoningChains.push(reasoningResult);
            return reasoningResult;
            
        } catch (error) {
            this.handleError('reasoning_failed', error, problem);
            return await this.performBasicReasoning(problem);
        }
    }

    /**
     * Comprehensive goal-driven planning system
     * @param {Array} goals - User's financial goals
     * @param {Object} currentSituation - Current financial situation
     * @param {string} timeHorizon - Planning time horizon
     * @returns {Promise<Object>} Comprehensive financial plan
     */
    async createComprehensivePlan(goals, currentSituation, timeHorizon = 'medium_term') {
        try {
            // Step 1: Goal analysis and prioritization
            const analyzedGoals = await this.analyzeAndPrioritizeGoals(goals, currentSituation);
            
            // Step 2: Resource assessment
            const resourceAnalysis = await this.assessAvailableResources(currentSituation);
            
            // Step 3: Constraint identification
            const constraints = await this.identifyConstraints(currentSituation, goals);
            
            // Step 4: Strategy generation using AI
            const strategies = await this.generateStrategies(analyzedGoals, resourceAnalysis, constraints);
            
            // Step 5: Timeline development
            const timeline = await this.developTimeline(strategies, timeHorizon);
            
            // Step 6: Risk assessment and mitigation
            const riskAnalysis = await this.performRiskAnalysis(strategies, timeline);
            
            // Step 7: Plan optimization
            const optimizedPlan = await this.optimizePlan(strategies, timeline, riskAnalysis);
            
            // Step 8: Success metrics definition
            const successMetrics = await this.defineSuccessMetrics(optimizedPlan, goals);
            
            const comprehensivePlan = {
                goals: analyzedGoals,
                strategies: optimizedPlan.strategies,
                timeline: timeline,
                riskMitigation: riskAnalysis.mitigationStrategies,
                successMetrics: successMetrics,
                resourceRequirements: resourceAnalysis.requirements,
                constraints: constraints,
                adaptationMechanisms: await this.createAdaptationMechanisms(optimizedPlan),
                planId: `plan_${Date.now()}`,
                createdBy: this.agentId,
                creationDate: new Date().toISOString(),
                planType: 'comprehensive_autonomous'
            };
            
            // Store plan for tracking and updates
            await this.storePlanInMemory(comprehensivePlan);
            
            return comprehensivePlan;
            
        } catch (error) {
            this.handleError('planning_failed', error, { goals, currentSituation });
            return await this.createBasicPlan(goals, currentSituation);
        }
    }

    /**
     * Continuous learning and adaptation system
     * @param {Object} experience - New experience to learn from
     * @param {Object} feedback - User feedback on previous actions
     * @returns {Promise<Object>} Learning outcome and model updates
     */
    async learnAndAdapt(experience, feedback = null) {
        try {
            // Step 1: Experience encoding
            const encodedExperience = await this.encodeExperience(experience);
            
            // Step 2: Pattern extraction
            const extractedPatterns = await this.extractLearningPatterns(encodedExperience);
            
            // Step 3: Knowledge integration
            const knowledgeUpdates = await this.integrateNewKnowledge(extractedPatterns);
            
            // Step 4: Model parameter adjustment
            const modelUpdates = await this.adjustModelParameters(knowledgeUpdates, feedback);
            
            // Step 5: Hypothesis formation for future testing
            const hypotheses = await this.formHypotheses(knowledgeUpdates);
            
            // Step 6: Update memory systems
            await this.updateMemorySystems(encodedExperience, knowledgeUpdates);
            
            const learningOutcome = {
                experienceProcessed: encodedExperience,
                patternsLearned: extractedPatterns,
                modelUpdates: modelUpdates,
                newHypotheses: hypotheses,
                learningIteration: ++this.performanceMetrics.learningIterations,
                timestamp: new Date().toISOString(),
                agentId: this.agentId
            };
            
            // Store learning outcome
            this.episodicMemory.push(learningOutcome);
            
            return learningOutcome;
            
        } catch (error) {
            this.handleError('learning_failed', error, experience);
            return { error: 'learning_process_failed', fallback: true };
        }
    }

    /**
     * GEMINI AI INTEGRATION FOR ADVANCED REASONING
     */

    /**
     * Implements rate limiting for API calls
     * @private
     */
    async enforceRateLimit() {
        const now = Date.now();
        
        // Remove timestamps older than 1 minute
        this.requestTimestamps = this.requestTimestamps.filter(
            timestamp => now - timestamp < 60000
        );
        
        // If we've hit the rate limit, wait until we can make another request
        if (this.requestTimestamps.length >= RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
            const oldestTimestamp = this.requestTimestamps[0];
            const waitTime = 60000 - (now - oldestTimestamp);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        // Add current timestamp
        this.requestTimestamps.push(now);
    }

    /**
     * Implements exponential backoff for retrying failed requests
     * @private
     */
    async retryWithExponentialBackoff(operation, maxRetries = 5) {
        let retryCount = 0;
        let delay = RATE_LIMIT.BACKOFF_INITIAL_DELAY;

        while (retryCount < maxRetries) {
            try {
                await this.enforceRateLimit();
                return await operation();
            } catch (error) {
                if (error.status === 429 || error.message.includes('429')) {
                    retryCount++;
                    if (retryCount === maxRetries) {
                        throw new Error(`Failed after ${maxRetries} retries: ${error.message}`);
                    }
                    
                    // Calculate delay with jitter
                    const jitter = Math.random() * 1000;
                    delay = Math.min(delay * RATE_LIMIT.BACKOFF_FACTOR + jitter, RATE_LIMIT.BACKOFF_MAX_DELAY);
                    
                    devLog(`Rate limit hit, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Enhanced Gemini API call with rate limiting and retries
     * @param {string} prompt - The prompt to send to Gemini
     * @param {Object} context - Additional context for the API call
     */
    async callGeminiForReasoning(prompt, context = {}) {
        try {
            if (!this.geminiApiKey) {
                throw new Error("Gemini API key not configured");
            }

            const enhancedPrompt = this.buildEnhancedPrompt(prompt, context);
            const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
            
            const requestBody = {
                contents: [{
                    parts: [{
                        text: enhancedPrompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            };

            const response = await fetch(`${apiUrl}?key=${this.geminiApiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            console.error("Error calling Gemini API:", error);
            return this.getFallbackResponse(prompt, context);
        }
    }

    /**
     * MEMORY SYSTEM IMPLEMENTATION
     */

    /**
     * Initialize sophisticated memory systems
     * @private
     */
    async initializeMemorySystems() {
        // Short-term memory for current session
        this.shortTermMemory.set('session_start', new Date().toISOString());
        this.shortTermMemory.set('user_interactions', []);
        
        // Load persistent long-term memory
        await this.loadLongTermMemory();
        
        // Initialize semantic knowledge base
        await this.initializeSemanticMemory();
    }

    /**
     * Store experience in episodic memory with rich context
     * @param {Object} experience - Experience to store
     */
    storeEpisodicMemory(experience) {
        const episodicEntry = {
            timestamp: new Date().toISOString(),
            agentId: this.agentId,
            experience: experience,
            context: this.getCurrentContext(),
            emotionalTone: this.assessEmotionalContext(experience),
            importanceScore: this.calculateImportanceScore(experience)
        };
        
        this.episodicMemory.push(episodicEntry);
        
        // Maintain memory size limits
        if (this.episodicMemory.length > 1000) {
            this.episodicMemory = this.episodicMemory.slice(-800); // Keep most recent 800
        }
    }

    /**
     * UTILITY METHODS
     */

    /**
     * Log agent actions for monitoring and debugging
     * @param {string} action - Action type
     * @param {Object} data - Action data
     */
    logAgentAction(action, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            agentId: this.agentId,
            agentType: this.agentType,
            action: action,
            data: data,
            state: this.currentState
        };
        
        // Environment-aware logging
        if (this.envConfig.enableDebugLogs) {
            devLog(`[${this.agentType}] ${action}:`, data);
        }
        
        // Store in short-term memory
        const interactions = this.shortTermMemory.get('user_interactions') || [];
        interactions.push(logEntry);
        this.shortTermMemory.set('user_interactions', interactions);
    }

    /**
     * Handle errors with graceful degradation
     * @param {string} errorType - Type of error
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     */
    handleError(errorType, error, context = {}) {
        this.errorCount++;
        
        const errorLog = {
            timestamp: new Date().toISOString(),
            agentId: this.agentId,
            errorType: errorType,
            error: error.message,
            context: context,
            stackTrace: error.stack
        };
        
        prodError(`[${this.agentType}] Error:`, errorLog);
        
        // Store error for learning
        this.storeEpisodicMemory({ type: 'error', data: errorLog });
        
        // Activate recovery if needed
        if (this.errorCount > 5) {
            this.activateRecoveryMode();
        }
    }

    /**
     * Abstract methods to be implemented by specific agents
     */
    
    // These methods must be implemented by each specific agent
    async analyzeSituation(context) { throw new Error('analyzeSituation must be implemented by subclass'); }
    async generateActionOptions(context, analysis) { throw new Error('generateActionOptions must be implemented by subclass'); }
    async evaluateOptions(options, context) { throw new Error('evaluateOptions must be implemented by subclass'); }
    async selectOptimalAction(options, context) { throw new Error('selectOptimalAction must be implemented by subclass'); }
    
    // Placeholder implementations that can be overridden
    async buildReasoningChain(context, options, decision) { return { steps: [], conclusion: decision }; }
    async planFollowUpActions(decision, context) { return { actions: [], timeline: 'immediate' }; }
    async makeEmergencyDecision(context) { return { decision: 'seek_human_assistance', confidence: 0.5 }; }

    /**
     * IMPLEMENTATION OF HELPER METHODS
     */

    /**
     * Initialize goal framework system
     * @private
     */
    async initializeGoalFramework() {
        // Initialize goal tracking systems
        this.goalCategories = new Map([
            ['financial_health', { priority: 1, weight: 0.4 }],
            ['savings', { priority: 2, weight: 0.3 }],
            ['investment', { priority: 3, weight: 0.2 }],
            ['debt_management', { priority: 4, weight: 0.1 }]
        ]);

        // Load user's existing goals
        await this.loadUserGoals();
    }

    /**
     * Initialize reasoning engine
     * @private
     */
    async initializeReasoningEngine() {
        // Set up reasoning parameters
        this.reasoningConfig = {
            maxReasoningSteps: 10,
            confidenceThreshold: 0.6,
            evidenceWeights: new Map([
                ['historical_data', 0.4],
                ['user_preferences', 0.3],
                ['expert_knowledge', 0.2],
                ['market_conditions', 0.1]
            ])
        };

        // Initialize reasoning templates
        this.reasoningTemplates = new Map();
        await this.loadReasoningTemplates();
    }

    /**
     * Initialize user context
     * @private
     */
    async initializeUserContext() {
        if (this.auth.currentUser) {
            this.currentUser = this.auth.currentUser;
            const userData = await getUserData(this.currentUser.uid);
            this.longTermMemory.set('user_profile', userData);
        }
    }

    /**
     * Initialize learning system
     * @private
     */
    async initializeLearningSystem() {
        // Set up learning parameters
        this.learningConfig = {
            learningRate: this.learningRate,
            memoryCapacity: 1000,
            feedbackWeight: 0.7,
            experienceWeight: 0.3
        };

        // Load previous learning data
        await this.loadLearningHistory();
    }

    /**
     * Decompose complex problems into manageable parts
     * @param {Object} problem - Complex problem to decompose
     * @returns {Promise<Array>} Array of sub-problems
     */
    async decomposeComplex(problem) {
        const decompositionPrompt = `
        Decompose this financial problem into smaller, manageable sub-problems:
        
        Problem: ${JSON.stringify(problem)}
        
        Break it down into 3-5 specific sub-problems that can be analyzed independently.
        Return as JSON array: ["sub-problem 1", "sub-problem 2", ...]
        `;

        try {
            const response = await this.callGeminiForReasoning(decompositionPrompt);
            return Array.isArray(response) ? response : [problem.description || 'Unknown problem'];
        } catch (error) {
            return [problem.description || 'Unknown problem'];
        }
    }

    /**
     * Gather relevant evidence from memory and external sources
     * @param {Object} problem - Problem to gather evidence for
     * @returns {Promise<Object>} Collected evidence
     */
    async gatherRelevantEvidence(problem) {
        const evidence = {
            historical: this.searchEpisodicMemory(problem),
            user_profile: this.longTermMemory.get('user_profile') || {},
            recent_interactions: this.shortTermMemory.get('user_interactions') || [],
            market_data: await this.getRelevantMarketData(problem),
            expert_knowledge: this.searchSemanticMemory(problem)
        };

        return evidence;
    }

    /**
     * Recognize patterns from past experiences
     * @param {Object} problem - Current problem
     * @param {Object} evidence - Gathered evidence
     * @returns {Promise<Array>} Recognized patterns
     */
    async recognizePatterns(problem, evidence) {
        const patterns = [];

        // Pattern recognition from episodic memory
        const similarExperiences = this.findSimilarExperiences(problem, evidence.historical);
        if (similarExperiences.length > 0) {
            patterns.push({
                type: 'experiential',
                pattern: 'similar_situations_handled',
                confidence: 0.8,
                data: similarExperiences
            });
        }

        // Pattern recognition from user behavior
        const behaviorPatterns = this.analyzeBehaviorPatterns(evidence.recent_interactions);
        if (behaviorPatterns.length > 0) {
            patterns.push({
                type: 'behavioral',
                pattern: 'user_preference_patterns',
                confidence: 0.7,
                data: behaviorPatterns
            });
        }

        return patterns;
    }

    /**
     * Perform logical inference
     * @param {Array} subProblems - Decomposed sub-problems
     * @param {Object} evidence - Available evidence
     * @param {Array} patterns - Recognized patterns
     * @returns {Promise<Object>} Inference results
     */
    async performLogicalInference(subProblems, evidence, patterns) {
        const inferences = [];

        for (const subProblem of subProblems) {
            const inference = await this.inferSolution(subProblem, evidence, patterns);
            inferences.push(inference);
        }

        return {
            subProblemInferences: inferences,
            overallInference: this.synthesizeInferences(inferences),
            confidence: this.calculateInferenceConfidence(inferences)
        };
    }

    /**
     * Synthesize conclusion from reasoning steps
     * @param {Array} reasoningSteps - All reasoning steps
     * @param {Object} originalProblem - Original problem
     * @returns {Promise<Object>} Final conclusion
     */
    async synthesizeConclusion(reasoningSteps, originalProblem) {
        const synthesis = {
            problem: originalProblem,
            reasoningPath: reasoningSteps.map(step => step.step),
            evidence_quality: this.assessEvidenceQuality(reasoningSteps),
            pattern_strength: this.assessPatternStrength(reasoningSteps),
            logical_coherence: this.assessLogicalCoherence(reasoningSteps),
            conclusion: await this.formulateConclusion(reasoningSteps),
            confidence: this.calculateOverallConfidence(reasoningSteps)
        };

        return synthesis;
    }

    /**
     * Assess reasoning confidence
     * @param {Array} reasoningSteps - Reasoning steps to assess
     * @returns {number} Confidence score (0-1)
     */
    assessReasoningConfidence(reasoningSteps) {
        let totalConfidence = 0;
        let weightSum = 0;

        reasoningSteps.forEach(step => {
            const stepWeight = this.getStepWeight(step.step);
            const stepConfidence = step.result.confidence || 0.5;
            totalConfidence += stepConfidence * stepWeight;
            weightSum += stepWeight;
        });

        return weightSum > 0 ? totalConfidence / weightSum : 0.5;
    }

    /**
     * Store decision experience for learning
     * @param {Object} context - Decision context
     * @param {Object} decision - Made decision
     * @param {Object} reasoning - Reasoning chain
     */
    storeDecisionExperience(context, decision, reasoning) {
        const experience = {
            timestamp: new Date().toISOString(),
            context: context,
            decision: decision,
            reasoning: reasoning,
            agentId: this.agentId,
            experienceType: 'decision_making'
        };

        this.decisionHistory.push(experience);
        this.storeEpisodicMemory(experience);
    }

    /**
     * Build enhanced prompt for Gemini API
     * @param {string} basePrompt - Base prompt
     * @param {Object} context - Additional context
     * @returns {string} Enhanced prompt
     */
    buildEnhancedPrompt(basePrompt, context) {
        const agentContext = `
        You are an autonomous ${this.agentType} AI agent with the following characteristics:
        - Agent ID: ${this.agentId}
        - Autonomy Level: ${this.autonomyLevel}
        - Version: ${this.version}
        - Current State: ${this.currentState}
        - Decision History: ${this.decisionHistory.length} previous decisions
        - Learning Iterations: ${this.performanceMetrics.learningIterations}
        
        Context: ${JSON.stringify(context)}
        
        ${basePrompt}
        
        Provide your response in JSON format with clear reasoning and confidence scores.
        `;

        return agentContext;
    }

    /**
     * Parse AI response with error handling
     * @param {string} rawResponse - Raw AI response
     * @returns {Object} Parsed response
     */
    parseAIResponse(rawResponse) {
        try {
            // Try to extract JSON from response
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // Fallback to structured parsing
            return {
                content: rawResponse,
                confidence: 0.6,
                timestamp: new Date().toISOString(),
                parsed: false
            };
        } catch (error) {
            return {
                content: rawResponse,
                confidence: 0.3,
                error: 'parsing_failed',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get fallback response when AI fails
     * @param {string} prompt - Original prompt
     * @param {Object} context - Context
     * @returns {Promise<Object>} Fallback response
     */
    async getFallbackResponse(prompt, context) {
        return {
            content: "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.",
            confidence: 0.3,
            fallback: true,
            timestamp: new Date().toISOString(),
            context: context
        };
    }

    /**
     * Load long-term memory from storage
     * @private
     */
    async loadLongTermMemory() {
        try {
            if (this.currentUser) {
                const storedMemory = await getUserData(this.currentUser.uid);
                if (storedMemory?.agentMemory?.[this.agentType]) {
                    const memoryData = storedMemory.agentMemory[this.agentType];
                    Object.entries(memoryData).forEach(([key, value]) => {
                        this.longTermMemory.set(key, value);
                    });
                }
            }
        } catch (error) {
            console.warn('Failed to load long-term memory:', error);
        }
    }

    /**
     * Initialize semantic memory with domain knowledge
     * @private
     */
    async initializeSemanticMemory() {
        // Load domain-specific knowledge based on agent type
        const knowledgeBase = await this.loadDomainKnowledge();
        Object.entries(knowledgeBase).forEach(([concept, knowledge]) => {
            this.semanticMemory.set(concept, knowledge);
        });
    }

    /**
     * Load domain knowledge for the specific agent
     * @returns {Promise<Object>} Domain knowledge
     */
    async loadDomainKnowledge() {
        // This will be overridden by specific agents
        return {
            'financial_basics': 'Core financial principles and concepts',
            'risk_management': 'Risk assessment and mitigation strategies',
            'goal_setting': 'SMART goal setting principles'
        };
    }

    /**
     * Get current context for decision making
     * @returns {Object} Current context
     */
    getCurrentContext() {
        return {
            agentState: this.currentState,
            sessionDuration: Date.now() - new Date(this.shortTermMemory.get('session_start')).getTime(),
            recentDecisions: this.decisionHistory.slice(-5),
            userPresent: this.currentUser !== null,
            memoryLoad: this.episodicMemory.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Assess emotional context of experience
     * @param {Object} experience - Experience to assess
     * @returns {string} Emotional tone
     */
    assessEmotionalContext(experience) {
        // Simple emotional assessment based on experience type
        if (experience.type === 'error') return 'negative';
        if (experience.type === 'success') return 'positive';
        if (experience.type === 'learning') return 'neutral';
        return 'neutral';
    }

    /**
     * Calculate importance score for memory prioritization
     * @param {Object} experience - Experience to score
     * @returns {number} Importance score (0-1)
     */
    calculateImportanceScore(experience) {
        let score = 0.5; // Base score

        // Increase importance for decisions
        if (experience.type === 'decision_making') score += 0.3;
        
        // Increase importance for errors (learning opportunities)
        if (experience.type === 'error') score += 0.2;
        
        // Increase importance for user feedback
        if (experience.userFeedback) score += 0.2;
        
        // Increase importance for successful outcomes
        if (experience.outcome === 'success') score += 0.1;

        return Math.min(score, 1.0);
    }

    /**
     * Activate recovery mode when errors accumulate
     * @private
     */
    async activateRecoveryMode() {
        this.currentState = 'recovery';
        console.warn(`[${this.agentType}] Activating recovery mode due to ${this.errorCount} errors`);
        
        // Reset error count
        this.errorCount = 0;
        
        // Reinitialize core systems
        await this.initializeCoreSystemsAsync();
    }

    /**
     * Get current performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            uptime: Date.now() - new Date(this.shortTermMemory.get('session_start')).getTime(),
            memoryUsage: {
                shortTerm: this.shortTermMemory.size,
                longTerm: this.longTermMemory.size,
                episodic: this.episodicMemory.length,
                semantic: this.semanticMemory.size
            },
            errorRate: this.errorCount,
            currentState: this.currentState
        };
    }

    // Placeholder methods for abstract implementations
    async performBasicReasoning(problem) { return { conclusion: 'basic_reasoning_applied', confidence: 0.5 }; }
    async loadUserGoals() { this.currentGoals = []; }
    async loadReasoningTemplates() { /* Load reasoning templates */ }
    async loadLearningHistory() { /* Load learning history */ }
    async getRelevantMarketData(problem) { return {}; }
    async inferSolution(subProblem, evidence, patterns) { return { solution: 'inferred', confidence: 0.6 }; }
    
    // Helper methods with basic implementations
    searchEpisodicMemory(query) { return this.episodicMemory.filter(e => JSON.stringify(e).includes(query.toString())); }
    searchSemanticMemory(query) { return this.semanticMemory.get(query.toString()) || null; }
    findSimilarExperiences(problem, historical) { return historical.slice(0, 3); }
    analyzeBehaviorPatterns(interactions) { return []; }
    synthesizeInferences(inferences) { return 'synthesized_result'; }
    calculateInferenceConfidence(inferences) { return 0.7; }
    assessEvidenceQuality(steps) { return 'good'; }
    assessPatternStrength(steps) { return 'moderate'; }
    assessLogicalCoherence(steps) { return 'coherent'; }
    async formulateConclusion(steps) { return 'conclusion_formulated'; }
    calculateOverallConfidence(steps) { return 0.7; }
    getStepWeight(stepType) { return 1.0; }

    // Add error tracking methods
    trackError(error, type = 'api') {
        const now = Date.now();
        
        // Reset error counts if enough time has passed
        if (this.errors.lastErrorTime && 
            (now - this.errors.lastErrorTime) > this.errorThresholds.errorResetTime) {
            this.resetErrorCounts();
        }
        
        this.errors.lastErrorTime = now;
        this.lastError = error;
        
        if (error.status === 429) {
            this.errors.rateLimitErrors++;
            this.errors.consecutiveErrors++;
        } else {
            this.errors.apiErrors++;
            this.errors.consecutiveErrors++;
        }
        
        // Check if we should switch to offline mode
        if (this.shouldSwitchToOfflineMode()) {
            console.warn('Switching to offline mode due to error threshold exceeded');
            this.config.offlineMode = true;
        }
    }

    resetErrorCounts() {
        this.errors = {
            apiErrors: 0,
            rateLimitErrors: 0,
            lastErrorTime: null,
            consecutiveErrors: 0
        };
    }

    shouldSwitchToOfflineMode() {
        return (
            this.errors.consecutiveErrors >= this.errorThresholds.maxConsecutiveErrors ||
            this.errors.apiErrors >= this.errorThresholds.maxApiErrors
        );
    }

    // Add method to check API availability
    async checkApiAvailability() {
        if (this.config.offlineMode) {
            return false;
        }
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.config.geminiModel}?key=${this.config.geminiApiKey}`);
            return response.ok;
        } catch (error) {
            console.warn('API availability check failed:', error);
            return false;
        }
    }

    // Add method to handle API responses
    handleApiResponse(response) {
        if (!response.ok) {
            const error = new Error(`API error: ${response.status}`);
            error.status = response.status;
            this.trackError(error);
            throw error;
        }
        return response;
    }

    // Add method to check if we should retry an operation
    shouldRetry(error, attempt) {
        if (attempt >= 3) return false;
        if (error.status === 429) return true;
        if (error.status >= 500) return true;
        return false;
    }
}

/**
 * Export for use by specific agent implementations
 */
export default BaseAgent; 