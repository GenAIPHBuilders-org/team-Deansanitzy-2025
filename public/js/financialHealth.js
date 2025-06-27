// Enhanced Financial Health Module using Gemini AI
import { GEMINI_API_KEY, GEMINI_MODEL } from "./config.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { 
    getUserBankAccounts,
    getUserTransactions,
    getUserData,
    collection,
    db,
    getDocs
} from "./firestoredb.js";
import { callGeminiAI } from '../js/agentCommon.js';

// Financial Health Configuration
const FINANCIAL_HEALTH_CONFIG = {
    emergencyFundMonthsTarget: 6,
    savingsRateTarget: 20,
    debtToIncomeRatioMax: 36,
    expenseRatioMax: 80,
    animationDuration: 1000,
    refreshInterval: 300000, // 5 minutes
    chartColors: {
        primary: '#10df6f',
        secondary: '#1a73e8',
        warning: '#ff9500',
        danger: '#ff4757',
        success: '#2ed573',
        info: '#3742fa',
        neutral: '#747d8c'
    }
};

// Initialize auth
const auth = getAuth();

// Get UI elements
const financialHealthContent = document.getElementById('financial-health-content');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessage = document.getElementById('error-message');

// State management functions
function showLoading() {
    if (financialHealthContent) {
        financialHealthContent.innerHTML = `
            <div class="loading-state">
                <div class="pulse-loader"></div>
                <p>Analyzing your financial data...</p>
            </div>
        `;
    }
}

function showError(message) {
    if (financialHealthContent) {
        financialHealthContent.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
                <button onclick="location.reload()" class="retry-button">
                    <i class="fas fa-sync"></i> Retry
                </button>
            </div>
        `;
    }
}

function showPlaceholderData() {
    if (financialHealthContent) {
        financialHealthContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <h3>Let's Start Your Financial Journey</h3>
                <p>Add your accounts and transactions to get a personalized financial health analysis.</p>
                <a href="accounts.html" class="primary-button">
                    <i class="fas fa-plus"></i> Add Financial Data
                </a>
            </div>
        `;
    }
}

// Get user's financial data
async function getUserFinancialData(user) {
    try {
        console.log('Fetching financial data for user:', user.uid);
        
        // Get accounts, transactions, and profile in parallel
        const [accounts, transactions, profileData] = await Promise.all([
            getUserBankAccounts(user.uid),
            getUserTransactions(user.uid),
            getUserData(user.uid)
        ]);
        
        return {
            accounts: accounts || [],
            transactions: transactions || [],
            profile: profileData || {}
        };
    } catch (error) {
        console.error('Error fetching financial data:', error);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeFinancialHealth();
});

async function initializeFinancialHealth() {
    try {
        showLoading();
        
        // Check if user is logged in
        const user = auth.currentUser;
        if (!user) {
            // If no user yet, wait for auth state to change
            const unsubscribe = auth.onAuthStateChanged(async (user) => {
                if (user) {
                    unsubscribe(); // Stop listening once we have a user
                    try {
                        const userData = await getUserFinancialData(user);
                        await processFinancialData(userData);
                    } catch (dataError) {
                        console.error('Error loading user data after auth:', dataError);
                        showError("Failed to load financial data. Please try again.");
                    }
                } else {
                    showError("Please log in to view your financial health analysis.");
                }
            });
            return;
        }

        // Get user's financial data
        const userData = await getUserFinancialData(user);
        await processFinancialData(userData);

    } catch (error) {
        console.error('Failed to initialize financial health:', error);
        showError("Failed to initialize financial health analysis. Please try again.");
    }
}

async function processFinancialData(userData) {
    try {
        if (!userData || (!userData.accounts?.length && !userData.transactions?.length)) {
            showPlaceholderData();
            return;
        }

        // Get AI-powered analysis
        const analysis = await analyzeFinancialHealth(userData);
        
        // Render the financial health widget
        renderFinancialHealthWidget(analysis, userData);
        
        // Initialize interactions and animations
        initializeInteractions();
        initializeAnimations();
        
    } catch (error) {
        console.error('Error processing financial data:', error);
        showError("Failed to process financial data. Please try again.");
    }
}

