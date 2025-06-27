/**
 * WealthBuilder AI - V4.0
 * An AI agent designed for sophisticated, personalized financial planning and wealth building.
 * This version uses a unified prompt to generate a comprehensive wealth plan with visual charts.
 */

import { firebaseConfig } from "../js/config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserTransactions, getUserBankAccounts } from "../js/firestoredb.js";
import { callGeminiAI } from "../js/agentCommon.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

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
    strategicPlanList: () => getElement('insights-list'),
    tacticalStepsList: () => getElement('actions-list'),
    financialInsightsHeader: () => getElement('financial-insights').querySelector('.card-header'),
    recommendedActionsHeader: () => getElement('recommended-actions').querySelector('.card-header'),
    userPersona: () => getElement('user-persona'),
    aiSummaryText: () => getElement('ai-summary-text'),
    aiRiskAnalysis: () => getElement('ai-risk-analysis'),
    readinessGaugeChart: () => getElement('readiness-gauge-chart'),
    allocationChart: () => getElement('allocation-chart'),
};

// Chart instances to prevent duplicates
let readinessChart = null;
let allocationChart = null;

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

        // Generate the full wealth plan from the AI
        const wealthPlan = await generateWealthPlan(financialData, accounts, transactions);

        if (wealthPlan) {
            renderWealthPlan(wealthPlan);
        } else {
            // Handle cases where the AI might fail
            setUIState('error', 'Could not generate an AI-powered wealth plan at this time.');
        }

        setUIState('content');
    } catch (error) {
        console.error("WealthBuilder Analysis Failed:", error);
        setUIState('error', 'Could not build your wealth plan due to an unexpected error. Please try again later.');
    }
}

// --- UI State & Rendering ---
function setUIState(state, message = '') {
    const { loadingState, contentState, emptyState } = ui;
    loadingState().style.display = 'none';
    contentState().style.display = 'none';
    emptyState().style.display = 'none';

    switch (state) {
        case 'loading':
            loadingState().style.display = 'block';
            break;
        case 'content':
            contentState().style.display = 'block';
            break;
        case 'empty':
            emptyState().style.display = 'block';
            emptyState().innerHTML = `<i class="fas fa-box-open empty-icon"></i><p>${message || 'No data available. Please add accounts or transactions.'}</p>`;
            break;
        case 'error':
            emptyState().style.display = 'block';
            emptyState().innerHTML = `<i class="fas fa-exclamation-triangle error-icon"></i><p>${message}</p>`;
            break;
    }
}

