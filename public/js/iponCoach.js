import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { GEMINI_API_KEY } from "./config.js";
import { getUserData, getUserTransactions } from "./firestoredb.js";
import { apiRateLimiter, sanitizeText, createSafeElement, setSafeFormattedText } from "./security-utils.js";

const auth = getAuth();
const
    API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

// UI Elements
const loadingState = document.getElementById('loading-state');
const contentState = document.getElementById('content-state');
const emptyState = document.getElementById('empty-state');
const logoutBtn = document.getElementById('logout-btn');

// --- Main Initialization ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User is logged in:", user.uid);
        initializeApp(user);
    } else {
        console.log("User is not logged in. Redirecting to login page.");
        window.location.href = '/pages/login.html';
    }
});

logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    signOut(auth).then(() => {
        console.log('User signed out.');
        window.location.href = '/index.html';
    }).catch((error) => {
        console.error('Sign out error', error);
    });
});


async function initializeApp(user) {
    try {
        setUIState('loading');

        const [userData, transactions] = await Promise.all([
            getUserData(user.uid),
            getUserTransactions(user.uid)
        ]);

        if (!transactions || transactions.length < 3) {
            setUIState('empty');
            return;
        }

        // Process data and generate AI content
        await processAndDisplayAIContent(user.uid, userData, transactions);

        setUIState('content');

    } catch (error) {
        console.error("Initialization failed:", error);
        setUIState('empty'); // Fallback to empty state on error
    }
}

async function processAndDisplayAIContent(userId, userData, transactions) {
    const financialSummary = createFinancialSummary(transactions);
    
    // Define all AI-driven tasks
    const tasks = [
        generateAlkansyaChallenge(financialSummary),
        generateMotivationalQuote(),
        generateCoachTip(financialSummary),
        await displayUserGoals(userData, financialSummary)
    ];

    // Run all tasks in parallel
    await Promise.all(tasks);
}


// --- UI State Management ---
function setUIState(state) {
    loadingState.classList.toggle('hidden', state !== 'loading');
    contentState.classList.toggle('hidden', state !== 'content');
    emptyState.classList.toggle('hidden', state !== 'empty');
}

// --- Data Processing ---
function createFinancialSummary(transactions) {
    const summary = {
        totalIncome: 0,
        totalExpenses: 0,
        expenseCategories: {},
        transactionCount: transactions.length,
        recentTransactions: transactions.slice(0, 10) // Get 10 most recent
    };

    transactions.forEach(tx => {
        const amount = parseFloat(tx.amount);
        if (tx.type === 'income') {
            summary.totalIncome += amount;
        } else {
            summary.totalExpenses += amount;
            const category = tx.category || 'Uncategorized';
            summary.expenseCategories[category] = (summary.expenseCategories[category] || 0) + amount;
        }
    });

    summary.netSavings = summary.totalIncome - summary.totalExpenses;
    return summary;
}


// --- AI Generation Functions ---
async function callGeminiAPI(prompt) {
    // Check rate limiting
    if (!apiRateLimiter.isAllowed()) {
        const waitTime = Math.ceil(apiRateLimiter.getTimeUntilReset() / 1000);
        console.warn(`Rate limit exceeded. Please wait ${waitTime} seconds before making another request.`);
        return `Rate limit exceeded. Please wait ${waitTime} seconds and try again.`;
    }
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 2048,
                },
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API call failed with status ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.warn("No content candidates returned from API:", data);
            return "The AI coach is thinking... please try again in a moment.";
        }
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Could not get a response from the AI coach due to an error.";
    }
}

