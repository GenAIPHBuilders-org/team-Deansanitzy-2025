// Enhanced Financial Health Module using Gemini AI
import { GEMINI_API_KEY, GEMINI_MODEL } from "./config.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { 
    getUserBankAccounts,
    getUserTransactions,
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
        
        // Get accounts and transactions in parallel
        const [accounts, transactions] = await Promise.all([
            getUserBankAccounts(user.uid),
            getUserTransactions(user.uid)
        ]);
        
        return {
            accounts: accounts || [],
            transactions: transactions || []
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
        let jsonString = text.trim();
        
        // 1. Aggressively find and extract the JSON object from the raw text.
        // First, look for a markdown block. If found, use its content.
        const jsonBlockMatch = jsonString.match(/```json\s*(\{[\s\S]*?\})\s*```/s);
        if (jsonBlockMatch && jsonBlockMatch[1]) {
            jsonString = jsonBlockMatch[1];
        } else {
            // If not in a markdown block, find the first and last brace to extract the object.
            const firstBrace = jsonString.indexOf('{');
            const lastBrace = jsonString.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                jsonString = jsonString.substring(firstBrace, lastBrace + 1);
            } else {
                console.error("No valid JSON object could be extracted from the AI response.", {rawResponse: text});
                throw new Error("No valid JSON object found in AI response.");
            }
        }

        // 2. Clean up common JSON syntax errors from LLMs
        let sanitizedString = jsonString
            // Remove invalid control characters that can break JSON.parse.
            // This leaves valid whitespace like \n, \r, \t.
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
            // Remove comments, although the prompt should prevent this.
            .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
            // Remove trailing commas before closing braces or brackets. A frequent error.
            .replace(/,\s*([\}\]])/g, '$1');

        const parsedData = JSON.parse(sanitizedString);

        // 3. Validate the structure of the parsed data to ensure it's usable
        analysis = {
            healthScore: parsedData.healthScore || 50,
            summary: parsedData.summary || "AI summary was not provided.",
            insights: Array.isArray(parsedData.insights) ? parsedData.insights : [],
            recommendations: Array.isArray(parsedData.recommendations) ? parsedData.recommendations : [],
            riskAssessment: { shortTerm: [], longTerm: [], mitigationStrategies: [] } // default this
        };

    } catch (error) {
        console.error("Failed to parse final AI JSON analysis. The response was likely malformed beyond simple repair.", error);
        console.error("Original malformed response for review:", text); // Log the original failing text
        return { insights: [], recommendations: [] }; // Critical fallback
    }

    // 4. Manually calculate metrics and add them to the analysis
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
    const { accounts, transactions } = userData;
    
    // Calculate some basic metrics to help the AI
    const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
    const monthlyTransactions = getMonthlyTransactions(transactions);
    const monthlyIncome = calculateMonthlyIncome(monthlyTransactions);
    const monthlyExpenses = calculateMonthlyExpenses(monthlyTransactions);
    
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
    
    // FINAL ROBUST PROMPT v4: Use JSON for data to prevent confusion.
    return `You are a financial analyst AI. Your response MUST be a single, valid JSON object and nothing else.
    
**CRITICAL RULES:**
1.  **JSON ONLY:** Your entire response must be a raw string representing a single JSON object, starting with \`{\` and ending with \`}\`.
2.  **NO MARKDOWN OR COMMENTS:** Do NOT wrap the JSON in markdown blocks or include any comments.
3.  **VALID JSON:** Ensure the JSON is valid. All keys and string values must use double quotes. No trailing commas.

**FINANCIAL DATA (PHP):**
This data is provided in JSON format.
- Summary: { "totalBalance": ${totalBalance.toFixed(2)}, "monthlyIncome": ${monthlyIncome.toFixed(2)}, "monthlyExpenses": ${monthlyExpenses.toFixed(2)} }
- Accounts: ${JSON.stringify(accountData)}
- Transactions This Month: ${JSON.stringify(transactionData)}

**JSON RESPONSE STRUCTURE:**
Provide your analysis in the following JSON format.
{
  "healthScore": <Number 0-100>,
  "summary": "<One-sentence summary>",
  "insights": [
    { "type": "<strength|weakness|opportunity|threat>", "priority": "<low|medium|high>", "title": "...", "description": "...", "impact": "..." }
  ],
  "recommendations": [
    { "title": "...", "description": "...", "impact": "<low|medium|high>", "timeframe": "<immediate|short_term|long_term>", "difficulty": "<easy|moderate|challenging>", "expectedOutcome": "..." }
  ]
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
        const { accounts, transactions } = userData;
        
        // Calculate total balances and monthly flows
        const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
        
        // Get current month's transactions
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        const monthlyTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
        });

        // Calculate monthly income and expenses
        const monthlyIncome = monthlyTransactions
            .filter(tx => tx.type === 'income')
            .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

        const monthlyExpenses = monthlyTransactions
            .filter(tx => tx.type === 'expense')
            .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);

        // Calculate key metrics
        const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;
        const expenseRatio = monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 100;
        const emergencyFundMonths = monthlyExpenses > 0 ? totalBalance / monthlyExpenses : 0;
        
        // Calculate health score (0-100)
        let healthScore = 50; // Base score
        if (savingsRate >= FINANCIAL_HEALTH_CONFIG.savingsRateTarget) healthScore += 15;
        else if (savingsRate > 0) healthScore += (savingsRate / FINANCIAL_HEALTH_CONFIG.savingsRateTarget) * 15;
        if (expenseRatio <= FINANCIAL_HEALTH_CONFIG.expenseRatioMax) healthScore += 15;
        else healthScore -= ((expenseRatio - FINANCIAL_HEALTH_CONFIG.expenseRatioMax) / 20) * 15;
        if (emergencyFundMonths >= FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget) healthScore += 20;
        else healthScore += (emergencyFundMonths / FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget) * 20;
        healthScore = Math.min(100, Math.max(0, healthScore));

        // Return a clear, non-hardcoded fallback analysis
        return {
            healthScore: Math.round(healthScore),
            summary: `Your basic financial health score is ${Math.round(healthScore)}/100. AI analysis is currently unavailable, so this is a summary based on standard calculations.`,
            metrics: {
                savingsRate: parseFloat(savingsRate.toFixed(1)),
                debtToIncome: 0,
                expenseRatio: parseFloat(expenseRatio.toFixed(1)),
                emergencyFundMonths: parseFloat(emergencyFundMonths.toFixed(1)),
                investmentAllocation: 0,
                discretionarySpending: 0,
                basicNecessitiesRatio: 0,
                financialSustainability: 0
            },
            insights: [{
                type: "weakness",
                title: "AI Analysis Unavailable",
                description: "Could not connect to the AI for a detailed financial analysis. The metrics above are based on standard calculations, not personalized insights.",
                priority: "high",
                impact: "You are not seeing personalized insights or a detailed action plan.",
                trend: "stable"
            }],
            recommendations: [{
                title: "Retry AI Analysis",
                description: "Please check your internet connection and refresh the page to get your full AI-powered financial analysis.",
                impact: "high",
                timeframe: "immediate",
                difficulty: "easy",
                expectedOutcome: "A detailed analysis with personalized insights and an action plan.",
                alternativeSolutions: ["If the problem persists, the AI service may be temporarily down. Please try again later."]
            }],
            riskAssessment: {
                shortTerm: ["AI-based risk assessment unavailable."],
                longTerm: ["AI-based risk assessment unavailable."],
                mitigationStrategies: ["Retry analysis to get risk assessment."]
            }
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
