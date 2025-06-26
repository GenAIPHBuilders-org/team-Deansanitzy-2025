/**
 * Debt Demolisher AI - Autonomous Debt Elimination Agent
 * Features: Debt portfolio analysis, Repayment strategy simulation (Avalanche, Snowball), Automated plan execution & monitoring.
 */

import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { BaseAgent } from "./BaseAgent.js";
import { GEMINI_API_KEY, GEMINI_MODEL, OFFLINE_MODE, configStatus } from "../js/config.js";
import { getUserTransactions, getUserBankAccounts } from "../js/firestoredb.js";

// API configuration for potential future use (e.g., financial data aggregation APIs)
const API_CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    RATE_LIMIT_WINDOW: 60000, // 1 minute
    MAX_REQUESTS_PER_WINDOW: 10,
    BACKOFF_MULTIPLIER: 1.5
};

/**
 * StrategyEngine: A pure logic module for simulating debt payoff scenarios.
 * It is self-contained and does not interact with the DOM.
 */
class StrategyEngine {
    constructor(debtAccounts, extraPayment = 0) {
        // Deep copy accounts to avoid mutating the original data during simulation
        this.accounts = JSON.parse(JSON.stringify(debtAccounts));
        this.extraPayment = extraPayment;
    }

    /**
     * Runs a full debt payoff simulation using a specified strategy.
     * @param {'avalanche' | 'snowball'} strategy The strategy to use.
     * @returns {object} An object containing the simulation results.
     */
    simulate(strategy) {
        let sortedAccounts = this.getSortedAccounts(strategy);
        
        let months = 0;
        let totalInterestPaid = 0;
        const paymentSchedule = [];

        // Main simulation loop
        while (sortedAccounts.some(acc => acc.balance > 0) && months < 600) { // Safety break at 50 years
            months++;
            let monthInterest = 0;
            let snowballPayment = this.extraPayment;
            
            // 1. Accrue interest and collect minimum payments for snowball
            sortedAccounts.forEach(acc => {
                if (acc.balance > 0) {
                    const monthlyInterest = (acc.balance * (acc.interestRate / 100)) / 12;
                    acc.balance += monthlyInterest;
                    totalInterestPaid += monthlyInterest;
                    monthInterest += monthlyInterest;
                    snowballPayment += acc.minimumPayment;
                }
            });

            // 2. Apply payments
            sortedAccounts.forEach(acc => {
                if (acc.balance > 0) {
                    const payment = Math.min(acc.balance, snowballPayment);
                    acc.balance -= payment;
                    snowballPayment -= payment;
                    if (snowballPayment <= 0.01) return; // End payments if snowball is used up
                }
            });

            // Record monthly progress for charting
            const remainingBalance = sortedAccounts.reduce((sum, acc) => sum + acc.balance, 0);
            paymentSchedule.push({ month: months, balance: remainingBalance });
            
            if (remainingBalance <= 0) break;
        }

        return {
            name: strategy === 'avalanche' ? 'Debt Avalanche' : 'Debt Snowball',
            payoffTimeMonths: months,
            totalInterestPaid: totalInterestPaid,
            paymentSchedule: paymentSchedule,
        };
    }

    /**
     * Sorts accounts based on the chosen strategy.
     * @param {'avalanche' | 'snowball'} strategy The strategy name.
     * @returns {Array} A sorted array of account objects.
     */
    getSortedAccounts(strategy) {
        const accountsToSimulate = this.accounts.filter(acc => acc.balance > 0);
        if (strategy === 'avalanche') {
            // Highest interest rate first
            return accountsToSimulate.sort((a, b) => b.interestRate - a.interestRate);
        } else { // snowball
            // Lowest balance first
            return accountsToSimulate.sort((a, b) => a.balance - b.balance);
        }
    }
}

class DebtDemolisherAI extends BaseAgent {
    constructor() {
        super('debtDemolisher', {
            autonomyLevel: 'high',
            planningHorizon: 'long_term',
            learningRate: 0.2, // Lower learning rate for stable financial planning
            riskTolerance: 'low', // Debt elimination is typically risk-averse
            geminiApiKey: GEMINI_API_KEY,
            geminiModel: GEMINI_MODEL,
            offlineMode: OFFLINE_MODE
        });
        
        // AI State
        this.offlineMode = OFFLINE_MODE;
        this.debtAccounts = [];
        this.repaymentStrategies = {}; // To store strategies like Avalanche, Snowball
        this.activeAlerts = [];
        this.totalDebt = 0;
        this.userIncome = 0;
        this.extraPayment = 5000; // Default extra payment, can be made user-configurable
        
        this.initializeElements();
        this.initializeEventListeners();
    }