async function analyzeFinancialHealth(userData) {
    if (!GEMINI_API_KEY) {
        console.log('Gemini API key not configured, using offline analysis');
        return enhancedOfflineAnalysis(userData);
    }

    try {
        const prompt = generateFinancialPrompt(userData);
        
        try {
            const aiResponse = await callGeminiAI(prompt, { maxOutputTokens: 2048 });
            
            if (!aiResponse) {
                console.log('Invalid Gemini API response, falling back to offline analysis');
                return enhancedOfflineAnalysis(userData);
            }

            const analysis = await parsePlainTextAnalysis(aiResponse, userData);

            // ROBUSTNESS CHECK: If AI response is incomplete, use the reliable offline analysis.
            if (!analysis.insights || analysis.insights.length === 0 || !analysis.recommendations || analysis.recommendations.length === 0) {
                console.log('AI analysis was incomplete (missing insights or recommendations). Falling back to full offline analysis.');
                return enhancedOfflineAnalysis(userData);
            }

            return enhanceAIAnalysis(analysis, userData);

        } catch (apiError) {
            console.error('All API retries failed:', apiError);
            console.log('Falling back to offline analysis after all retries failed');
            return enhancedOfflineAnalysis(userData);
        }
    } catch (error) {
        console.error('Failed to get AI analysis:', error);
        console.log('Falling back to offline analysis due to error');
        return enhancedOfflineAnalysis(userData);
    }
}

async function parsePlainTextAnalysis(text, userData) {
    let analysis = {}; // Start with an empty object

    try {
        // --- The Ultimate JSON Repair and Reconstruction Engine ---

        // 1. Find the first '{' to start the JSON string and discard any preamble.
        const firstBraceIndex = text.indexOf('{');
        if (firstBraceIndex === -1) throw new Error("No '{' found in AI response.");
        let jsonString = text.substring(firstBraceIndex);

        // 2. Aggressively remove common non-JSON patterns from the AI response.
        jsonString = jsonString.replace(/\/\/.*$/gm, ''); // Remove single-line comments.
        jsonString = jsonString.replace(/\*\*.*\*\*[\s\S]*/, ''); // Remove markdown headers and all subsequent text.

        // 3. Find the last meaningful character (brace or bracket) to discard trailing garbage.
        const lastBracket = jsonString.lastIndexOf(']');
            const lastBrace = jsonString.lastIndexOf('}');
        const lastCharIndex = Math.max(lastBracket, lastBrace);
        if (lastCharIndex === -1) throw new Error("No closing bracket found after cleaning.");
        jsonString = jsonString.substring(0, lastCharIndex + 1);

        // 4. Reconstruct the object by adding missing closing brackets using a stack.
        const stack = [];
        let inString = false;
        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i];
            if (char === '"' && (i === 0 || jsonString[i-1] !== '\\')) {
                inString = !inString;
            } else if (!inString) {
                if (char === '{' || char === '[') {
                    stack.push(char);
                } else if (char === '}') {
                    if (stack.length > 0 && stack[stack.length - 1] === '{') stack.pop();
                } else if (char === ']') {
                    if (stack.length > 0 && stack[stack.length - 1] === '[') stack.pop();
                }
            }
        }
        while (stack.length > 0) {
            const openChar = stack.pop();
            jsonString += (openChar === '{') ? '}' : ']';
        }

        // 5. Perform final syntax repairs on the reconstructed string.
        jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3'); // Add quotes to unquoted keys.
        
        // This regex finds colon-separated values that are unquoted strings and adds quotes.
        // It avoids quoting numbers, true, false, null, objects, or arrays.
        jsonString = jsonString.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, p1) => {
            if (p1 === 'true' || p1 === 'false' || p1 === 'null') {
                return `: ${p1}`;
            }
            return `: "${p1}"`;
        });

        jsonString = jsonString.replace(/,\s*([\}\]])/g, '$1'); // Remove trailing commas.
        jsonString = jsonString.replace(/\}\s*\{/g, '},{'); // Add missing commas between objects.

        const parsedData = JSON.parse(jsonString);

        // 6. Validate the structure of the parsed data to ensure it's usable.
        analysis = {
            healthScore: parsedData.healthScore || 50,
            summary: parsedData.summary || "AI summary was not provided.",
            insights: Array.isArray(parsedData.insights) ? parsedData.insights : [],
            recommendations: Array.isArray(parsedData.recommendations) ? parsedData.recommendations : [],
            riskAssessment: parsedData.riskAssessment || { shortTerm: [], longTerm: [], mitigationStrategies: [] }
        };

    } catch (error) {
        console.error("Failed to parse final AI JSON analysis. The response was likely malformed beyond simple repair.", error);
        console.error("Original malformed response for review:", text); // Log the original failing text
        return { insights: [], recommendations: [] }; // Critical fallback
    }

    // 7. Manually calculate metrics and add them to the analysis.
    const { accounts, transactions } = userData;
    const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
    const monthlyTransactions = getMonthlyTransactions(transactions);
    const monthlyIncome = calculateMonthlyIncome(monthlyTransactions);
    const monthlyExpenses = calculateMonthlyExpenses(monthlyTransactions);
    
    analysis.metrics = {
        savingsRate: monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0,
        expenseRatio: monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 100,
        emergencyFundMonths: monthlyExpenses > 0 ? totalBalance / monthlyExpenses : 0,
        debtToIncome: 0,
        investmentAllocation: 0,
    };
    
    return analysis;
}

