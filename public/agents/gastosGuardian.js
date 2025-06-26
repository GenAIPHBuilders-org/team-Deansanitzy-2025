import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { GEMINI_API_KEY } from "../js/config.js";
import { getUserTransactions } from "../js/firestoredb.js";

const auth = getAuth();
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

// UI Elements - Add null checks and error handling
const loadingState = document.getElementById('loading-state') || createFallbackElement('loading-state');
const contentState = document.getElementById('content-state') || createFallbackElement('content-state');
const emptyState = document.getElementById('empty-state') || createFallbackElement('empty-state');
const logoutBtn = document.getElementById('logout-btn');
const spendingLeaksContent = document.getElementById('spending-leaks-content');
const tipidTipsContent = document.getElementById('tipid-tips-content');
const expenseChartCanvas = document.getElementById('expense-chart');
let expenseChart = null; // To hold the chart instance

// Helper function to create fallback elements if they don't exist
function createFallbackElement(id) {
    console.log(`Creating fallback element for ${id}`);
    const element = document.createElement('div');
    element.id = id;
    element.classList.add('hidden');
    document.body.appendChild(element);
    return element;
}

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing Gastos Guardian');
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            initializeApp(user);
        } else {
            window.location.href = '/pages/login.html';
        }
    });

    // Only set up logout listener if button exists
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                window.location.href = '/index.html';
            }).catch((error) => {
                console.error('Sign out error', error);
            });
        });
    }

    // Add refresh button handler
    const refreshBtn = document.getElementById('refresh-data-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            window.refreshGastosGuardian();
        });
    }
});

async function initializeApp(user) {
    try {
        console.log('Initializing app for user:', user.uid);
        setUIState('loading');
        
        // Fetch transactions with better error handling
        let transactions;
        try {
            transactions = await getUserTransactions(user.uid);
            console.log('Fetched transactions:', transactions?.length || 0);
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
            transactions = [];
        }

        // Show content if there are any transactions
        if (transactions && transactions.length > 0) {
            console.log('Processing transactions for analysis');
            await processAndDisplayAIContent(transactions);
            setUIState('content');
        } else {
            console.log('No transactions found, showing empty state');
            setUIState('empty');
        }

    } catch (error) {
        console.error("Initialization failed:", error);
        setUIState('empty');
    }

}

// Add refresh functionality
window.refreshGastosGuardian = async function() {
    console.log('Refreshing Gastos Guardian data...');
    const user = auth.currentUser;
    if (user) {
        await initializeApp(user);
    } else {
        console.error('Cannot refresh: No authenticated user');
    }
};

async function processAndDisplayAIContent(transactions) {
    try {
        console.log('Processing transactions for AI analysis:', transactions.length);
        const transactionSummaryForAI = transactions.map(t => `- ${t.name}: ₱${t.amount} (${t.type})`).join('\n');
        
        // Update UI elements first
        if (contentState) {
            // Make sure all required elements exist
            const requiredElements = ['spending-leaks-content', 'tipid-tips-content', 'expense-chart'].filter(
                id => !document.getElementById(id)
            );
            
            if (requiredElements.length > 0) {
                console.log('Creating missing UI elements:', requiredElements);
                contentState.innerHTML = `
                    <div class="guardian-grid">
                        <div class="card forecast-card">
                            <div class="card-header">
                                <h3><i class="fas fa-chart-line"></i> Expense Analysis</h3>
                            </div>
                            <div class="card-content">
                                <canvas id="expense-chart"></canvas>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <h3><i class="fas fa-search"></i> Spending Leaks</h3>
                            </div>
                            <div class="card-content" id="spending-leaks-content">
                                <p>Analyzing your spending patterns...</p>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <h3><i class="fas fa-lightbulb"></i> Tipid Tips</h3>
                            </div>
                            <div class="card-content" id="tipid-tips-content">
                                <p>Generating personalized tips...</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        
        // Define all AI-driven tasks with error handling
        const tasks = [
            analyzeAndDisplayExpenseCategories(transactionSummaryForAI).catch(err => {
                console.error('Failed to analyze expense categories:', err);
                return null;
            }),
            generateSpendingLeaks(transactionSummaryForAI).catch(err => {
                console.error('Failed to generate spending leaks:', err);
                return null;
            }),
            generateTipidTips(transactionSummaryForAI).catch(err => {
                console.error('Failed to generate tipid tips:', err);
                return null;
            })
        ];

        await Promise.allSettled(tasks);
        console.log('AI content processing complete');
    } catch (error) {
        console.error('Error processing AI content:', error);
        // Show a user-friendly error message
        if (contentState) {
            contentState.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Sorry, we encountered an error analyzing your transactions. Please try refreshing the page.</p>
                    <button onclick="window.refreshGastosGuardian()" class="btn btn-secondary">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
        }
    }
}

// --- UI State Management ---
function setUIState(state) {
    try {
        console.log('Setting UI state to:', state);
        if (loadingState) loadingState.classList.toggle('hidden', state !== 'loading');
        if (contentState) contentState.classList.toggle('hidden', state !== 'content');
        if (emptyState) emptyState.classList.toggle('hidden', state !== 'empty');
    } catch (error) {
        console.error('Error setting UI state:', error);
    }
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
    try {
        if (!expenseChartCanvas) {
            console.error('Expense chart canvas not found');
            return;
        }

        if (expenseChart) {
            expenseChart.destroy(); // Destroy old chart instance if it exists
        }

        if (!categoryData || !Array.isArray(categoryData) || categoryData.length === 0) {
            console.warn('No category data available for chart');
            return;
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
                        position: 'right',
                        labels: {
                            color: '#fff',
                            font: {
                                family: 'Poppins'
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error rendering expense chart:', error);
    }
} 