function renderFinancialOverview(data) {
    const format = (num) => `₱${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    ui.monthlyIncome().textContent = format(data.monthlyIncome);
    ui.monthlyExpenses().textContent = format(data.monthlyExpenses);
    ui.totalBalance().textContent = format(data.totalBalance);
    ui.savingsRate().textContent = `${data.savingsRate.toFixed(1)}%`;
}

function renderWealthPlan(plan) {
    // Update text content
    ui.userPersona().textContent = plan.persona || 'Your Financial Profile';
    ui.aiSummaryText().textContent = plan.summary || 'No summary available.';
    ui.aiRiskAnalysis().innerHTML = `<strong>Risk Analysis:</strong> ${plan.riskAnalysis || 'Not available.'}`;

    // Render charts
    renderInvestmentReadinessGauge(plan.investmentReadinessScore || 0);
    renderPortfolioAllocationChart(plan.portfolioSuggestion);

    // Render text lists
    renderStrategicRecommendations(plan.strategicRecommendations);
    renderTacticalSteps(plan.tacticalSteps);
}

function renderInvestmentReadinessGauge(score) {
    const ctx = ui.readinessGaugeChart().getContext('2d');
    const scoreColor = score > 75 ? '#2ed573' : score > 50 ? '#ff9f43' : '#ff4757';

    if (readinessChart) {
        readinessChart.destroy();
    }

    readinessChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Readiness', ''],
            datasets: [{
                data: [score, 100 - score],
                backgroundColor: [scoreColor, '#394056'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
                datalabels: {
                    formatter: (value, context) => {
                        if (context.dataIndex === 0) {
                            return `${value}%`;
                        }
                        return '';
                    },
                    color: '#fff',
                    font: { size: 24, weight: 'bold' }
                }
            },
            elements: { arc: { cornerRadius: 5 } }
        },
        plugins: [ChartDataLabels]
    });
}

function renderPortfolioAllocationChart(allocation) {
    if (!allocation || !allocation.labels || !allocation.data) {
        ui.allocationChart().style.display = 'none';
        return;
    }
    const ctx = ui.allocationChart().getContext('2d');
    const backgroundColors = ['#1e90ff', '#2ed573', '#ff9f43', '#ff6384', '#a4b0be'];

    if (allocationChart) {
        allocationChart.destroy();
    }

    allocationChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: allocation.labels,
            datasets: [{
                data: allocation.data,
                backgroundColor: backgroundColors,
                borderColor: '#2a2d3e',
                borderWidth: 3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#fff', boxWidth: 15, padding: 15 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += `${context.parsed}%`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function renderStrategicRecommendations(recommendations) {
    const list = ui.strategicPlanList();
    if (!recommendations || recommendations.length === 0) {
        list.innerHTML = '<p>No strategic recommendations available.</p>';
        return;
    }
    list.innerHTML = recommendations.map(rec => `
        <div class="timeline-item strategic">
            <h4>${rec.title}</h4>
            <p>${rec.description}</p>
            <div class="details-grid">
                <div><strong>Type:</strong> ${rec.investmentType}</div>
                <div><strong>Risk:</strong> <span class="risk-${rec.riskLevel?.toLowerCase()}">${rec.riskLevel}</span></div>
                <div><strong>Horizon:</strong> ${rec.timeHorizon}</div>
            </div>
        </div>
    `).join('');
}

function renderTacticalSteps(steps) {
    const list = ui.tacticalStepsList();
    if (!steps || steps.length === 0) {
        list.innerHTML = '<p>No tactical steps available.</p>';
        return;
    }
    list.innerHTML = steps.map(step => `
        <div class="timeline-item tactical">
            <h4>${step.title}</h4>
            <p>${step.description}</p>
            <div class="details-grid">
                <div><strong>Difficulty:</strong> ${step.difficulty}</div>
                <div><strong>Impact:</strong> <span class="impact-${step.impact?.toLowerCase()}">${step.impact}</span></div>
            </div>
        </div>
    `).join('');
}

// --- Data Calculation ---
function calculateFinancialOverview(accounts, transactions) {
    const monthlyIncome = calculateMonthlyAverage(transactions, 'income');
    const monthlyExpenses = calculateMonthlyAverage(transactions, 'expense');
    const totalBalance = accounts.reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;
    
    return { monthlyIncome, monthlyExpenses, totalBalance, savingsRate };
}

function calculateMonthlyAverage(transactions, type) {
    const relevantTransactions = transactions.filter(t => t.type === type && t.amount > 0);
    if (relevantTransactions.length === 0) return 0;

    const monthMap = relevantTransactions.reduce((acc, t) => {
        const month = new Date(t.date).toISOString().slice(0, 7);
        acc[month] = (acc[month] || 0) + (parseFloat(t.amount) || 0);
        return acc;
    }, {});

    const numMonths = Object.keys(monthMap).length;
    const total = Object.values(monthMap).reduce((sum, amount) => sum + amount, 0);
    
    return numMonths > 0 ? total / numMonths : 0;
}

function categorizeAndSummarizeTransactions(transactions, limit = 5) {
    const expenseCategories = transactions
        .filter(t => t.type === 'expense' && t.category)
        .reduce((acc, t) => {
            const category = t.category || 'Uncategorized';
            acc[category] = (acc[category] || 0) + (parseFloat(t.amount) || 0);
            return acc;
        }, {});

    return Object.entries(expenseCategories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([name, total]) => ({ name, total: total.toFixed(2) }));
}

// --- AI Generation & Logic ---
function cleanAndParseJson(text) {
    if (!text) return null;
    
    // Find the start of the JSON object
    const startIndex = text.indexOf('{');
    if (startIndex === -1) {
        console.error("No JSON object found in response:", text);
        return null;
    }

    // Attempt to repair the JSON string
    let jsonString = text.substring(startIndex);
    // Find the last closing brace or bracket
    const lastBrace = jsonString.lastIndexOf('}');
    const lastBracket = jsonString.lastIndexOf(']');
    const lastIndex = Math.max(lastBrace, lastBracket);
    if (lastIndex > -1) {
        jsonString = jsonString.substring(0, lastIndex + 1);
    }
    
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse JSON:", e, "Attempted to parse:", jsonString);
        return null;
    }
}

async function generateWealthPlan(financialData, accounts, transactions) {
    const prompt = buildWealthBuilderPrompt(financialData, accounts, transactions);
    try {
        const response = await callGeminiAI(prompt, { maxOutputTokens: 2048 });
        return cleanAndParseJson(response);
    } catch (error) {
        console.error("Failed to generate wealth plan:", error);
        // Return a structured error object or null
        return null;
    }
}

// --- Prompt Engineering ---
function buildWealthBuilderPrompt(financialData, accounts, transactions) {
    const topExpenses = categorizeAndSummarizeTransactions(transactions);
    const accountSummary = accounts.map(acc => ({
        name: acc.name,
        type: acc.accountType,
        balance: acc.balance.toFixed(2)
    }));

    // FINAL PROMPT v4.0 - Sophisticated Wealth Advisor with Visuals
    return `You are "WealthBuilder AI," an expert wealth management advisor for the Philippine market. Your analysis must be personalized, detailed, and encouraging. Your entire response must be a single, valid JSON object. Do not include any other text or markdown.

**User's Financial Profile (PHP):**
- **Core Metrics:**
  - Average Monthly Income: ${financialData.monthlyIncome.toFixed(2)}
  - Average Monthly Expenses: ${financialData.monthlyExpenses.toFixed(2)}
  - Calculated Savings Rate: ${financialData.savingsRate.toFixed(1)}%
- **Assets:**
  - Total Liquid Balance: ${financialData.totalBalance.toFixed(2)}
  - Accounts: ${JSON.stringify(accountSummary)}
- **Spending Habits:**
  - Top 5 Expense Categories (Monthly Average): ${JSON.stringify(topExpenses)}

**Your Task:**
Based *only* on the data above, generate a comprehensive wealth-building plan.

**Required JSON Output Structure:**
{
  "persona": "<A short, encouraging persona title for the user, e.g., 'The Emerging Investor', 'The Disciplined Saver'>",
  "investmentReadinessScore": <Number, 0-100, assessing readiness based on savings, balance, and positive cash flow>,
  "summary": "<A 2-3 sentence personalized and encouraging summary of their wealth-building potential, directly referencing their data>",
  "riskAnalysis": "<A 1-2 sentence analysis of their current financial risk exposure based on their savings rate and emergency funds.>",
  "portfolioSuggestion": {
    "labels": ["<e.g., Stocks>", "<e.g., Bonds>", "<e.g., Emergency Fund>"],
    "data": [<Number, e.g., 50>, <Number, e.g., 30>, <Number, e.g., 20>]
  },
  "strategicRecommendations": [
    {
      "title": "<Specific, actionable title, e.g., 'Establish a Core Equity Investment via UITF'>",
      "description": "<Detailed explanation of why this strategy fits their profile, mentioning specific data points. Explain the 'what' and 'why'.>",
      "investmentType": "<Stocks|Bonds|UITF|MP2|Real Estate|REITs|Emergency Fund>",
      "riskLevel": "<Low|Medium|High>",
      "timeHorizon": "<1-3 Years|3-5 Years|5+ Years>"
    }
  ],
  "tacticalSteps": [
    {
      "title": "<Specific, actionable title, e.g., 'Automate ₱1,000 Monthly to Savings'>",
      "description": "<Clear, step-by-step guidance on how to execute this. Link it to their data, e.g., 'Given your ₱${financialData.monthlyIncome.toFixed(0)} income...'>",
      "difficulty": "<Easy|Moderate>",
      "impact": "<Medium|High>"
    }
  ]
}`;
}