function generateFinancialPrompt(userData) {
    const { accounts, transactions, profile } = userData;
    
    // Calculate some basic metrics to help the AI
    const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
    const monthlyTransactions = getMonthlyTransactions(transactions);
    const monthlyIncome = calculateMonthlyIncome(monthlyTransactions);
    const monthlyExpenses = calculateMonthlyExpenses(monthlyTransactions);
    const statedMonthlyIncome = profile?.financialProfile?.monthlyIncome || 0;
    
    // Sanitize user-generated strings to prevent breaking the prompt structure
    const sanitizeForPrompt = (str) => (str || '').replace(/"/g, "'").replace(/\n/g, ' ').trim();
    
    const transactionData = monthlyTransactions.map(tx => ({
        type: tx.type,
        description: sanitizeForPrompt(tx.description),
        category: tx.category,
        amount: Math.abs(parseFloat(tx.amount || 0)),
        date: tx.date,
    }));

    const accountData = accounts.map(acc => ({
        name: sanitizeForPrompt(acc.name),
        accountType: acc.accountType,
        balance: parseFloat(acc.balance || 0),
    }));
    
    // FINAL ROBUST PROMPT v6: Ask for a specific quantity of smarter, non-hardcoded analysis.
    return `You are a world-class financial analyst AI, specializing in providing hyper-personalized, actionable advice. Your response MUST be a single, valid JSON object and nothing else.

**CRITICAL INSTRUCTIONS:**
1.  **JSON ONLY:** Your entire response must be a raw string representing a single JSON object, starting with \`{\` and ending with \`}\`.
2.  **NO MARKDOWN OR COMMENTS:** Do NOT wrap the JSON in markdown blocks, comments, or any other text.
3.  **VALID & COMPLETE JSON:** Ensure the JSON is valid. All keys and string values must use double quotes. No trailing commas. Fill all fields.
4.  **DEEPLY PERSONALIZED ANALYSIS (NO GENERIC ADVICE):** Analyze the provided data deeply. Do NOT provide hardcoded, generic, or placeholder advice. Every insight and recommendation must be directly derived from the user's specific data. For example, if you suggest saving money, pinpoint the exact expense categories (e.g., "Your 'Dining Out' spending of ₱5,000 is high relative to your income") rather than saying "spend less."
5.  **QUANTITY & DIVERSITY:** You MUST generate AT LEAST 6 detailed and diverse insights and AT LEAST 4 actionable recommendations. The insights should cover various financial areas like spending, saving, income, and account health. This is a mandatory requirement.

**USER'S FINANCIAL DATA (in PHP):**
This data is provided in JSON format.
- Core Profile: { "statedMonthlyIncome": ${statedMonthlyIncome.toFixed(2)}, "employmentStatus": "${profile?.financialProfile?.employmentStatus || 'Not specified'}" }
- Account Summary: { "totalBalance": ${totalBalance.toFixed(2)}, "transactionalMonthlyIncome": ${monthlyIncome.toFixed(2)}, "monthlyExpenses": ${monthlyExpenses.toFixed(2)} }
- Accounts Details: ${JSON.stringify(accountData)}
- Recent Transactions (Current Month): ${JSON.stringify(transactionData)}

**YOUR TASK:**
Based *only* on the data above, perform a detailed financial health analysis and generate the JSON response below.

**JSON RESPONSE STRUCTURE:**
{
  "healthScore": <Number 0-100, calculated based on savings rate, emergency fund, and debt (if available)>,
  "summary": "<One-sentence, personalized summary of their current financial status>",
  "insights": [
    // REQUIRED: Generate at least 6 diverse and detailed insights here.
    { "type": "<strength|weakness|opportunity>", "priority": "<low|medium|high>", "title": "<Specific, data-driven title>", "description": "<Detailed description that references specific numbers or transactions from the user's data>", "impact": "<low|medium|high>" }
  ],
  "recommendations": [
    // REQUIRED: Generate at least 4 actionable recommendations here.
    { "title": "<Actionable, specific title>", "description": "<Clear, step-by-step guidance on what to do, referencing their data>", "impact": "<low|medium|high>", "timeframe": "<immediate|short_term|long_term>", "difficulty": "<easy|moderate|challenging>", "expectedOutcome": "<A quantifiable outcome, e.g., 'Increase savings by ₱1,500/month'>" }
  ],
  "riskAssessment": {
    "shortTerm": ["<A specific, personalized short-term risk based on the user's data>", "<Another risk>"],
    "longTerm": ["<A specific, personalized long-term risk based on the user's data>", "<Another risk>"],
    "mitigationStrategies": ["<An actionable mitigation strategy for the identified risks>", "<Another strategy>"]
  }
}
`;
}

function getMonthlyTransactions(transactions) {
    if (!transactions || transactions.length === 0) {
        return [];
    }

    // Find the date of the most recent transaction to ensure we analyze the correct month
    const mostRecentDate = new Date(
        Math.max.apply(
            null,
            transactions.map(t => new Date(t.date || t.timestamp))
        )
    );
    
    const analysisMonth = mostRecentDate.getMonth();
    const analysisYear = mostRecentDate.getFullYear();

    return transactions.filter(tx => {
        const txDate = new Date(tx.date || tx.timestamp);
        return txDate.getMonth() === analysisMonth && txDate.getFullYear() === analysisYear;
    });
}

function calculateMonthlyIncome(transactions) {
    return transactions
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
}

function calculateMonthlyExpenses(transactions) {
    return transactions
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);
}

