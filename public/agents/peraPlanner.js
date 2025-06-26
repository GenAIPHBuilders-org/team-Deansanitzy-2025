/**
 * Pera Planner AI - Financial Planning Assistant
 * 
 * An AI agent designed for personal financial planning in the Filipino context.
 * Focuses on practical financial guidance and recommendations.
 * 
 * Key Features:
 * - Transaction analysis and insights
 * - Personalized financial recommendations
 * - Goal tracking and planning
 * - Financial projections
 * - Progress notifications
 * 
 * @version 2.2.0
 * @license MIT
 */

import { GEMINI_API_KEY, GEMINI_MODEL, isConfigured, firebaseConfig } from "../js/config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserData, getUserTransactions, getUserBankAccounts, storeUserData, updateFinancialProfile } from "../js/firestoredb.js";
import { BaseAgent } from "./BaseAgent.js";
import { callGeminiAI } from "../js/agentCommon.js";

// Initialize Firebase if it hasn't been initialized yet
let app;
try {
    app = initializeApp(firebaseConfig);
} catch (error) {
    if (error.code !== 'app/duplicate-app') {
        console.error('Firebase initialization error:', error);
        throw error;
    }
}
const auth = getAuth(app);

// Constants for financial planning
const FINANCIAL_CONSTANTS = {
    EMERGENCY_FUND_MONTHS: 6,
    MIN_SAVINGS_RATE: 0.2,
    PLANNING_HORIZONS: ['short_term', 'medium_term', 'long_term'],
    GOAL_TYPES: {
        EMERGENCY_FUND: 'emergency_fund',
        SAVINGS: 'savings',
        INVESTMENT: 'investment',
        DEBT_PAYMENT: 'debt_payment',
        MAJOR_PURCHASE: 'major_purchase'
    }
};

class PeraPlannerAI extends BaseAgent {
    constructor() {
        super('peraPlannerAI', {
            planningHorizon: 'long_term'
        });
        
        // Initialize state
        this.goals = new Map();
        this.recommendations = [];
        this.insights = [];
        this.userAccounts = [];
        this.userTransactions = [];
        this.projections = new Map();
        this.notifications = [];
        
        // Check if AI services are configured
        this.isAIConfigured = isConfigured();
        
        // Initialize error state
        this.initializationError = null;
    }

    /**
     * Initialize the AI agent with user data
     * @returns {Promise<boolean>} Success status of initialization
     */
    async initialize() {
        try {
            const user = auth.currentUser;
            
            if (!user) {
                this.initializationError = 'User not authenticated';
                throw new Error(this.initializationError);
            }

            // Set UI state to loading
            this.setUIState('loading');

            // Load user data
            try {
                const [accounts, transactions, userData] = await Promise.all([
                    getUserBankAccounts(user.uid),
                    getUserTransactions(user.uid),
                    getUserData(user.uid)
                ]);
                
                this.userAccounts = accounts || [];
                this.userTransactions = transactions || [];
                
                // Initialize goals from user data
                if (userData?.goals) {
                    this.goals = new Map(Object.entries(userData.goals));
                }
            } catch (dataError) {
                console.error('Failed to load user data:', dataError);
                this.initializationError = 'Failed to load user data';
                throw dataError;
            }
            
            // Generate initial insights, recommendations, and projections
            if (this.isAIConfigured) {
                try {
                    await Promise.all([
                        this.generateInsightsAndRecommendations(),
                        this.updateProjections(),
                        this.checkGoalProgress()
                    ]);
                } catch (aiError) {
                    console.error('AI analysis failed:', aiError);
                    // Don't throw here - we can still proceed with basic functionality
                    this.recommendations = this.getDefaultRecommendations();
                    this.insights = this.getDefaultInsights();
                }
            } else {
                // Use default recommendations and insights if AI is not configured
                this.recommendations = this.getDefaultRecommendations();
                this.insights = this.getDefaultInsights();
            }
            
            // Set UI state to ready
            this.setUIState('ready');
            return true;
        } catch (error) {
            console.error('Failed to initialize PeraPlanner:', error);
            this.initializationError = error.message;
            // Set UI state to error
            this.setUIState('error');
            return false;
        }
    }

