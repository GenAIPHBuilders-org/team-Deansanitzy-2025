import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserTransactions, getUserBankAccounts } from "../js/firestoredb.js";
import { callGeminiAI } from "../js/agentCommon.js"; // Use the shared AI call function

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
    // We don't need to create a manual summary; the prompts will handle the raw data.
    const analysisPromises = [
        findSubscriptions(transactions),
        generateOptimizationTips(transactions, accounts),
        analyzeAndDisplaySpending(transactions)
    ];
    await Promise.all(analysisPromises);
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

async function findSubscriptions(transactions) {
    const prompt = `
        As a "Subscription Sleuth" AI, your task is to identify recurring payments from a list of financial transactions. 
        Analyze the following transaction data and identify anything that looks like a monthly or yearly subscription.

        Transactions:
        ${JSON.stringify(transactions, null, 2)}

        Look for patterns in transaction names (e.g., "Netflix", "Spotify", "AWS") and amounts that repeat over time.

        Please return the response as a JSON array of objects, where each object has "name" and "amount" properties. The amount should be the monthly cost.
        For example: [{"name": "Netflix", "amount": 15.99}, {"name": "Dopamine", "amount": 100.00}]
        If no subscriptions are found, return an empty array.
    `;
    
    try {
        const responseText = await callGeminiAI(prompt);
        const subscriptions = cleanAndParseJson(responseText);
        
        if (subscriptions && subscriptions.length > 0) {
            subscriptionContent.innerHTML = `<ul>${subscriptions.map(item => `<li><i class="fas fa-receipt"></i><span>${item.name}</span><strong>₱${item.amount.toFixed(2)}/mo</strong></li>`).join('')}</ul>`;
        } else {
            subscriptionContent.innerHTML = '<p>No recurring subscriptions were automatically detected.</p>';
        }
    } catch (error) {
        console.error("Error finding subscriptions:", error);
        // Fallback to rule-based analysis
        const fallbackSubscriptions = getFallbackSubscriptions(transactions);
        if (fallbackSubscriptions.length > 0) {
            subscriptionContent.innerHTML = `<ul>${fallbackSubscriptions.map(item => `<li><i class="fas fa-receipt"></i><span>${item.name}</span><strong>₱${item.amount.toFixed(2)}/mo</strong></li>`).join('')}</ul>`;
        } else {
            subscriptionContent.innerHTML = '<p class="error-text">Could not analyze subscriptions at this time.</p>';
        }
    }
}

async function generateOptimizationTips(transactions, accounts) {
    const prompt = `
        As a "Cashflow Optimizer" AI, your goal is to provide personalized, actionable tips to improve the user's financial health based on their real data.

        User's Financial Data:
        - Accounts: ${JSON.stringify(accounts, null, 2)}
        - Transactions: ${JSON.stringify(transactions, null, 2)}

        Analyze the data and provide 3-5 concise, actionable tips. Focus on:
        1.  **Reducing Spending**: Identify categories with high or non-essential spending.
        2.  **Increasing Savings**: Suggest ways to free up more cash.
        3.  **Optimizing Bills**: Look for opportunities to lower recurring bills.

        Please return the response as a simple JSON array of strings.
        For example: ["Consider using a budgeting app to track your 'Food' spending, which seems high.", "You have a high balance in a low-interest account. Consider moving some to a high-yield savings account."]
        If the user's finances look good, provide tips on accelerating wealth-building.
    `;

    try {
        const responseText = await callGeminiAI(prompt);
        const tips = cleanAndParseJson(responseText);

        if (tips && tips.length > 0) {
            optimizationTipsContent.innerHTML = `<ul>${tips.map(item => `<li><i class="fas fa-lightbulb"></i>${item}</li>`).join('')}</ul>`;
        } else {
            optimizationTipsContent.innerHTML = '<p>Your cashflow looks well-optimized already! Keep up the great work.</p>';
        }
    } catch (error) {
        console.error("Error generating tips:", error);
        // Fallback to rule-based analysis
        const fallbackTips = getFallbackTips(transactions, accounts);
        if (fallbackTips.length > 0) {
            optimizationTipsContent.innerHTML = `<ul>${fallbackTips.map(item => `<li><i class="fas fa-lightbulb"></i>${item}</li>`).join('')}</ul>`;
        } else {
            optimizationTipsContent.innerHTML = '<p class="error-text">Could not generate tips at this time.</p>';
        }
    }
}

async function analyzeAndDisplaySpending(transactions) {
    const spendingSpotlightContent = document.getElementById('spending-spotlight-content');
    if (!spendingSpotlightContent) return;

    const prompt = `
        As a "Spending Analyst" AI, your task is to categorize a user's expenses and calculate the total for each category.
        Analyze the following expense transactions and group them into logical categories (e.g., "Food & Dining", "Transportation", "Shopping", "Bills & Utilities", "Entertainment").

        Expense Transactions:
        ${JSON.stringify(transactions.filter(t => t.type === 'expense'), null, 2)}

        Please return the response as a JSON object where keys are the category names and values are the total spending for that category.
        For example:
        {
          "Food & Dining": 4500.75,
          "Transportation": 2250.00,
          "Shopping": 1800.50
        }
        Only include categories with actual spending. Do not invent categories.
    `;

    try {
        const responseText = await callGeminiAI(prompt);
        const spendingData = cleanAndParseJson(responseText);

        if (spendingData && Object.keys(spendingData).length > 0) {
            const totalSpending = Object.values(spendingData).reduce((sum, amount) => sum + amount, 0);
            
            const categories = Object.entries(spendingData)
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
    } catch (error) {
        console.error("Error analyzing spending:", error);
        // Fallback to rule-based analysis
        const fallbackSpending = getFallbackSpending(transactions);
        if (Object.keys(fallbackSpending).length > 0) {
            const totalSpending = Object.values(fallbackSpending).reduce((sum, amount) => sum + amount, 0);
            const categories = Object.entries(fallbackSpending)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5);

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
            spendingSpotlightContent.innerHTML = '<p class="error-text">Could not analyze spending at this time.</p>';
        }
    }
}

// --- Fallback Functions (Rule-Based) ---

function getFallbackSubscriptions(transactions) {
    const recurring = {};
    const candidates = transactions.filter(t => t.type === 'expense');

    candidates.forEach(t => {
        const name = t.description.toLowerCase().replace(/\d/g, '').trim();
        if (recurring[name]) {
            recurring[name].count++;
            recurring[name].amounts.push(t.amount);
        } else {
            recurring[name] = { count: 1, amounts: [t.amount], originalName: t.description };
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
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);

    if (totalBalance < totalExpenses * 3) {
        tips.push("Build an emergency fund of 3-6 months' worth of expenses.");
    }
    if (transactions.filter(t => t.category.toLowerCase() === 'food').length > 5) {
        tips.push("You have frequent 'Food' expenses. Consider cooking at home more often.");
    }
    return tips;
}

function getFallbackSpending(transactions) {
    const spending = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        const category = t.category || 'Uncategorized';
        if (spending[category]) {
            spending[category] += Math.abs(t.amount);
        } else {
            spending[category] = Math.abs(t.amount);
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
        if (t.amount > 0) { // Assuming positive amount is income
            acc[month].income += t.amount;
        } else { // Negative amount is expense
            acc[month].expenses += Math.abs(t.amount);
        }
        return acc;
    }, {});

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