function categorizeTransactions(transactions) {
    const categories = {};
    
    transactions.forEach(tx => {
        const category = tx.category || 'uncategorized';
        if (!categories[category]) {
            categories[category] = {
                count: 0,
                total: 0,
                transactions: []
            };
        }
        
        categories[category].count++;
        categories[category].total += Math.abs(parseFloat(tx.amount || 0));
        categories[category].transactions.push({
            amount: tx.amount,
            date: tx.date || tx.timestamp,
            description: tx.description
        });
    });
    
    return categories;
}

function enhanceAIAnalysis(analysis, userData) {
    // Sanitize and enhance the analysis from the AI to prevent rendering errors
    const enhancedAnalysis = {
        ...analysis,
        metrics: {
            ...(analysis.metrics || {}),
            lastUpdated: new Date().toISOString()
        },
        // Sanitize insights to ensure all required fields are present
        insights: (Array.isArray(analysis.insights) ? analysis.insights : []).map(insight => ({
            type: insight.type || 'info',
            priority: insight.priority || 'medium',
            title: insight.title || 'Insight Not Available',
            description: insight.description || 'The AI did not provide a description for this insight.',
            impact: insight.impact || 'Not specified.',
            trend: insight.trend || 'stable'
        })),
        // Sanitize recommendations to ensure all required fields are present for the Action Plan
        recommendations: (Array.isArray(analysis.recommendations) ? analysis.recommendations : []).map(rec => ({
            title: rec.title || 'Recommendation Not Available',
            description: rec.description || 'The AI did not provide a description for this recommendation.',
            impact: rec.impact || 'medium',
            timeframe: rec.timeframe || 'short_term',
            difficulty: rec.difficulty || 'moderate',
            expectedOutcome: rec.expectedOutcome || 'Positive financial impact.',
            alternativeSolutions: rec.alternativeSolutions || []
        })),
        riskAssessment: {
            shortTerm: Array.isArray(analysis.riskAssessment?.shortTerm) ? analysis.riskAssessment.shortTerm : [],
            longTerm: Array.isArray(analysis.riskAssessment?.longTerm) ? analysis.riskAssessment.longTerm : [],
            mitigationStrategies: Array.isArray(analysis.riskAssessment?.mitigationStrategies) ? analysis.riskAssessment.mitigationStrategies : []
        }
    };

    return enhancedAnalysis;
}

