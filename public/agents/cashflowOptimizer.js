import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserTransactions, getUserBankAccounts } from "../js/firestoredb.js";
import { callLocalAI, cleanAndParseJson } from "../js/agentCommon.js"; // Use the shared AI call function

const auth = getAuth();

// UI Elements
const loadingState = document.getElementById('loading-state');
const contentState = document.getElementById('content-state');
const emptyState = document.getElementById('empty-state');
const subscriptionContent = document.getElementById('subscription-content');
const optimizationTipsContent = document.getElementById('optimization-tips-content');
const cashflowChartCanvas = document.getElementById('cashflow-chart');
let cashflowChart = null;

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            initializeApp(user);
        } else {
            window.location.href = '../pages/login.html';
        }
    });
});

async function initializeApp(user) {
    try {
        setUIState('loading');
        const [transactions, accounts] = await Promise.all([
            getUserTransactions(user.uid),
            getUserBankAccounts(user.uid)
        ]);

        if (transactions && transactions.length > 0) {
            setUIState('content'); // Show content area immediately
            analyzeCashflow(transactions); // Render chart
            // Run AI analysis in parallel
            processAndDisplayAIContent(transactions, accounts);
        } else {
            setUIState('empty');
        }
    } catch (error) {
        console.error("Initialization failed:", error);
        setUIState('error'); // Use a specific error state
    }
}

async function processAndDisplayAIContent(transactions, accounts) {
    // --- CONSOLIDATED AI ANALYSIS ---
    try {
        const analysis = await getConsolidatedAnalysis(transactions, accounts);
        if (analysis) {
            displaySubscriptions(analysis.subscriptions || [], transactions);
            displayOptimizationTips(analysis.optimizationTips || [], transactions, accounts);
            displaySpendingAnalysis(analysis.spendingAnalysis || {}, transactions);
            displayCashflowForecast(analysis.cashflowForecast || null);
        } else {
            // If AI fails, run all fallbacks
            runFallbackAnalyses(transactions, accounts);
        }
    } catch (error) {
        console.error("Consolidated AI analysis failed:", error);
        runFallbackAnalyses(transactions, accounts);
    }
}

function runFallbackAnalyses(transactions, accounts) {
    displaySubscriptions(null, transactions);
    displayOptimizationTips(null, transactions, accounts);
    displaySpendingAnalysis(null, transactions);
    const forecast = getFallbackForecast(transactions);
    displayCashflowForecast(forecast);
}

async function getConsolidatedAnalysis(transactions, accounts) {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const topExpenses = getFallbackSpending(transactions);
    const top5ExpenseCategories = Object.entries(topExpenses)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([cat, amt]) => `${cat}: ₱${amt.toFixed(2)}`)
        .join(', ');

    const prompt = `
        Analyze the user's financial data provided below.
        
        DATA:
        ${JSON.stringify(transactions, null, 2)}

        TASKS:
        1. Identify recurring subscriptions.
        2. Provide 3-5 actionable cashflow optimization tips.
        3. Categorize all expenses and sum the totals for each category.
        4. Provide a brief, one-sentence cashflow forecast for the next 3 months based on the data.

        Your entire response MUST be a single, valid JSON object. Do not add any text, conversational filler, or markdown before or after the JSON object.
        The JSON object must follow this exact structure:
        {
          "subscriptions": [{"name": "string", "amount": "number"}],
          "optimizationTips": ["string"],
          "spendingAnalysis": { "category_name": "number" },
          "cashflowForecast": "string"
        }
    `;

    try {
        const responseText = await callLocalAI(prompt);
        return cleanAndParseJson(responseText);
    } catch (error) {
        console.error("Error in getConsolidatedAnalysis:", error);
        return null; // Return null to trigger fallbacks
    }
}

// --- UI State Management ---
function setUIState(state) {
    if (loadingState) loadingState.style.display = state === 'loading' ? 'flex' : 'none';
    if (contentState) contentState.style.display = state === 'content' ? 'block' : 'none';
    if (emptyState) emptyState.style.display = state === 'empty' ? 'flex' : 'none';

    // Add an error state for better user feedback
    if (state === 'error') {
        if (emptyState) {
            emptyState.style.display = 'flex';
            emptyState.innerHTML = `<i class="fas fa-exclamation-circle"></i><h3>Analysis Failed</h3><p>We couldn't analyze your data right now. Please try again later.</p>`;
        }
    }
}

// --- AI Generation Functions ---

