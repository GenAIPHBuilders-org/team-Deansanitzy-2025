/**
 * WealthBuilder AI - Long-term Investment and Wealth Growth Assistant
 * 
 * An AI agent designed for personal financial planning and wealth building in the Filipino context.
 * Focuses on practical investment guidance and long-term strategy.
 * 
 * Key Features:
 * - Investment portfolio analysis
 * - Personalized wealth-building recommendations
 * - Long-term goal tracking and forecasting
 * - Market insights and opportunities
 * - Progress notifications and milestone alerts
 * 
 * @version 3.0.0
 * @license MIT
 */

import { GEMINI_API_KEY, GEMINI_MODEL, isConfigured, firebaseConfig } from "../js/config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserData, getUserTransactions, getUserBankAccounts, storeUserData, updateFinancialProfile } from "../js/firestoredb.js";
import { BaseAgent } from "./BaseAgent.js";
import { callGeminiAI } from "../js/agentCommon.js";
import { getApiBaseUrl } from "../js/utils/environment.js";

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

// --- UI Element Getters ---
const getElement = (id) => document.getElementById(id);
const ui = {
    loadingState: () => getElement('loading-state'),
    contentState: () => getElement('content-state'),
    emptyState: () => getElement('empty-state'),
    monthlyIncome: () => getElement('monthly-income'),
    monthlyExpenses: () => getElement('monthly-expenses'),
    totalBalance: () => getElement('total-balance'),
    savingsRate: () => getElement('savings-rate'),
    insightsList: () => getElement('insights-list'),
    actionsList: () => getElement('actions-list'),
};

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            analyzeAndRender(user);
        } else {
            window.location.href = '../pages/login.html';
        }
    });
});

/**
 * Main function to orchestrate the analysis and rendering of the wealth builder plan.
 * @param {object} user The authenticated Firebase user object.
 */
async function analyzeAndRender(user) {
    try {
        setUIState('loading');

        const [accounts, transactions] = await Promise.all([
            getUserBankAccounts(user.uid),
            getUserTransactions(user.uid),
        ]);

        if (!transactions || transactions.length === 0 || !accounts || accounts.length === 0) {
            setUIState('empty');
            return;
        }

        const financialData = calculateFinancialOverview(accounts, transactions);
        renderFinancialOverview(financialData);

        // Run AI analysis in parallel
        generateInsightsAndRecommendations(financialData, accounts, transactions);

        setUIState('content');
    } catch (error) {
        console.error("WealthBuilder Analysis Failed:", error);
        setUIState('error');
    }
}

// --- UI State & Rendering ---