    /**
     * Set the UI state and update the display
     * @private
     */
    setUIState(state) {
        const loadingElement = document.getElementById('loading-screen');
        const contentElement = document.getElementById('content');
        const errorElement = document.getElementById('error-message');
        
        if (!loadingElement || !contentElement || !errorElement) {
            console.error('Required UI elements not found');
            return;
        }
        
        switch (state) {
            case 'loading':
                loadingElement.style.display = 'block';
                contentElement.style.display = 'none';
                errorElement.style.display = 'none';
                break;
            case 'ready':
                loadingElement.style.display = 'none';
                contentElement.style.display = 'block';
                errorElement.style.display = 'none';
                break;
            case 'error':
                loadingElement.style.display = 'none';
                contentElement.style.display = 'none';
                errorElement.style.display = 'block';
                errorElement.textContent = this.initializationError || 'An error occurred while loading your financial data';
                break;
            default:
                console.error('Invalid UI state:', state);
        }
    }

    /**
     * Add or update a financial goal
     * @param {string} goalId Unique identifier for the goal
     * @param {Object} goalData Goal details
     * @returns {Promise<boolean>} Success status
     */
    async setGoal(goalId, goalData) {
        try {
            const user = auth.currentUser;
            
            if (!user) throw new Error('User not authenticated');
            
            // Validate goal data
            if (!goalData.targetAmount || !goalData.targetDate || !goalData.type) {
                throw new Error('Invalid goal data');
            }
            
            // Add goal to local state
            this.goals.set(goalId, {
                ...goalData,
                currentAmount: goalData.currentAmount || 0,
                startDate: goalData.startDate || new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });
            
            // Update goals in database
            await updateFinancialProfile(user.uid, { goals: Object.fromEntries(this.goals) });
            
            // Update projections and check progress
            await Promise.all([
                this.updateProjections(),
                this.checkGoalProgress()
            ]);
            
            return true;
        } catch (error) {
            console.error('Failed to set goal:', error);
            return false;
        }
    }

    /**
     * Update financial projections for all goals
     * @private
     */
    async updateProjections() {
        if (!this.userTransactions?.length || !this.goals.size) return;
        
        try {
            const prompt = this.buildProjectionsPrompt();
            const projectionData = await callGeminiAI(prompt);
            
            if (projectionData) {
                const parsedProjections = this.parseAIResponse(projectionData);
                this.projections = new Map(Object.entries(parsedProjections));
            }
        } catch (error) {
            console.error('Failed to update projections:', error);
        }
    }

    /**
     * Check progress on financial goals and generate notifications
     * @private
     */
    async checkGoalProgress() {
        if (!this.goals.size) return;
        
        this.notifications = [];
        const now = new Date();
        
        for (const [goalId, goal] of this.goals) {
            const targetDate = new Date(goal.targetDate);
            const startDate = new Date(goal.startDate);
            const totalDays = (targetDate - startDate) / (1000 * 60 * 60 * 24);
            const elapsedDays = (now - startDate) / (1000 * 60 * 60 * 24);
            const progressPercent = (goal.currentAmount / goal.targetAmount) * 100;
            const timePercent = (elapsedDays / totalDays) * 100;
            
            // Check if behind schedule
            if (progressPercent < timePercent - 10) {
                this.notifications.push({
                    type: 'warning',
                    goalId,
                    message: `You're falling behind on your ${goal.name} goal. Consider increasing your monthly contribution.`,
                    suggestion: `Try saving ₱${this.calculateRequiredSavings(goal)} monthly to reach your goal.`
                });
            }
            
            // Check if ahead of schedule
            if (progressPercent > timePercent + 10) {
                this.notifications.push({
                    type: 'success',
                    goalId,
                    message: `Great progress on your ${goal.name} goal! You're ahead of schedule.`,
                    suggestion: 'Consider setting a more ambitious goal!'
                });
            }
            
            // Check if near deadline
            const daysRemaining = (targetDate - now) / (1000 * 60 * 60 * 24);
            if (daysRemaining <= 30 && progressPercent < 90) {
                this.notifications.push({
                    type: 'urgent',
                    goalId,
                    message: `Your ${goal.name} goal deadline is approaching! Only ${Math.ceil(daysRemaining)} days left.`,
                    suggestion: `You need to save ₱${goal.targetAmount - goal.currentAmount} more to reach your goal.`
                });
            }
        }
    }