    // Initialize DOM elements
    initializeElements() {
        this.elements = {
            loadingState: document.getElementById('loading-state'),
            contentLoaded: document.getElementById('content-loaded'),
            emptyState: document.getElementById('empty-state'),
            // Financial Overview
            totalDebt: document.getElementById('total-debt'),
            debtReductionProgress: document.getElementById('debt-reduction-progress'),
            estimatedPayoffDate: document.getElementById('estimated-payoff-date'),
            interestSaved: document.getElementById('interest-saved'),
            // Card Content
            debtPortfolioContent: document.getElementById('debt-portfolio-content'),
            strategyContent: document.getElementById('strategy-content'),
            alertsContent: document.getElementById('alerts-content'),
        };

        // Validate elements
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Element ${key} not found in DOM`);
            }
        });
    }

    // Initialize event listeners (can be expanded later)
    initializeEventListeners() {
        // Placeholder for future event listeners like strategy toggles
    }

    // Start the Debt Demolisher agent
    async start() {
        try {
            console.log("💣 Starting Debt Demolisher AI...");
            this.showLoadingState();
            
            await this.waitForAuth();
            
            if (!this.currentUser) {
                this.showEmptyState("Please log in to build your debt demolition plan.");
                return;
            }

            await this.waitForInitialization();
            await this.loadUserFinancialData();
            
            if (this.debtAccounts.length === 0) {
                this.showEmptyState("No debt accounts found. Link your liability accounts to get started.");
                return;
            }

            await this.runAnalysis();
            
            this.showContentState();
            console.log("✅ Debt Demolisher AI initialized successfully");
            
        } catch (error) {
            console.error("❌ Error starting Debt Demolisher AI:", error);
            this.showErrorMessage("Failed to initialize the Debt Demolisher. Please try again.");
        }
    }

    async waitForAuth() {
        const auth = getAuth();
        return new Promise((resolve) => {
            auth.onAuthStateChanged((user) => {
                if (user) {
                    this.currentUser = user;
                    resolve();
                } else {
                    // Handle user not logged in
                    resolve();
                }
                });
        });
    }

    async waitForInitialization() {
        // Inherited from BaseAgent, ensures it's ready
        return new Promise(resolve => setTimeout(resolve, 0)); 
    }

    // Load user's financial data, focusing on debts and income
    async loadUserFinancialData() {
        try {
            console.log("📊 Loading user financial data for debt analysis...");
            if (!this.currentUser) return;

            const [transactions, accounts] = await Promise.all([
                getUserTransactions(this.currentUser.uid),
                getUserBankAccounts(this.currentUser.uid)
            ]);

            // Identify income from transactions
            this.userIncome = (transactions || [])
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);

            // Identify debt accounts (e.g., loans, credit cards)
            this.debtAccounts = (accounts || []).filter(acc => 
                acc.category === 'loan' || acc.accountType === 'Credit Card'
            );

            this.totalDebt = this.debtAccounts.reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
            
            console.log(`✅ Loaded ${this.debtAccounts.length} debt accounts with a total of ${this.totalDebt}`);
        } catch (error) {
            console.error("❌ Error loading user financial data:", error);
            throw error;
        }
    }

    // Run the main analysis
    async runAnalysis() {
        console.log("🧠 Running Debt Demolisher Analysis...");

        // Instantiate and run the strategy engine
        const engine = new StrategyEngine(this.debtAccounts, this.extraPayment);
        this.repaymentStrategies.avalanche = engine.simulate('avalanche');
        
        // We need a new instance of the engine for the second simulation
        const engine2 = new StrategyEngine(this.debtAccounts, this.extraPayment);
        this.repaymentStrategies.snowball = engine2.simulate('snowball');

        console.log('Avalanche Plan:', this.repaymentStrategies.avalanche);
        console.log('Snowball Plan:', this.repaymentStrategies.snowball);

        this.updateFinancialOverview();
        this.updateDebtPortfolioUI();
        this.updateStrategyUI();
        this.updateSmartAlertsUI();
    }

    // Update the main metric cards
    updateFinancialOverview() {
        if (this.elements.totalDebt) {
            this.elements.totalDebt.textContent = `₱${this.totalDebt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
        }

        // Use the most efficient strategy (Avalanche) for the main display
        const preferredStrategy = this.repaymentStrategies.avalanche;
        if (!preferredStrategy) return;

        // Calculate original total interest to find savings
        const originalEngine = new StrategyEngine(this.debtAccounts, 0); // No extra payments
        const originalPlan = originalEngine.simulate('snowball'); // Strategy doesn't matter w/ no extra payment
        const interestSaved = originalPlan.totalInterestPaid - preferredStrategy.totalInterestPaid;
        
        const years = Math.floor(preferredStrategy.payoffTimeMonths / 12);
        const months = preferredStrategy.payoffTimeMonths % 12;
        const payoffDate = `${years} yrs, ${months} mos`;

        if (this.elements.debtReductionProgress) this.elements.debtReductionProgress.textContent = '0%'; // Needs real progress tracking later
        if (this.elements.estimatedPayoffDate) this.elements.estimatedPayoffDate.textContent = payoffDate;
        if (this.elements.interestSaved) {
            this.elements.interestSaved.textContent = `₱${interestSaved > 0 ? interestSaved.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '0.00'}`;
        }
    }