function renderFinancialHealthWidget(analysis, userData) {
    if (!financialHealthContent) return;

    const healthScore = analysis.healthScore;
    const scoreColor = healthScore >= 80 ? FINANCIAL_HEALTH_CONFIG.chartColors.success :
                      healthScore >= 60 ? FINANCIAL_HEALTH_CONFIG.chartColors.primary :
                      healthScore >= 40 ? FINANCIAL_HEALTH_CONFIG.chartColors.warning :
                      FINANCIAL_HEALTH_CONFIG.chartColors.danger;

    financialHealthContent.innerHTML = `
        <div class="financial-health-widget">
            <div class="health-score-section">
                <div class="health-score-container">
                    <div class="health-score-circle" style="background: conic-gradient(${scoreColor} ${healthScore}%, #2a2d3e ${healthScore}% 100%)">
                        <div class="health-score-inner">
                            <div class="score-value">${healthScore}</div>
                            <div class="score-label">Your Score</div>
                        </div>
                    </div>
                    <div class="health-summary">
                        <h3>Your Financial Health Status</h3>
                        <p>${analysis.summary}</p>
                    </div>
                </div>
            </div>

            <div class="metrics-grid">
                <div class="metric-card savings">
                    <div class="metric-icon">
                        <i class="fas fa-piggy-bank"></i>
                    </div>
                    <div class="metric-content">
                        <div class="metric-title">Your Savings Rate</div>
                        <div class="metric-value ${analysis.metrics.savingsRate >= FINANCIAL_HEALTH_CONFIG.savingsRateTarget ? 'positive' : 'negative'}">
                            ${analysis.metrics.savingsRate.toFixed(1)}%
                        </div>
                        <div class="metric-target">Target: ${FINANCIAL_HEALTH_CONFIG.savingsRateTarget}%</div>
                        <div class="metric-progress">
                            <div class="progress-bar" style="width: ${Math.min(100, (analysis.metrics.savingsRate / FINANCIAL_HEALTH_CONFIG.savingsRateTarget) * 100)}%"></div>
                        </div>
                    </div>
                </div>

                <div class="metric-card expenses">
                    <div class="metric-icon">
                        <i class="fas fa-wallet"></i>
                    </div>
                    <div class="metric-content">
                        <div class="metric-title">Your Expense Ratio</div>
                        <div class="metric-value ${analysis.metrics.expenseRatio <= FINANCIAL_HEALTH_CONFIG.expenseRatioMax ? 'positive' : 'negative'}">
                            ${analysis.metrics.expenseRatio.toFixed(1)}%
                        </div>
                        <div class="metric-target">Your Target: < ${FINANCIAL_HEALTH_CONFIG.expenseRatioMax}%</div>
                        <div class="metric-progress">
                            <div class="progress-bar" style="width: ${Math.min(100, (analysis.metrics.expenseRatio / FINANCIAL_HEALTH_CONFIG.expenseRatioMax) * 100)}%"></div>
                        </div>
                    </div>
                </div>

                <div class="metric-card emergency">
                    <div class="metric-icon">
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <div class="metric-content">
                        <div class="metric-title">Your Emergency Fund</div>
                        <div class="metric-value ${analysis.metrics.emergencyFundMonths >= FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget ? 'positive' : 'negative'}">
                            ${analysis.metrics.emergencyFundMonths.toFixed(1)} months
                        </div>
                        <div class="metric-target">Your Target: ${FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget} months</div>
                        <div class="metric-progress">
                            <div class="progress-bar" style="width: ${Math.min(100, (analysis.metrics.emergencyFundMonths / FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget) * 100)}%"></div>
                        </div>
                    </div>
                </div>

                <div class="metric-card investment">
                    <div class="metric-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="metric-content">
                        <div class="metric-title">Your Investment Allocation</div>
                        <div class="metric-value">${analysis.metrics.investmentAllocation}%</div>
                        <div class="metric-target">Recommended: 15-30%</div>
                        <div class="metric-progress">
                            <div class="progress-bar" style="width: ${Math.min(100, (analysis.metrics.investmentAllocation / 30) * 100)}%"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="financial-details-tabs">
                <div class="tab-headers">
                    <button class="tab-link active" data-tab="insights">Key Insights</button>
                    <button class="tab-link" data-tab="recommendations">Your Action Plan</button>
                    <button class="tab-link" data-tab="risks">Risk Assessment</button>
                </div>

                <div id="insights" class="tab-content">
                    <div class="insights-section">
                        <h3>Your Key Financial Insights</h3>
                        <div class="insights-grid">
                            ${
                                (() => {
                                    const displayedInsights = analysis.insights.slice(0, 6);
                                    let insightsHtml = displayedInsights.map(insight => `
                                        <div class="insight-card ${insight.type}" data-trend="${insight.trend}">
                                            <div class="insight-header">
                                                <div class="insight-icon">
                                                    ${getInsightIcon(insight.type)}
                                                </div>
                                                <div class="insight-priority ${insight.priority}">
                                                    ${insight.priority.toUpperCase()}
                                                </div>
                                                <div class="insight-trend">
                                                    <i class="fas fa-fw fa-${getTrendIcon(insight.trend)}"></i>
                                                </div>
                                            </div>
                                            <div class="insight-content">
                                                <h4>${insight.title}</h4>
                                                <p>${insight.description}</p>
                                                <div class="insight-impact">
                                                    <strong>Impact on your finances:</strong> ${insight.impact}
                                                </div>
                                            </div>
                                        </div>
                                    `).join('');

                                    const placeholdersNeeded = 6 - displayedInsights.length;
                                    if (placeholdersNeeded > 0) {
                                        for (let i = 0; i < placeholdersNeeded; i++) {
                                            insightsHtml += `
                                                <div class="insight-card placeholder">
                                                    <div class="placeholder-content">
                                                        <i class="fas fa-stream"></i>
                                                        <span>More insights will appear as you add data.</span>
                                                    </div>
                                                </div>
                                            `;
                                        }
                                    }
                                    return insightsHtml;
                                })()
                            }
                        </div>
                    </div>
                </div>

                <div id="recommendations" class="tab-content" style="display: none;">
                    <div class="recommendations-section">
                        <h3>Your Personalized Action Plan</h3>
                        <div class="recommendations-grid">
                            ${analysis.recommendations.map(rec => `
                                <div class="recommendation-card">
                                    <div class="recommendation-header">
                                        <div class="recommendation-impact ${rec.impact}">
                                            ${rec.impact.toUpperCase()} IMPACT
                                        </div>
                                        <div class="recommendation-timeframe ${rec.timeframe}">
                                            ${formatTimeframe(rec.timeframe)}
                                        </div>
                                        <div class="recommendation-difficulty ${rec.difficulty}">
                                            ${rec.difficulty.toUpperCase()}
                                        </div>
                                    </div>
                                    <div class="recommendation-content">
                                        <h4>${rec.title}</h4>
                                        <p>${rec.description}</p>
                                        <div class="recommendation-outcome">
                                            <strong>Expected Outcome for you:</strong> ${rec.expectedOutcome}
                                        </div>
                                        ${rec.alternativeSolutions && rec.alternativeSolutions.length > 0 ? `
                                            <div class="recommendation-alternatives">
                                                <strong>Alternative approaches for you:</strong>
                                                <ul>
                                                    ${rec.alternativeSolutions.map(alt => `<li>${alt}</li>`).join('')}
                                                </ul>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div id="risks" class="tab-content" style="display: none;">
                    <div class="risk-assessment-section">
                        <h3>Your Financial Risk Assessment</h3>
                        <div class="risk-grid">
                            <div class="risk-column">
                                <h4>Short-term Risks to You</h4>
                                <ul class="risk-list">
                                    ${analysis.riskAssessment.shortTerm.map(risk => `
                                        <li class="risk-item">
                                            <i class="fas fa-exclamation-triangle"></i>
                                            ${risk}
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                            <div class="risk-column">
                                <h4>Long-term Risks to You</h4>
                                <ul class="risk-list">
                                    ${analysis.riskAssessment.longTerm.map(risk => `
                                        <li class="risk-item">
                                            <i class="fas fa-chart-line"></i>
                                            ${risk}
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                            <div class="risk-column">
                                <h4>How You Can Mitigate Risks</h4>
                                <ul class="risk-list">
                                    ${analysis.riskAssessment.mitigationStrategies.map(strategy => `
                                        <li class="risk-item">
                                            <i class="fas fa-shield-alt"></i>
                                            ${strategy}
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add event listeners for tabs
    const tabLinks = financialHealthContent.querySelectorAll('.tab-link');
    const tabContents = financialHealthContent.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            const tabId = event.currentTarget.dataset.tab;

            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => (c.style.display = 'none'));

            event.currentTarget.classList.add('active');
            const activeTab = financialHealthContent.querySelector(`#${tabId}`);
            if (activeTab) {
                activeTab.style.display = 'block';
            }
        });
    });

    initializeTooltips();
    initializeInteractions();
    initializeAnimations();
}

