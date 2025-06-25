/**
 * Gastos Guardian AI - Autonomous Expense Analysis Assistant
 * Implements agentic behavior with reasoning, planning, and autonomy
 */

import { GEMINI_API_KEY, GEMINI_MODEL } from "../js/config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserData, getUserTransactions, getUserBankAccounts } from "../js/firestoredb.js";
import { BaseAgent } from "./BaseAgent.js";

class GastosGuardianAI extends BaseAgent {
    constructor() {
        super('gastosGuardian', {
            autonomyLevel: 'high',
            planningHorizon: 'short_term',
            learningRate: 0.2
        });
        
        this.expenseData = null;
        this.analysisResults = null;
        this.chart = null;
        this.processingComplete = false;
        this.auth = getAuth();
        this.currentUser = null;
        
        this.initializeElements();
        this.setupAuthListener();
    }

    // Setup Firebase authentication
    setupAuthListener() {
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                console.log('⏰ Auth timeout reached, proceeding without authentication');
                this.currentUser = null;
                resolve();
            }, 5000);

            onAuthStateChanged(this.auth, (user) => {
                clearTimeout(timeoutId);
                if (user) {
                    console.log('✅ User authenticated:', user.uid);
                    this.currentUser = user;
                } else {
                    console.log('❌ User not authenticated');
                    this.currentUser = null;
                }
                resolve();
            });
        });
    }

    // Initialize DOM elements with error handling
    initializeElements() {
        this.elements = {
            loadingState: document.getElementById('loading-state'),
            contentState: document.getElementById('content-state'),
            emptyState: document.getElementById('empty-state'),
            expenseChart: document.getElementById('expense-chart'),
            spendingLeaksContent: document.getElementById('spending-leaks-content'),
            tipidTipsContent: document.getElementById('tipid-tips-content')
        };

        // Validate all elements exist
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Element ${key} not found in DOM`);
            }
        });
    }

    // Enhanced expense analysis using BaseAgent's account data
    async loadUserFinancialData() {
        try {
            if (!this.currentUser) {
                console.log('⚠️ User not authenticated, using demo data');
                return this.generateMockExpenseData();
            }

            console.log('📊 Loading comprehensive expense analysis with account data...');
            
            // Wait for BaseAgent to load financial data
            await this.waitForInitialization();
            
            // Use BaseAgent's loaded data and insights
            if (this.userTransactions.length === 0) {
                console.log('⚠️ No transactions found, using demo data');
                return this.generateMockExpenseData();
            }

            return this.processComprehensiveExpenseData();
        } catch (error) {
            console.error('❌ Error loading expense data:', error);
            return this.generateMockExpenseData();
        }
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

        if (!this.initialized) {
            console.warn('⚠️ BaseAgent initialization timeout, proceeding with available data');
        }
    }

    // Process comprehensive expense data using account insights
    processComprehensiveExpenseData() {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        // Get current month expenses
        const currentMonthTransactions = this.userTransactions.filter(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            return txDate.getMonth() === currentMonth && 
                   txDate.getFullYear() === currentYear &&
                   tx.type === 'expense';
        });

        // Analyze expenses by account
        const expensesByAccount = this.analyzeExpensesByAccount(currentMonthTransactions);
        
        // Enhanced category analysis
        const categories = this.enhancedCategoryAnalysis(currentMonthTransactions);
        
        // Calculate spending patterns
        const spendingPatterns = this.analyzeSpendingPatterns(currentMonthTransactions);
        
        // Account-specific insights
        const accountSpendingInsights = this.generateAccountSpendingInsights();

        const totalExpenses = currentMonthTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        const financialOverview = this.getFinancialOverview();
        
        return {
            categories: Object.values(categories),
            totalExpenses,
            monthlyIncome: financialOverview.monthlyIncome,
            transactionCount: currentMonthTransactions.length,
            averageDaily: Math.round(totalExpenses / 30),
            topCategory: this.findTopSpendingCategory(categories),
            rawTransactions: currentMonthTransactions,
            
            // Enhanced insights from account analysis
            expensesByAccount,
            spendingPatterns,
            accountSpendingInsights,
            spendingVelocity: this.calculateSpendingVelocity(),
            accountRiskFactors: this.identifySpendingRiskFactors(),
            optimizationOpportunities: this.identifySpendingOptimization(),
            
            // Financial health indicators
            expenseToIncomeRatio: financialOverview.monthlyIncome > 0 ? 
                (totalExpenses / financialOverview.monthlyIncome) * 100 : 0,
            savingsRate: financialOverview.savingsRate,
            liquidityStatus: this.assessLiquidityFromSpending(totalExpenses)
        };
    }

    // Analyze expenses by account
    analyzeExpensesByAccount(expenses) {
        const accountExpenses = {};
        
        expenses.forEach(tx => {
            if (!accountExpenses[tx.accountId]) {
                const account = this.userAccounts.find(acc => acc.id === tx.accountId);
                accountExpenses[tx.accountId] = {
                    accountName: account?.name || 'Unknown Account',
                    accountType: account?.accountType || 'Unknown',
                    category: account?.category || 'Unknown',
                    totalSpent: 0,
                    transactionCount: 0,
                    averageTransaction: 0,
                    spendingFrequency: 'low'
                };
            }
            
            accountExpenses[tx.accountId].totalSpent += parseFloat(tx.amount || 0);
            accountExpenses[tx.accountId].transactionCount++;
        });

        // Calculate averages and patterns
        Object.values(accountExpenses).forEach(accountData => {
            accountData.averageTransaction = accountData.totalSpent / accountData.transactionCount;
            
            if (accountData.transactionCount > 20) accountData.spendingFrequency = 'very_high';
            else if (accountData.transactionCount > 15) accountData.spendingFrequency = 'high';
            else if (accountData.transactionCount > 10) accountData.spendingFrequency = 'medium';
            else if (accountData.transactionCount > 5) accountData.spendingFrequency = 'low';
        });

        return accountExpenses;
    }

    // Enhanced category analysis with account context
    enhancedCategoryAnalysis(expenses) {
        const categories = {};
        const accountCategoryMap = {};

        expenses.forEach(tx => {
            const category = this.categorizeTransaction(tx);
            const accountId = tx.accountId;
            
            // Initialize category if not exists
            if (!categories[category]) {
                categories[category] = {
                    name: category,
                    amount: 0,
                    color: this.getCategoryColor(category),
                    transactionCount: 0,
                    accounts: new Set(),
                    frequencyPattern: 'irregular'
                };
            }
            
            // Update category data
            categories[category].amount += parseFloat(tx.amount || 0);
            categories[category].transactionCount++;
            categories[category].accounts.add(accountId);
            
            // Track account-category relationships
            const key = `${accountId}-${category}`;
            if (!accountCategoryMap[key]) {
                accountCategoryMap[key] = { count: 0, amount: 0 };
            }
            accountCategoryMap[key].count++;
            accountCategoryMap[key].amount += parseFloat(tx.amount || 0);
        });

        // Analyze frequency patterns
        Object.values(categories).forEach(category => {
            if (category.transactionCount > 15) category.frequencyPattern = 'very_frequent';
            else if (category.transactionCount > 10) category.frequencyPattern = 'frequent';
            else if (category.transactionCount > 5) category.frequencyPattern = 'moderate';
            else if (category.transactionCount > 2) category.frequencyPattern = 'occasional';
            
            // Convert Set to array for easier handling
            category.accounts = Array.from(category.accounts);
            category.accountDiversity = category.accounts.length;
        });

        return categories;
    }

    // Analyze spending patterns
    analyzeSpendingPatterns(expenses) {
        // Daily spending pattern
        const dailySpending = {};
        
        // Weekly pattern
        const weeklyPattern = Array(7).fill(0);
        
        // Time of day pattern (if we have timestamps)
        const hourlyPattern = Array(24).fill(0);

        expenses.forEach(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            const day = txDate.getDate();
            const weekDay = txDate.getDay();
            const hour = txDate.getHours();
            const amount = parseFloat(tx.amount || 0);
            
            // Daily accumulation
            if (!dailySpending[day]) dailySpending[day] = 0;
            dailySpending[day] += amount;
            
            // Weekly pattern
            weeklyPattern[weekDay] += amount;
            
            // Hourly pattern (if available)
            if (!isNaN(hour)) {
                hourlyPattern[hour] += amount;
            }
        });

        // Identify peak spending days
        const sortedDays = Object.entries(dailySpending)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        return {
            dailySpending,
            weeklyPattern,
            hourlyPattern,
            peakSpendingDays: sortedDays,
            spendingConsistency: this.calculateSpendingConsistency(Object.values(dailySpending))
        };
    }

    // Calculate spending consistency
    calculateSpendingConsistency(dailyAmounts) {
        if (dailyAmounts.length < 2) return 'insufficient_data';
        
        const average = dailyAmounts.reduce((sum, amt) => sum + amt, 0) / dailyAmounts.length;
        const variance = dailyAmounts.reduce((sum, amt) => sum + Math.pow(amt - average, 2), 0) / dailyAmounts.length;
        const standardDeviation = Math.sqrt(variance);
        
        const coefficientOfVariation = average > 0 ? (standardDeviation / average) * 100 : 0;
        
        if (coefficientOfVariation < 30) return 'very_consistent';
        if (coefficientOfVariation < 50) return 'consistent';
        if (coefficientOfVariation < 80) return 'moderate';
        return 'inconsistent';
    }

    // Generate account-specific spending insights
    generateAccountSpendingInsights() {
        const insights = [];
        
        this.userAccounts.forEach(account => {
            const accountTransactions = this.getAccountTransactions(account.id);
            const expenseTransactions = accountTransactions.filter(tx => 
                tx.type === 'expense' || tx.type === 'withdrawal'
            );
            
            if (expenseTransactions.length === 0) return;
            
            const totalSpent = expenseTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
            const averageTransaction = totalSpent / expenseTransactions.length;
            const balanceRatio = parseFloat(account.balance || 0) / totalSpent;
            
            const insight = {
                accountId: account.id,
                accountName: account.name,
                accountType: account.category,
                totalSpent,
                transactionCount: expenseTransactions.length,
                averageTransaction,
                balanceRatio,
                spendingFrequency: this.calculateSpendingFrequency(expenseTransactions),
                spendingPattern: this.analyzeAccountSpendingPattern(expenseTransactions),
                riskLevel: this.assessSpendingRisk(account, expenseTransactions),
                recommendations: this.generateSpendingRecommendations(account, expenseTransactions, balanceRatio),
                optimization: this.identifyAccountSpendingOptimization(account, expenseTransactions),
                categories: this.categorizeAccountExpenses(expenseTransactions)
            };
            
            insights.push(insight);
        });
        
        return insights;
    }

    // Calculate spending frequency for an account
    calculateSpendingFrequency(transactions) {
        const currentDate = new Date();
        const thirtyDaysAgo = new Date(currentDate.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        const recentTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            return txDate >= thirtyDaysAgo;
        });
        
        const frequency = recentTransactions.length;
        
        if (frequency > 20) return 'very_high';
        if (frequency > 15) return 'high';
        if (frequency > 10) return 'moderate';
        if (frequency > 5) return 'low';
        return 'very_low';
    }

    // Analyze spending pattern for a specific account
    analyzeAccountSpendingPattern(transactions) {
        if (transactions.length < 3) return 'insufficient_data';
        
        const amounts = transactions.map(tx => parseFloat(tx.amount || 0));
        const mean = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
        const variance = this.calculateVariance(amounts);
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;
        
        if (coefficientOfVariation < 0.3) return 'consistent';
        if (coefficientOfVariation < 0.6) return 'moderate_variation';
        return 'highly_variable';
    }

    // Assess spending risk for an account
    assessSpendingRisk(account, transactions) {
        let riskScore = 0;
        const balance = parseFloat(account.balance || 0);
        const totalSpent = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        
        // High spending relative to balance
        if (balance > 0 && totalSpent / balance > 2) riskScore += 30;
        else if (balance > 0 && totalSpent / balance > 1) riskScore += 15;
        
        // High transaction frequency
        const frequency = this.calculateSpendingFrequency(transactions);
        if (frequency === 'very_high') riskScore += 25;
        else if (frequency === 'high') riskScore += 15;
        
        // Low remaining balance
        if (balance < 1000) riskScore += 20;
        else if (balance < 5000) riskScore += 10;
        
        // Account type specific risks
        if (account.category === 'digital-wallet' && totalSpent > 50000) riskScore += 15;
        if (account.category === 'credit-card') riskScore += 10; // Credit cards inherently riskier
        
        if (riskScore >= 50) return 'high';
        if (riskScore >= 25) return 'medium';
        return 'low';
    }

    // Generate spending recommendations for an account
    generateSpendingRecommendations(account, transactions, balanceRatio) {
        const recommendations = [];
        const totalSpent = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        const balance = parseFloat(account.balance || 0);
        
        // Balance-based recommendations
        if (balanceRatio < 0.5) {
            recommendations.push({
                type: 'balance_warning',
                priority: 'high',
                message: `High spending relative to balance in ${account.name}`,
                action: 'Reduce spending or transfer more funds to this account'
            });
        }
        
        // Frequency-based recommendations
        const frequency = this.calculateSpendingFrequency(transactions);
        if (frequency === 'very_high' && account.category !== 'digital-wallet') {
            recommendations.push({
                type: 'frequency_warning',
                priority: 'medium',
                message: 'Very frequent spending detected',
                action: 'Consider budgeting and expense tracking'
            });
        }
        
        // Account-specific recommendations
        if (account.category === 'traditional-bank' && totalSpent > balance) {
            recommendations.push({
                type: 'overdraft_risk',
                priority: 'high',
                message: 'Risk of overdraft fees',
                action: 'Monitor balance closely and set up alerts'
            });
        }
        
        if (account.category === 'digital-wallet' && totalSpent > 100000) {
            recommendations.push({
                type: 'security_risk',
                priority: 'medium',
                message: 'High transaction volume in digital wallet',
                action: 'Review security settings and transaction limits'
            });
        }
        
        return recommendations;
    }

    // Identify account-specific spending optimization
    identifyAccountSpendingOptimization(account, transactions) {
        const optimizations = [];
        const balance = parseFloat(account.balance || 0);
        const totalSpent = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        
        // Fee optimization
        if (account.category === 'traditional-bank' && transactions.length > 30) {
            optimizations.push({
                type: 'fee_optimization',
                description: 'High transaction volume may incur fees',
                potentialSavings: 500,
                action: 'Consider upgrading account type or using digital alternatives'
            });
        }
        
        // Cashback optimization
        if (account.category === 'digital-wallet' && totalSpent > 20000) {
            optimizations.push({
                type: 'rewards_optimization',
                description: 'High spending qualifies for rewards programs',
                potentialGain: totalSpent * 0.01, // 1% cashback estimate
                action: 'Activate cashback or rewards features'
            });
        }
        
        // Balance optimization
        if (balance > totalSpent * 3) {
            optimizations.push({
                type: 'balance_optimization',
                description: 'Excess balance could earn more elsewhere',
                potentialGain: (balance - totalSpent) * 0.02 / 12, // 2% annual interest
                action: 'Transfer excess to high-yield savings'
            });
        }
        
        return optimizations;
    }

    // Categorize expenses for a specific account
    categorizeAccountExpenses(transactions) {
        const categories = {};
        
        transactions.forEach(tx => {
            const category = this.categorizeTransaction(tx);
            if (!categories[category]) {
                categories[category] = {
                    total: 0,
                    count: 0,
                    transactions: []
                };
            }
            
            categories[category].total += parseFloat(tx.amount || 0);
            categories[category].count++;
            categories[category].transactions.push(tx);
        });
        
        // Convert to array and sort by total
        return Object.entries(categories)
            .map(([name, data]) => ({
                name,
                total: data.total,
                count: data.count,
                percentage: transactions.length > 0 ? (data.count / transactions.length) * 100 : 0,
                averageAmount: data.count > 0 ? data.total / data.count : 0
            }))
            .sort((a, b) => b.total - a.total);
    }

    // Calculate variance helper method
    calculateVariance(numbers) {
        if (numbers.length === 0) return 0;
        const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
        const squaredDifferences = numbers.map(num => Math.pow(num - mean, 2));
        return squaredDifferences.reduce((sum, diff) => sum + diff, 0) / numbers.length;
    }

    // Calculate spending velocity across all accounts
    calculateSpendingVelocity() {
        const accountVelocities = [];
        
        this.userAccounts.forEach(account => {
            const transactions = this.getAccountTransactions(account.id);
            const expenseTransactions = transactions.filter(tx => 
                tx.type === 'expense' || tx.type === 'withdrawal'
            );
            
            if (expenseTransactions.length < 2) return;
            
            const totalSpent = expenseTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
            const daysBetween = this.getDaysBetweenTransactions(expenseTransactions);
            const velocity = daysBetween > 0 ? totalSpent / daysBetween : 0;
            
            accountVelocities.push({
                accountId: account.id,
                accountName: account.name,
                velocity,
                level: this.getVelocityLevel(velocity)
            });
        });
        
        const totalVelocity = accountVelocities.reduce((sum, av) => sum + av.velocity, 0);
        const averageVelocity = accountVelocities.length > 0 ? totalVelocity / accountVelocities.length : 0;
        
        return {
            averageVelocity,
            level: this.getVelocityLevel(averageVelocity),
            accountVelocities,
            description: this.getVelocityDescription(this.getVelocityLevel(averageVelocity))
        };
    }

    // Get velocity level
    getVelocityLevel(velocity) {
        if (velocity > 5000) return 'very_high';
        if (velocity > 2000) return 'high';
        if (velocity > 1000) return 'moderate';
        if (velocity > 500) return 'low';
        return 'very_low';
    }

    // Get velocity description
    getVelocityDescription(level) {
        const descriptions = {
            very_high: 'Very high spending velocity - money flows out quickly',
            high: 'High spending velocity - monitor cash flow carefully',
            moderate: 'Moderate spending velocity - generally healthy',
            low: 'Low spending velocity - conservative spending pattern',
            very_low: 'Very low spending velocity - minimal expenses'
        };
        return descriptions[level] || 'Unknown spending velocity';
    }

    // Identify spending risk factors
    identifySpendingRiskFactors() {
        const riskFactors = [];
        const financialOverview = this.getFinancialOverview();
        
        // High expense-to-income ratio
        if (financialOverview.monthlyExpenses > financialOverview.monthlyIncome * 0.8) {
            riskFactors.push({
                type: 'high_expense_ratio',
                severity: 'high',
                description: 'Monthly expenses exceed 80% of income',
                impact: 'Limited savings capacity and financial stress',
                recommendation: 'Reduce discretionary spending by 15-20%'
            });
        }
        
        // Negative cash flow
        if (financialOverview.netMonthlyCashFlow < 0) {
            riskFactors.push({
                type: 'negative_cash_flow',
                severity: 'critical',
                description: 'Spending exceeds income',
                impact: 'Debt accumulation and financial instability',
                recommendation: 'Immediately reduce expenses and increase income'
            });
        }
        
        // High digital wallet spending
        const digitalWalletSpending = this.calculateCategorySpending('digital-wallet');
        if (digitalWalletSpending > 50000) {
            riskFactors.push({
                type: 'high_digital_spending',
                severity: 'medium',
                description: 'High spending through digital wallets',
                impact: 'Potential for impulse purchases and overspending',
                recommendation: 'Set transaction limits and enable spending alerts'
            });
        }
        
        // Concentration in one account
        const spendingConcentration = this.analyzeSpendingConcentration();
        if (spendingConcentration.maxPercentage > 70) {
            riskFactors.push({
                type: 'spending_concentration',
                severity: 'medium',
                description: 'Over 70% of spending from one account',
                impact: 'Risk of overdraft and limited spending flexibility',
                recommendation: 'Diversify spending across multiple accounts'
            });
        }
        
        return riskFactors;
    }

    // Calculate spending for a specific category
    calculateCategorySpending(category) {
        const categoryAccounts = this.userAccounts.filter(acc => acc.category === category);
        
        return categoryAccounts.reduce((total, account) => {
            const transactions = this.getAccountTransactions(account.id);
            const expenseTransactions = transactions.filter(tx => 
                tx.type === 'expense' || tx.type === 'withdrawal'
            );
            return total + expenseTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        }, 0);
    }

    // Analyze spending concentration
    analyzeSpendingConcentration() {
        const accountSpending = {};
        let totalSpending = 0;
        
        this.userAccounts.forEach(account => {
            const transactions = this.getAccountTransactions(account.id);
            const expenseTransactions = transactions.filter(tx => 
                tx.type === 'expense' || tx.type === 'withdrawal'
            );
            const accountTotal = expenseTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
            
            accountSpending[account.id] = {
                name: account.name,
                total: accountTotal,
                percentage: 0
            };
            totalSpending += accountTotal;
        });
        
        // Calculate percentages
        Object.values(accountSpending).forEach(account => {
            account.percentage = totalSpending > 0 ? (account.total / totalSpending) * 100 : 0;
        });
        
        const maxAccount = Object.values(accountSpending).reduce((max, account) => 
            account.percentage > max.percentage ? account : max
        , { percentage: 0 });
        
        return {
            accountSpending,
            maxPercentage: maxAccount.percentage,
            maxAccount: maxAccount.name,
            isConcentrated: maxAccount.percentage > 70
        };
    }

    // Assess liquidity from spending perspective
    assessLiquidityFromSpending(monthlyExpenses) {
        const liquidAccounts = ['traditional-bank', 'digital-wallet', 'cash'];
        const liquidBalance = this.userAccounts
            .filter(acc => liquidAccounts.includes(acc.category))
            .reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
        
        const monthsOfExpensesCovered = monthlyExpenses > 0 ? liquidBalance / monthlyExpenses : 0;
        
        let riskLevel;
        if (monthsOfExpensesCovered >= 6) riskLevel = 'low';
        else if (monthsOfExpensesCovered >= 3) riskLevel = 'medium';
        else if (monthsOfExpensesCovered >= 1) riskLevel = 'high';
        else riskLevel = 'critical';
        
        return {
            riskLevel,
            monthsOfExpensesCovered: Math.round(monthsOfExpensesCovered * 10) / 10,
            liquidBalance,
            recommendation: this.getLiquidityRecommendation(riskLevel)
        };
    }

    // Get liquidity recommendation
    getLiquidityRecommendation(riskLevel) {
        const recommendations = {
            low: 'Excellent liquidity position - consider investing excess funds',
            medium: 'Good liquidity - maintain current levels',
            high: 'Limited liquidity - build emergency fund to 3-6 months expenses',
            critical: 'Critical liquidity shortage - immediately reduce expenses and build cash reserves'
        };
        return recommendations[riskLevel] || 'Monitor liquidity regularly';
    }

    // Identify spending optimization opportunities
    identifySpendingOptimization() {
        const opportunities = [];
        
        // Account-level optimizations
        this.userAccounts.forEach(account => {
            const transactions = this.getAccountTransactions(account.id);
            const expenseTransactions = transactions.filter(tx => 
                tx.type === 'expense' || tx.type === 'withdrawal'
            );
            
            if (expenseTransactions.length === 0) return;
            
            const accountOptimizations = this.identifyAccountSpendingOptimization(account, expenseTransactions);
            opportunities.push(...accountOptimizations.map(opt => ({
                ...opt,
                accountId: account.id,
                accountName: account.name
            })));
        });
        
        // Cross-account optimizations
        const spendingConcentration = this.analyzeSpendingConcentration();
        if (spendingConcentration.isConcentrated) {
            opportunities.push({
                type: 'diversification',
                description: 'Spending too concentrated in one account',
                action: 'Distribute spending across multiple accounts for better cash flow management',
                impact: 'Improved financial flexibility and reduced overdraft risk'
            });
        }
        
        // Category-based optimizations
        const categoryAnalysis = this.analyzeCategoryOptimization();
        opportunities.push(...categoryAnalysis);
        
        return opportunities;
    }

    // Analyze category-based optimization opportunities
    analyzeCategoryOptimization() {
        const optimizations = [];
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        const monthlyExpenses = this.userTransactions.filter(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            return txDate.getMonth() === currentMonth && 
                   txDate.getFullYear() === currentYear &&
                   (tx.type === 'expense' || tx.type === 'withdrawal');
        });
        
        const categoryTotals = {};
        monthlyExpenses.forEach(tx => {
            const category = this.categorizeTransaction(tx);
            categoryTotals[category] = (categoryTotals[category] || 0) + parseFloat(tx.amount || 0);
        });
        
        // Identify high-spend categories
        Object.entries(categoryTotals).forEach(([category, total]) => {
            if (total > 15000) { // High spending threshold
                optimizations.push({
                    type: 'category_optimization',
                    category,
                    currentSpending: total,
                    description: `High spending in ${category}`,
                    action: this.getCategoryOptimizationTip(category),
                    potentialSavings: total * 0.15 // 15% potential reduction
                });
            }
        });
        
        return optimizations;
    }

    // Get optimization tip for specific category
    getCategoryOptimizationTip(category) {
        const tips = {
            'Food & Dining': 'Consider meal planning and cooking at home more often',
            'Transportation': 'Explore public transport or carpooling options',
            'Shopping': 'Use shopping lists and compare prices before purchasing',
            'Entertainment': 'Look for free or low-cost entertainment alternatives',
            'Utilities': 'Review usage patterns and consider energy-saving measures',
            'Healthcare': 'Compare prices for medications and services',
            'Education': 'Look for scholarships, discounts, or online alternatives'
        };
        return tips[category] || 'Review and optimize spending in this category';
    }

    // Helper method to get days between transactions
    getDaysBetweenTransactions(transactions) {
        if (transactions.length < 2) return 0;
        
        const dates = transactions
            .map(tx => new Date(tx.date || tx.timestamp))
            .sort((a, b) => a - b);
        
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];
        
        return Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));
    }

    // Rest of the original methods (with enhancements)
    
    // Process real user financial data (enhanced version)
    processUserFinancialData(transactions, bankAccounts, userData) {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        // Filter current month transactions
        const currentMonthTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            return txDate.getMonth() === currentMonth && 
                   txDate.getFullYear() === currentYear;
        });

        // Calculate expenses by category
        const categories = {};
        let totalExpenses = 0;
        let totalIncome = 0;

        currentMonthTransactions.forEach(tx => {
            const amount = parseFloat(tx.amount) || 0;
            if (tx.type === 'expense') {
                totalExpenses += amount;
                const category = this.categorizeTransaction(tx);
                if (!categories[category]) {
                    categories[category] = { name: category, amount: 0, color: this.getCategoryColor(category) };
                }
                categories[category].amount += amount;
            } else if (tx.type === 'income') {
                totalIncome += amount;
            }
        });

        const monthlyIncome = userData?.monthlyIncome || totalIncome || 50000; // Default fallback
        const categoryArray = Object.values(categories);

        return {
            categories: categoryArray,
            totalExpenses,
            monthlyIncome,
            transactionCount: currentMonthTransactions.length,
            averageDaily: Math.round(totalExpenses / 30),
            topCategory: categoryArray.reduce((prev, current) => 
                (prev.amount > current.amount) ? prev : current, categoryArray[0] || { name: 'None', amount: 0 }),
            rawTransactions: currentMonthTransactions,
            userData
        };
    }

    // Categorize transaction based on name and existing category
    categorizeTransaction(transaction) {
        if (transaction.category) return transaction.category;
        
        const name = transaction.name?.toLowerCase() || '';
        
        if (name.includes('food') || name.includes('restaurant') || name.includes('jollibee') || name.includes('mcdo')) {
            return 'Food & Dining';
        }
        if (name.includes('grab') || name.includes('uber') || name.includes('taxi') || name.includes('bus')) {
            return 'Transportation';
        }
        if (name.includes('mall') || name.includes('shop') || name.includes('store')) {
            return 'Shopping';
        }
        if (name.includes('bill') || name.includes('electric') || name.includes('water') || name.includes('internet')) {
            return 'Bills & Utilities';
        }
        if (name.includes('movie') || name.includes('game') || name.includes('entertainment')) {
            return 'Entertainment';
        }
        
        return 'Others';
    }

    // Get color for category
    getCategoryColor(category) {
        const colors = {
            'Food & Dining': '#FF6B6B',
            'Transportation': '#4ECDC4',
            'Shopping': '#45B7D1',
            'Bills & Utilities': '#96CEB4',
            'Entertainment': '#FFEAA7',
            'Healthcare': '#DDA0DD',
            'Family Support': '#98D8C8',
            'Others': '#F7DC6F'
        };
        return colors[category] || '#95A5A6';
    }

    // Generate realistic mock expense data (fallback)
    generateMockExpenseData() {
        const categories = [
            { name: 'Food & Dining', amount: 15000, color: '#FF6B6B' },
            { name: 'Transportation', amount: 8000, color: '#4ECDC4' },
            { name: 'Shopping', amount: 12000, color: '#45B7D1' },
            { name: 'Bills & Utilities', amount: 6000, color: '#96CEB4' },
            { name: 'Entertainment', amount: 5000, color: '#FFEAA7' },
            { name: 'Healthcare', amount: 3000, color: '#DDA0DD' },
            { name: 'Family Support', amount: 8000, color: '#98D8C8' },
            { name: 'Others', amount: 2000, color: '#F7DC6F' }
        ];

        const totalExpenses = categories.reduce((sum, cat) => sum + cat.amount, 0);
        const monthlyIncome = 65000;

        return {
            categories,
            totalExpenses,
            monthlyIncome,
            transactionCount: 89,
            averageDaily: Math.round(totalExpenses / 30),
            topCategory: categories.reduce((prev, current) => (prev.amount > current.amount) ? prev : current),
            userData: null
        };
    }

    // AI Analysis Engine using Gemini AI
    async analyzeExpenseData(data) {
        try {
            console.log('🤖 Starting AI expense analysis with Gemini...');
            
            if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
                console.warn('Gemini API key not configured, using basic analysis');
                return this.getBasicAnalysis(data);
            }

            const aiPrompt = this.createExpenseAnalysisPrompt(data);
            const aiResponse = await this.callGeminiAI(aiPrompt);
            
            console.log('✅ AI analysis completed');
            return this.parseAIAnalysis(aiResponse, data);
            
        } catch (error) {
            console.error('❌ Error in AI analysis:', error);
            return this.getBasicAnalysis(data);
        }
    }

    // Create comprehensive AI prompt for expense analysis
    createExpenseAnalysisPrompt(data) {
        const spendingRate = (data.totalExpenses / data.monthlyIncome) * 100;
        const categoriesText = data.categories.map(cat => 
            `${cat.name}: ₱${cat.amount.toLocaleString()} (${((cat.amount / data.totalExpenses) * 100).toFixed(1)}%)`
        ).join(', ');

        return `
Ikaw ay isang expert Filipino Financial Advisor na nag-aanalyze ng gastos. Analyze ang expense data at gumawa ng detailed insights na may cultural context para sa mga Pilipino.

USER EXPENSE DATA:
- Monthly Income: ₱${data.monthlyIncome.toLocaleString()}
- Total Expenses: ₱${data.totalExpenses.toLocaleString()}
- Spending Rate: ${spendingRate.toFixed(1)}%
- Transaction Count: ${data.transactionCount}
- Categories: ${categoriesText}
- Top Category: ${data.topCategory.name} (₱${data.topCategory.amount.toLocaleString()})

Gumawa ka ng COMPLETE JSON response na may mga sumusunod:

{
  "spendingPattern": {
    "pattern": "Assessment ng spending behavior (e.g., 'Moderate Spender', 'High Risk Spender')",
    "spendingRate": ${spendingRate.toFixed(1)},
    "severity": "low/medium/high based on spending rate",
    "recommendations": [
      "3-5 specific Filipino-context recommendations"
    ],
    "culturalInsight": "Insight about Filipino spending habits related to this pattern"
  },
  "spendingLeaks": [
    {
      "category": "Category with excessive spending",
      "excessAmount": 0,
      "currentSpend": 0,
      "recommendedSpend": 0,
      "strategy": "Specific Filipino strategy to reduce spending",
      "priority": "high/medium/low"
    }
  ],
  "filipinoStrategies": [
    {
      "category": "Category name",
      "strategy": "Filipino cultural money-saving strategy",
      "expectedSavings": "Estimated monthly savings",
      "culturalContext": "Why this works for Filipinos",
      "actionSteps": ["Step 1", "Step 2", "Step 3"]
    }
  ],
  "budgetOptimization": {
    "currentAllocation": {
      "needs": 0,
      "wants": 0,
      "savings": 0
    },
    "recommendedAllocation": {
      "needs": 0,
      "wants": 0,
      "savings": 0
    },
    "monthlyPotentialSavings": 0,
    "achievabilityScore": 0.0,
    "optimizationTips": [
      "Practical tips for budget optimization"
    ]
  },
  "riskAssessment": {
    "financialHealthScore": 0,
    "riskLevel": "low/medium/high",
    "riskFactors": [
      "Identified financial risks"
    ],
    "mitigationStrategies": [
      "How to address each risk"
    ],
    "emergencyFundRecommendation": "Months of expenses to save"
  }
}

IMPORTANT: Gumawa ng realistic at actionable advice na applicable sa Filipino lifestyle at culture. Use Tagalog terms na familiar sa Filipinos tulad ng 'tipid', 'ipon', 'diskarte', 'baon', etc.
`;
    }

    // Call Gemini AI API
    async callGeminiAI(prompt) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
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
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.8,
                        topK: 40,
                        maxOutputTokens: 2048,
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Error calling Gemini AI:', error);
            throw error;
        }
    }

    // Parse AI response and structure it
    parseAIAnalysis(aiResponse, data) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    spendingPattern: parsed.spendingPattern || this.getBasicSpendingPattern(data),
                    spendingLeaks: parsed.spendingLeaks || [],
                    categoryInsights: this.analyzeCategorySpending(data),
                    filipinoStrategies: parsed.filipinoStrategies || [],
                    budgetOptimization: parsed.budgetOptimization || this.getBasicBudgetOptimization(data),
                    riskAssessment: parsed.riskAssessment || this.getBasicRiskAssessment(data)
                };
            }
        } catch (error) {
            console.error('Error parsing AI response:', error);
        }
        
        // Fallback to basic analysis
        return this.getBasicAnalysis(data);
    }

    // Get basic analysis (fallback when AI is not available)
    getBasicAnalysis(data) {
        return {
            spendingPattern: this.getBasicSpendingPattern(data),
            spendingLeaks: this.getBasicSpendingLeaks(data),
            categoryInsights: this.analyzeCategorySpending(data),
            filipinoStrategies: this.getBasicStrategies(data),
            budgetOptimization: this.getBasicBudgetOptimization(data),
            riskAssessment: this.getBasicRiskAssessment(data)
        };
    }

    // Basic spending pattern analysis (fallback)
    getBasicSpendingPattern(data) {
        const spendingRate = (data.totalExpenses / data.monthlyIncome) * 100;
        const dailyAverage = data.averageDaily;
        
        let pattern = '';
        let severity = 'low';
        let recommendations = [];

        if (spendingRate > 90) {
            pattern = 'High Risk Spender';
            severity = 'high';
            recommendations = [
                'Implement emergency spending controls',
                'Use envelope budgeting method',
                'Start small daily savings challenge'
            ];
        } else if (spendingRate > 75) {
            pattern = 'Moderate Risk Spender';
            severity = 'medium';
            recommendations = [
                'Apply 50-30-20 budgeting rule',
                'Consider group savings programs',
                'Review expenses weekly'
            ];
        } else {
            pattern = 'Balanced Spender';
            severity = 'low';
            recommendations = [
                'Maintain current spending discipline',
                'Consider investment opportunities',
                'Explore additional income sources'
            ];
        }

        return {
            pattern,
            spendingRate: Math.round(spendingRate),
            dailyAverage,
            severity,
            recommendations,
            culturalInsight: 'This analysis is based on general spending patterns'
        };
    }

    // Basic spending leaks detection (fallback)
    getBasicSpendingLeaks(data) {
        const leaks = [];
        const optimalRatios = {
            'Food & Dining': 0.25,
            'Transportation': 0.12,
            'Shopping': 0.15,
            'Bills & Utilities': 0.12,
            'Entertainment': 0.08,
            'Healthcare': 0.05,
            'Family Support': 0.18,
            'Others': 0.05
        };

        data.categories.forEach(category => {
            const currentRatio = category.amount / data.totalExpenses;
            const optimalRatio = optimalRatios[category.name] || 0.05;

            if (currentRatio > optimalRatio) {
                const excessAmount = (currentRatio - optimalRatio) * data.totalExpenses;
                leaks.push({
                    category: category.name,
                    excessAmount: Math.round(excessAmount),
                    currentSpend: category.amount,
                    recommendedSpend: Math.round(optimalRatio * data.totalExpenses),
                    strategy: this.getBasicLeakStrategy(category.name),
                    priority: excessAmount > 3000 ? 'high' : excessAmount > 1500 ? 'medium' : 'low'
                });
            }
        });

        return leaks.sort((a, b) => b.excessAmount - a.excessAmount);
    }

    // Basic strategy for spending leaks (fallback)
    getBasicLeakStrategy(categoryName) {
        const strategies = {
            'Food & Dining': 'Consider cooking at home more often',
            'Transportation': 'Look for more cost-effective commute options',
            'Shopping': 'Create and stick to shopping lists',
            'Entertainment': 'Find free or low-cost entertainment alternatives',
            'Bills & Utilities': 'Reduce consumption and find better service providers',
            'Family Support': 'Set a sustainable monthly budget for family assistance',
            'Healthcare': 'Focus on preventive care to reduce future costs',
            'Others': 'Review and question each purchase in this category'
        };
        return strategies[categoryName] || 'Review and optimize this spending category';
    }

    // Basic strategies (fallback)
    getBasicStrategies(data) {
        return [
            {
                category: 'General',
                strategy: 'Track expenses regularly',
                expectedSavings: '5-10% of monthly income',
                culturalContext: 'Consistent monitoring helps build awareness',
                actionSteps: ['Use expense tracking app', 'Review weekly', 'Set category limits']
            },
            {
                category: 'Food',
                strategy: 'Cook at home more often',
                expectedSavings: '₱3,000-5,000/month',
                culturalContext: 'Home cooking is healthier and more economical',
                actionSteps: ['Plan weekly meals', 'Buy groceries in bulk', 'Prep meals in advance']
            }
        ];
    }

    // Basic budget optimization (fallback)
    getBasicBudgetOptimization(data) {
        const currentSavings = Math.max(0, data.monthlyIncome - data.totalExpenses);
        const savingsRate = (currentSavings / data.monthlyIncome) * 100;

        return {
            currentAllocation: {
                needs: Math.round(data.totalExpenses * 0.6),
                wants: Math.round(data.totalExpenses * 0.4),
                savings: currentSavings
            },
            recommendedAllocation: {
                needs: Math.round(data.monthlyIncome * 0.5),
                wants: Math.round(data.monthlyIncome * 0.3),
                savings: Math.round(data.monthlyIncome * 0.2)
            },
            monthlyPotentialSavings: Math.max(0, Math.round(data.monthlyIncome * 0.2) - currentSavings),
            achievabilityScore: savingsRate > 15 ? 0.8 : 0.6,
            optimizationTips: [
                'Automate savings transfers',
                'Use the 50-30-20 rule',
                'Review subscriptions monthly'
            ]
        };
    }

    // Basic risk assessment (fallback)
    getBasicRiskAssessment(data) {
        const spendingRate = (data.totalExpenses / data.monthlyIncome) * 100;
        const savingsRate = 100 - spendingRate;
        
        let riskLevel = 'low';
        let financialHealthScore = 75;
        
        if (spendingRate > 90) {
            riskLevel = 'high';
            financialHealthScore = 30;
        } else if (spendingRate > 75) {
            riskLevel = 'medium';
            financialHealthScore = 50;
        }

        return {
            financialHealthScore,
            riskLevel,
            riskFactors: spendingRate > 80 ? ['High spending rate', 'Low savings rate'] : ['Normal spending patterns'],
            mitigationStrategies: [
                'Build emergency fund',
                'Diversify income sources',
                'Monitor expenses regularly'
            ],
            emergencyFundRecommendation: riskLevel === 'high' ? '6 months' : '3-6 months'
        };
    }

    // Analyze individual category spending (used by AI and fallback)
    analyzeCategorySpending(data) {
        return data.categories.map(category => {
            const percentage = (category.amount / data.totalExpenses) * 100;
            let status = 'optimal';
            let recommendation = '';

            if (percentage > 35) {
                status = 'too_high';
                recommendation = `Consider reducing ${category.name} expenses`;
            } else if (percentage > 25) {
                status = 'moderate';
                recommendation = `Monitor ${category.name} spending`;
            } else {
                status = 'optimal';
                recommendation = `Good control over ${category.name} expenses`;
            }

            return {
                ...category,
                percentage: Math.round(percentage),
                status,
                recommendation
            };
        });
    }

    // Simulate AI processing with realistic delays
    async simulateAIProcessing() {
        const stages = [
            { message: 'Scanning expense patterns...', delay: 1000 },
            { message: 'Identifying spending leaks...', delay: 1200 },
            { message: 'Analyzing Filipino spending behaviors...', delay: 900 },
            { message: 'Generating Tipid strategies...', delay: 800 },
            { message: 'Optimizing your budget...', delay: 700 }
        ];

        for (const stage of stages) {
            await this.updateLoadingMessage(stage.message);
            await this.delay(stage.delay);
        }
    }

    async updateLoadingMessage(message) {
        const loadingText = this.elements.loadingState?.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Render the expense chart
    renderExpenseChart(data) {
        console.log("Rendering expense chart with data:", data);
        
        if (!this.elements.expenseChart) {
            console.error('Expense chart canvas element not found');
            return;
        }

        try {
            const ctx = this.elements.expenseChart.getContext('2d');
            
            if (!ctx) {
                console.error('Could not get 2D context from canvas');
                return;
            }
            
            // Destroy existing chart if it exists
            if (this.chart) {
                console.log("Destroying existing chart");
                this.chart.destroy();
                this.chart = null;
            }

            // Ensure we have valid data
            if (!data.categories || data.categories.length === 0) {
                console.error('No categories data available for chart');
                this.showChartError();
                return;
            }

            console.log("Creating new chart with categories:", data.categories.length);

            // Create center text plugin
            const centerTextPlugin = {
                id: 'centerText',
                beforeDraw: function(chart) {
                    const ctx = chart.ctx;
                    const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                    const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Total amount
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 16px Poppins, sans-serif';
                    ctx.fillText('Total Expenses', centerX, centerY - 15);
                    
                    ctx.font = 'bold 20px Poppins, sans-serif';
                    ctx.fillStyle = '#4ECDC4';
                    ctx.fillText(`₱${data.totalExpenses.toLocaleString()}`, centerX, centerY + 15);
                    
                    ctx.restore();
                }
            };

            this.chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.categories.map(cat => cat.name),
                    datasets: [{
                        data: data.categories.map(cat => cat.amount),
                        backgroundColor: data.categories.map(cat => cat.color),
                        borderColor: '#1a1a1a',
                        borderWidth: 2,
                        hoverBorderWidth: 3,
                        hoverBackgroundColor: data.categories.map(cat => this.lightenColor(cat.color, 20))
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#fff',
                                usePointStyle: true,
                                padding: 20,
                                font: {
                                    size: 12,
                                    family: 'Poppins, sans-serif'
                                },
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    if (data.labels.length && data.datasets.length) {
                                        return data.labels.map((label, i) => {
                                            const dataset = data.datasets[0];
                                            const total = dataset.data.reduce((a, b) => a + b, 0);
                                            const value = dataset.data[i];
                                            const percentage = ((value / total) * 100).toFixed(1);
                                            
                                            return {
                                                text: `${label} (${percentage}%)`,
                                                fillStyle: dataset.backgroundColor[i],
                                                strokeStyle: dataset.borderColor,
                                                lineWidth: dataset.borderWidth,
                                                hidden: false,
                                                index: i
                                            };
                                        });
                                    }
                                    return [];
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#333',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((context.raw / total) * 100).toFixed(1);
                                    return `${context.label}: ₱${context.raw.toLocaleString()} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    cutout: '60%',
                    animation: {
                        animateRotate: true,
                        duration: 2000,
                        onComplete: function() {
                            console.log("Chart animation completed");
                        }
                    },
                    onHover: (event, activeElements) => {
                        event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                    }
                },
                plugins: [centerTextPlugin]
            });

            console.log("Chart created successfully:", this.chart);

        } catch (error) {
            console.error('Error creating expense chart:', error);
            this.showChartError();
        }
    }

    // Lighten color for hover effect
    lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    // Show chart error message
    showChartError() {
        if (!this.elements.expenseChart) return;
        
        const chartContainer = this.elements.expenseChart.parentElement;
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div class="chart-error">
                    <i class="fas fa-chart-pie" style="font-size: 3rem; color: #666; margin-bottom: 1rem;"></i>
                    <h3>Chart Unavailable</h3>
                    <p>Unable to load expense breakdown chart. Please refresh the page.</p>
                    <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 1rem;">
                        <i class="fas fa-refresh"></i> Refresh Page
                    </button>
                </div>
            `;
        }
    }

    // Render spending leaks analysis
    renderSpendingLeaks(leaks) {
        if (!this.elements.spendingLeaksContent || !leaks.length) {
            this.elements.spendingLeaksContent.innerHTML = '<p>Great news! No major spending leaks detected. Your Guardian is impressed! 🎉</p>';
            return;
        }

        const leaksHTML = leaks.slice(0, 3).map(leak => `
            <div class="leak-item priority-${leak.priority}">
                <div class="leak-header">
                    <h4>${leak.category}</h4>
                    <span class="leak-amount">-₱${leak.excessAmount.toLocaleString()}</span>
                </div>
                <div class="leak-details">
                    <p><strong>Current:</strong> ₱${leak.currentSpend.toLocaleString()}</p>
                    <p><strong>Recommended:</strong> ₱${leak.recommendedSpend.toLocaleString()}</p>
                    <p><strong>Strategy:</strong> ${leak.strategy}</p>
                </div>
            </div>
        `).join('');

        this.elements.spendingLeaksContent.innerHTML = leaksHTML;
    }

    // Render Filipino Tipid tips
    renderTipidTips(strategies) {
        if (!this.elements.tipidTipsContent) return;

        const tipsHTML = strategies.slice(0, 4).map((strategy, index) => `
            <div class="tip-item">
                <div class="tip-number">${index + 1}</div>
                <div class="tip-content">
                    <h4>${strategy.tip}</h4>
                    <div class="tip-details">
                        <span class="tip-category">${strategy.category}</span>
                        <span class="tip-savings">${strategy.savings}</span>
                        <span class="tip-impact impact-${strategy.impact}">${strategy.impact} impact</span>
                    </div>
                </div>
            </div>
        `).join('');

        this.elements.tipidTipsContent.innerHTML = tipsHTML;
    }

    // State management
    showState(stateName) {
        const stateElements = {
            'loadingState': this.elements.loadingState,
            'contentState': this.elements.contentState,
            'emptyState': this.elements.emptyState
        };

        // Hide all states
        Object.values(stateElements).forEach(element => {
            if (element) {
                element.classList.add('hidden');
            }
        });

        // Show the requested state
        const targetElement = stateElements[stateName];
        if (targetElement) {
            targetElement.classList.remove('hidden');
        }
    }

    // Main autonomous execution
    async start() {
        try {
            this.showState('loadingState');
            
            // Check if Chart.js is loaded
            if (typeof Chart === 'undefined') {
                console.error('Chart.js is not loaded');
                this.showError('Chart.js library failed to load. Please refresh the page.');
                return;
            }
            
            console.log('Chart.js version:', Chart.version);
            
            // Simulate data fetching
            await this.delay(1000);
            
            // Generate expense data (in real app, this would fetch from backend)
            this.expenseData = await this.loadUserFinancialData();
            
            console.log('Generated expense data:', this.expenseData);
            
            // Check if user has sufficient data
            if (!this.expenseData.transactionCount || this.expenseData.transactionCount < 1) {
                // If user has no transactions at all, show a helpful message
                if (this.expenseData.transactionCount === 0) {
                    this.showEmptyStateWithPrompt();
                } else {
                    this.showState('emptyState');
                }
                return;
            }

            // Perform AI analysis
            this.analysisResults = await this.analyzeExpenseData(this.expenseData);
            
            console.log('Analysis results:', this.analysisResults);
            
            // Show content first
            this.showState('contentState');
            
            // Wait a bit for DOM to be ready
            await this.delay(500);
            
            // Render all components
            this.renderExpenseChart(this.expenseData);
            this.renderSpendingLeaks(this.analysisResults.spendingLeaks);
            this.renderTipidTips(this.analysisResults.filipinoStrategies);
            
            // Mark analysis as complete
            this.processingComplete = true;
            
            console.log('Gastos Guardian AI analysis complete!');
            
        } catch (error) {
            console.error('Error in Gastos Guardian AI:', error);
            this.showError('An error occurred while analyzing your expenses. Please refresh and try again.');
        }
    }

    showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Analysis Error</h3>
            <p>${message}</p>
        `;
        
        document.body.appendChild(errorElement);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    }

    showEmptyStateWithPrompt() {
        if (!this.elements.emptyState) return;
        
        this.elements.emptyState.innerHTML = `
            <div class="empty-state-content">
                <i class="fas fa-shield-alt" style="font-size: 3rem; color: rgba(255, 255, 255, 0.3); margin-bottom: 1.5rem;"></i>
                <h3>Your Gastos Guardian is Ready!</h3>
                <p>To start analyzing your expenses and find spending leaks, you need to:</p>
                <ul style="list-style: none; padding: 0; margin-top: 1rem; text-align: left; display: inline-block;">
                    <li style="margin-bottom: 0.5rem;"><i class="fas fa-plus-circle" style="margin-right: 0.5rem; color: #4CAF50;"></i> Add at least 1 expense transaction</li>
                    <li style="margin-bottom: 0.5rem;"><i class="fas fa-chart-pie" style="margin-right: 0.5rem; color: #FF6B6B;"></i> Track different spending categories</li>
                    <li style="margin-bottom: 0.5rem;"><i class="fas fa-lightbulb" style="margin-right: 0.5rem; color: #FFC107;"></i> Get personalized Filipino "tipid" tips</li>
                </ul>
                <p style="margin-top: 1.5rem;">Once you start tracking expenses, I'll help you identify spending leaks and provide culturally-relevant money-saving strategies!</p>
                <div style="margin-top: 2rem;">
                    <button onclick="window.location.href='/pages/transactions.html'" class="btn btn-primary" style="margin-right: 1rem;">
                        <i class="fas fa-plus"></i> Add Expense
                    </button>
                    <button onclick="location.reload()" class="btn btn-secondary">
                        <i class="fas fa-refresh"></i> Refresh
                    </button>
                </div>
            </div>
        `;
        
        this.showState('emptyState');
    }
}

// Initialize the Gastos Guardian AI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const gastosGuardian = new GastosGuardianAI();
    gastosGuardian.start();
});