function setUIState(state) {
    const { loadingState, contentState, emptyState } = ui;
    loadingState().style.display = 'none';
    contentState().style.display = 'none';
    emptyState().style.display = 'none';

    switch (state) {
        case 'loading':
            loadingState().style.display = 'flex';
            break;
        case 'content':
            contentState().style.display = 'block';
            break;
        case 'empty':
            emptyState().style.display = 'flex';
            emptyState().innerHTML = `<i class="fas fa-box-open empty-icon"></i><p>No data available. Please add accounts or transactions.</p>`;
            break;
        case 'error':
            emptyState().style.display = 'flex';
            emptyState().innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Could not build your wealth plan. Please try again later.</p>`;
            break;
    }
}

function renderFinancialOverview(data) {
    const { monthlyIncome, monthlyExpenses, totalBalance, savingsRate } = ui;
    monthlyIncome().textContent = `₱${data.monthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    monthlyExpenses().textContent = `₱${data.monthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    totalBalance().textContent = `₱${data.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    savingsRate().textContent = `${data.savingsRate.toFixed(1)}%`;
}

function renderInsights(insights) {
    const insightsList = ui.insightsList();
    if (!insights || insights.length === 0) {
        insightsList.innerHTML = '<li>No specific insights generated at this time.</li>';
        return;
    }
    insightsList.innerHTML = insights
        .map(item => `<div class="insight-item">
                        <div class="insight-icon ${getPriorityClass(item.priority)}"><i class="fas ${getInsightIcon(item.category)}"></i></div>
                        <div class="insight-content">
                            <h4>${item.title}</h4>
                            <p>${item.description}</p>
                        </div>
                     </div>`)
        .join('');
}

function renderRecommendations(actions) {
    const actionsList = ui.actionsList();
    if (!actions || actions.length === 0) {
        actionsList.innerHTML = '<li>No specific actions recommended at this time.</li>';
        return;
    }
    actionsList.innerHTML = actions
        .map(item => `<div class="action-item">
                        <div class="action-icon ${getPriorityClass(item.priority)}"><i class="fas fa-tasks"></i></div>
                        <div class="action-content">
                            <h4>${item.title}</h4>
                            <p>${item.description}</p>
                        </div>
                     </div>`)
        .join('');
}

// --- Data Calculation ---

function calculateFinancialOverview(accounts, transactions) {
    const monthlyIncome = calculateMonthlyAverage(transactions, 'income');
    const monthlyExpenses = calculateMonthlyAverage(transactions, 'expense');
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;
    
    return { monthlyIncome, monthlyExpenses, totalBalance, savingsRate };
}

function calculateMonthlyAverage(transactions, type) {
    const relevantTransactions = transactions.filter(t => t.type === type);
    if (relevantTransactions.length === 0) return 0;

    const monthMap = relevantTransactions.reduce((acc, t) => {
        const month = new Date(t.date).toISOString().slice(0, 7);
        acc[month] = (acc[month] || 0) + t.amount;
        return acc;
    }, {});

    const numMonths = Object.keys(monthMap).length;
    const total = Object.values(monthMap).reduce((sum, amount) => sum + amount, 0);
    
    return numMonths > 0 ? total / numMonths : 0;
}


// --- AI Generation & Logic ---

function cleanAndParseJson(jsonString) {
    if (!jsonString) return null;
    const cleanedString = jsonString.replace(/```json|```/g, '').trim();
    try {
        return JSON.parse(cleanedString);
    } catch (e) {
        console.error("Failed to parse JSON:", e, "Response was:", cleanedString);
        return null;
    }
}

async function generateInsightsAndRecommendations(financialData, accounts, transactions) {
    // Generate insights and recommendations in parallel
    const insightsPromise = generateInsights(financialData, transactions);
    const recommendationsPromise = generateRecommendations(financialData, accounts, transactions);

    const [insights, recommendations] = await Promise.all([
        insightsPromise,
        recommendationsPromise,
    ]);

    renderInsights(insights);
    renderRecommendations(recommendations);
}

async function generateRecommendations(financialData, accounts, transactions) {
    const prompt = buildRecommendationsPrompt(financialData, accounts, transactions);
    try {
        const response = await callGeminiAI(prompt);
        return cleanAndParseJson(response) || getDefaultRecommendations();
    } catch (error) {
        console.error("Failed to generate recommendations:", error);
        return getDefaultRecommendations(); // Fallback
    }
}

async function generateInsights(financialData, transactions) {
    const prompt = buildInsightsPrompt(financialData, transactions);
    try {
        const response = await callGeminiAI(prompt);
        return cleanAndParseJson(response) || getDefaultInsights();
    } catch (error) {
        console.error("Failed to generate insights:", error);
        return getDefaultInsights(); // Fallback
    }
}

// --- Prompt Engineering ---

function buildRecommendationsPrompt(financialData, accounts, transactions) {
    return `As WealthBuilder AI, your goal is to guide a user in the Philippines from saving to strategic investing. Based on the following financial data, provide personalized, actionable recommendations for building long-term wealth.

Financial Snapshot:
- Monthly Income: ₱${financialData.monthlyIncome.toLocaleString()}
- Monthly Expenses: ₱${financialData.monthlyExpenses.toLocaleString()}
- Current Investment/Savings Rate: ${financialData.savingsRate.toFixed(2)}%
- Total Liquid Assets: ₱${accounts.reduce((sum, acc) => acc.type === 'savings' || acc.type === 'checking' ? sum + acc.balance : sum, 0).toLocaleString()}

Account Balances:
${accounts.map(acc => `- ${acc.accountType} (${acc.name}): ₱${acc.balance.toLocaleString()}`).join('\n')}

Please provide 3-4 high-impact recommendations. Focus on:
1. Investment Strategy: Suggest a diversified portfolio (e.g., mix of Philippine stocks via index funds/UITFs, Pag-IBIG MP2, digital bank savings for high yield).
2. Increasing Investable Capital: Pinpoint areas in spending to optimize.
3. Debt Management: If loans are present, suggest strategies like the avalanche or snowball method.

Return the response as a valid JSON array of objects. Each object must have "title", "description", and "priority" ('high', 'medium', 'low').
Example: [{"title": "Start a Diversified UITF", "description": "Invest in a local equity index UITF to capture market growth.", "priority": "high"}]`;
}


function buildInsightsPrompt(financialData, transactions) {
    return `As a sharp financial analyst AI, your task is to identify key insights from a user's financial data. Provide a concise analysis of their spending habits, income patterns, and savings behavior.

Financial Snapshot:
- Monthly Income: ₱${financialData.monthlyIncome.toLocaleString()}
- Monthly Expenses: ₱${financialData.monthlyExpenses.toLocaleString()}
- Savings Rate: ${financialData.savingsRate.toFixed(2)}%

Recent Transactions (sample):
${transactions.slice(0, 20).map(t => `- ${t.name}: ₱${t.amount.toLocaleString()} (${t.type})`).join('\n')}

Based on this, generate 3-4 critical insights.
Focus on:
1. Spending Habits: Where is the money going? Is there a concentration in a specific category?
2. Income Stability: Is income regular or fluctuating?
3. Savings Potential: How does their savings rate compare to a benchmark (e.g., 20%)?

Return the response as a valid JSON array of objects. Each object must have "title", "description", "category" ('spending', 'income', 'savings'), and "priority" ('high', 'medium', 'low').
Example: [{"title": "High Discretionary Spending", "description": "A significant portion of your expenses is on non-essentials.", "category": "spending", "priority": "high"}]`;
}


// --- Fallback Data & Helpers ---

function getDefaultRecommendations() {
    return [
        { title: "Build an Emergency Fund", description: "Aim to save 3-6 months of living expenses in a high-yield savings account.", priority: "high" },
        { title: "Explore Low-Cost Investments", description: "Consider starting with Pag-IBIG MP2 or a local index fund UITF.", priority: "medium" },
    ];
}

function getDefaultInsights() {
    return [
        { title: "Track Your Spending", description: "Get a clearer picture of where your money goes by categorizing every expense.", category: "spending", priority: "high" },
    ];
}

function getPriorityClass(priority) {
    switch (priority) {
        case 'high': return 'priority-high';
        case 'medium': return 'priority-medium';
        case 'low': return 'priority-low';
        default: return '';
    }
}

function getInsightIcon(category) {
    switch (category) {
        case 'spending': return 'fa-shopping-cart';
        case 'income': return 'fa-wallet';
        case 'savings': return 'fa-piggy-bank';
        default: return 'fa-info-circle';
    }
}