function displaySubscriptions(subscriptions, fallbackTransactions) {
    if (subscriptions && subscriptions.length > 0) {
        subscriptionContent.innerHTML = `<ul>${subscriptions.map(item => `<li><i class="fas fa-receipt"></i><span>${item.name}</span><strong>₱${(item.amount || 0).toFixed(2)}/mo</strong></li>`).join('')}</ul>`;
    } else {
        // Fallback to rule-based analysis if AI returns nothing or fails
        const fallbackSubscriptions = getFallbackSubscriptions(fallbackTransactions);
        if (fallbackSubscriptions.length > 0) {
            subscriptionContent.innerHTML = `<ul>${fallbackSubscriptions.map(item => `<li><i class="fas fa-receipt"></i><span>${item.name}</span><strong>₱${item.amount.toFixed(2)}/mo</strong></li>`).join('')}</ul>`;
        } else {
            subscriptionContent.innerHTML = '<p>No recurring subscriptions were automatically detected.</p>';
        }
    }
}

function displayOptimizationTips(tips, fallbackTransactions, fallbackAccounts) {
    if (tips && tips.length > 0) {
        optimizationTipsContent.innerHTML = `<ul>${tips.map(item => `<li><i class="fas fa-lightbulb"></i>${item}</li>`).join('')}</ul>`;
    } else {
        // Fallback to rule-based analysis
        const fallbackTips = getFallbackTips(fallbackTransactions, fallbackAccounts);
        if (fallbackTips.length > 0) {
            optimizationTipsContent.innerHTML = `<ul>${fallbackTips.map(item => `<li><i class="fas fa-lightbulb"></i>${item}</li>`).join('')}</ul>`;
        } else {
            optimizationTipsContent.innerHTML = '<p>Your cashflow looks well-optimized already! Keep up the great work.</p>';
        }
    }
}

function displaySpendingAnalysis(spendingData, fallbackTransactions) {
    const spendingSpotlightContent = document.getElementById('spending-spotlight-content');
    if (!spendingSpotlightContent) return;

    const dataToDisplay = (spendingData && Object.keys(spendingData).length > 0) ? spendingData : getFallbackSpending(fallbackTransactions);

    if (Object.keys(dataToDisplay).length > 0) {
        const totalSpending = Object.values(dataToDisplay).reduce((sum, amount) => sum + amount, 0);
        
        const categories = Object.entries(dataToDisplay)
            .sort(([, a], [, b]) => b - a) // Sort by amount descending
            .slice(0, 5); // Show top 5

        let contentHTML = '';
        for (const [category, amount] of categories) {
            const percentage = totalSpending > 0 ? (amount / totalSpending) * 100 : 0;
            contentHTML += `
                <div class="spending-category">
                    <div class="category-header">
                        <span class="category-name">${category}</span>
                        <span class="category-amount">₱${amount.toFixed(2)}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%;"></div>
                    </div>
                </div>
            `;
        }
        spendingSpotlightContent.innerHTML = contentHTML;
    } else {
        spendingSpotlightContent.innerHTML = '<p>Not enough data to analyze spending patterns.</p>';
    }
}

function displayCashflowForecast(forecastText) {
    const forecastContent = document.getElementById('forecast-content');
    if (!forecastContent) return;

    if (forecastText) {
        forecastContent.innerHTML = `<p>${forecastText}</p>`;
    } else {
        // Fallback message
        forecastContent.innerHTML = '<p>Not enough transaction data is available to generate a reliable forecast.</p>';
    }
}

// --- Fallback Functions (Rule-Based) ---

function getFallbackForecast(transactions) {
    if (!transactions || transactions.length < 3) {
        return null;
    }

    const monthlyData = transactions.reduce((acc, t) => {
        // Ensure date is valid before processing
        if (!t.date || isNaN(new Date(t.date))) return acc;
        
        const month = new Date(t.date).toISOString().slice(0, 7);
        if (!acc[month]) {
            acc[month] = { income: 0, expenses: 0, count: 0 };
        }
        if (t.type === 'income') {
            acc[month].income += (t.amount || 0);
        } else if (t.type === 'expense') {
            acc[month].expenses += Math.abs(t.amount || 0);
        }
        acc[month].count++;
        return acc;
    }, {});

    const sortedMonths = Object.keys(monthlyData).sort().slice(-3); // Use last 3 months
    if (sortedMonths.length === 0) {
        return null;
    }

    const totalIncome = sortedMonths.reduce((sum, m) => sum + monthlyData[m].income, 0);
    const totalExpenses = sortedMonths.reduce((sum, m) => sum + monthlyData[m].expenses, 0);

    const avgMonthlyNet = (totalIncome - totalExpenses) / sortedMonths.length;

    if (avgMonthlyNet > 100) {
        return `Based on your average net cashflow of ₱${avgMonthlyNet.toFixed(2)}/month over the last ${sortedMonths.length} months, you are trending towards a healthy surplus. Keep this momentum to reach your financial goals faster.`;
    } else if (avgMonthlyNet < -100) {
        return `Your average net cashflow is ₱${avgMonthlyNet.toFixed(2)}/month. It's important to review your spending habits to prevent potential shortfalls and get back on track.`;
    } else {
        return `Your income and expenses have been closely matched recently. This is a good time to look for opportunities to increase your savings or reduce non-essential costs to build a stronger financial buffer.`;
    }
}

