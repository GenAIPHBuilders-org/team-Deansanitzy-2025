import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { GEMINI_API_KEY } from "./config.js";
import { getUserData, getUserTransactions } from "./firestoredb.js";

const auth = getAuth();
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

// UI Elements
const loadingState = document.getElementById('loading-state');
const contentState = document.getElementById('content-state');
const emptyState = document.getElementById('empty-state');
const logoutBtn = document.getElementById('logout-btn');

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
        const [userData, transactions] = await Promise.all([
            getUserData(user.uid),
            getUserTransactions(user.uid)
        ]);

        if (!transactions || transactions.length < 5) { // Needs more data for long-term planning
            setUIState('empty');
            return;
        }

        await processAndDisplayAIContent(userData, transactions);
        setUIState('content');

    } catch (error) {
        console.error("Initialization failed:", error);
        setUIState('empty');
    }
}

async function processAndDisplayAIContent(userData, transactions) {
    const summary = createFinancialSummary(transactions);
    const userProfile = {
        age: userData.age || 25, // Default age if not provided
        income: summary.totalIncome,
        savings: summary.netSavings,
        goals: userData.financialProfile?.goals || ["buy a house", "save for retirement"]
    };

    const tasks = [
        generateFinancialRoadmap(userProfile, summary),
        generateInvestmentInsights(userProfile),
        generateCareerSimulations(userProfile),
        generateBalancingActAdvice(userProfile)
    ];

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
    const summary = { totalIncome: 0, totalExpenses: 0 };
    transactions.forEach(tx => {
        const amount = parseFloat(tx.amount);
        if (tx.type === 'income') summary.totalIncome += amount;
        else summary.totalExpenses += amount;
    });
    summary.netSavings = summary.totalIncome - summary.totalExpenses;
    return summary;
}

// --- AI Generation & Rendering ---
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

async function generateFinancialRoadmap(userProfile, summary) {
    const prompt = `
        As a financial planner AI for a Filipino user, create a long-term financial roadmap.
        User Profile: Age ${userProfile.age}, Monthly Income ~₱${userProfile.income}, Monthly Savings ~₱${userProfile.savings}.
        User Goals: ${userProfile.goals.join(', ')}.
        Also consider common Filipino life events: supporting parents, marriage, children's education.
        
        Create a timeline with 4-5 major milestones.
        Provide the output in this exact JSON format:
        {
          "roadmap": [
            {"timeframe": "In 1-2 Years", "title": "Milestone Title", "description": "Details about the milestone."},
            {"timeframe": "In 3-5 Years", "title": "Milestone Title", "description": "Details about the milestone."}
          ]
        }
    `;
    const responseText = await callGeminiAPI(prompt);
    const data = cleanAndParseJson(responseText);
    const container = document.getElementById('financial-timeline');

    if (data && data.roadmap) {
        container.innerHTML = data.roadmap.map(event => `
            <div class="timeline-event">
                <div class="timeline-date">${event.timeframe}</div>
                <h3 class="timeline-title">${event.title}</h3>
                <p class="timeline-description">${event.description}</p>
            </div>
        `).join('');
    } else {
        container.innerHTML = "<p>Could not generate your financial roadmap at this time.</p>";
    }
}

async function generateInvestmentInsights(userProfile) {
    const prompt = `
        Based on a user profile for a ${userProfile.age}-year-old Filipino with a monthly income of ~₱${userProfile.income}, suggest 2-3 suitable investment options available in the Philippines.
        Consider their likely risk tolerance (moderate given the age). Include a mix of safe and growth-oriented options.
        For each, provide a brief explanation. Format the output as a simple HTML string.
        Example: "<h3>Pag-IBIG MP2 Savings</h3><p>A very safe, government-backed savings program with higher returns than traditional banks.</p>"
    `;
    const responseHtml = await callGeminiAPI(prompt);
    document.getElementById('investment-content').innerHTML = responseHtml || "<p>Could not load investment insights.</p>";
}

async function generateCareerSimulations(userProfile) {
    const prompt = `
        For a ${userProfile.age}-year-old Filipino, briefly simulate the financial pros and cons of two common career paths: 'BPO Professional' and 'OFW (Overseas Filipino Worker)'.
        Frame it as a strategic choice related to their financial goals. Format the output as a simple HTML string.
        Example: "<h3>BPO Professional</h3><p><strong>Pros:</strong> Stable income, career growth... <strong>Cons:</strong> Night shifts, potential burnout...</p>"
    `;
    const responseHtml = await callGeminiAPI(prompt);
    document.getElementById('career-content').innerHTML = responseHtml || "<p>Could not load career simulations.</p>";
}

async function generateBalancingActAdvice(userProfile) {
    const prompt = `
        Provide practical advice for a Filipino user on balancing personal financial goals (like buying a house) with common family obligations (like supporting parents or siblings).
        Offer 1-2 key strategies. Frame it as "The Balancing Act." Format the output as a simple HTML string.
        Example: "<h3>Set Clear Boundaries</h3><p>Have an open conversation with family about what you can realistically contribute...</p>"
    `;
    const responseHtml = await callGeminiAPI(prompt);
    document.getElementById('balancing-act-content').innerHTML = responseHtml || "<p>Could not load financial advice.</p>";
} 