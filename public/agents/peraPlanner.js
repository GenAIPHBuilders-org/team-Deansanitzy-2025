/**
 * Pera Planner AI - Comprehensive Financial Planning Assistant
 * Implements agentic behavior with reasoning, planning, and autonomy
 */

import { GEMINI_API_KEY, GEMINI_MODEL } from "../js/config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserData, getUserTransactions, getUserBankAccounts } from "../js/firestoredb.js";
import { BaseAgent } from "./BaseAgent.js";
import { 
    isProduction, 
    isDevelopment, 
    isDebugMode, 
    isTestMode, 
    isSimpleMode,
    devLog, 
    devWarn, 
    prodError,
    runInDevelopment,
    getEnvironmentConfig 
} from "../js/utils/environment.js";

class PeraPlannerAI extends BaseAgent {
    constructor() {
        super('peraPlanner', {
            autonomyLevel: 'medium',
            planningHorizon: 'long_term',
            learningRate: 0.15
        });
        
        this.userProfile = null;
        this.financialPlan = null;
        this.planningComplete = false;
        this.currentAge = 28;
        
        // Environment-aware configuration
        this.config = getEnvironmentConfig();
        
        // Firebase setup
        this.auth = getAuth();
        this.currentUser = null;
        
        this.initializeElements();
        this.setupAuthListener();
    }

    // Setup Firebase authentication
    setupAuthListener() {
        return new Promise((resolve) => {
            // Set a timeout to prevent infinite waiting
            const timeoutId = setTimeout(() => {
                devLog('⏰ Auth timeout reached, proceeding without authentication');
                this.currentUser = null;
                resolve();
            }, 5000); // 5 second timeout

            onAuthStateChanged(this.auth, (user) => {
                clearTimeout(timeoutId);
                if (user) {
                    devLog('✅ User authenticated:', user.uid);
                    this.currentUser = user;
                } else {
                    devLog('❌ User not authenticated');
                    this.currentUser = null;
                }
                resolve();
            });
        });
    }