function getInsightIcon(type) {
    const icons = {
        strength: '<i class="fas fa-star"></i>',
        weakness: '<i class="fas fa-exclamation-circle"></i>',
        opportunity: '<i class="fas fa-lightbulb"></i>',
        threat: '<i class="fas fa-shield-alt"></i>'
    };
    return icons[type] || '<i class="fas fa-info-circle"></i>';
}

function getTrendIcon(trend) {
    switch (trend) {
        case 'improving':
            return 'arrow-up';
        case 'declining':
            return 'arrow-down';
        default:
            return 'equals';
    }
}

function formatTimeframe(timeframe) {
    switch (timeframe) {
        case 'immediate':
            return 'Do Now';
        case 'short_term':
            return '1-3 Months';
        case 'long_term':
            return '3+ Months';
        default:
            return timeframe;
    }
}

function initializeTooltips() {
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(element => {
        tippy(element, {
            content: element.getAttribute('data-tooltip'),
            placement: 'top',
            theme: 'custom'
        });
    });
}

function initializeInteractions() {
    // Add any interactive features here
    const insightCards = document.querySelectorAll('.insight-card');
    insightCards.forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('expanded');
        });
    });
}

function initializeAnimations() {
    // Add animations for metrics and scores
    const scoreValue = document.querySelector('.score-value');
    if (scoreValue) {
        scoreValue.style.animation = `fadeInScale ${FINANCIAL_HEALTH_CONFIG.animationDuration}ms ease-out`;
    }

    const metricValues = document.querySelectorAll('.metric-value');
    metricValues.forEach((metric, index) => {
        metric.style.animation = `slideInUp ${FINANCIAL_HEALTH_CONFIG.animationDuration}ms ease-out ${index * 200}ms`;
    });
}

