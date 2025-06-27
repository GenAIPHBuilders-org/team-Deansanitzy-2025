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
    // --- CONSOLIDATED AI ANALYSIS ---
    try {
        const analysis = await getConsolidatedAnalysis(transactions, accounts);
        if (analysis) {
            displaySubscriptions(analysis.subscriptions || [], transactions);
            displayOptimizationTips(analysis.optimizationTips || [], transactions, accounts);
            displaySpendingAnalysis(analysis.spendingAnalysis || {}, transactions);
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
        You are an expert financial analyst AI. Your task is to analyze the user's financial summary and provide a consolidated analysis in a single JSON object.
        
        FINANCIAL SUMMARY:
        - Total Monthly Income: ₱${totalIncome.toFixed(2)}
        - Total Monthly Expenses: ₱${totalExpenses.toFixed(2)}
        - Top 5 Expense Categories: ${top5ExpenseCategories}
        - Total Transactions: ${transactions.length}

        Based on the full transaction list provided below, perform three tasks:
        1.  **Identify Subscriptions**: Find recurring monthly/yearly payments.
        2.  **Generate Optimization Tips**: Provide 3-5 actionable tips to improve cashflow.
        3.  **Analyze Spending**: Categorize all expenses and sum the totals.

        Full Transaction Data:
        ${JSON.stringify(transactions, null, 2)}

        Return a single, valid JSON object with the following structure. Do not include any other text or markdown.
        {
          "subscriptions": [{"name": "Example Subscription", "amount": 100.00}],
          "optimizationTips": ["Example tip 1.", "Example tip 2."],
          "spendingAnalysis": {"Example Category": 1500.50, "Another Category": 800.75}
        }
    `;

    try {
        const responseText = await callGeminiAI(prompt);
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

function cleanAndParseJson(jsonString) {
    if (!jsonString) return null;
    // Strip out JSON comments and any other markdown artifacts before parsing
    const cleanedString = jsonString
        .replace(/\/\/.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/```json|```/g, '')
        .trim();
        
    try {
        return JSON.parse(cleanedString);
    } catch (e) {
        console.error("Failed to parse JSON:", e, "Response was:", cleanedString);
        return null;
    }
}

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

// --- Fallback Functions (Rule-Based) ---

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