    // Display the list of identified debts
    updateDebtPortfolioUI() {
        if (!this.elements.debtPortfolioContent) return;

        let content = this.debtAccounts.map(acc => {
            const icon = acc.type === 'loan' ? 'fa-landmark' : 'fa-credit-card';
            return `
                <div class="recommendation-item">
                    <i class="fas ${icon}"></i>
                    <div class="recommendation-content">
                        <div class="recommendation-title">${acc.name}</div>
                        <div class="recommendation-desc">Balance: ₱${Math.abs(acc.balance).toLocaleString('en-PH')}</div>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.debtPortfolioContent.innerHTML = content || '<p>No debt accounts to display.</p>';
    }

    // Display placeholder for repayment strategies
    updateStrategyUI() {
        if (!this.elements.strategyContent) return;

        const avalanche = this.repaymentStrategies.avalanche;
        const snowball = this.repaymentStrategies.snowball;

        if (!avalanche || !snowball) {
            this.elements.strategyContent.innerHTML = '<p>Could not calculate repayment strategies.</p>';
            return;
        }
        
        const formatMonths = (m) => `${Math.floor(m / 12)}y ${m % 12}m`;
        const formatCurrency = (c) => `₱${c.toLocaleString('en-PH', {maximumFractionDigits: 0})}`;

        const isAvalancheCheaper = avalanche.totalInterestPaid < snowball.totalInterestPaid;

        const content = `
            <div class="strategy-comparison">
                <!-- Avalanche Card -->
                <div class="strategy-card ${isAvalancheCheaper ? 'recommended' : ''}">
                    ${isAvalancheCheaper ? '<div class="recommended-badge"><i class="fas fa-star"></i> Most Savings</div>' : ''}
                    <h4>Debt Avalanche</h4>
                    <p>Focuses on highest interest rate first.</p>
                    <div class="strategy-metrics">
                        <div>
                            <span class="metric-label">Payoff Time</span>
                            <span class="metric-value">${formatMonths(avalanche.payoffTimeMonths)}</span>
                        </div>
                        <div>
                            <span class="metric-label">Total Interest</span>
                            <span class="metric-value">${formatCurrency(avalanche.totalInterestPaid)}</span>
                        </div>
                    </div>
                </div>
                <!-- Snowball Card -->
                <div class="strategy-card ${!isAvalancheCheaper ? 'recommended' : ''}">
                    ${!isAvalancheCheaper ? '<div class="recommended-badge"><i class="fas fa-star"></i> Quickest Wins</div>' : ''}
                    <h4>Debt Snowball</h4>
                    <p>Focuses on smallest balance first.</p>
                    <div class="strategy-metrics">
                        <div>
                            <span class="metric-label">Payoff Time</span>
                            <span class="metric-value">${formatMonths(snowball.payoffTimeMonths)}</span>
                        </div>
                        <div>
                            <span class="metric-label">Total Interest</span>
                            <span class="metric-value">${formatCurrency(snowball.totalInterestPaid)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.elements.strategyContent.innerHTML = content;
    }
    
    // Display relevant alerts for the user's debt situation
    updateSmartAlertsUI() {
        if (!this.elements.alertsContent) return;
        this.activeAlerts = []; // Clear previous alerts

        // Example Alert: High Debt-to-Income Ratio
        if (this.userIncome > 0) {
            const dtiRatio = this.totalDebt / this.userIncome;
            if (dtiRatio > 0.4) { // Threshold for high DTI
                this.activeAlerts.push({
                    title: 'High Debt-to-Income Ratio',
                    desc: `Your debt is high compared to your income (${(dtiRatio * 100).toFixed(0)}%), which could impact your financial health.`,
                    priority: 'high',
                    icon: 'fa-exclamation-triangle'
                });
            }
        }
        
        // Alert to encourage plan personalization
        if(this.debtAccounts.length > 0) {
             this.activeAlerts.push({
                title: 'Review Your Repayment Plan',
                desc: `We've simulated your payoff using an estimated ₱${this.extraPayment.toLocaleString('en-PH')} extra per month. Adjust this to personalize your forecast.`,
                priority: 'medium',
                icon: 'fa-cogs'
            });
        }
        
        const alertsContent = this.activeAlerts.map(alert => this.renderAlert(alert.title, alert.desc, alert.priority, alert.icon)).join('');
        this.elements.alertsContent.innerHTML = alertsContent || this.renderAlert('All Clear!', 'No urgent debt alerts for you right now.', 'low', 'fa-check-circle');
    }

    renderAlert(title, desc, priority, icon = 'fa-exclamation-circle') {
        const priorityClasses = { high: 'severity-high', medium: 'severity-medium', low: 'severity-low' };
        return `
            <div class="alert-item ${priorityClasses[priority]}">
                <i class="fas ${icon} alert-icon"></i>
                <div class="alert-content">
                    <div class="alert-title">${title}</div>
                    <div class="alert-desc">${desc}</div>
                </div>
            </div>
        `;
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
        // In a real app, you'd show this in the UI
        if(this.elements.alertsContent) {
            this.elements.alertsContent.innerHTML = this.renderAlert('Error', message, 'high');
        }
        this.showContentState(); // Show content area so error is visible
    }
}

// Initialize and start the agent
const debtDemolisher = new DebtDemolisherAI();
debtDemolisher.start().catch(console.error);