function enhancedOfflineAnalysis(userData) {
    try {
        const { accounts, transactions, profile } = userData;
        
        // Calculate total balances and monthly flows
        const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
        const monthlyTransactions = getMonthlyTransactions(transactions);
        const monthlyIncome = calculateMonthlyIncome(monthlyTransactions);
        const monthlyExpenses = calculateMonthlyExpenses(monthlyTransactions);

        // Calculate key metrics
        const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;
        const emergencyFundMonths = monthlyExpenses > 0 ? totalBalance / monthlyExpenses : 0;

        // --- Generate a guaranteed set of 6+ offline insights ---
        const insights = [];

        // Insight 1: AI Status
        insights.push({ type: "weakness", priority: "high", title: "AI Analysis Offline", description: "You're seeing a standard analysis because the AI engine is currently offline. Key metrics are calculated, but personalized insights are unavailable.", impact: "low", trend: "stable" });

        // Insight 2: Savings Rate
        if (savingsRate >= FINANCIAL_HEALTH_CONFIG.savingsRateTarget) {
            insights.push({ type: "strength", priority: "high", title: "Excellent Savings Rate", description: `Your savings rate of ${savingsRate.toFixed(1)}% is above the recommended ${FINANCIAL_HEALTH_CONFIG.savingsRateTarget}%, which is fantastic for building wealth.`, impact: "high", trend: "stable" });
        } else {
            insights.push({ type: "opportunity", priority: "medium", title: "Opportunity to Boost Savings", description: `Your current savings rate is ${savingsRate.toFixed(1)}%. Aiming for the recommended ${FINANCIAL_HEALTH_CONFIG.savingsRateTarget}% could significantly accelerate your financial goals.`, impact: "medium", trend: "stable" });
        }
        
        // Insight 3: Emergency Fund
        if (emergencyFundMonths >= FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget) {
            insights.push({ type: "strength", priority: "high", title: "Strong Emergency Fund", description: `You have ${emergencyFundMonths.toFixed(1)} months of expenses saved, exceeding the ${FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget}-month target. This provides a strong financial safety net.`, impact: "high", trend: "stable" });
        } else {
            insights.push({ type: "weakness", priority: "high", title: "Grow Your Emergency Fund", description: `Your emergency fund currently covers ${emergencyFundMonths.toFixed(1)} months of expenses. Building this up to the recommended ${FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget} months is crucial for financial security.`, impact: "high", trend: "stable" });
        }

        // Insight 4: Top Expense Category
        const expenseTransactions = monthlyTransactions.filter(tx => tx.type === 'expense');
        if (expenseTransactions.length > 0) {
            const categorizedExpenses = categorizeTransactions(expenseTransactions);
            const topCategory = Object.keys(categorizedExpenses).reduce((a, b) => categorizedExpenses[a].total > categorizedExpenses[b].total ? a : b);
            if (topCategory && topCategory !== 'uncategorized') {
                const topCategoryTotal = categorizedExpenses[topCategory].total;
                const percentageOfExpenses = monthlyExpenses > 0 ? (topCategoryTotal / monthlyExpenses) * 100 : 0;
                insights.push({ type: "opportunity", priority: "medium", title: `Review '${topCategory}' Spending`, description: `Your spending on '${topCategory}' was ₱${topCategoryTotal.toFixed(2)} this month, making up ${percentageOfExpenses.toFixed(0)}% of your total expenses. Reviewing this could unlock savings.`, impact: "medium", trend: "stable" });
            }
        }

        // Insight 5: Income vs. Expenses
        if (monthlyIncome > monthlyExpenses) {
            insights.push({ type: "strength", priority: "medium", title: "Positive Cash Flow", description: `This month, your income of ₱${monthlyIncome.toFixed(2)} exceeded your expenses of ₱${monthlyExpenses.toFixed(2)}, resulting in a surplus. This is key to growing savings.`, impact: "high", trend: "stable" });
        } else {
            insights.push({ type: "weakness", priority: "high", title: "Negative Cash Flow Alert", description: `This month, your expenses (₱${monthlyExpenses.toFixed(2)}) were higher than your income (₱${monthlyIncome.toFixed(2)}). It's important to address this to avoid debt.`, impact: "high", trend: "stable" });
        }

        // Insight 6: Account Diversity
        if (accounts.length > 3) {
             insights.push({ type: "opportunity", priority: "low", title: "Simplify Your Accounts", description: `You have ${accounts.length} different bank accounts. Consolidating them could simplify your financial management and potentially lead to better interest rates.`, impact: "low", trend: "stable" });
        } else {
            insights.push({ type: "strength", priority: "low", title: "Focused Financial Accounts", description: `With ${accounts.length} bank accounts, your finances are streamlined and easy to manage.`, impact: "low", trend: "stable" });
        }

        // Calculate health score
        let healthScore = 10;
        healthScore += Math.max(0, Math.min(35, (savingsRate / FINANCIAL_HEALTH_CONFIG.savingsRateTarget) * 35));
        healthScore += Math.max(0, Math.min(40, (emergencyFundMonths / FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget) * 40));
        healthScore = Math.round(Math.min(100, Math.max(0, healthScore)));

        // --- Generate data-driven risk assessment ---
        const riskAssessment = {
            shortTerm: [],
            longTerm: [],
            mitigationStrategies: []
        };

        if (emergencyFundMonths < FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget / 2) {
            riskAssessment.shortTerm.push(`Critically low emergency fund (${emergencyFundMonths.toFixed(1)} months) poses an immediate risk from unexpected expenses (e.g., medical, job loss).`);
            riskAssessment.mitigationStrategies.push("Prioritize building your emergency fund to at least 3 months of expenses immediately.");
        } else if (emergencyFundMonths < FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget) {
            riskAssessment.shortTerm.push(`Insufficient emergency fund (${emergencyFundMonths.toFixed(1)} months) increases vulnerability to financial shocks.`);
            riskAssessment.mitigationStrategies.push("Automate monthly transfers to your emergency savings account.");
        }

        if (savingsRate < 10) {
            riskAssessment.shortTerm.push("Very low savings rate may lead to reliance on debt for minor unexpected costs.");
            riskAssessment.longTerm.push("Current savings rate is insufficient for long-term goals like retirement or major purchases.");
            riskAssessment.mitigationStrategies.push("Review your budget for non-essential expenses that can be redirected to savings.");
        }

        const offlineExpenseTransactions = monthlyTransactions.filter(tx => tx.type === 'expense');
        if (offlineExpenseTransactions.length > 0) {
            const categorizedExpenses = categorizeTransactions(offlineExpenseTransactions);
            const topCategory = Object.keys(categorizedExpenses).reduce((a, b) => categorizedExpenses[a].total > categorizedExpenses[b].total ? a : b, '');
            if (topCategory) {
                const topCategoryPercentage = monthlyExpenses > 0 ? (categorizedExpenses[topCategory].total / monthlyExpenses) * 100 : 0;
                if (topCategoryPercentage > 30) {
                    riskAssessment.shortTerm.push(`High spending concentration in '${topCategory}' (${topCategoryPercentage.toFixed(0)}%) creates budget vulnerability if this category's costs rise.`);
                    riskAssessment.mitigationStrategies.push(`Set a specific budget for the '${topCategory}' category and track your spending against it.`);
                }
            }
        }
        
        riskAssessment.longTerm.push("Without dedicated investment accounts, your savings may lose purchasing power to inflation over time.");
        riskAssessment.mitigationStrategies.push("Consider opening a low-cost index fund or consulting a financial advisor to start investing.");

        // Return a clear, non-hardcoded fallback analysis
        return {
            healthScore: healthScore,
            summary: `Your standard financial health score is ${healthScore}/100. This is based on key metrics, as AI analysis is currently unavailable.`,
            metrics: {
                savingsRate: parseFloat(savingsRate.toFixed(1)),
                debtToIncome: 0,
                expenseRatio: monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 100,
                emergencyFundMonths: parseFloat(emergencyFundMonths.toFixed(1)),
                investmentAllocation: 0,
                discretionarySpending: 0,
                basicNecessitiesRatio: 0,
                financialSustainability: 0
            },
            insights: insights, // Use the dynamically generated insights
            recommendations: [{
                title: "Review Your Key Metrics",
                description: "The scores above for Savings Rate and Emergency Fund are based on standard financial guidelines. Use them as a starting point to assess your financial standing.",
                impact: "medium", timeframe: "immediate", difficulty: "easy",
                expectedOutcome: "Gain a clearer understanding of your current financial health.",
            }, {
                title: "Categorize Your Spending",
                description: "For a clearer picture of your finances, ensure all your transactions are categorized correctly. This will improve the quality of both standard and AI-powered analyses.",
                impact: "medium", timeframe: "short_term", difficulty: "easy",
                expectedOutcome: "More accurate financial insights and better spending awareness.",
            }],
            riskAssessment: riskAssessment
        };
    } catch (error) {
        console.error('Error in offline analysis:', error);
        // Return a minimal valid structure if there's an error in calculations
        return {
            healthScore: 0,
            summary: "Unable to perform analysis due to an unexpected error. Please try again.",
            metrics: { savingsRate: 0, debtToIncome: 0, expenseRatio: 0, emergencyFundMonths: 0, investmentAllocation: 0 },
            insights: [{
                type: "weakness",
                title: "Error During Analysis",
                description: "A calculation error occurred. Please refresh to try again.",
                priority: "high",
                impact: "Analysis could not be completed.",
                trend: "stable"
            }],
            recommendations: [],
            riskAssessment: { shortTerm: [], longTerm: [], mitigationStrategies: [] }
        };
    }
}

// ... rest of the file remains unchanged ...