async function generateAlkansyaChallenge(summary) {
    const prompt = `
        As an AI "Ipon Coach," create a personalized Filipino-style savings challenge called an "Alkansya Challenge."
        Base it on this user's financial summary:
        - Total Monthly Income (estimate): ₱${summary.totalIncome.toFixed(2)}
        - Total Monthly Expenses: ₱${summary.totalExpenses.toFixed(2)}
        - Net Savings: ₱${summary.netSavings.toFixed(2)}
        - Top Expense Categories: ${JSON.stringify(summary.expenseCategories)}

        The challenge should be:
        1.  Culturally relevant to the Philippines.
        2.  Achievable and encouraging, not overwhelming.
        3.  Directly related to their spending habits (e.g., "50-Peso Bill Challenge" if they have many small expenses).
        
        Provide the output in this exact JSON format, with no other text:
        {
          "name": "Challenge Name (e.g., 'The 50-Peso Bill Ipon Challenge')",
          "description": "A short, fun description of the challenge (2-3 sentences).",
          "target": "A suggested monthly target amount as a number (e.g., 1000)."
        }
    `;
    const responseText = await callGeminiAPI(prompt);
    try {
        // Clean the response to remove markdown and get pure JSON
        const jsonString = responseText.replace(/```json|```/g, '').trim();
        const data = JSON.parse(jsonString);
        
        document.getElementById('challenge-name').textContent = data.name;
        document.getElementById('challenge-desc').textContent = data.description;
        document.getElementById('challenge-target').textContent = `₱${parseFloat(data.target).toLocaleString()}`;
    } catch (e) {
        console.error("Failed to parse Alkansya Challenge JSON:", e, "Response was:", responseText);
        document.getElementById('challenge-name').textContent = "Challenge Error";
        document.getElementById('challenge-desc').textContent = "Could not generate a savings challenge at this moment.";
    }
}



async function generateMotivationalQuote() {
    const prompt = `
        Provide a short, powerful Filipino motivational quote (salawikain) about the importance of saving money or financial prudence. 
        Provide only the quote itself and its English translation in this exact JSON format:
        {
          "tagalog": "The Tagalog quote.",
          "english": "The English translation."
        }
    `;
    const responseText = await callGeminiAPI(prompt);
    try {
        const jsonString = responseText.replace(/```json|```/g, '').trim();
        const data = JSON.parse(jsonString);
        
        // Safely set the motivational quote content
        const quoteElement = document.getElementById('motivational-quote');
        quoteElement.innerHTML = ''; // Clear existing content
        
        // Create safe elements for the quote
        const quoteText = createSafeElement('span', `"${sanitizeText(data.tagalog)}"`);
        const lineBreak = document.createElement('br');
        const translationText = createSafeElement('em', `(${sanitizeText(data.english)})`, 'text-sm text-secondary');
        
        // Append elements safely
        quoteElement.appendChild(quoteText);
        quoteElement.appendChild(lineBreak);
        quoteElement.appendChild(translationText);
        
    } catch (e) {
        console.error("Failed to parse motivational quote JSON:", e, "Response was:", responseText);
        // Generate a backup motivational quote using AI instead of hardcoding
        await generateBackupMotivationalQuote();
    }
}

async function generateBackupMotivationalQuote() {
    const simplePrompt = `
        Generate a simple Filipino motivational quote about saving money. 
        Just return: "Tagalog quote (English translation)"
        Keep it short and inspiring.
    `;
    
    try {
        const responseText = await callGeminiAPI(simplePrompt);
        const quoteElement = document.getElementById('motivational-quote');
        quoteElement.textContent = sanitizeText(responseText.trim());
    } catch (error) {
        console.error("Backup quote generation failed:", error);
        // Last resort fallback
        const quoteElement = document.getElementById('motivational-quote');
        quoteElement.textContent = "Ang hindi marunong magtipon, ay hindi marunong mag-ipon. (Those who don't know how to save, don't know how to prosper.)";
    }
}