    /**
     * Calculate required monthly savings to reach a goal
     * @private
     */
    calculateRequiredSavings(goal) {
        const now = new Date();
        const targetDate = new Date(goal.targetDate);
        const monthsRemaining = (targetDate.getFullYear() - now.getFullYear()) * 12 + targetDate.getMonth() - now.getMonth();
        const remainingAmount = goal.targetAmount - goal.currentAmount;
        
        return Math.ceil(remainingAmount / monthsRemaining);
    }

    /**
     * Build prompt for generating financial projections
     * @private
     */
    buildProjectionsPrompt() {
        const transactions = this.userTransactions || [];
        const goals = Array.from(this.goals.values());
        
        // Calculate savings rate and patterns
        const monthlyIncome = this.calculateMonthlyIncome(transactions);
        const monthlyExpenses = this.calculateMonthlyExpenses(transactions);
        const monthlySavings = monthlyIncome - monthlyExpenses;
        const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
        
        return `Analyze financial behavior and project goal achievement based on:

Financial Metrics:
- Monthly Income: ${monthlyIncome}
- Monthly Expenses: ${monthlyExpenses}
- Monthly Savings: ${monthlySavings}
- Savings Rate: ${savingsRate}%

Financial Goals:
${goals.map(goal => `
- ${goal.name}:
  Target: ₱${goal.targetAmount}
  Current: ₱${goal.currentAmount}
  Deadline: ${goal.targetDate}
  Type: ${goal.type}`).join('\n')}

Recent Transaction Patterns:
${this.getRecentTransactionSummary()}

Please provide:
1. Projected achievement dates for each goal based on current behavior
2. Recommended adjustments to reach goals faster
3. Risk factors that might delay goal achievement
4. Probability of success for each goal

Format response as a JSON object with projections for each goal.`;
    }

    /**
     * Get summary of recent transaction patterns
     * @private
     */
    getRecentTransactionSummary() {
        const transactions = this.userTransactions || [];
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const recentTransactions = transactions.filter(t => new Date(t.date) >= threeMonthsAgo);
        
        // Group by category
        const categoryTotals = recentTransactions.reduce((acc, trans) => {
            if (!acc[trans.category]) {
                acc[trans.category] = { total: 0, count: 0 };
            }
            acc[trans.category].total += Math.abs(trans.amount);
            acc[trans.category].count++;
            return acc;
        }, {});
        
        return Object.entries(categoryTotals)
            .map(([category, data]) => 
                `${category}: ₱${data.total} (${data.count} transactions)`)
            .join('\n');
    }

    /**
     * Generate insights and recommendations
     * @private
     */
    async generateInsightsAndRecommendations() {
        try {
            await Promise.all([
                this.generateRecommendations(),
                this.generateInsights()
            ]);
        } catch (error) {
            console.error('Failed to generate insights and recommendations:', error);
        }
    }

    /**
     * Generate personalized recommendations using AI
     * @private
     */
    async generateRecommendations() {
        if (!this.userTransactions?.length) return;

        const prompt = this.buildRecommendationsPrompt();
        
        try {
            const recommendations = await callGeminiAI(prompt);
            if (recommendations) {
                this.recommendations = this.parseAIResponse(recommendations);
            }
        } catch (error) {
            console.error('Failed to generate recommendations:', error);
            this.recommendations = this.getDefaultRecommendations();
        }
    }