    initializeElements() {
        this.elements = {
            loadingState: document.getElementById('loading-state'),
            contentState: document.getElementById('content-state'),
            emptyState: document.getElementById('empty-state'),
            financialTimeline: document.getElementById('financial-timeline'),
            investmentContent: document.getElementById('investment-content'),
            careerContent: document.getElementById('career-content'),
            balancingActContent: document.getElementById('balancing-act-content')
        };

        let missingElements = [];
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                devWarn(`Element ${key} not found in DOM`);
                missingElements.push(key);
            }
        });

        if (missingElements.length > 0) {
            devWarn(`Missing DOM elements: ${missingElements.join(', ')}`);
        }
    }

    // Enhanced user profile generation using BaseAgent's account analysis
    async generateUserProfile() {
        try {
            if (!this.currentUser) {
                devLog('⚠️ User not authenticated, using fallback profile');
                return this.generateFallbackProfile();
            }

            devLog('📊 Generating comprehensive user profile with account analysis...');
            
            // Wait for BaseAgent to load financial data
            await this.waitForInitialization();
            
            // Get financial overview from BaseAgent
            const financialOverview = this.getFinancialOverview();
            
            // Get detailed account insights
            const accountInsights = Array.from(this.accountInsights.values());
            
            // Calculate advanced financial metrics using account data
            const advancedMetrics = this.calculateAdvancedFinancialMetrics();
            
            // Get user profile data
            const userData = this.userFinancialProfile;
            
            // Enhanced profile with account-specific insights
            const profile = {
                // Basic info
                age: userData?.age || this.currentAge,
                name: userData?.name || this.currentUser.displayName || 'User',
                location: userData?.location || 'Philippines',
                
                // Financial data from real accounts
                monthlyIncome: financialOverview.monthlyIncome,
                monthlyExpenses: financialOverview.monthlyExpenses,
                currentSavings: financialOverview.totalBalance,
                savingsRate: financialOverview.savingsRate,
                netMonthlyCashFlow: financialOverview.netMonthlyCashFlow,
                
                // Account diversification analysis
                accountDiversification: this.analyzeAccountDiversification(),
                digitalWalletOptimization: this.analyzeDigitalWalletUsage(),
                cashManagementInsights: this.analyzeCashManagement(),
                
                // Risk assessment across all accounts
                portfolioRisk: this.assessPortfolioRisk(),
                liquidityAnalysis: this.analyzeLiquidity(),
                
                // Employment info
                employmentType: userData?.employmentType || 'employed',
                industry: userData?.industry || 'General',
                
                // Personal info
                dependents: userData?.dependents || 0,
                maritalStatus: userData?.maritalStatus || 'single',
                
                // Financial preferences
                lifeStage: this.determineLifeStage(userData?.age || this.currentAge),
                riskTolerance: this.determineRiskToleranceFromAccounts(),
                primaryGoals: this.inferGoalsFromAccountBehavior(),
                
                // Enhanced account-based insights
                accountCount: this.userAccounts.length,
                accountTypes: this.getAccountTypeBreakdown(),
                averageAccountBalance: financialOverview.totalBalance / (this.userAccounts.length || 1),
                
                // Investment readiness
                investmentReadiness: this.assessInvestmentReadiness(),
                emergencyFundStatus: this.assessEmergencyFundStatus(),
                
                // Data quality and insights
                dataQuality: this.assessDataQuality(),
                accountInsights: accountInsights,
                recommendations: this.generatePortfolioRecommendations(),
                
                // Behavioral insights
                spendingBehavior: this.analyzeSpendingBehavior(),
                savingsBehavior: this.analyzeSavingsBehavior(),
                
                // Filipino-specific considerations
                ofwConsiderations: this.assessOFWFactors(userData),
                familyObligations: this.assessFamilyObligations(userData)
            };

            devLog('✅ Generated enhanced user profile with account insights:', profile);
            return profile;

        } catch (error) {
            prodError('❌ Error generating enhanced user profile:', error);
            devLog('⚠️ Falling back to basic profile due to error');
            return this.generateFallbackProfile();
        }
    }

    // Wait for BaseAgent initialization to complete
    async waitForInitialization() {
        const maxWait = 10000; // 10 seconds
        const checkInterval = 100; // 100ms
        let waited = 0;

        while (!this.initialized && waited < maxWait) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
        }

        if (!this.initialized) {
            devLog('⚠️ BaseAgent initialization timeout, proceeding with available data');
        }
    }

    // Analyze account diversification
    analyzeAccountDiversification() {
        const categories = {};
        let totalBalance = 0;

        this.userAccounts.forEach(account => {
            categories[account.category] = categories[account.category] || { count: 0, balance: 0 };
            categories[account.category].count++;
            categories[account.category].balance += parseFloat(account.balance || 0);
            totalBalance += parseFloat(account.balance || 0);
        });

        // Calculate diversification score
        const categoryCount = Object.keys(categories).length;
        let diversificationScore = 0;
        
        if (categoryCount >= 4) diversificationScore = 100;
        else if (categoryCount === 3) diversificationScore = 80;
        else if (categoryCount === 2) diversificationScore = 60;
        else diversificationScore = 30;

        // Check for over-concentration in one category
        const concentrationRisk = Object.values(categories).some(cat => 
            (cat.balance / totalBalance) > 0.7
        );

        if (concentrationRisk) diversificationScore -= 20;

        return {
            categories,
            diversificationScore,
            concentrationRisk,
            totalBalance,
            recommendations: this.getDiversificationRecommendations(categories, totalBalance),
            optimalAllocation: this.calculateOptimalAllocation(categories, totalBalance)
        };
    }

    // Analyze digital wallet usage patterns
    analyzeDigitalWalletUsage() {
        const digitalWallets = this.userAccounts.filter(acc => acc.category === 'digital-wallet');
        
        if (digitalWallets.length === 0) {
            return {
                hasWallets: false,
                recommendation: 'Consider setting up a digital wallet for convenient transactions'
            };
        }

        const walletInsights = digitalWallets.map(wallet => {
            const walletInsight = this.accountInsights.get(wallet.id);
            return {
                ...wallet,
                ...walletInsight,
                utilizationEfficiency: this.calculateWalletEfficiency(wallet, walletInsight)
            };
        });

        const mostActiveWallet = this.findMostActiveWallet(digitalWallets);
        const totalWalletBalance = digitalWallets.reduce((sum, w) => sum + parseFloat(w.balance || 0), 0);

        return {
            hasWallets: true,
            walletCount: digitalWallets.length,
            totalBalance: totalWalletBalance,
            mostActiveWallet,
            walletInsights,
            optimization: this.getWalletOptimization(digitalWallets, walletInsights),
            securityRecommendations: this.getWalletSecurityTips(),
            efficiencyScore: this.calculateOverallWalletEfficiency(walletInsights)
        };
    }

    // Calculate wallet efficiency
    calculateWalletEfficiency(wallet, insight) {
        if (!insight) return 50;
        
        let efficiency = 50;
        
        // Usage frequency factor
        if (insight.usageFrequency === 'very_active') efficiency += 30;
        else if (insight.usageFrequency === 'active') efficiency += 20;
        else if (insight.usageFrequency === 'moderate') efficiency += 10;
        else if (insight.usageFrequency === 'low') efficiency -= 10;
        else if (insight.usageFrequency === 'inactive') efficiency -= 25;
        
        // Balance optimization factor
        const balance = parseFloat(wallet.balance || 0);
        if (balance > 100000) efficiency -= 15; // Too much in digital wallet
        else if (balance > 50000) efficiency -= 10;
        else if (balance >= 5000 && balance <= 30000) efficiency += 15; // Optimal range
        else if (balance < 1000) efficiency -= 5;
        
        // Risk factor
        if (insight.riskLevel === 'low') efficiency += 10;
        else if (insight.riskLevel === 'medium') efficiency -= 5;
        else if (insight.riskLevel === 'high') efficiency -= 15;
        
        return Math.min(100, Math.max(0, efficiency));
    }

    // Calculate overall wallet efficiency
    calculateOverallWalletEfficiency(walletInsights) {
        if (walletInsights.length === 0) return 0;
        
        const totalEfficiency = walletInsights.reduce((sum, wallet) => 
            sum + (wallet.utilizationEfficiency || 50), 0
        );
        
        return totalEfficiency / walletInsights.length;
    }

    // Get wallet security tips
    getWalletSecurityTips() {
        return [
            'Enable two-factor authentication on all digital wallets',
            'Set transaction limits to prevent unauthorized large transactions',
            'Regularly monitor transaction history for suspicious activity',
            'Keep only necessary amounts in digital wallets',
            'Use strong, unique passwords for each wallet account'
        ];
    }

    // Analyze cash management
    analyzeCashManagement() {
        const cashAccounts = this.userAccounts.filter(acc => acc.category === 'cash');
        
        if (cashAccounts.length === 0) {
            return {
                hasCash: false,
                recommendation: 'Consider tracking cash transactions for better financial visibility'
            };
        }

        const totalCash = cashAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
        const cashPercentage = (totalCash / this.getFinancialOverview().totalBalance) * 100;
        
        let riskLevel = 'low';
        let recommendations = [];
        
        if (totalCash > 50000) {
            riskLevel = 'high';
            recommendations.push('Consider depositing excess cash into interest-bearing accounts');
            recommendations.push('High cash holdings are vulnerable to theft and inflation');
        } else if (totalCash > 20000) {
            riskLevel = 'medium';
            recommendations.push('Consider maintaining only emergency cash and depositing the rest');
        } else if (totalCash < 2000) {
            recommendations.push('Maintain some emergency cash for unexpected situations');
        }

        if (cashPercentage > 30) {
            recommendations.push('Cash holdings exceed recommended 20% of total assets');
        }

        return {
            hasCash: true,
            totalCash,
            cashPercentage,
            riskLevel,
            recommendations,
            optimalCashRange: { min: 5000, max: 15000 },
            securityTips: [
                'Store cash in secure, fireproof safe',
                'Divide cash between multiple secure locations',
                'Consider deposit insurance protection for large amounts'
            ]
        };
    }

    // Assess portfolio risk across all accounts
    assessPortfolioRisk() {
        const riskFactors = [];
        let totalRiskScore = 0;
        let accountRiskDistribution = { low: 0, medium: 0, high: 0 };

        // Analyze each account's risk
        this.userAccounts.forEach(account => {
            const insight = this.accountInsights.get(account.id);
            if (insight && insight.riskLevel) {
                accountRiskDistribution[insight.riskLevel]++;
                totalRiskScore += this.convertRiskLevelToScore(insight.riskLevel);
            }
        });

        const averageRiskScore = this.userAccounts.length > 0 ? 
            totalRiskScore / this.userAccounts.length : 0;

        // Portfolio-level risk factors
        const financialOverview = this.getFinancialOverview();
        
        if (financialOverview.savingsRate < 10) {
            riskFactors.push('Low savings rate indicates financial stress');
        }
        
        if (financialOverview.liquidityRatio < 50) {
            riskFactors.push('Low liquidity ratio may cause cash flow issues');
        }
        
        if (this.userAccounts.length === 1) {
            riskFactors.push('Single account creates concentration risk');
        }
        
        const diversification = this.analyzeAccountDiversification();
        if (diversification.concentrationRisk) {
            riskFactors.push('Over-concentration in one account category');
        }

        return {
            overallRiskLevel: this.convertScoreToRiskLevel(averageRiskScore),
            averageRiskScore,
            accountRiskDistribution,
            riskFactors,
            mitigationStrategies: this.getRiskMitigationStrategies(averageRiskScore),
            riskCapacity: this.assessRiskCapacity(),
            recommendations: this.getPortfolioRiskRecommendations(averageRiskScore, riskFactors)
        };
    }

    // Convert risk level to numerical score
    convertRiskLevelToScore(riskLevel) {
        const scores = { low: 25, medium: 50, high: 75 };
        return scores[riskLevel] || 50;
    }

    // Convert score to risk level
    convertScoreToRiskLevel(score) {
        if (score < 35) return 'low';
        if (score < 65) return 'medium';
        return 'high';
    }

    // Assess risk capacity
    assessRiskCapacity() {
        const financialOverview = this.getFinancialOverview();
        const emergencyFund = this.assessEmergencyFundStatus();
        
        let capacity = 'moderate';
        
        if (financialOverview.savingsRate > 20 && emergencyFund.status === 'adequate') {
            capacity = 'high';
        } else if (financialOverview.savingsRate < 5 || emergencyFund.status === 'insufficient') {
            capacity = 'low';
        }
        
        return {
            level: capacity,
            factors: {
                savingsRate: financialOverview.savingsRate,
                emergencyFund: emergencyFund.status,
                liquidityRatio: financialOverview.liquidityRatio
            }
        };
    }

    // Get portfolio risk recommendations
    getPortfolioRiskRecommendations(riskScore, riskFactors) {
        const recommendations = [];
        
        if (riskScore > 60) {
            recommendations.push('Prioritize risk reduction through diversification');
            recommendations.push('Build emergency fund before taking additional risks');
        }
        
        riskFactors.forEach(factor => {
            if (factor.includes('savings rate')) {
                recommendations.push('Focus on increasing monthly savings to 20% of income');
            } else if (factor.includes('liquidity')) {
                recommendations.push('Maintain 60-80% of assets in liquid accounts');
            } else if (factor.includes('concentration')) {
                recommendations.push('Diversify across multiple account types and providers');
            }
        });
        
        return recommendations;
    }

    // Assess investment readiness
    assessInvestmentReadiness() {
        const financialOverview = this.getFinancialOverview();
        const emergencyFund = this.assessEmergencyFundStatus();
        const portfolioRisk = this.assessPortfolioRisk();
        
        let readinessScore = 0;
        const factors = [];
        
        // Emergency fund factor (40% weight)
        if (emergencyFund.status === 'adequate') {
            readinessScore += 40;
            factors.push('✅ Emergency fund established');
        } else if (emergencyFund.status === 'building') {
            readinessScore += 20;
            factors.push('⚠️ Emergency fund in progress');
        } else {
            factors.push('❌ Emergency fund needed');
        }
        
        // Savings rate factor (30% weight)
        if (financialOverview.savingsRate > 20) {
            readinessScore += 30;
            factors.push('✅ Strong savings rate');
        } else if (financialOverview.savingsRate > 10) {
            readinessScore += 20;
            factors.push('⚠️ Moderate savings rate');
        } else if (financialOverview.savingsRate > 5) {
            readinessScore += 10;
            factors.push('⚠️ Low savings rate');
        } else {
            factors.push('❌ Insufficient savings rate');
        }
        
        // Debt-to-income assessment (20% weight)
        const netCashFlow = financialOverview.netMonthlyCashFlow;
        if (netCashFlow > financialOverview.monthlyIncome * 0.15) {
            readinessScore += 20;
            factors.push('✅ Healthy cash flow');
        } else if (netCashFlow > 0) {
            readinessScore += 10;
            factors.push('⚠️ Tight cash flow');
        } else {
            factors.push('❌ Negative cash flow');
        }
        
        // Risk tolerance and diversification (10% weight)
        if (portfolioRisk.overallRiskLevel === 'low') {
            readinessScore += 10;
            factors.push('✅ Well-managed risk profile');
        } else if (portfolioRisk.overallRiskLevel === 'medium') {
            readinessScore += 5;
            factors.push('⚠️ Moderate risk profile');
        } else {
            factors.push('❌ High risk profile needs attention');
        }
        
        // Determine readiness level
        let readinessLevel;
        if (readinessScore >= 80) readinessLevel = 'ready';
        else if (readinessScore >= 60) readinessLevel = 'nearly_ready';
        else if (readinessScore >= 40) readinessLevel = 'building';
        else readinessLevel = 'not_ready';
        
        return {
            readinessLevel,
            readinessScore,
            factors,
            recommendations: this.getInvestmentReadinessRecommendations(readinessLevel, factors),
            suggestedTimeline: this.getInvestmentTimeline(readinessLevel),
            riskCapacity: portfolioRisk.riskCapacity
        };
    }

    // Get investment readiness recommendations
    getInvestmentReadinessRecommendations(readinessLevel, factors) {
        const recommendations = [];
        
        switch (readinessLevel) {
            case 'ready':
                recommendations.push('You\'re ready to start investing! Consider index funds or ETFs');
                recommendations.push('Start with 5-10% of income in low-cost diversified investments');
                recommendations.push('Maintain your emergency fund while investing');
                break;
                
            case 'nearly_ready':
                recommendations.push('Focus on building emergency fund to 6 months expenses');
                recommendations.push('Increase savings rate to 20% if possible');
                recommendations.push('Consider starting with very conservative investments');
                break;
                
            case 'building':
                recommendations.push('Priority: Build emergency fund (3-6 months expenses)');
                recommendations.push('Improve savings rate through expense optimization');
                recommendations.push('Learn about investing while building financial foundation');
                break;
                
            case 'not_ready':
                recommendations.push('Focus on increasing income and reducing expenses');
                recommendations.push('Build emergency fund of ₱50,000 minimum');
                recommendations.push('Stabilize cash flow before considering investments');
                break;
        }
        
        return recommendations;
    }

    // Get investment timeline
    getInvestmentTimeline(readinessLevel) {
        const timelines = {
            ready: 'You can start investing now',
            nearly_ready: '2-6 months of preparation needed',
            building: '6-12 months to build foundation',
            not_ready: '12+ months to establish financial stability'
        };
        
        return timelines[readinessLevel] || 'Timeline assessment needed';
    }

    // Assess emergency fund status using liquid accounts
    assessEmergencyFundStatus() {
        const financialOverview = this.getFinancialOverview();
        const liquidAccounts = ['traditional-bank', 'digital-wallet'];
        
        const liquidBalance = Object.entries(financialOverview.accountsByCategory)
            .filter(([category]) => liquidAccounts.includes(category))
            .reduce((sum, [, data]) => sum + data.totalBalance, 0);
        
        const monthlyExpenses = financialOverview.monthlyExpenses || 
            (financialOverview.monthlyIncome * 0.7); // Estimate if no expense data
        
        const monthsCovered = monthlyExpenses > 0 ? liquidBalance / monthlyExpenses : 0;
        
        let status;
        if (monthsCovered >= 6) status = 'adequate';
        else if (monthsCovered >= 3) status = 'building';
        else if (monthsCovered >= 1) status = 'minimal';
        else status = 'insufficient';
        
        const targetAmount = monthlyExpenses * 6;
        const remainingAmount = Math.max(0, targetAmount - liquidBalance);
        
        return {
            status,
            currentAmount: liquidBalance,
            targetAmount,
            remainingAmount,
            monthsCovered: Math.round(monthsCovered * 10) / 10,
            recommendations: this.getEmergencyFundRecommendations(status, remainingAmount),
            liquidAccounts: financialOverview.accountsByCategory
        };
    }

    // Get emergency fund recommendations
    getEmergencyFundRecommendations(status, remainingAmount) {
        const recommendations = [];
        
        switch (status) {
            case 'adequate':
                recommendations.push('✅ Emergency fund is well-established');
                recommendations.push('Maintain this level and adjust for lifestyle changes');
                recommendations.push('Consider higher-yield savings for emergency fund');
                break;
                
            case 'building':
                recommendations.push('Good progress! Continue building to 6 months expenses');
                recommendations.push(`Save additional ₱${remainingAmount.toLocaleString()} to reach target`);
                recommendations.push('Automate transfers to emergency fund');
                break;
                
            case 'minimal':
                recommendations.push('Priority: Build emergency fund to 3-6 months expenses');
                recommendations.push('Cut unnecessary expenses temporarily to boost savings');
                recommendations.push('Keep emergency fund in easily accessible accounts');
                break;
                
            case 'insufficient':
                recommendations.push('🚨 Critical: Build emergency fund immediately');
                recommendations.push('Start with goal of ₱25,000 minimum');
                recommendations.push('Consider side income to accelerate fund building');
                break;
        }
        
        return recommendations;
    }

    // Infer financial goals from account behavior
    inferGoalsFromAccountBehavior() {
        const goals = [];
        const financialOverview = this.getFinancialOverview();
        const emergencyFund = this.assessEmergencyFundStatus();
        const investmentReadiness = this.assessInvestmentReadiness();
        
        // Emergency fund goal
        if (emergencyFund.status !== 'adequate') {
            goals.push({
                type: 'emergency_fund',
                priority: 'high',
                description: 'Build emergency fund',
                target: emergencyFund.targetAmount,
                current: emergencyFund.currentAmount,
                timeframe: '6-12 months',
                progress: (emergencyFund.currentAmount / emergencyFund.targetAmount) * 100
            });
        }
        
        // Investment goal
        if (investmentReadiness.readinessLevel === 'ready' || investmentReadiness.readinessLevel === 'nearly_ready') {
            goals.push({
                type: 'investment_start',
                priority: 'medium',
                description: 'Start investment portfolio',
                target: financialOverview.monthlyIncome * 0.1, // 10% of monthly income
                timeframe: '1-3 months',
                progress: 0
            });
        }
        
        // Savings optimization goal
        if (financialOverview.savingsRate < 20) {
            goals.push({
                type: 'savings_rate',
                priority: 'medium',
                description: 'Increase savings rate to 20%',
                target: 20,
                current: financialOverview.savingsRate,
                timeframe: '3-6 months',
                progress: (financialOverview.savingsRate / 20) * 100
            });
        }
        
        // Account optimization goal
        const diversification = this.analyzeAccountDiversification();
        if (diversification.diversificationScore < 70) {
            goals.push({
                type: 'diversification',
                priority: 'low',
                description: 'Diversify account portfolio',
                target: 'Have accounts in 3+ categories',
                timeframe: '2-4 months',
                progress: diversification.diversificationScore
            });
        }
        
        return goals;
    }

    // Determine risk tolerance from account behavior
    determineRiskToleranceFromAccounts() {
        const portfolioRisk = this.assessPortfolioRisk();
        const diversification = this.analyzeAccountDiversification();
        const cashManagement = this.analyzeCashManagement();
        
        let riskScore = 50; // Base moderate score
        
        // Account diversification indicates risk tolerance
        if (diversification.diversificationScore > 80) riskScore += 15;
        else if (diversification.diversificationScore < 50) riskScore -= 15;
        
        // Cash holdings indicate risk aversion
        if (cashManagement.hasCash && cashManagement.cashPercentage > 30) riskScore -= 20;
        else if (cashManagement.hasCash && cashManagement.cashPercentage < 10) riskScore += 10;
        
        // Investment accounts indicate risk tolerance
        const hasInvestmentAccounts = this.userAccounts.some(acc => acc.category === 'investment');
        if (hasInvestmentAccounts) riskScore += 20;
        
        // Convert to risk tolerance level
        if (riskScore >= 70) return 'high';
        if (riskScore >= 40) return 'moderate';
        return 'conservative';
    }

    // Calculate enhanced financial metrics using BaseAgent data
    calculateAdvancedFinancialMetrics() {
        const overview = this.getFinancialOverview();
        const accountInsights = Array.from(this.accountInsights.values());
        
        // Calculate velocity of money (how fast money moves through accounts)
        const totalTransactionVolume = accountInsights.reduce((sum, insight) => 
            sum + insight.monthlyInflow + insight.monthlyOutflow, 0
        );
        
        const velocityOfMoney = overview.totalBalance > 0 ? totalTransactionVolume / overview.totalBalance : 0;
        
        // Calculate account efficiency (balance utilization)
        const accountEfficiency = accountInsights.map(insight => ({
            accountId: insight.accountId,
            efficiency: insight.currentBalance > 0 ? 
                (insight.monthlyInflow + insight.monthlyOutflow) / insight.currentBalance : 0
        }));

        return {
            velocityOfMoney,
            accountEfficiency,
            averageAccountUtilization: accountEfficiency.reduce((sum, eff) => sum + eff.efficiency, 0) / accountEfficiency.length,
            totalTransactionVolume,
            financialComplexity: this.calculateFinancialComplexity()
        };
    }

    // Calculate financial complexity score
    calculateFinancialComplexity() {
        let complexityScore = 0;
        
        // Account diversity adds complexity
        complexityScore += this.userAccounts.length * 10;
        
        // Different account types add complexity
        const uniqueCategories = new Set(this.userAccounts.map(acc => acc.category));
        complexityScore += uniqueCategories.size * 15;
        
        // Investment accounts add more complexity
        const investmentAccounts = this.userAccounts.filter(acc => acc.category === 'investment');
        complexityScore += investmentAccounts.length * 20;
        
        // High transaction volume adds complexity
        const totalTransactions = this.userTransactions.length;
        if (totalTransactions > 100) complexityScore += 30;
        else if (totalTransactions > 50) complexityScore += 20;
        else if (totalTransactions > 20) complexityScore += 10;

        return {
            score: Math.min(complexityScore, 100),
            level: this.getComplexityLevel(complexityScore),
            factors: this.getComplexityFactors()
        };
    }

    // Get complexity level description
    getComplexityLevel(score) {
        if (score >= 80) return 'very_complex';
        if (score >= 60) return 'complex';
        if (score >= 40) return 'moderate';
        if (score >= 20) return 'simple';
        return 'very_simple';
    }

    // Helper methods for enhanced account analysis
    
    // Get complexity factors
    getComplexityFactors() {
        const factors = [];
        
        if (this.userAccounts.length > 5) factors.push('Multiple accounts');
        if (new Set(this.userAccounts.map(acc => acc.category)).size > 3) factors.push('Diverse account types');
        if (this.userAccounts.some(acc => acc.category === 'investment')) factors.push('Investment accounts');
        if (this.userTransactions.length > 100) factors.push('High transaction volume');
        
        return factors;
    }

    // Get account type breakdown
    getAccountTypeBreakdown() {
        const breakdown = {};
        this.userAccounts.forEach(account => {
            breakdown[account.category] = breakdown[account.category] || 0;
            breakdown[account.category]++;
        });
        return breakdown;
    }

    // Assess data quality
    assessDataQuality() {
        let qualityScore = 0;
        const factors = [];

        // Account data quality
        if (this.userAccounts.length > 0) {
            qualityScore += 30;
            factors.push('✅ Has account data');
        }

        // Transaction data quality
        if (this.userTransactions.length > 0) {
            qualityScore += 30;
            factors.push('✅ Has transaction history');
            
            if (this.userTransactions.length > 20) {
                qualityScore += 20;
                factors.push('✅ Rich transaction history');
            }
        }

        // Recent data
        const hasRecentTransactions = this.userTransactions.some(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            return txDate >= thirtyDaysAgo;
        });

        if (hasRecentTransactions) {
            qualityScore += 20;
            factors.push('✅ Recent transaction activity');
        }

        let qualityLevel = 'poor';
        if (qualityScore >= 80) qualityLevel = 'excellent';
        else if (qualityScore >= 60) qualityLevel = 'good';
        else if (qualityScore >= 40) qualityLevel = 'fair';

        return {
            score: qualityScore,
            level: qualityLevel,
            factors
        };
    }

    // Generate portfolio recommendations
    generatePortfolioRecommendations() {
        const recommendations = [];
        const overview = this.getFinancialOverview();
        const diversification = this.analyzeAccountDiversification();
        
        // Diversification recommendations
        if (diversification.score < 60) {
            recommendations.push({
                type: 'diversification',
                priority: 'high',
                title: 'Improve Account Diversification',
                description: 'Consider adding different types of accounts for better financial flexibility',
                action: 'Add digital wallets or investment accounts'
            });
        }

        // Emergency fund recommendations
        const emergencyFund = this.assessEmergencyFundStatus();
        if (emergencyFund.status === 'inadequate') {
            recommendations.push({
                type: 'emergency_fund',
                priority: 'high',
                title: 'Build Emergency Fund',
                description: emergencyFund.recommendations.join('\n'),
                action: `Save ₱${emergencyFund.targetAmount.toLocaleString()} for 6 months of expenses`
            });
        }

        // Investment recommendations
        const investmentReadiness = this.assessInvestmentReadiness();
        if (investmentReadiness.readinessLevel === 'ready') {
            recommendations.push({
                type: 'investment',
                priority: 'medium',
                title: 'Start Investing',
                description: 'You appear ready to start building wealth through investments',
                action: 'Consider opening an investment account with COL Financial or similar'
            });
        }

        return recommendations;
    }

    // Analyze spending behavior
    analyzeSpendingBehavior() {
        if (this.userTransactions.length === 0) {
            return { pattern: 'no_data', description: 'No spending data available' };
        }

        const expenses = this.userTransactions.filter(tx => tx.type === 'expense');
        const totalSpending = expenses.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        const averageTransaction = totalSpending / expenses.length;

        // Analyze spending frequency
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentExpenses = expenses.filter(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            return txDate >= thirtyDaysAgo;
        });

        const dailySpending = recentExpenses.length > 0 ? 
            recentExpenses.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0) / 30 : 0;

        let pattern = 'moderate';
        if (recentExpenses.length > 60) pattern = 'frequent';
        else if (recentExpenses.length < 10) pattern = 'infrequent';

        return {
            pattern,
            averageTransaction,
            dailySpending,
            monthlyExpenses: dailySpending * 30,
            description: this.getSpendingDescription(pattern)
        };
    }

    // Get spending pattern description
    getSpendingDescription(pattern) {
        const descriptions = {
            frequent: 'You make frequent transactions - consider budgeting apps',
            moderate: 'Your spending pattern appears balanced',
            infrequent: 'You make few transactions - consider if you need more financial accounts',
            no_data: 'No spending data to analyze'
        };
        return descriptions[pattern] || 'Unknown spending pattern';
    }

    // Analyze savings behavior
    analyzeSavingsBehavior() {
        const overview = this.getFinancialOverview();
        const savingsRate = overview.savingsRate;

        let behavior = 'poor';
        let description = 'Work on increasing your savings rate';

        if (savingsRate >= 30) {
            behavior = 'excellent';
            description = 'Excellent savings rate! You\'re building wealth effectively';
        } else if (savingsRate >= 20) {
            behavior = 'good';
            description = 'Good savings rate, keep it up!';
        } else if (savingsRate >= 10) {
            behavior = 'fair';
            description = 'Fair savings rate, try to increase it gradually';
        }

        return {
            behavior,
            savingsRate,
            description,
            monthlyNetSaving: overview.netMonthlyCashFlow,
            recommendations: this.getSavingsRecommendations(savingsRate)
        };
    }

    // Get savings recommendations
    getSavingsRecommendations(savingsRate) {
        if (savingsRate < 10) {
            return ['Track expenses to identify saving opportunities', 'Consider the 50-30-20 budgeting rule'];
        } else if (savingsRate < 20) {
            return ['Automate savings transfers', 'Look for ways to reduce unnecessary expenses'];
        } else {
            return ['Consider increasing investment allocation', 'Explore high-yield savings options'];
        }
    }

    // Assess OFW factors
    assessOFWFactors(userData) {
        const isOFW = userData?.employmentType === 'ofw' || userData?.isOFW || false;
        
        if (!isOFW) {
            return { isOFW: false, considerations: [] };
        }

        return {
            isOFW: true,
            considerations: [
                'Consider USD/PHP exchange rate when planning',
                'Set up efficient remittance channels',
                'Plan for eventual return to Philippines',
                'Consider Philippine investments despite being abroad'
            ],
            remittanceOptimization: this.analyzeRemittanceAccounts(),
            currencyRisk: 'Consider hedging against currency fluctuations'
        };
    }

    // Analyze remittance accounts
    analyzeRemittanceAccounts() {
        const remittanceAccounts = this.userAccounts.filter(acc => 
            acc.name?.toLowerCase().includes('remit') || 
            acc.name?.toLowerCase().includes('dollar') ||
            acc.provider?.toLowerCase().includes('western union') ||
            acc.provider?.toLowerCase().includes('remitly')
        );

        return {
            hasRemittanceAccounts: remittanceAccounts.length > 0,
            accountCount: remittanceAccounts.length,
            recommendation: remittanceAccounts.length === 0 ? 
                'Consider setting up dedicated remittance accounts for family support' : 
                'Optimize remittance timing and fees'
        };
    }

    // Assess family obligations
    assessFamilyObligations(userData) {
        const dependents = userData?.dependents || 0;
        const familySupport = this.calculateFamilySupport();

        return {
            dependents,
            estimatedMonthlyCost: dependents * 5000, // Rough estimate
            familySupportRatio: familySupport.ratio,
            recommendations: this.getFamilyObligationRecommendations(dependents, familySupport)
        };
    }

    // Calculate family support from transactions
    calculateFamilySupport() {
        const familyTransactions = this.userTransactions.filter(tx => 
            tx.type === 'expense' && (
                tx.name?.toLowerCase().includes('family') ||
                tx.name?.toLowerCase().includes('remit') ||
                tx.name?.toLowerCase().includes('support') ||
                tx.category?.toLowerCase().includes('family')
            )
        );

        const totalFamilySupport = familyTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        const totalExpenses = this.getFinancialOverview().monthlyExpenses;
        const ratio = totalExpenses > 0 ? (totalFamilySupport / totalExpenses) * 100 : 0;

        return {
            amount: totalFamilySupport,
            ratio,
            transactionCount: familyTransactions.length
        };
    }

    // Get family obligation recommendations
    getFamilyObligationRecommendations(dependents, familySupport) {
        const recommendations = [];

        if (dependents > 2) {
            recommendations.push('Consider insurance to protect dependents');
            recommendations.push('Plan for education expenses');
        }

        if (familySupport.ratio > 30) {
            recommendations.push('High family support ratio - ensure you\'re also saving for yourself');
        }

        return recommendations;
    }

    // Find most active wallet
    findMostActiveWallet(digitalWallets) {
        if (digitalWallets.length === 0) return null;

        return digitalWallets.reduce((mostActive, wallet) => {
            const walletInsight = this.accountInsights.get(wallet.id);
            const mostActiveInsight = this.accountInsights.get(mostActive.id);
            
            if (!walletInsight) return mostActive;
            if (!mostActiveInsight) return wallet;
            
            return walletInsight.usagePattern.frequency > mostActiveInsight.usagePattern.frequency ? 
                wallet : mostActive;
        });
    }

    // Get wallet optimization suggestions
    getWalletOptimization(digitalWallets, walletInsights) {
        const suggestions = [];

        // Check for low-balance wallets
        const lowBalanceWallets = digitalWallets.filter(wallet => wallet.balance < 100);
        if (lowBalanceWallets.length > 1) {
            suggestions.push('Consider consolidating low-balance digital wallets');
        }

        // Check for inactive wallets
        const inactiveWallets = walletInsights.filter(insight => 
            insight && insight.usagePattern.pattern === 'inactive'
        );
        if (inactiveWallets.length > 0) {
            suggestions.push('Consider closing or repurposing inactive digital wallets');
        }

        return suggestions;
    }

    // Get diversification recommendations
    getDiversificationRecommendations(categories, totalBalance) {
        const recommendations = [];

        if (!categories['traditional-bank']) {
            recommendations.push('Consider opening a traditional bank account for stability');
        }

        if (!categories['digital-wallet'] && totalBalance > 5000) {
            recommendations.push('Add digital wallets for convenient transactions');
        }

        if (!categories['investment'] && totalBalance > 50000) {
            recommendations.push('Consider investment accounts for wealth building');
        }

        if (categories['cash'] && categories['cash'].balance > totalBalance * 0.3) {
            recommendations.push('Consider depositing some cash into interest-bearing accounts');
        }

        return recommendations;
    }

    // Consolidate risk factors from all accounts
    consolidateRiskFactors() {
        const allFactors = [];
        this.accountInsights.forEach(insight => {
            if (insight.riskLevel && insight.riskLevel.factors) {
                allFactors.push(...insight.riskLevel.factors);
            }
        });
        
        // Remove duplicates
        return [...new Set(allFactors)];
    }

    // Get risk mitigation strategies
    getRiskMitigationStrategies(riskScore) {
        const strategies = [];

        if (riskScore >= 75) {
            strategies.push('Urgent: Diversify your accounts immediately');
            strategies.push('Build emergency fund');
            strategies.push('Consider financial counseling');
        } else if (riskScore >= 50) {
            strategies.push('Increase account diversification');
            strategies.push('Monitor spending patterns');
            strategies.push('Build larger cash reserves');
        } else {
            strategies.push('Continue current financial practices');
            strategies.push('Consider growth opportunities');
        }

        return strategies;
    }

    // Get investment readiness recommendations
    getInvestmentReadinessRecommendations(readinessLevel, factors) {
        const recommendations = [];

        if (readinessLevel === 'ready') {
            recommendations.push('Start with low-risk investments like UITFs or mutual funds');
            recommendations.push('Consider peso-cost averaging for stocks');
            recommendations.push('Diversify across different asset classes');
        } else if (readinessLevel === 'almost_ready') {
            recommendations.push('Focus on building emergency fund first');
            recommendations.push('Increase savings rate gradually');
            recommendations.push('Learn about investment basics');
        } else {
            recommendations.push('Priority: Build emergency fund');
            recommendations.push('Track and optimize expenses');
            recommendations.push('Increase income if possible');
        }

        return recommendations;
    }

    // Analyze liquidity
    analyzeLiquidity() {
        const liquidAccounts = this.userAccounts.filter(acc => 
            acc.category === 'traditional-bank' || 
            acc.category === 'digital-wallet' || 
            acc.category === 'cash'
        );

        const liquidBalance = liquidAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
        const totalBalance = this.userAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
        const liquidityRatio = totalBalance > 0 ? (liquidBalance / totalBalance) * 100 : 0;

        let liquidityLevel = 'poor';
        if (liquidityRatio >= 60) liquidityLevel = 'excellent';
        else if (liquidityRatio >= 40) liquidityLevel = 'good';
        else if (liquidityRatio >= 20) liquidityLevel = 'fair';

        return {
            liquidBalance,
            liquidityRatio,
            liquidityLevel,
            liquidAccounts: liquidAccounts.length,
            recommendation: this.getLiquidityRecommendation(liquidityLevel)
        };
    }

    // Get liquidity recommendation
    getLiquidityRecommendation(liquidityLevel) {
        const recommendations = {
            excellent: 'Good liquidity! Consider investing some excess liquid funds',
            good: 'Healthy liquidity ratio for your needs',
            fair: 'Consider increasing liquid savings for emergencies',
            poor: 'Low liquidity - prioritize building accessible savings'
        };
        return recommendations[liquidityLevel] || 'Monitor your liquidity position';
    }

    // Generate user profile from real Firestore data (keeping original method for fallback)
    async generateOriginalUserProfile() {
        try {
            if (!this.currentUser) {
                devLog('⚠️ User not authenticated, using fallback profile');
                return this.generateFallbackProfile();
            }

            devLog('📊 Fetching real user data from Firestore...');
            
            // Get actual user data from Firestore with error handling
            let userData = null;
            let transactions = [];
            let bankAccounts = [];

            try {
                const results = await Promise.allSettled([
                    getUserData(this.currentUser.uid),
                    getUserTransactions(this.currentUser.uid),
                    getUserBankAccounts(this.currentUser.uid)
                ]);

                userData = results[0].status === 'fulfilled' ? results[0].value : null;
                transactions = results[1].status === 'fulfilled' ? results[1].value || [] : [];
                bankAccounts = results[2].status === 'fulfilled' ? results[2].value || [] : [];

                devLog('📊 Real data fetched:', { userData, transactions: transactions.length, bankAccounts: bankAccounts.length });
            } catch (firestoreError) {
                prodError('❌ Error fetching Firestore data:', firestoreError);
                devLog('⚠️ Falling back to empty profile due to Firestore error');
                return this.generateFallbackProfile();
            }

            // Calculate financial metrics from real transaction data
            const financialMetrics = this.calculateFinancialMetrics(transactions, bankAccounts);
            
            // Extract comprehensive user profile
            const profile = {
                // Basic info
                age: userData?.age || this.currentAge,
                name: userData?.name || 'User',
                location: userData?.location || 'Philippines',
                
                // Financial data from real transactions
                monthlyIncome: financialMetrics.monthlyIncome,
                monthlyExpenses: financialMetrics.monthlyExpenses,
                currentSavings: financialMetrics.totalSavings,
                savingsRate: financialMetrics.savingsRate,
                
                // Employment info
                employmentType: userData?.employmentType || 'employed',
                industry: userData?.industry || 'General',
                monthlyIncomeFromProfile: userData?.monthlyIncome || financialMetrics.monthlyIncome,
                
                // Personal info
                dependents: userData?.dependents || 0,
                maritalStatus: userData?.maritalStatus || 'single',
                
                // Financial preferences
                lifeStage: this.determineLifeStage(userData?.age || this.currentAge),
                riskTolerance: userData?.riskTolerance || 'moderate',
                primaryGoals: userData?.primaryGoals || ['emergency_fund', 'retirement'],
                
                // Insurance and investments
                hasInsurance: userData?.hasInsurance || false,
                hasInvestments: financialMetrics.hasInvestments,
                investmentExperience: userData?.investmentExperience || 'beginner',
                
                // Financial knowledge
                financialKnowledge: userData?.financialKnowledge || 'beginner',
                
                // Data metrics
                transactionCount: transactions.length,
                accountCount: bankAccounts.length,
                dataQuality: this.calculateOriginalDataQuality(transactions, bankAccounts, userData),
                
                // Raw data for AI analysis
                recentTransactions: transactions.slice(0, 20), // Last 20 transactions
                spendingCategories: financialMetrics.spendingCategories,
                incomePattern: financialMetrics.incomePattern
            };

            devLog('✅ Generated comprehensive user profile:', profile);
            return profile;

        } catch (error) {
            prodError('❌ Error generating user profile:', error);
            devLog('⚠️ Falling back to empty profile due to error');
            return this.generateFallbackProfile();
        }
    }

    // Generate minimal fallback profile when no data is available
    generateFallbackProfile() {
        return {
            age: this.currentAge,
            name: 'User',
            monthlyIncome: 0,
            monthlyExpenses: 0,
            currentSavings: 0,
            savingsRate: 0,
            employmentType: 'unknown',
            industry: 'General',
            dependents: 0,
            lifeStage: this.determineLifeStage(this.currentAge),
            riskTolerance: 'conservative',
            primaryGoals: [],
            hasInsurance: false,
            hasInvestments: false,
            location: 'Philippines',
            financialKnowledge: 'beginner',
            transactionCount: 0,
            accountCount: 0,
            dataQuality: { score: 0, level: 'no_data', factors: ['No financial data available'] },
            isUsingFallback: true
        };
    }

    // Call Gemini AI for personalized financial analysis
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
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            devLog('Error calling Gemini AI:', error);
            return null;
        }
    }

    // Create AI-powered financial plan
    // Create comprehensive financial plan using enhanced Gemini AI
    async createFinancialPlan(profile) {
        try {
            devLog('🤖 Creating comprehensive financial plan with Gemini AI...');
            
            if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
                devWarn('Gemini API key not configured, using fallback plan');
                return this.createFallbackPlan(profile);
            }
            
            const aiPrompt = `
Ikaw ay isang world-class Filipino Financial Planner na may expertise sa Philippine market at culture. Analyze ang detailed financial situation ng user at gumawa ng comprehensive, personalized financial plan.

DETAILED USER PROFILE:
- Personal: Age ${profile.age}, ${profile.maritalStatus}, ${profile.dependents} dependents
- Financial: Monthly Income ₱${profile.monthlyIncome.toLocaleString()}, Monthly Expenses ₱${profile.monthlyExpenses.toLocaleString()}
- Savings: Current ₱${profile.currentSavings.toLocaleString()} (${(profile.savingsRate * 100).toFixed(1)}% rate)
- Risk Profile: ${profile.riskTolerance}, Investment Experience: ${profile.investmentExperience}
- Employment: ${profile.employmentType} in ${profile.industry}
- Goals: ${profile.primaryGoals?.join(', ') || 'Financial security'}
- Data Quality: ${profile.transactionCount} transactions, ${profile.accountCount} accounts

SPENDING ANALYSIS:
${Object.entries(profile.spendingCategories || {}).map(([cat, amount]) => 
    `- ${cat}: ₱${amount.toLocaleString()} (${((amount / profile.monthlyExpenses) * 100).toFixed(1)}%)`
).join('\n')}

RECENT INCOME PATTERN:
${profile.incomePattern?.slice(0, 3).map(income => 
    `- ${income.source}: ₱${income.amount.toLocaleString()}`
).join('\n') || '- Primary income source'}

Gumawa ng COMPLETE, DETAILED JSON response na may:

{
  "executiveSummary": {
    "financialHealthScore": 85,
    "primaryRecommendation": "Main action na dapat gawin",
    "timeToFinancialFreedom": "15 years",
    "criticalInsights": ["Insight 1", "Insight 2", "Insight 3"]
  },
  "lifestageAnalysis": {
    "currentStage": "Detailed life stage assessment",
    "stageDescription": "Comprehensive description ng current situation",
    "keyPriorities": ["Priority 1", "Priority 2", "Priority 3", "Priority 4"],
    "recommendedSavingsRate": 0.25,
    "filipinoFamilyContext": "How Filipino family dynamics affect financial planning",
    "culturalConsiderations": ["Cultural factor 1", "Cultural factor 2"]
  },
  "investmentStrategy": {
    "riskProfile": "Based sa age, income, at experience",
    "portfolioAllocation": {
      "emergencyFund": 0.25,
      "conservativeInvestments": 0.35,
      "moderateRiskInvestments": 0.25,
      "growthInvestments": 0.15
    },
    "recommendedInvestments": [
      {
        "name": "Specific Philippine investment",
        "type": "Category (stocks, bonds, REIT, etc)",
        "allocation": 0.20,
        "platform": "Available platform in PH",
        "expectedReturn": "Realistic return range",
        "minimumAmount": 5000,
        "filipinoAdvantage": "Why this works for Filipinos",
        "riskLevel": "low/medium/high"
      }
    ],
    "investmentTimeline": {
      "immediate": "What to invest now",
      "within6months": "Next investment steps",
      "within1year": "Long-term investment plan"
    }
  },
  "careerDevelopment": {
    "currentAssessment": "Assessment ng current career position",
    "incomeGrowthPotential": "realistic/high/limited",
    "projectedIncome": {
      "year1": ${Math.round(profile.monthlyIncome * 12 * 1.1)},
      "year3": ${Math.round(profile.monthlyIncome * 12 * 1.3)},
      "year5": ${Math.round(profile.monthlyIncome * 12 * 1.6)},
      "year10": ${Math.round(profile.monthlyIncome * 12 * 2.2)}
    },
    "skillDevelopmentPlan": ["Specific skill 1", "Specific skill 2", "Specific skill 3"],
    "careerMilestones": [
      {
        "timeframe": "1-2 years",
        "target": "Specific career goal",
        "incomeTarget": ${Math.round(profile.monthlyIncome * 1.2)},
        "actionSteps": ["Action 1", "Action 2"]
      }
    ],
    "filipinoCareerAdvice": "Culture-specific career guidance"
  },
  "lifeGoalsRoadmap": {
    "shortTerm": {
      "timeframe": "6 months - 2 years",
      "goals": ["Specific achievable goal 1", "Specific achievable goal 2"],
      "financialTargets": ["Target 1", "Target 2"],
      "actionPlan": ["Concrete step 1", "Concrete step 2"],
      "totalTargetAmount": ${Math.round(profile.monthlyIncome * 6)}
    },
    "mediumTerm": {
      "timeframe": "2-7 years",
      "goals": ["Major goal 1", "Major goal 2"],
      "financialTargets": ["Target 1", "Target 2"],
      "actionPlan": ["Strategic step 1", "Strategic step 2"],
      "totalTargetAmount": ${Math.round(profile.monthlyIncome * 24)}
    },
    "longTerm": {
      "timeframe": "7-20 years",
      "goals": ["Life goal 1", "Life goal 2"],
      "financialTargets": ["Target 1", "Target 2"],
      "actionPlan": ["Long-term step 1", "Long-term step 2"],
      "totalTargetAmount": ${Math.round(profile.monthlyIncome * 120)}
    }
  },
  "actionPlan": {
    "immediate": ["Do this within 1 month", "Do this within 1 month"],
    "within3months": ["3-month goal 1", "3-month goal 2"],
    "within6months": ["6-month milestone 1", "6-month milestone 2"],
    "within1year": ["Annual target 1", "Annual target 2"]
  }
}

CRITICAL REQUIREMENTS:
1. Gumawa ng REALISTIC recommendations based sa actual income at expenses
2. Consider Philippine market conditions at available investments
3. Integrate Filipino cultural values at family priorities
4. Provide SPECIFIC, ACTIONABLE steps - hindi generic advice
5. Use actual numbers from user profile - hindi placeholder values
6. Consider user's actual risk tolerance at investment experience
7. Make recommendations achievable within user's current financial capacity

Maging creative at comprehensive sa analysis, pero realistic sa recommendations!
`;

            const aiResponse = await this.callGeminiAI(aiPrompt);
            
            let aiPlan = null;
            if (aiResponse) {
                try {
                    // Extract JSON from AI response
                    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        aiPlan = JSON.parse(jsonMatch[0]);
                    }
                } catch (error) {
                    devLog('Error parsing AI response:', error);
                }
            }
            
            // Create comprehensive plan with AI insights or fallback
            const plan = {
                userProfile: profile,
                aiInsights: aiPlan || this.createFallbackPlan(profile),
                financialRoadmap: aiPlan?.lifeGoalsRoadmap || this.createFinancialRoadmap(profile),
                investmentStrategy: aiPlan?.investmentStrategy || this.developInvestmentStrategy(profile),
                careerProjection: aiPlan?.careerDevelopment || this.projectCareerPath(profile),
                familyBalancing: aiPlan?.familyFinancialPlanning || this.analyzeLifeBalance(profile),
                generatedAt: new Date().toISOString(),
                planType: aiPlan ? 'ai_comprehensive' : 'fallback',
                planVersion: '2.0'
            };

            devLog('✅ Comprehensive financial plan created successfully');
            return plan;

        } catch (error) {
            prodError('❌ Error creating financial plan:', error);
            return this.createFallbackPlan(profile);
        }
    }

    // Create fallback plan when AI is not available
    createFallbackPlan(profile) {
        return {
            financialRoadmap: this.createFinancialRoadmap(profile),
            investmentStrategy: this.developInvestmentStrategy(profile),
            careerProjection: this.projectCareerPath(profile),
            familyBalancing: this.analyzeLifeBalance(profile),
            aiInsights: null,
            dataQuality: profile.dataQuality,
            planType: 'fallback'
        };
    }

    // Extract key insights from AI response
    extractAIInsights(aiResponse) {
        const insights = [];
        
        // Look for key phrases in AI response
        if (aiResponse.includes('emergency fund')) {
            insights.push('🚨 Emergency fund prioritization recommended');
        }
        if (aiResponse.includes('investment') || aiResponse.includes('invest')) {
            insights.push('📈 Investment strategy customized to your profile');
        }
        if (aiResponse.includes('career') || aiResponse.includes('income')) {
            insights.push('🚀 Career growth opportunities identified');
        }
        if (aiResponse.includes('family') || aiResponse.includes('dependent')) {
            insights.push('👨‍👩‍👧‍👦 Family financial planning considered');
        }

        return insights;
    }

    // Fallback methods (used when AI is unavailable)
    createFinancialRoadmap(profile) {
        const currentYear = new Date().getFullYear();
        const roadmap = [];

        // Emergency Fund
        const emergencyTarget = profile.monthlyExpenses * 6;
        roadmap.push({
            year: currentYear + 1,
            age: profile.age + 1,
            goal: "Emergency Fund Complete",
            target: emergencyTarget,
            strategy: `Save ₱${Math.round(emergencyTarget/12).toLocaleString()}/month using automated transfers`,
            priority: "high"
        });

        // Investment Start
        const investmentTarget = profile.monthlyIncome * 12;
        roadmap.push({
            year: currentYear + 2,
            age: profile.age + 2,
            goal: "Investment Portfolio Launch",
            target: investmentTarget,
            strategy: `Invest ₱${Math.round(profile.monthlyIncome * 0.2).toLocaleString()}/month in index funds`,
            priority: "high"
        });

        // Major Goal (House/Business)
        const majorTarget = profile.monthlyIncome * 24;
        roadmap.push({
            year: currentYear + 5,
            age: profile.age + 5,
            goal: profile.age < 35 ? "House Down Payment" : "Business Capital",
            target: majorTarget,
            strategy: `Combine savings and investment returns for major milestone`,
            priority: "medium"
        });

        return roadmap;
    }

    developInvestmentStrategy(profile) {
        const monthlyInvestment = Math.round(profile.monthlyIncome * 0.20);
        
        // Determine stage based on actual data
        let stage = 'beginner';
        if (profile.hasInvestments || profile.currentSavings > 500000) {
            stage = 'intermediate';
        }
        if (profile.currentSavings > 2000000 || profile.investmentExperience === 'advanced') {
            stage = 'advanced';
        }

        // Basic fallback investment info (when AI is not available)
        const stageInfo = {
            beginner: {
                platforms: ["CIMB Bank", "ING Bank", "COL Financial"],
                instruments: ["Digital Banks", "Time Deposits", "Index Funds"],
                expectedReturn: "4-8%"
            },
            intermediate: {
                platforms: ["COL Financial", "BPI Trade", "First Metro Securities"],
                instruments: ["Stock Market", "Index Funds", "Real Estate"],
                expectedReturn: "6-12%"
            },
            advanced: {
                platforms: ["BDO Nomura", "Philequity", "AREIT"],
                instruments: ["Blue Chip Stocks", "REITs", "International Funds"],
                expectedReturn: "8-15%"
            }
        };
        
        return {
            stage: stage,
            monthlyBudget: monthlyInvestment,
            assetAllocation: this.calculateAssetAllocation(profile),
            platforms: stageInfo[stage].platforms,
            instruments: stageInfo[stage].instruments,
            expectedReturn: stageInfo[stage].expectedReturn,
            reasoning: `Based on your ${profile.dataQuality.level} data quality and ${stage} investor profile`
        };
    }

    calculateAssetAllocation(profile) {
        const age = profile.age;
        const riskTolerance = profile.riskTolerance;
        
        // Base allocation on age (rule of 100 minus age for stocks)
        let stockPercentage = Math.max(20, 100 - age);
        
        // Adjust for risk tolerance
        if (riskTolerance === 'conservative') {
            stockPercentage -= 20;
        } else if (riskTolerance === 'aggressive') {
            stockPercentage += 10;
        }
        
        stockPercentage = Math.max(20, Math.min(80, stockPercentage));
        
        return {
            stocks: stockPercentage,
            bonds: Math.round((100 - stockPercentage) * 0.6),
            realEstate: Math.round((100 - stockPercentage) * 0.3),
            cash: Math.round((100 - stockPercentage) * 0.1)
        };
    }

    projectCareerPath(profile) {
        const projections = [];
        const currentIncome = profile.monthlyIncome;
        
        // Industry-specific growth rates
        const growthRates = {
            'IT/Technology': 0.12,
            'Finance/Banking': 0.08,
            'Healthcare': 0.07,
            'Education': 0.05,
            'Government': 0.04,
            'Business/Sales': 0.09
        };
        
        const growthRate = growthRates[profile.industry] || 0.07;
        
        for (let i = 5; i <= 20; i += 5) {
            const futureAge = profile.age + i;
            const futureIncome = Math.round(currentIncome * Math.pow(1 + growthRate, i));
            
            projections.push({
                year: new Date().getFullYear() + i,
                age: futureAge,
                income: futureIncome,
                level: this.determineCareerLevel(futureAge)
            });
        }
        
        return {
            projections,
            recommendations: [
                `Focus on ${profile.industry} skill development`,
                `Target ${Math.round(growthRate * 100)}% annual income growth`,
                `Consider leadership roles by age ${profile.age + 10}`
            ]
        };
    }

    determineCareerLevel(age) {
        if (age < 30) return "Junior Level";
        if (age < 35) return "Senior Level";
        if (age < 40) return "Lead/Supervisory Level";
        if (age < 45) return "Management Level";
        return "Executive Level";
    }

    analyzeLifeBalance(profile) {
        const monthlyIncome = profile.monthlyIncome;
        const dependents = profile.dependents;
        
        // Adjust allocation based on dependents
        const personalPercentage = dependents > 0 ? 0.25 : 0.35;
        const familyPercentage = dependents > 0 ? 0.20 : 0.10;
        
        const personalGoals = Math.round(monthlyIncome * personalPercentage);
        const familyObligations = Math.round(monthlyIncome * familyPercentage);
        
        return {
            personalGoals,
            familyObligations,
            balanceScore: this.calculateBalanceScore(personalGoals, familyObligations, profile),
            recommendations: [
                `Allocate ₱${personalGoals.toLocaleString()}/month for personal goals`,
                `Budget ₱${familyObligations.toLocaleString()}/month for family obligations`,
                dependents > 0 ? 'Consider family insurance coverage' : 'Build personal wealth foundation first'
            ]
        };
    }

    calculateBalanceScore(personalGoals, familyObligations, profile) {
        let score = 70; // Base score
        
        // Adjust based on savings rate
        if (profile.savingsRate > 0.25) score += 15;
        else if (profile.savingsRate > 0.15) score += 10;
        else if (profile.savingsRate < 0.05) score -= 20;
        
        // Adjust based on emergency fund
        const emergencyFundMonths = profile.currentSavings / profile.monthlyExpenses;
        if (emergencyFundMonths >= 6) score += 15;
        else if (emergencyFundMonths >= 3) score += 5;
        else score -= 10;
        
        return Math.max(0, Math.min(100, score));
    }

    showState(stateName) {
        const states = ['loading-state', 'content-state', 'empty-state'];
        
        states.forEach(state => {
            const element = document.getElementById(state);
            if (element) {
                if (state === stateName) {
                    element.style.display = 'block';
                    element.classList.remove('hidden');
                } else {
                    element.style.display = 'none';
                    element.classList.add('hidden');
                }
            }
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async updateLoadingMessage(message) {
        const loadingText = this.elements.loadingState?.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
        await this.delay(800);
    }

    renderTestContent() {
        if (this.elements.financialTimeline) {
            this.elements.financialTimeline.innerHTML = `
                <div class="timeline-event">
                    <div class="timeline-date">2025 (Age 29)</div>
                    <div class="timeline-title">Emergency Fund Complete</div>
                    <div class="timeline-description">
                        <p><strong>Goal:</strong> Build 6-month emergency fund</p>
                        <p><strong>Target:</strong> ₱210,000</p>
                        <p><strong>Strategy:</strong> Automated savings + Side hustle</p>
                    </div>
                </div>
            `;
        }

        if (this.elements.investmentContent) {
            this.elements.investmentContent.innerHTML = `
                <h3>Your Investment Stage: Paglaki (Growth)</h3>
                <p><strong>Monthly Investment Budget:</strong> ₱10,000</p>
                <h4>Recommended Asset Allocation:</h4>
                <ul>
                    <li>Stocks: 60%</li>
                    <li>Bonds: 25%</li>
                    <li>Real Estate: 10%</li>
                    <li>Cash: 5%</li>
                </ul>
            `;
        }

        if (this.elements.careerContent) {
            this.elements.careerContent.innerHTML = `
                <h3>Career Projection</h3>
                <ul>
                    <li><strong>2029</strong> (Age 33): ₱66,000/month - Senior Level</li>
                    <li><strong>2034</strong> (Age 38): ₱89,000/month - Lead Level</li>
                </ul>
            `;
        }

        if (this.elements.balancingActContent) {
            this.elements.balancingActContent.innerHTML = `
                <h3>Balance Score: 75/100</h3>
                <p>Personal Goals: ₱15,000/month | Family: ₱10,000/month</p>
            `;
        }
    }

    renderPlan(plan, profile) {
        devLog('🎨 Rendering personalized financial plan...');
        
        // Check if plan and profile are valid
        if (!plan) {
            devLog('❌ Plan is undefined, cannot render');
            return;
        }
        
        if (!profile) {
            devLog('❌ Profile is undefined, cannot render');
            return;
        }
        
        devLog('📊 Plan data:', plan);
        devLog('👤 Profile data:', profile);
        
        // Render data quality indicator
        if (profile.dataQuality) {
            this.renderDataQuality(profile);
        }
        
        // Render AI insights if available
        if (plan.aiInsights && plan.aiInsights.length > 0) {
            this.renderAIInsights(plan.aiInsights);
        }
        
        // Render roadmap
        if (this.elements.financialTimeline && plan.financialRoadmap && Array.isArray(plan.financialRoadmap)) {
            let timelineHTML = '';
            plan.financialRoadmap.forEach(milestone => {
                if (milestone && milestone.year && milestone.age && milestone.goal) {
                    timelineHTML += `
                        <div class="timeline-event">
                            <div class="timeline-date">${milestone.year} (Age ${milestone.age})</div>
                            <div class="timeline-title">${milestone.goal}</div>
                            <div class="timeline-description">
                                <p><strong>Target:</strong> ₱${milestone.target ? milestone.target.toLocaleString() : 'TBD'}</p>
                                <p><strong>Strategy:</strong> ${milestone.strategy || 'To be determined'}</p>
                                <span class="priority-badge priority-${milestone.priority || 'medium'}">${(milestone.priority || 'medium')} priority</span>
                            </div>
                        </div>
                    `;
                }
            });
            this.elements.financialTimeline.innerHTML = timelineHTML;
        }

        // Render investment strategy
        if (this.elements.investmentContent && plan.investmentStrategy) {
            const strategy = plan.investmentStrategy;
            let strategyHTML = `<h3>Investment Strategy: ${strategy.stage ? strategy.stage.charAt(0).toUpperCase() + strategy.stage.slice(1) : 'Beginner'}</h3>`;
            
            if (strategy.monthlyBudget) {
                strategyHTML += `<p><strong>Monthly Budget:</strong> ₱${strategy.monthlyBudget.toLocaleString()}</p>`;
            }
            
            if (strategy.reasoning) {
                strategyHTML += `<p class="ai-insight">💡 ${strategy.reasoning}</p>`;
            }
            
            if (strategy.assetAllocation) {
                strategyHTML += `
                    <h4>Asset Allocation:</h4>
                    <div class="allocation-bars">
                        <div class="allocation-item">
                            <span>Stocks: ${strategy.assetAllocation.stocks || 0}%</span>
                            <div class="progress-bar"><div class="progress-fill" style="width: ${strategy.assetAllocation.stocks || 0}%"></div></div>
                        </div>
                        <div class="allocation-item">
                            <span>Bonds: ${strategy.assetAllocation.bonds || 0}%</span>
                            <div class="progress-bar"><div class="progress-fill" style="width: ${strategy.assetAllocation.bonds || 0}%"></div></div>
                        </div>
                        <div class="allocation-item">
                            <span>Real Estate: ${strategy.assetAllocation.realEstate || 0}%</span>
                            <div class="progress-bar"><div class="progress-fill" style="width: ${strategy.assetAllocation.realEstate || 0}%"></div></div>
                        </div>
                        <div class="allocation-item">
                            <span>Cash: ${strategy.assetAllocation.cash || 0}%</span>
                            <div class="progress-bar"><div class="progress-fill" style="width: ${strategy.assetAllocation.cash || 0}%"></div></div>
                        </div>
                    </div>
                `;
            }
            
            if (strategy.platforms && Array.isArray(strategy.platforms)) {
                strategyHTML += `
                    <h4>Recommended Platforms:</h4>
                    <ul>
                        ${strategy.platforms.map(platform => `<li>${platform}</li>`).join('')}
                    </ul>
                `;
            }
            
            if (strategy.expectedReturn) {
                strategyHTML += `<p><strong>Expected Return:</strong> ${strategy.expectedReturn} annually</p>`;
            }
            
            this.elements.investmentContent.innerHTML = strategyHTML;
        }

        // Render career projection
        if (this.elements.careerContent && plan.careerProjection) {
            const career = plan.careerProjection;
            let careerHTML = '<h3>Career Growth Projection</h3>';
            
            if (career.projections && Array.isArray(career.projections)) {
                careerHTML += '<ul>';
                career.projections.forEach(projection => {
                    if (projection && projection.year && projection.age && projection.income && projection.level) {
                        careerHTML += `
                            <li><strong>${projection.year}</strong> (Age ${projection.age}): 
                            ₱${projection.income.toLocaleString()}/month - ${projection.level}</li>
                        `;
                    }
                });
                careerHTML += '</ul>';
            }
            
            if (career.recommendations && Array.isArray(career.recommendations)) {
                careerHTML += '<h4>Career Recommendations:</h4><ul>';
                career.recommendations.forEach(rec => {
                    if (rec) {
                        careerHTML += `<li>${rec}</li>`;
                    }
                });
                careerHTML += '</ul>';
            }
            
            this.elements.careerContent.innerHTML = careerHTML;
        }

        // Render life balance
        if (this.elements.balancingActContent && plan.familyBalancing) {
            const balance = plan.familyBalancing;
            let balanceHTML = `<h3>Financial Balance Score: ${balance.balanceScore || 70}/100</h3>`;
            
            if (balance.personalGoals !== undefined && balance.familyObligations !== undefined) {
                balanceHTML += `
                    <div class="balance-allocation">
                        <div class="balance-item">
                            <h4>Personal Goals</h4>
                            <p class="amount">₱${balance.personalGoals.toLocaleString()}/month</p>
                        </div>
                        <div class="balance-item">
                            <h4>Family Obligations</h4>
                            <p class="amount">₱${balance.familyObligations.toLocaleString()}/month</p>
                        </div>
                    </div>
                `;
            }
            
            if (balance.recommendations && Array.isArray(balance.recommendations)) {
                balanceHTML += '<h4>Recommendations:</h4><ul>';
                balance.recommendations.forEach(rec => {
                    if (rec) {
                        balanceHTML += `<li>${rec}</li>`;
                    }
                });
                balanceHTML += '</ul>';
            }
            
            this.elements.balancingActContent.innerHTML = balanceHTML;
        }
    }

    renderDataQuality(profile) {
        if (!this.elements.financialTimeline || !profile || !profile.dataQuality) {
            devLog('⚠️ Cannot render data quality: missing elements or data');
            return;
        }
        
        const dataQuality = profile.dataQuality;
        const qualityHTML = `
            <div class="data-quality-indicator">
                <h3>📊 Your Financial Data Analysis</h3>
                <div class="quality-score quality-${dataQuality.level || 'demo'}">
                    <span class="score">${dataQuality.score || 50}/100</span>
                    <span class="level">${(dataQuality.level || 'demo').toUpperCase()}</span>
                </div>
                <div class="quality-factors">
                    ${(dataQuality.factors || ['Demo data']).map(factor => `<span class="factor">✓ ${factor}</span>`).join('')}
                </div>
                <p class="data-note">
                    ${profile.isUsingFallback ? 
                        '⚠️ No financial data available. Add transactions and accounts for personalized recommendations.' : 
                        '✅ Recommendations based on your real financial data.'
                    }
                </p>
            </div>
        `;
        
        this.elements.financialTimeline.innerHTML = qualityHTML + (this.elements.financialTimeline.innerHTML || '');
    }

    renderAIInsights(insights) {
        if (!this.elements.financialTimeline || !insights || !Array.isArray(insights) || insights.length === 0) {
            devLog('⚠️ Cannot render AI insights: missing elements or data');
            return;
        }
        
        const insightsHTML = `
            <div class="ai-insights">
                <h3>🤖 AI-Powered Insights</h3>
                <div class="insights-list">
                    ${insights.filter(insight => insight).map(insight => `<div class="insight-item">${insight}</div>`).join('')}
                </div>
            </div>
        `;
        
        this.elements.financialTimeline.innerHTML = (this.elements.financialTimeline.innerHTML || '') + insightsHTML;
    }

    async start() {
        try {
            devLog('🚀 Starting Personalized Pera Planner AI...');
            devLog('🔍 URL parameters:', window.location.search);
            devLog('🔧 Test mode:', this.config.testMode);
            devLog('🔧 Debug mode:', this.config.debugMode);
            devLog('🔧 Simple mode:', this.config.simpleMode);
            
            this.showState('loading-state');
            
            // Test mode - quick rendering
            if (this.config.testMode) {
                devLog('🧪 TEST MODE: Quick rendering...');
                await this.updateLoadingMessage('Test mode activated...');
                await this.delay(2000);
                this.renderTestContent();
                this.showState('content-state');
                devLog('✅ Test mode completed');
                return;
            }

            // Simple mode - basic content
            if (this.config.simpleMode) {
                devLog('🔧 SIMPLE MODE: Basic content...');
                await this.updateLoadingMessage('Simple mode activated...');
                await this.delay(1000);
                this.renderTestContent();
                this.showState('content-state');
                devLog('✅ Simple mode completed');
                return;
            }

            // Debug mode - empty profile
            if (this.config.debugMode) {
                devLog('🔧 DEBUG MODE: Using empty profile...');
                await this.updateLoadingMessage('Debug mode: Using empty profile...');
                await this.delay(1000);
                this.userProfile = this.generateFallbackProfile();
                this.financialPlan = await this.createFinancialPlan(this.userProfile);
                this.renderPlan(this.financialPlan, this.userProfile);
                this.showState('content-state');
                devLog('✅ Debug mode completed');
                return;
            }

            // Wait for authentication
            devLog('🔑 Setting up authentication...');
            await this.updateLoadingMessage('Authenticating user...');
            await this.setupAuthListener();
            
            devLog('✅ Authentication setup complete, user:', this.currentUser ? 'authenticated' : 'not authenticated');

            // Generate user profile from real data
            await this.updateLoadingMessage('Analyzing your financial data...');
            this.userProfile = await this.generateUserProfile();
            
            devLog('📊 User profile generated:', this.userProfile);
            
            // Check if we have sufficient data
            if (!this.userProfile.isUsingFallback && 
                this.userProfile.transactionCount === 0 && 
                this.userProfile.accountCount === 0) {
                devLog('⚠️ Insufficient data, showing empty state');
                this.showState('empty-state');
                return;
            }

            devLog('💡 Creating financial plan...');
            // Create AI-powered financial plan
            await this.updateLoadingMessage('Creating personalized financial plan...');
            this.financialPlan = await this.createFinancialPlan(this.userProfile);
            
            devLog('🎨 Rendering plan...');
            // Render the personalized plan
            await this.updateLoadingMessage('Rendering your financial roadmap...');
            this.renderPlan(this.financialPlan, this.userProfile);
            
            this.showState('content-state');
            this.planningComplete = true;
            
            devLog('✅ Personalized Pera Planner AI complete!');
            
        } catch (error) {
            prodError('❌ Error in Pera Planner:', error);
            devLog('📍 Error stack:', error.stack);
            
            // Show error message and fallback to empty state
            await this.updateLoadingMessage('Error occurred. Please try debug mode.');
            await this.delay(2000);
            this.showState('empty-state');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    devLog('🚀 Pera Planner DOM loaded, initializing...');
    try {
        const peraPlanner = new PeraPlannerAI();
        
        // Add timeout fallback
        const timeoutId = setTimeout(() => {
            devLog('⏰ Pera Planner timeout - showing fallback');
            const loadingState = document.getElementById('loading-state');
            const emptyState = document.getElementById('empty-state');
            if (loadingState) loadingState.style.display = 'none';
            if (emptyState) {
                emptyState.style.display = 'block';
                emptyState.classList.remove('hidden');
            }
        }, 15000);
        
        peraPlanner.start().then(() => {
            clearTimeout(timeoutId);
            devLog('✅ Pera Planner completed successfully');
        }).catch((error) => {
            clearTimeout(timeoutId);
            prodError('❌ Pera Planner failed:', error);
        });
        
    } catch (error) {
        prodError('❌ Error initializing Pera Planner:', error);
        const loadingState = document.getElementById('loading-state');
        const emptyState = document.getElementById('empty-state');
        if (loadingState) loadingState.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.classList.remove('hidden');
        }
    }
});