async function generateCoachTip(summary) {
    const prompt = `
        Based on this user's financial summary, provide one single, actionable financial tip.
        - Total Monthly Income: ₱${summary.totalIncome.toFixed(2)}
        - Total Monthly Expenses: ₱${summary.totalExpenses.toFixed(2)}
        - Expense breakdown: ${JSON.stringify(summary.expenseCategories)}
        - Net Savings: ₱${summary.netSavings.toFixed(2)}

        The tip should be:
        1. Specific and easy to implement.
        2. Directly related to their largest or most frequent expense category.
        3. Framed positively and encouragingly.
        
        Start the tip with a header like "**Your Personalized Tip:**" and then the advice. Keep it concise (2-4 sentences).
    `;
    const responseText = await callGeminiAPI(prompt);
    
    // Safely format and display the coach tip
    const tipElement = document.getElementById('coach-tip-content');
    setSafeFormattedText(tipElement, sanitizeText(responseText));
}


// --- AI Goal Generation ---
async function generateSuggestedGoals(financialSummary) {
    const prompt = `
        Based on this user's financial summary, suggest 3 realistic financial goals that would be appropriate for a Filipino:
        
        - Monthly Income: ₱${financialSummary.totalIncome.toFixed(2)}
        - Monthly Expenses: ₱${financialSummary.totalExpenses.toFixed(2)}
        - Net Savings: ₱${financialSummary.netSavings.toFixed(2)}
        - Expense Categories: ${JSON.stringify(financialSummary.expenseCategories)}
        
        Generate culturally relevant goals in JSON format:
        [
            {
                "name": "Goal name (e.g., Emergency Fund, Dream House)",
                "target": target_amount_as_number,
                "saved": suggested_current_progress_as_number,
                "priority": "high|medium|low"
            }
        ]
        
        Make goals realistic and achievable based on their actual financial capacity.
    `;
    
    try {
        const responseText = await callGeminiAPI(prompt);
        const jsonString = responseText.replace(/```json|```/g, '').trim();
        const goals = JSON.parse(jsonString);
        return Array.isArray(goals) ? goals : [];
    } catch (error) {
        console.error("Failed to generate suggested goals:", error);
        // Return empty array - user can set their own goals
        return [];
    }
}

// --- UI Rendering Functions ---
async function displayUserGoals(userData, financialSummary) {
    const goalsContainer = document.getElementById('goals-container');
    // Use actual user goals or generate AI-suggested goals if none exist
    let goals = userData.financialProfile?.goals;
    
    // If no goals exist, generate AI-suggested goals based on user's financial profile
    if (!goals || goals.length === 0) {
        goals = await generateSuggestedGoals(financialSummary);
    }

    // Clear existing content
    goalsContainer.innerHTML = '';

    if (!goals || goals.length === 0) {
        const noGoalsMessage = createSafeElement('p', "You haven't set any financial goals yet. Go to your profile to add them!");
        goalsContainer.appendChild(noGoalsMessage);
        return;
    }

    // Create goals elements safely
    goals.forEach(goal => {
        const percentage = Math.min((goal.saved / goal.target) * 100, 100);
        
        // Create goal container
        const goalDiv = createSafeElement('div', '', 'goal');
        
        // Create goal info section
        const goalInfoDiv = createSafeElement('div', '', 'goal-info');
        const goalNameSpan = createSafeElement('span', sanitizeText(goal.name));
        const goalAmountSpan = createSafeElement('span', `₱${goal.saved.toLocaleString()} / ₱${goal.target.toLocaleString()}`);
        
        goalInfoDiv.appendChild(goalNameSpan);
        goalInfoDiv.appendChild(goalAmountSpan);
        
        // Create progress bar section
        const progressBarDiv = createSafeElement('div', '', 'progress-bar');
        const progressBarFillDiv = createSafeElement('div', `${percentage.toFixed(0)}%`, 'progress-bar-fill');
        progressBarFillDiv.style.width = `${percentage}%`;
        
        progressBarDiv.appendChild(progressBarFillDiv);
        
        // Assemble goal element
        goalDiv.appendChild(goalInfoDiv);
        goalDiv.appendChild(progressBarDiv);
        
        // Add to container
        goalsContainer.appendChild(goalDiv);
    });
} 