    /**
     * Generate financial insights
     * @private
     */
    async generateInsights() {
        if (!this.userTransactions?.length) return;

        const prompt = this.buildInsightsPrompt();
        
        try {
            const insights = await callGeminiAI(prompt);
            if (insights) {
                this.insights = this.parseAIResponse(insights);
            }
        } catch (error) {
            console.error('Failed to generate insights:', error);
            this.insights = this.getDefaultInsights();
        }
    }

    /**
     * Build prompt for generating recommendations
     * @private
     */
    buildRecommendationsPrompt() {
        const transactions = this.userTransactions || [];
        const accounts = this.userAccounts || [];
        
        // Calculate key metrics
        const monthlyIncome = this.calculateMonthlyIncome(transactions);
        const monthlyExpenses = this.calculateMonthlyExpenses(transactions);
        const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;
        
        // Analyze recent transactions
        const recentTransactions = transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);
            
        return `Based on the following financial data, provide personalized recommendations:

Key Metrics:
- Monthly Income: ${monthlyIncome}
- Monthly Expenses: ${monthlyExpenses}
- Current Savings Rate: ${savingsRate}%
- Target Minimum Savings Rate: ${FINANCIAL_CONSTANTS.MIN_SAVINGS_RATE * 100}%
- Emergency Fund Target: ${FINANCIAL_CONSTANTS.EMERGENCY_FUND_MONTHS} months of expenses

Recent Transaction Patterns:
${recentTransactions.map(t => `- ${t.date}: ${t.category} - ${t.amount}`).join('\n')}

Account Distribution:
${accounts.map(acc => `- ${acc.accountName}: ${acc.balance}`).join('\n')}

Please provide actionable recommendations in these areas:
1. Budgeting adjustments
2. Savings strategies
3. Expense optimization
4. Account management
5. Financial goals

Format the response as a JSON array of recommendation objects, each with 'category', 'priority', and 'action' fields.`;
    }

    /**
     * Build prompt for generating insights
     * @private
     */
    buildInsightsPrompt() {
        const transactions = this.userTransactions || [];
        const accounts = this.userAccounts || [];
        
        // Analyze transaction trends
        const monthlyTotals = transactions.reduce((acc, trans) => {
            const month = new Date(trans.date).toISOString().slice(0, 7);
            if (!acc[month]) {
                acc[month] = { income: 0, expenses: 0 };
            }
            if (trans.amount > 0) {
                acc[month].income += trans.amount;
            } else {
                acc[month].expenses += Math.abs(trans.amount);
            }
            return acc;
        }, {});

        return `Generate financial insights based on the following data:

Monthly Trends:
${Object.entries(monthlyTotals).map(([month, data]) => 
    `- ${month}: Income: ${data.income}, Expenses: ${data.expenses}`
).join('\n')}

Account Overview:
${accounts.map(acc => `- ${acc.accountName}: ${acc.balance}`).join('\n')}

Transaction Categories:
${Array.from(new Set(transactions.map(t => t.category))).join(', ')}

Please analyze and provide insights on:
1. Income stability and trends
2. Spending patterns and anomalies
3. Account utilization
4. Financial behavior patterns
5. Areas for improvement

Format the response as a JSON array of insight objects, each with 'category', 'observation', and 'impact' fields.`;
    }

    /**
     * Get default recommendations when AI is not available
     * @private
     */
    getDefaultRecommendations() {
        return [
            {
                category: 'Savings',
                priority: 'high',
                action: 'Start building an emergency fund'
            },
            {
                category: 'Budgeting',
                priority: 'high',
                action: 'Track all expenses for the next 30 days'
            }
        ];
    }

    /**
     * Get default insights when AI is not available
     * @private
     */
    getDefaultInsights() {
        return [
            {
                category: 'General',
                observation: 'Start tracking your transactions regularly',
                impact: 'Better financial awareness and decision making'
            }
        ];
    }

    /**
     * Calculate average monthly income from transactions
     * @private
     */
    calculateMonthlyIncome(transactions) {
        if (!transactions?.length) return 0;
        
        // Get transactions from the last 3 months
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const recentTransactions = transactions.filter(t => 
            new Date(t.date) >= threeMonthsAgo && t.amount > 0
        );
        
        if (!recentTransactions.length) return 0;
        
        // Calculate total income
        const totalIncome = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        // Calculate number of unique months
        const uniqueMonths = new Set(
            recentTransactions.map(t => new Date(t.date).toISOString().slice(0, 7))
        ).size;
        
        return uniqueMonths > 0 ? totalIncome / uniqueMonths : 0;
    }

    /**
     * Calculate average monthly expenses from transactions
     * @private
     */
    calculateMonthlyExpenses(transactions) {
        if (!transactions?.length) return 0;
        
        // Get transactions from the last 3 months
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const recentTransactions = transactions.filter(t => 
            new Date(t.date) >= threeMonthsAgo && t.amount < 0
        );
        
        if (!recentTransactions.length) return 0;
        
        // Calculate total expenses (convert negative amounts to positive)
        const totalExpenses = recentTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        // Calculate number of unique months
        const uniqueMonths = new Set(
            recentTransactions.map(t => new Date(t.date).toISOString().slice(0, 7))
        ).size;
        
        return uniqueMonths > 0 ? totalExpenses / uniqueMonths : 0;
    }

    /**
     * Parse AI response safely
     * @private
     */
    parseAIResponse(response) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            // If no JSON found, return the response as is
            return response;
        } catch (error) {
            console.error('Failed to parse AI response:', error);
            return null;
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        // Clean up any resources
        this.goals.clear();
        this.recommendations = [];
        this.insights = [];
        this.userAccounts = [];
        this.userTransactions = [];
        this.projections.clear();
        this.notifications = [];
    }

    /**
     * Display insights and recommendations in the UI
     */
    async displayInsightsAndRecommendations() {
        const contentState = document.getElementById('content-state');
        if (!contentState) return;
        
        // Clear existing content
        contentState.innerHTML = '';
        
        // Add goal tracking section
        const goalSection = document.createElement('div');
        goalSection.className = 'goals-section';
        goalSection.innerHTML = `
            <h2><i class="fas fa-bullseye"></i> Financial Goals</h2>
            <div class="goals-grid">
                ${Array.from(this.goals.entries()).map(([id, goal]) => {
                    const projection = this.projections.get(id);
                    const progress = (goal.currentAmount / goal.targetAmount) * 100;
                    return `
                        <div class="goal-card">
                            <div class="goal-header">
                                <h3>${goal.name}</h3>
                                <span class="goal-type">${goal.type}</span>
                            </div>
                            <div class="goal-progress">
                                <div class="progress-bar">
                                    <div class="progress" style="width: ${progress}%"></div>
                                </div>
                                <span class="progress-text">${progress.toFixed(1)}%</span>
                            </div>
                            <div class="goal-details">
                                <p class="target">Target: ₱${goal.targetAmount.toLocaleString()}</p>
                                <p class="current">Current: ₱${goal.currentAmount.toLocaleString()}</p>
                                <p class="deadline">Deadline: ${new Date(goal.targetDate).toLocaleDateString()}</p>
                                ${projection ? `
                                    <p class="projection">Projected completion: ${projection.projectedDate}</p>
                                    <p class="suggestion">${projection.suggestion}</p>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <button id="add-goal-btn" class="btn btn-primary">
                <i class="fas fa-plus"></i> Add New Goal
            </button>
        `;
        
        // Add notifications section if there are any
        if (this.notifications.length > 0) {
            const notificationsSection = document.createElement('div');
            notificationsSection.className = 'notifications-section';
            notificationsSection.innerHTML = `
                <h2><i class="fas fa-bell"></i> Updates & Notifications</h2>
                <div class="notifications-list">
                    ${this.notifications.map(notification => `
                        <div class="notification-card ${notification.type}">
                            <div class="notification-icon">
                                <i class="fas fa-${notification.type === 'success' ? 'check-circle' : 
                                                   notification.type === 'warning' ? 'exclamation-triangle' : 
                                                   'bell'}"></i>
                            </div>
                            <div class="notification-content">
                                <p class="message">${notification.message}</p>
                                <p class="suggestion">${notification.suggestion}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            contentState.appendChild(notificationsSection);
        }
        
        // Add existing sections
        contentState.appendChild(goalSection);
        
        // Add event listener for add goal button
        const addGoalBtn = document.getElementById('add-goal-btn');
        if (addGoalBtn) {
            addGoalBtn.addEventListener('click', () => this.showAddGoalModal());
        }
        
        // Add existing sections (overview, insights, recommendations)
        // ... rest of the existing display code ...
    }

    /**
     * Show modal for adding a new goal
     * @private
     */
    showAddGoalModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Add New Financial Goal</h2>
                <form id="add-goal-form">
                    <div class="form-group">
                        <label for="goal-name">Goal Name</label>
                        <input type="text" id="goal-name" required>
                    </div>
                    <div class="form-group">
                        <label for="goal-type">Goal Type</label>
                        <select id="goal-type" required>
                            ${Object.entries(FINANCIAL_CONSTANTS.GOAL_TYPES).map(([key, value]) => 
                                `<option value="${value}">${key.replace('_', ' ').toLowerCase()}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="target-amount">Target Amount (₱)</label>
                        <input type="number" id="target-amount" min="0" required>
                    </div>
                    <div class="form-group">
                        <label for="current-amount">Current Amount (₱)</label>
                        <input type="number" id="current-amount" min="0" required>
                    </div>
                    <div class="form-group">
                        <label for="target-date">Target Date</label>
                        <input type="date" id="target-date" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Add Goal</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Handle form submission
        const form = document.getElementById('add-goal-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const goalData = {
                name: form.querySelector('#goal-name').value,
                type: form.querySelector('#goal-type').value,
                targetAmount: parseFloat(form.querySelector('#target-amount').value),
                currentAmount: parseFloat(form.querySelector('#current-amount').value),
                targetDate: form.querySelector('#target-date').value
            };
            
            const goalId = `goal_${Date.now()}`;
            const success = await this.setGoal(goalId, goalData);
            
            if (success) {
                modal.remove();
                this.displayInsightsAndRecommendations();
            } else {
                alert('Failed to add goal. Please try again.');
            }
        });
    }
}

// Export the PeraPlannerAI class
export default PeraPlannerAI;

// UI Elements
const loadingState = document.getElementById('loading-state');
const contentState = document.getElementById('content-state');
const emptyState = document.getElementById('empty-state');

// Initialize Pera Planner
const peraPlannerAI = new PeraPlannerAI();

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Starting initialization...');
        
        // Listen for auth state changes
        auth.onAuthStateChanged(async (user) => {
            console.log('Auth state changed:', user ? 'User logged in' : 'No user');
            if (user) {
                await initializePeraPlanner(user);
            } else {
                console.log('No user found, redirecting to login...');
                window.location.href = '/pages/login.html';
            }
        });
    } catch (error) {
        console.error('Error during initialization:', error);
        setUIState('error');
    }
});

/**
 * Initialize the Pera Planner application
 */
async function initializePeraPlanner(user) {
    try {
        console.log('Initializing Pera Planner for user:', user.uid);
        setUIState('loading');
        
        // Initialize the AI agent
        const success = await peraPlannerAI.initialize();
        console.log('AI initialization result:', success);
        
        if (!success) {
            throw new Error('Failed to initialize Pera Planner');
        }
        
        // Check if we have enough data
        if (!peraPlannerAI.userTransactions?.length) {
            console.log('No transactions found, showing empty state');
            setUIState('empty');
            return;
        }
        
        // Display the insights and recommendations
        console.log('Displaying insights and recommendations');
        await displayInsightsAndRecommendations();
        
        setUIState('content');
    } catch (error) {
        console.error('Failed to initialize Pera Planner:', error);
        setUIState('empty');
    }
}

/**
 * Display insights and recommendations in the UI
 */
async function displayInsightsAndRecommendations() {
    const contentState = document.getElementById('content-state');
    if (!contentState) return;
    
    // Clear existing content
    contentState.innerHTML = '';
    
    // Create insights section
    const insightsSection = document.createElement('div');
    insightsSection.className = 'insights-section';
    insightsSection.innerHTML = `
        <h2><i class="fas fa-lightbulb"></i> Financial Insights</h2>
        <div class="insights-grid">
            ${peraPlannerAI.insights.map(insight => `
                <div class="insight-card">
                    <h3>${insight.category}</h3>
                    <p class="observation">${insight.observation}</p>
                    <p class="impact">${insight.impact}</p>
                </div>
            `).join('')}
        </div>
    `;
    
    // Create recommendations section
    const recommendationsSection = document.createElement('div');
    recommendationsSection.className = 'recommendations-section';
    recommendationsSection.innerHTML = `
        <h2><i class="fas fa-tasks"></i> Recommended Actions</h2>
        <div class="recommendations-list">
            ${peraPlannerAI.recommendations.map(rec => `
                <div class="recommendation-card priority-${rec.priority.toLowerCase()}">
                    <div class="rec-header">
                        <h3>${rec.category}</h3>
                        <span class="priority-badge">${rec.priority}</span>
                    </div>
                    <p class="action">${rec.action}</p>
                </div>
            `).join('')}
        </div>
    `;
    
    // Add financial overview section
    const overviewSection = document.createElement('div');
    overviewSection.className = 'overview-section';
    overviewSection.innerHTML = `
        <h2><i class="fas fa-chart-pie"></i> Financial Overview</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Monthly Income</h3>
                <p class="amount">₱${peraPlannerAI.calculateMonthlyIncome(peraPlannerAI.userTransactions).toLocaleString()}</p>
            </div>
            <div class="metric-card">
                <h3>Monthly Expenses</h3>
                <p class="amount">₱${peraPlannerAI.calculateMonthlyExpenses(peraPlannerAI.userTransactions).toLocaleString()}</p>
            </div>
            <div class="metric-card">
                <h3>Total Balance</h3>
                <p class="amount">₱${peraPlannerAI.userAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0).toLocaleString()}</p>
            </div>
        </div>
    `;
    
    // Add sections to content
    contentState.appendChild(overviewSection);
    contentState.appendChild(insightsSection);
    contentState.appendChild(recommendationsSection);
}

/**
 * Set the UI state
 */
function setUIState(state) {
    loadingState.classList.toggle('hidden', state !== 'loading');
    contentState.classList.toggle('hidden', state !== 'content');
    emptyState.classList.toggle('hidden', state !== 'empty');
    
    // Update progress steps in loading state
    if (state === 'loading') {
        const steps = loadingState.querySelectorAll('.progress-step');
        let currentStep = 0;
        
        const updateSteps = () => {
            steps.forEach((step, index) => {
                step.classList.toggle('active', index === currentStep);
            });
            currentStep = (currentStep + 1) % steps.length;
        };
        
        // Update steps every 2 seconds
        updateSteps();
        const interval = setInterval(updateSteps, 2000);
        
        // Store the interval ID to clear it when loading is done
        loadingState.dataset.intervalId = interval;
    } else {
        // Clear the interval when loading is done
        const intervalId = loadingState.dataset.intervalId;
        if (intervalId) {
            clearInterval(intervalId);
            delete loadingState.dataset.intervalId;
        }
    }
}