function getFallbackSubscriptions(transactions) {
    const recurring = {};
    const candidates = transactions.filter(t => t.type === 'expense');

    candidates.forEach(t => {
        // Defensive check for description
        if (t.description) {
            const name = t.description.toLowerCase().replace(/\\d/g, '').trim();
            if (recurring[name]) {
                recurring[name].count++;
                recurring[name].amounts.push(t.amount);
            } else {
                recurring[name] = { count: 1, amounts: [t.amount], originalName: t.description };
            }
        }
    });

    return Object.keys(recurring)
        .filter(key => recurring[key].count > 1)
        .map(key => ({
            name: recurring[key].originalName,
            amount: Math.abs(recurring[key].amounts.reduce((a, b) => a + b, 0) / recurring[key].amounts.length)
        }));
}

function getFallbackTips(transactions, accounts) {
    const tips = [];
    if (!transactions || !accounts) return tips;

    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const expenses = transactions.filter(t => t.type === 'expense');
    const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    const netCashflow = totalIncome - totalExpenses;

    // Tip 1: Emergency Fund
    if (totalExpenses > 0 && totalBalance < totalExpenses) {
        tips.push("Your current balance is less than one month of your expenses. Focus on building an emergency fund to cover unexpected costs.");
    }

    // Tip 2: High Spending Categories
    const spendingByCategory = getFallbackSpending(transactions);
    if (Object.keys(spendingByCategory).length > 1 && totalExpenses > 0) {
        const topCategory = Object.entries(spendingByCategory).sort(([, a], [, b]) => b - a)[0];
        if (topCategory) {
            const percentageOfExpenses = (topCategory[1] / totalExpenses) * 100;
            if (percentageOfExpenses > 30) {
                tips.push(`Your spending on '${topCategory[0]}' makes up ${percentageOfExpenses.toFixed(0)}% of your expenses. Review this area for potential savings.`);
            }
        }
    }

    // Tip 3: Subscriptions
    const subscriptions = getFallbackSubscriptions(transactions);
    if (subscriptions.length > 2) {
        tips.push(`You have ${subscriptions.length} recurring payments detected. Take a moment to review them and cancel any you no longer need.`);
    }

    // Tip 4: Cashflow Status
    if (netCashflow > 0 && totalIncome > 0) {
        tips.push(`With a positive cashflow of ₱${netCashflow.toFixed(2)}, consider allocating this surplus towards savings, investments, or paying down high-interest debt.`);
    }

    if (tips.length === 0) {
        tips.push("Your cashflow appears stable and well-managed. To further improve, consider setting a specific savings goal or exploring investment options.");
    }

    return tips;
}

function getFallbackSpending(transactions) {
    const spending = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        const category = t.category || 'Uncategorized';
        if (spending[category]) {
            spending[category] += Math.abs(t.amount || 0);
        } else {
            spending[category] = Math.abs(t.amount || 0);
        }
    });
    return spending;
}

// --- UI Rendering ---
function analyzeCashflow(transactions) {
    if (!cashflowChartCanvas) return;
    
    // Logic to prepare data for the chart (e.g., monthly aggregation)
    const monthlyData = transactions.reduce((acc, t) => {
        const month = new Date(t.date).toISOString().slice(0, 7);
        if (!acc[month]) {
            acc[month] = { income: 0, expenses: 0 };
        }
        if (t.type === 'income') {
            acc[month].income += t.amount;
        } else if (t.type === 'expense') {
            acc[month].expenses += Math.abs(t.amount);
        }
        return acc;
    }, {});

    // --- Update Summary Cards ---
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const netCashflow = totalIncome - totalExpenses;

    const formatAsCurrency = (amount) => `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    document.getElementById('summary-income').textContent = formatAsCurrency(totalIncome);
    document.getElementById('summary-expenses').textContent = formatAsCurrency(totalExpenses);
    document.getElementById('summary-net').textContent = formatAsCurrency(netCashflow);
    // --- End Update Summary Cards ---

    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths;
    const incomeData = sortedMonths.map(m => monthlyData[m].income);
    const expenseData = sortedMonths.map(m => monthlyData[m].expenses);

    if (cashflowChart) {
        cashflowChart.destroy();
    }

    cashflowChart = new Chart(cashflowChartCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Expenses',
                    data: expenseData,
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#f0f6fc' } },
                title: { display: true, text: 'Monthly Income vs. Expenses', color: '#f0f6fc', font: { size: 16 } }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    ticks: { color: '#8b949e' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: { 
                    ticks: { color: '#8b949e' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
} 