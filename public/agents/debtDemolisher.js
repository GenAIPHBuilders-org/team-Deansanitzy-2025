/**
 * Debt Demolisher AI - Autonomous Debt Elimination Agent
 * Features: Debt portfolio analysis, Repayment strategy simulation (Avalanche, Snowball), Automated plan execution & monitoring.
 */

import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { BaseAgent } from "./BaseAgent.js";
import { GEMINI_API_KEY, GEMINI_MODEL, OFFLINE_MODE, configStatus } from "../js/config.js";
import { getUserTransactions, getUserBankAccounts } from "../js/firestoredb.js";
import { callGeminiAI } from "../js/agentCommon.js";

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
        this.userIncome = 0; // Default or fetched value
        this.extraPayment = 5000; // Default or user-defined value
        
        this.initializeElements();
        this.initializeEventListeners();
    }

    // Initialize DOM elements
    initializeElements() {
        this.elements = {
            loadingState: document.getElementById('loading-state'),
            emptyState: document.getElementById('empty-state'),
            contentLoaded: document.getElementById('content-loaded'),
            totalDebt: document.getElementById('total-debt'),
            debtReductionProgress: document.getElementById('debt-reduction-progress'),
            estimatedPayoffDate: document.getElementById('estimated-payoff-date'),
            interestSaved: document.getElementById('interest-saved'),
            debtPortfolioContent: document.getElementById('debt-portfolio-content'),
            strategyContent: document.getElementById('strategy-content'),
            insightsContent: document.getElementById('insights-content'),
            toast: document.getElementById('toast-notification'),
            toastMessage: document.getElementById('toast-message'),
            // Chatbot elements
            chatbotWindow: document.getElementById('chatbot-window'),
            chatbotBody: document.getElementById('chatbot-body'),
            chatbotMessages: document.getElementById('chatbot-messages'),
            chatbotInput: document.getElementById('chatbot-input'),
            chatbotSendBtn: document.getElementById('chatbot-send-btn'),
            chatbotTitle: document.getElementById('chatbot-title'),
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
        if (this.elements.chatbotSendBtn) {
            this.elements.chatbotSendBtn.addEventListener('click', () => this.handleChatbotInput());
            this.elements.chatbotInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleChatbotInput();
                }
            });
        }
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
            
            this.showContentState();
            if (this.elements.chatbotTitle) {
                this.elements.chatbotTitle.innerHTML = `AI Debt Assistant <span class="model-badge">Powered by Phi-3</span>`;
            }
            console.log("✅ Debt Demolisher AI initialized successfully");
            
            // Automatically run the analysis after initialization
            await this.runAnalysis();
            
        } catch (error) {
            console.error("❌ Error starting Debt Demolisher AI:", error);
            this.showToast("Failed to initialize the Debt Demolisher. Please try again.", "error");
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
        try {
            console.log("🧠 Running full debt analysis and strategy simulation...");
            this.showToast("Analyzing your debt portfolio...", "info");

            // Show loaders in cards
            const cardLoaderHTML = '<div class="card-loader"><div class="spinner"></div></div>';
            this.elements.debtPortfolioContent.innerHTML = cardLoaderHTML;
            this.elements.strategyContent.innerHTML = cardLoaderHTML;
            this.elements.insightsContent.innerHTML = cardLoaderHTML;

            // 1. Simulate strategies
            const engine = new StrategyEngine(this.debtAccounts, this.extraPayment);
            const avalanchePlan = engine.simulate('avalanche');
        
        const engine2 = new StrategyEngine(this.debtAccounts, this.extraPayment);
            const snowballPlan = engine2.simulate('snowball');

            console.log("📊 Local simulations complete:", { avalanchePlan, snowballPlan });

            // Step 2: Ask the AI to analyze the pre-calculated results and provide insights.
            const prompt = this._generateAnalysisPrompt(avalanchePlan, snowballPlan);
            const aiResponse = await callGeminiAI(prompt, { max_tokens: 1024 }); 

            const parsedInsights = this.parseAIResponse(aiResponse);

            // Step 3: Translate the AI's insights and the calculated data into the final plan.
            const structuredPlan = this._structureAIGeneratedPlan(parsedInsights, avalanchePlan, snowballPlan);

            if (!structuredPlan || !structuredPlan.recommendedStrategy || !structuredPlan.recommendedStrategy.name) {
                throw new Error("AI analysis response was invalid, incomplete, or could not be structured.");
            }
            
            // Store the AI-generated plan
            this.repaymentStrategies.ai_driven_plan = structuredPlan;
            this.activeAlerts = structuredPlan.smartAlerts || [];
            
            this.logAgentAction('analysis_ai_completed', { strategy: structuredPlan.recommendedStrategy.name });

        this.updateFinancialOverview();
        this.updateDebtPortfolioUI();
        this.updateStrategyUI();
        this.updateInsightsUI();

        } catch (error) {
            this.handleError('analysis_failed', error);
            this.showToast("A critical error occurred during the AI analysis. We're showing a standard plan for now.", "error");
            
            // Critical Fallback: run the simple simulation so the page still works
            const engine = new StrategyEngine(this.debtAccounts, this.extraPayment);
            this.repaymentStrategies.avalanche = engine.simulate('avalanche');
            this.repaymentStrategies.snowball = engine.simulate('snowball');
            
            this.updateFinancialOverview();
            this.updateDebtPortfolioUI();
            this.updateStrategyUI();
            this.updateInsightsUI(); // Clear any old insights
        }
    }

    /**
     * Generates a sophisticated prompt to guide the AI in creating a full debt demolition plan.
     * @param {object} avalanchePlan - The pre-calculated avalanche plan data.
     * @param {object} snowballPlan - The pre-calculated snowball plan data.
     * @returns {string} The prompt for the AI.
     * @private
     */
    _generateAnalysisPrompt(avalanchePlan, snowballPlan) {
        return `You are a helpful financial AI assistant. Your goal is to compare two debt repayment plans and recommend the best one.

**CRITICAL INSTRUCTIONS:**
- Your response must be ONLY a valid, flat JSON object.
- Do not add any text or markdown before or after the JSON.
- You must provide a value for every key in the example.

**PLAN COMPARISON:**
*   **Plan A (Debt Avalanche):**
    *   Saves more money on interest.
    *   Total Interest: ₱${avalanchePlan.totalInterestPaid.toFixed(2)}
    *   Payoff Time: ${avalanchePlan.payoffTimeMonths} months
*   **Plan B (Debt Snowball):**
    *   Provides psychological wins by clearing small debts first.
    *   Total Interest: ₱${snowballPlan.totalInterestPaid.toFixed(2)}
    *   Payoff Time: ${snowballPlan.payoffTimeMonths} months

**YOUR TASK:**
Based on the plan comparison, choose the best plan and provide a concise reasoning for your choice.

**JSON OUTPUT EXAMPLE:**
\`\`\`json
{
  "recommendedStrategyName": "Debt Avalanche",
  "reasoning": "The Avalanche plan saves more money in interest, making it the most cost-effective path to becoming debt-free."
}
\`\`\`

**YOUR JSON RESPONSE:**
`;
    }

    /**
     * Structures the flat plan from the AI into the nested object required by the UI.
     * @param {object} insights - The flat JSON object of insights from the AI, which may be incomplete.
     * @param {object} avalanchePlan - The pre-calculated avalanche plan data.
     * @param {object} snowballPlan - The pre-calculated snowball plan data.
     * @returns {object|null} A structured plan object or null if input is invalid.
     * @private
     */
    _structureAIGeneratedPlan(insights, avalanchePlan, snowballPlan) {
        // Even if AI insights are null or empty, we can still build a plan.
        const safeInsights = insights || {};

        try {
            // Default to Avalanche if AI gives no recommendation, as it's usually the most financially optimal.
            const recommendedName = safeInsights.recommendedStrategyName || 'Debt Avalanche';
            const chosenPlan = recommendedName === 'Debt Snowball' ? snowballPlan : avalanchePlan;
            const focusAccount = chosenPlan.paymentSchedule[0];

            // Generate a smarter default reasoning if the AI doesn't provide one.
            let reasoning = safeInsights.reasoning;
            if (!reasoning) {
                // Check if a valid focus account was found in the simulation
                if (focusAccount && focusAccount.name && typeof focusAccount.interestRate === 'number') {
                    if (recommendedName === 'Debt Avalanche') {
                        reasoning = `The <strong>Debt Avalanche</strong> method is recommended. By focusing on your <strong>${focusAccount.name}</strong> with its high interest rate of <strong>${(focusAccount.interestRate * 100).toFixed(1)}%</strong>, you will save the most money on interest charges over the long term.`;
                    } else {
                        reasoning = `The <strong>Debt Snowball</strong> method is recommended. Focusing on your smallest debt, the <strong>${focusAccount.name}</strong>, will give you a quick win and build powerful momentum to keep you motivated on your debt-free journey.`;
                    }
                } else {
                    // Fallback to a more generic but still helpful explanation if the focus account is invalid
                     if (recommendedName === 'Debt Avalanche') {
                        reasoning = `The <strong>Debt Avalanche</strong> method is recommended. This plan prioritizes your highest-interest debts first, which will save you the most money in interest charges over time.`;
                    } else {
                        reasoning = `The <strong>Debt Snowball</strong> method is recommended. This plan focuses on paying off your smallest debts first, which can provide powerful motivation through quick wins.`;
                    }
                }
            }

            const structuredPlan = {
                recommendedStrategy: {
                    name: recommendedName,
                    reasoning: reasoning,
                    payoffTimeMonths: chosenPlan.payoffTimeMonths,
                    totalInterestPaid: chosenPlan.totalInterestPaid,
                    focusAccount: chosenPlan.paymentSchedule[0]?.name || "Not specified",
                },
                actionPlan: [],
                insights: []
            };

            // Reconstruct action plan with a smart fallback based on the *first* insight.
            if (safeInsights.insight1_title && safeInsights.insight1_description) {
                 structuredPlan.actionPlan.push({
                    step: 1,
                    title: safeInsights.insight1_title,
                    description: safeInsights.insight1_description,
                    priority: 'high'
                });
            } else {
                // Create a default, but still useful, action step
                structuredPlan.actionPlan.push({
                    step: 1,
                    title: `Target Your ${recommendedName === 'Debt Avalanche' ? 'Highest-Interest' : 'Smallest'} Debt`,
                    description: `Pay the minimum on all debts, and aggressively channel all extra money towards the account with the ${recommendedName === 'Debt Avalanche' ? 'highest interest rate' : 'smallest balance'} to accelerate your progress.`,
                    priority: 'high'
                });
            }
            structuredPlan.actionPlan.push({
                step: 2,
                title: "Automate Extra Payments",
                description: `Set up an automatic transfer of at least ₱${this.extraPayment.toFixed(2)} to your focus account each month to accelerate your progress.`,
                priority: "high"
            });


            // Reconstruct insights from the flat JSON response
            for (let i = 1; i <= 4; i++) {
                if (safeInsights[`insight${i}_title`] && safeInsights[`insight${i}_description`]) {
                    structuredPlan.insights.push({
                        title: safeInsights[`insight${i}_title`],
                        description: safeInsights[`insight${i}_description`],
                        priority: 'opportunity'
                    });
                }
            }
            
            // If AI provides no insights, create smart, calculated ones.
            if (structuredPlan.insights.length === 0) {
                structuredPlan.insights = this._generateStrategicInsights(avalanchePlan, snowballPlan, recommendedName);
            }


            return structuredPlan;
        } catch (error) {
            console.error("Error structuring AI plan:", error);
            this.handleError('ai_plan_structuring_failed', error, { insights: safeInsights });
            return null;
        }
    }

    /**
     * Generates a list of context-aware fallback insights if the AI fails to provide them.
     * @param {object} avalanchePlan - The pre-calculated avalanche plan data.
     * @param {object} snowballPlan - The pre-calculated snowball plan data.
     * @param {string} recommendedName - The name of the recommended strategy.
     * @returns {Array<object>} A list of insight objects.
     * @private
     */
    _generateStrategicInsights(avalanchePlan, snowballPlan, recommendedName) {
        const insights = [];
        const chosenPlan = recommendedName === 'Debt Avalanche' ? avalanchePlan : snowballPlan;

        // --- Insight 1: Payment Power Analysis ---
        const paymentPowerDescription = [
            'Here is how increasing your extra monthly payments could accelerate your journey to being debt-free:'
        ];
        const scenarios = [1000, 2500, 5000];
        scenarios.forEach(extra => {
            const increasedExtraPayment = this.extraPayment + extra;
            const tempEngine = new StrategyEngine(this.debtAccounts, increasedExtraPayment);
            const fasterPlan = tempEngine.simulate(recommendedName.toLowerCase().replace(' ', ''));
            const monthsSaved = chosenPlan.payoffTimeMonths - fasterPlan.payoffTimeMonths;
            if (monthsSaved > 0) {
                paymentPowerDescription.push(`- <strong>+₱${extra.toLocaleString()}/mo:</strong> Pay off debt ${monthsSaved} months sooner!`);
            }
        });
        if (paymentPowerDescription.length > 1) {
            insights.push({
                title: 'Payment Power-Up',
                description: paymentPowerDescription.join('<br>'),
                priority: 'opportunity'
            });
        }

        // --- Insight 2: Debt-to-Income (DTI) Ratio Analysis ---
        if (this.userIncome > 0) {
            const dti = (this.totalDebt / (this.userIncome * 12)) * 100;
            let dtiDesc = `Your Debt-to-Income (DTI) ratio is approximately <strong>${dti.toFixed(0)}%</strong>. `;
            let priority = 'low';
            if (dti > 43) {
                dtiDesc += 'This is considered high and could make it difficult to get new loans. Focusing on your debt plan is crucial.';
                priority = 'high';
            } else if (dti > 36) {
                dtiDesc += 'This is manageable, but reducing it will improve your financial flexibility.';
                priority = 'medium';
            } else {
                dtiDesc += 'This is generally considered healthy. Keep up the great work!';
            }
            insights.push({ title: 'Debt-to-Income Analysis', description: dtiDesc, priority: priority });
        }
        
        // --- Insight 3: Interest Rate Review ---
        const highInterestAccount = this.debtAccounts.find(acc => acc.interestRate > 0.10); // 10% is a high threshold
        if (highInterestAccount) {
            insights.push({
                title: `High-Interest Rate Review: ${highInterestAccount.name}`,
                description: `Your ${highInterestAccount.name} has an interest rate of <strong>${(highInterestAccount.interestRate * 100).toFixed(1)}%</strong>. This is significantly increasing your cost of debt. Have you considered looking for refinancing options to secure a lower rate?`,
                priority: 'high'
            });
        }

        // --- Insight 4: Emergency Fund ---
        insights.push({
            title: "Build an Emergency Buffer",
            description: "To prevent future debt, it's critical to have a safety net. Aim to build an emergency fund that covers 3-6 months of essential living expenses. Start small and be consistent.",
            priority: 'medium'
        });

        return insights.slice(0, 4);
    }

    // Update the main metric cards
    updateFinancialOverview() {
        if (!this.elements.totalDebt) return;

        this.elements.totalDebt.textContent = `₱${this.totalDebt.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

        let payoffMonths = 0;
        let interestSaved = 0;
        
        if (this.repaymentStrategies.ai_driven_plan) {
            // If we have an AI plan, use it as the primary source of truth
            const aiPlan = this.repaymentStrategies.ai_driven_plan.recommendedStrategy;
            payoffMonths = aiPlan.payoffTimeMonths;

            // To calculate interest saved, we need a baseline. Let's run a quick "minimum payments only" simulation.
            const baselineEngine = new StrategyEngine(this.debtAccounts, 0); // 0 extra payment
            const baselineSim = baselineEngine.simulate('snowball'); // Strategy doesn't matter with 0 extra payment
            interestSaved = baselineSim.totalInterestPaid - aiPlan.totalInterestPaid;

        } else if (this.repaymentStrategies.avalanche) {
            // Fallback for offline or failed AI analysis
            const bestStrategy = this.repaymentStrategies.avalanche.totalInterestPaid < this.repaymentStrategies.snowball.totalInterestPaid
                ? this.repaymentStrategies.avalanche
                : this.repaymentStrategies.snowball;
            payoffMonths = bestStrategy.payoffTimeMonths;
            interestSaved = Math.abs(this.repaymentStrategies.avalanche.totalInterestPaid - this.repaymentStrategies.snowball.totalInterestPaid);
        }

        const formatMonths = (m) => {
            if (m <= 0) return 'N/A';
            const years = Math.floor(m / 12);
            const months = m % 12;
            let result = '';
            if (years > 0) result += `${years}y `;
            if (months > 0) result += `${months}m`;
            return result.trim();
        };

        this.elements.estimatedPayoffDate.textContent = formatMonths(payoffMonths);
        this.elements.interestSaved.textContent = `₱${interestSaved > 0 ? interestSaved.toLocaleString('en-PH', { maximumFractionDigits: 0 }) : '0'}`;
        
        // Placeholder for progress
        this.elements.debtReductionProgress.textContent = "0%";
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

        if (this.repaymentStrategies.ai_driven_plan) {
            // Render the new AI-driven plan
            const plan = this.repaymentStrategies.ai_driven_plan;
            const strategy = plan.recommendedStrategy;
            const formatCurrency = (c) => `₱${c.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
        const formatMonths = (m) => `${Math.floor(m / 12)}y ${m % 12}m`;

            this.elements.strategyContent.innerHTML = `
                <div class="ai-strategy-card">
                    <h4><i class="fas fa-brain"></i> Your AI-Powered Plan: ${strategy.name}</h4>
                    <p class="strategy-reasoning">${strategy.reasoning}</p>
                    <div class="strategy-metrics">
                        <div>
                            <span>Est. Payoff Time</span>
                            <strong>${formatMonths(strategy.payoffTimeMonths)}</strong>
                        </div>
                        <div>
                            <span>Total Interest</span>
                            <strong>${formatCurrency(strategy.totalInterestPaid)}</strong>
                        </div>
                    </div>
                    <hr>
                    <h5><i class="fas fa-bullseye"></i> Your Action Plan</h5>
                    <ul class="action-plan-list">
                        ${plan.actionPlan.map(step => `
                            <li>
                                <strong>Step ${step.step}: ${step.title}</strong>
                                <p>${step.description}</p>
                            </li>
                        `).join('')}
                    </ul>
                 </div>
            `;
        } else if (this.repaymentStrategies.avalanche) {
            // Fallback to the original comparison view
            const avalanche = this.repaymentStrategies.avalanche;
            const snowball = this.repaymentStrategies.snowball;
            const formatMonths = (m) => `${Math.floor(m / 12)}y ${m % 12}m`;
            const formatCurrency = (c) => `₱${c.toLocaleString('en-PH', {maximumFractionDigits: 0})}`;

            const bestStrategy = avalanche.totalInterestPaid < snowball.totalInterestPaid ? 'avalanche' : 'snowball';

            this.elements.strategyContent.innerHTML = `
                <div class="strategy-comparison">
                    <div class="strategy-card ${bestStrategy === 'avalanche' ? 'recommended' : ''}">
                        ${bestStrategy === 'avalanche' ? '<div class="ribbon">Recommended</div>' : ''}
                        <h4>Debt Avalanche</h4>
                        <p>Focuses on highest interest rate first.</p>
                        <div class="strategy-metrics">
                            <div><span>Payoff Time</span> <strong>${formatMonths(avalanche.payoffTimeMonths)}</strong></div>
                            <div><span>Total Interest</span> <strong>${formatCurrency(avalanche.totalInterestPaid)}</strong></div>
                    </div>
                </div>
                    <div class="strategy-card ${bestStrategy === 'snowball' ? 'recommended' : ''}">
                        ${bestStrategy === 'snowball' ? '<div class="ribbon">Recommended</div>' : ''}
                    <h4>Debt Snowball</h4>
                    <p>Focuses on smallest balance first.</p>
                    <div class="strategy-metrics">
                            <div><span>Payoff Time</span> <strong>${formatMonths(snowball.payoffTimeMonths)}</strong></div>
                            <div><span>Total Interest</span> <strong>${formatCurrency(snowball.totalInterestPaid)}</strong></div>
                    </div>
                </div>
            </div>
        `;
        } else {
             this.elements.strategyContent.innerHTML = `<p>Run analysis to see repayment strategies.</p>`;
        }
    }
    
    // Display relevant insights for the user's debt situation
    updateInsightsUI() {
        if (!this.elements.insightsContent) return;
        
        const insights = this.repaymentStrategies.ai_driven_plan?.insights || [];

        if (insights.length > 0) {
            this.elements.insightsContent.innerHTML = insights.map(insight =>
                this.renderAlert(insight.title, insight.description, insight.priority || 'opportunity')
            ).join('');
        } else {
            this.elements.insightsContent.innerHTML = this.renderAlert(
                'All Clear!',
                'Our AI found no specific strategic insights at this time. Sticking to the recommended plan is your best move.',
                'low',
                'fa-check-circle'
            );
        }
    }

    // Renders a single alert item. Can be used for insights, alerts, or info.
    renderAlert(title, description, priority, icon) {
        const priorityClasses = { high: 'severity-high', medium: 'severity-medium', low: 'severity-low' };
        // Logic to choose the right icon based on priority if not provided
        if (!icon) {
            switch (priority) {
                case 'high': icon = 'fas fa-exclamation-triangle'; break;
                case 'medium': icon = 'fas fa-info-circle'; break;
                case 'opportunity': icon = 'fas fa-lightbulb'; break;
                case 'low': 
                default:
                    icon = 'fas fa-check-circle'; break;
            }
        }
        return `
            <div class="alert-item ${priorityClasses[priority]}">
                <i class="fas ${icon} alert-icon"></i>
                <div class="alert-content">
                    <div class="alert-title">${title}</div>
                    <div class="alert-desc">${description}</div>
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

    showToast(message, type = 'info', duration = 3000) {
        if (!this.elements.toast) return;

        this.elements.toastMessage.textContent = message;
        this.elements.toast.className = `toast-notification show ${type}`;

        setTimeout(() => {
            this.elements.toast.className = 'toast-notification';
        }, duration);
    }

    async handleChatbotInput() {
        const userInput = this.elements.chatbotInput.value.trim();
        if (!userInput) return;

        this.appendMessage(userInput, 'user');
        this.elements.chatbotInput.value = '';

        // Show typing indicator
        this.appendMessage('<span></span><span></span><span></span>', 'typing-indicator');

        try {
            const aiResponse = await this.getAIResponse(userInput);
            this.appendMessage(aiResponse, 'assistant');
        } catch (error) {
            console.error("Chatbot AI Error:", error);
            this.appendMessage("Sorry, I encountered an error. Please try again.", 'assistant error');
        }
    }

    appendMessage(message, sender) {
        // Remove existing typing indicator before adding a new message
        const typingIndicator = this.elements.chatbotMessages.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `chatbot-message ${sender}`;
        messageDiv.innerHTML = message;
        this.elements.chatbotMessages.appendChild(messageDiv);
        this.elements.chatbotBody.scrollTop = this.elements.chatbotBody.scrollHeight;
    }

    async getAIResponse(userInput) {
        if (this.offlineMode) {
            this.log('Using offline chatbot response.');
            return this._getOfflineResponse(userInput);
        }

        try {
            const prompt = this._generateChatPrompt(userInput);
            const aiResponse = await callGeminiAI(prompt);
            
            if (!aiResponse) {
                console.warn("AI response was empty or invalid. Falling back to offline response.");
                return this._getOfflineResponse(userInput);
            }

            return aiResponse;

        } catch (error) {
            console.error("Error calling AI for chat response:", error);
            this.handleError('chatbot_ai_call_failed', error, { userInput });
            return this._getOfflineResponse(userInput);
        }
    }

    /**
     * Generates a detailed prompt for the AI chatbot.
     * @param {string} userInput The user's latest message.
     * @returns {string} A comprehensive prompt for the AI.
     * @private
     */
    _generateChatPrompt(userInput) {
        const debtData = this.debtAccounts.map(acc => ({
            name: acc.name,
            balance: acc.balance,
            interestRate: acc.interestRate,
            minimumPayment: acc.minimumPayment
        }));

        const strategiesData = {
            avalanche: {
                payoffTimeMonths: this.repaymentStrategies.avalanche?.payoffTimeMonths,
                totalInterestPaid: this.repaymentStrategies.avalanche?.totalInterestPaid,
            },
            snowball: {
                payoffTimeMonths: this.repaymentStrategies.snowball?.payoffTimeMonths,
                totalInterestPaid: this.repaymentStrategies.snowball?.totalInterestPaid,
            }
        };

        // Construct a history of the conversation for context
        const chatHistory = Array.from(this.elements.chatbotMessages.children)
            .filter(node => node.classList.contains('chatbot-message') && !node.classList.contains('typing-indicator'))
            .map(node => {
                const role = node.classList.contains('user') ? 'user' : 'model';
                return { role, parts: [{ text: node.textContent }] };
            })
            .slice(-6); // Get last 6 messages for context

        const prompt = `You are the "Debt Demolisher AI", a specialized financial assistant within the "Kita-kita" app. Your personality is encouraging, expert, and focused on helping the user eliminate their debt. Your responses must be concise, helpful, and directly related to debt management. Do not answer off-topic questions.

        **CRITICAL CONTEXT - DO NOT DISCLOSE TO THE USER:**
        - **User's Total Debt:** ₱${this.totalDebt.toFixed(2)}
        - **User's Debt Accounts:** ${JSON.stringify(debtData)}
        - **Calculated Repayment Strategies:** ${JSON.stringify(strategiesData)}
        - **Agent's Goal:** Provide clear, actionable advice to help the user understand and pay off their debt.

        **Conversation History:**
        ${JSON.stringify(chatHistory)}

        **Current User Question:**
        "${userInput}"

        **Your Task:**
        Based on the user's question and the financial context provided, generate a helpful and encouraging response. Keep it brief and to the point. If the question is off-topic, politely decline to answer.`;

        return prompt;
    }

    /**
     * Provides a fallback response when the AI is offline or fails.
     * @param {string} userInput The user's message.
     * @returns {string} A canned response based on keywords.
     * @private
     */
    _getOfflineResponse(userInput) {
        // Basic keyword matching from the original implementation
        if (userInput.toLowerCase().includes('avalanche')) {
            return "The Debt Avalanche method focuses on paying off debts with the highest interest rates first. This approach usually saves you the most money on interest in the long run.";
        } else if (userInput.toLowerCase().includes('snowball')) {
            return "The Debt Snowball method involves paying off your smallest debts first, regardless of their interest rate. This can create powerful psychological momentum and keep you motivated.";
        } else if (userInput.toLowerCase().includes('which is better')) {
            const avalancheInterest = this.repaymentStrategies.avalanche?.totalInterestPaid || 0;
            const snowballInterest = this.repaymentStrategies.snowball?.totalInterestPaid || 0;
            if (avalancheInterest < snowballInterest && avalancheInterest > 0) {
                return `For your specific debts, the Avalanche method is estimated to save you ₱${(snowballInterest - avalancheInterest).toFixed(2)} more in interest compared to the Snowball method.`;
            } else {
                return "Mathematically, the Avalanche method is often better for saving on interest. However, the best method is the one you can stick with. The Snowball method's small wins can be very powerful for motivation.";
            }
        }

        // Default response
        return "I'm here to help with your debt plan. Ask about 'Debt Snowball', 'Debt Avalanche', or 'which is better?' to compare strategies for your situation.";
    }

    async parseAIResponse(response) {
        try {
            console.log('Parsing AI response for debt analysis plan...');

            // Clean the response to extract only the JSON part
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```|({[\s\S]*})/);
            if (!jsonMatch) {
                throw new Error("No valid JSON object found in the AI response.");
            }
            
            // The actual JSON string is in one of the capturing groups
            const jsonString = jsonMatch[1] || jsonMatch[2];

            const parsed = JSON.parse(jsonString);
            console.log('Successfully parsed AI response.');
            return parsed;
        } catch (error) {
            this.handleError('ai_response_parsing_failed', error, { response });
            return null; // Return null to indicate parsing failure
        }
    }
}

// Initialize and start the agent
document.addEventListener('DOMContentLoaded', () => {
    const agent = new DebtDemolisherAI();
    agent.start();
});

