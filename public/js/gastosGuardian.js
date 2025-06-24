import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { GEMINI_API_KEY } from "./config.js";
import { getUserTransactions } from "./firestoredb.js";

const auth = getAuth();
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

// UI Elements
const loadingState = document.getElementById('loading-state');
const contentState = document.getElementById('content-state');
const emptyState = document.getElementById('empty-state');
const logoutBtn = document.getElementById('logout-btn');
const spendingLeaksContent = document.getElementById('spending-leaks-content');
const tipidTipsContent = document.getElementById('tipid-tips-content');
const expenseChartCanvas = document.getElementById('expense-chart');
let expenseChart = null; // To hold the chart instance

// --- Main Initialization ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        initializeApp(user);
    } else {
        window.location.href = '/pages/login.html';
    }
});

logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    signOut(auth).then(() => {
        window.location.href = '/index.html';
    }).catch((error) => {
        console.error('Sign out error', error);
    });
});

async function initializeApp(user) {
    try {
        setUIState('loading');
        const transactions = await getUserTransactions(user.uid);

        if (!transactions || transactions.length < 3) {
            setUIState('empty');
            return;
        }

        await processAndDisplayAIContent(transactions);
        setUIState('content');

    } catch (error) {
        console.error("Initialization failed:", error);
        setUIState('empty');
    }
}

async function processAndDisplayAIContent(transactions) {
    const transactionSummaryForAI = transactions.map(t => `- ${t.name}: ₱${t.amount} (${t.type})`).join('\n');
    
    // Define all AI-driven tasks
    const tasks = [
        analyzeAndDisplayExpenseCategories(transactionSummaryForAI),
        generateSpendingLeaks(transactionSummaryForAI),
        generateTipidTips(transactionSummaryForAI)
    ];

    await Promise.all(tasks);
}

// --- UI State Management ---
function setUIState(state) {
    loadingState.classList.toggle('hidden', state !== 'loading');
    contentState.classList.toggle('hidden', state !== 'content');
    emptyState.classList.toggle('hidden', state !== 'empty');
}

// --- AI Generation Functions ---
async function callGeminiAPI(prompt) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) throw new Error(`API call failed: ${response.status}`);
        
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return null;
    }
}

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

async function analyzeAndDisplayExpenseCategories(summary) {
    const prompt = `
        Analyze the following list of user transactions. Categorize each expense into relevant Filipino-specific categories.
        Common categories include: Food & Groceries, Transportation, Bills (Rent, Utilities), Load/Data, Padala (Remittances), Health, Entertainment, Shopping, and Sari-Sari Store.
        Aggregate the total amount for each category.

        Transactions:
        ${summary}

        Provide the output in this exact JSON format:
        {
          "categories": [
            {"category": "Category Name", "amount": TotalAmount},
            {"category": "Another Category", "amount": TotalAmount}
          ]
        }
    `;
    const responseText = await callGeminiAPI(prompt);
    const data = cleanAndParseJson(responseText);

    if (data && data.categories) {
        renderExpenseChart(data.categories);
    } else {
        spendingLeaksContent.innerHTML = '<p>Could not analyze expense categories at this moment.</p>';
    }
}

async function generateSpendingLeaks(summary) {
    const prompt = `
        As an AI "Gastos Guardian," analyze these Filipino user transactions and identify 2-3 potential "spending leaks."
        Focus on common areas where Filipinos might overspend, like frequent online shopping, expensive data plans, or too many small, un-tracked purchases.
        For each leak, provide a short, non-judgmental observation.

        Transactions:
        ${summary}

        Provide the output as a JSON array of strings:
        ["Observation about a potential leak.", "Another observation."]
    `;
    const responseText = await callGeminiAPI(prompt);
    const leaks = cleanAndParseJson(responseText);
    
    if (leaks && leaks.length) {
        spendingLeaksContent.innerHTML = `<ul>${leaks.map(item => `<li>${item}</li>`).join('')}</ul>`;
    } else {
        spendingLeaksContent.innerHTML = '<p>Great job! No significant spending leaks detected.</p>';
    }
}

async function generateTipidTips(summary) {
    const prompt = `
        As an AI "Gastos Guardian," provide 2-3 actionable "Tipid Tips" (thrifty tips) based on the user's spending habits.
        The tips must be culturally relevant to the Philippines. For example, if they spend on expensive coffee, suggest a local alternative. If they have high grocery bills, suggest palengke (wet market) shopping.

        Transactions:
        ${summary}

        Provide the output as a JSON array of strings:
        ["A culturally relevant tip.", "Another tip related to their spending."]
    `;
    const responseText = await callGeminiAPI(prompt);
    const tips = cleanAndParseJson(responseText);

    if (tips && tips.length) {
        tipidTipsContent.innerHTML = `<ul>${tips.map(item => `<li>${item}</li>`).join('')}</ul>`;
    } else {
        tipidTipsContent.innerHTML = '<p>Keep up the great work with your spending habits!</p>';
    }
}


// --- UI Rendering ---
function renderExpenseChart(categoryData) {
    if (expenseChart) {
        expenseChart.destroy(); // Destroy old chart instance if it exists
    }

    const labels = categoryData.map(c => c.category);
    const data = categoryData.map(c => c.amount);

    expenseChart = new Chart(expenseChartCanvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses',
                data: data,
                backgroundColor: [
                    '#10df6f', '#e96d1f', '#3498db', '#f1c40f', '#9b59b6',
                    '#e74c3c', '#1abc9c', '#34495e', '#2ecc71', '#ecf0f1'
                ],
                borderColor: '#060e21',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#ffffff',
                        font: {
                            size: 14
                        }
                    }
                }
            }
        }
    });
} 