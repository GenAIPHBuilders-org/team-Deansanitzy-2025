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

// Add this helper function for delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Add this helper function for API calls with retry
async function callGeminiAPI(prompt, retries = 3, baseDelay = 1000) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 2048,
                    }
                })
            });

            if (response.status === 429) {
                const waitTime = baseDelay * Math.pow(2, attempt);
                console.log(`Rate limit hit, waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`);
                await delay(waitTime);
                continue;
            }

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Gemini API error:', errorData);
                throw new Error(`Gemini API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (attempt === retries - 1) throw error;
            const waitTime = baseDelay * Math.pow(2, attempt);
            console.log(`API call failed, waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`);
            await delay(waitTime);
        }
    }
    throw new Error('All retries failed');
}

async function analyzeFinancialHealth(userData) {
    if (!GEMINI_API_KEY) {
        console.log('Gemini API key not configured, using offline analysis');
        return enhancedOfflineAnalysis(userData);
    }

    try {
        const prompt = generateFinancialPrompt(userData);
        
        // Use the new retry mechanism
        try {
            const data = await callGeminiAPI(prompt);
            
            if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
                console.log('Invalid Gemini API response format, falling back to offline analysis');
                return enhancedOfflineAnalysis(userData);
            }

            const aiResponse = data.candidates[0].content.parts[0].text;
            
            try {
                // Parse JSON response
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const analysis = JSON.parse(jsonMatch[0]);
                    return enhanceAIAnalysis(analysis, userData);
                } else {
                    console.log('Invalid JSON in Gemini response, falling back to offline analysis');
                    return enhancedOfflineAnalysis(userData);
                }
            } catch (parseError) {
                console.error('Failed to parse Gemini response:', parseError);
                console.log('Falling back to offline analysis');
                return enhancedOfflineAnalysis(userData);
            }
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

function generateFinancialPrompt(userData) {
    const { accounts, transactions } = userData;
    
    // Calculate some basic metrics to help the AI
    const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
    const monthlyTransactions = getMonthlyTransactions(transactions);
    const monthlyIncome = calculateMonthlyIncome(monthlyTransactions);
    const monthlyExpenses = calculateMonthlyExpenses(monthlyTransactions);
    
    // Categorize transactions
    const categories = categorizeTransactions(transactions);
    
    return `You are my personal Filipino financial health AI assistant, named "Kita-kita Coach". Your goal is to analyze my financial data and provide me with encouraging, clear, and actionable insights. Address me directly using "you" and "your".

    Here is my financial summary:
    - Total Balance: PHP ${totalBalance.toFixed(2)}
    - My Monthly Income: PHP ${monthlyIncome.toFixed(2)}
    - My Monthly Expenses: PHP ${monthlyExpenses.toFixed(2)}
    
    MY ACCOUNTS:
    ${JSON.stringify(accounts, null, 2)}

    MY TRANSACTION CATEGORIES:
    ${JSON.stringify(categories, null, 2)}

    MY RECENT TRANSACTIONS:
    ${JSON.stringify(monthlyTransactions, null, 2)}

    Please provide a comprehensive financial health analysis for me, considering the Filipino financial context. Your tone should be supportive and empowering.
    1. Calculate my key financial metrics based on Filipino financial standards.
    2. Consider local economic factors and cost of living in your analysis of my finances.
    3. Provide me with culturally relevant recommendations that I can realistically follow.
    4. Take into account common Filipino financial habits and challenges when giving advice.

    Please respond in this exact JSON format, writing all descriptions and recommendations directly to me (the user):
    {
        "healthScore": number (0-100),
        "summary": "A detailed summary of my current financial health status, written to me.",
        "metrics": {
            "savingsRate": number,
            "debtToIncome": number,
            "expenseRatio": number,
            "emergencyFundMonths": number,
            "investmentAllocation": number,
            "discretionarySpending": number,
            "basicNecessitiesRatio": number,
            "financialSustainability": number
        },
        "insights": [
            {
                "type": "strength|weakness|opportunity|threat",
                "title": "A specific insight title about my finances.",
                "description": "A detailed description of the insight, using my specific numbers and context. Explain it to me clearly.",
                "priority": "high|medium|low",
                "impact": "A description of how this affects my long-term financial health.",
                "trend": "improving|stable|declining"
            }
        ],
        "recommendations": [
            {
                "title": "A specific, actionable recommendation for me.",
                "description": "Detailed step-by-step guidance on how I can implement this.",
                "impact": "high|medium|low",
                "timeframe": "immediate|short_term|long_term",
                "difficulty": "easy|moderate|challenging",
                "expectedOutcome": "The specific results I can expect from following this recommendation.",
                "alternativeSolutions": ["An alternative approach I could take.", "Another alternative solution."]
            }
        ],
        "riskAssessment": {
            "shortTerm": ["A specific short-term risk to my finances.", "Another short-term risk."],
            "longTerm": ["A specific long-term risk to my finances.", "Another long-term risk."],
            "mitigationStrategies": ["A specific strategy for me to mitigate these risks.", "Another mitigation strategy."]
        }
    }`;
}

function getMonthlyTransactions(transactions) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    return transactions.filter(tx => {
        const txDate = new Date(tx.date || tx.timestamp);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
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
    // Add any additional calculations or enhancements to the AI analysis
    const enhancedAnalysis = {
        ...analysis,
        metrics: {
            ...analysis.metrics,
            // Add any additional metrics not covered by AI
            lastUpdated: new Date().toISOString()
        }
    };

    // Ensure all required fields are present
    if (!enhancedAnalysis.riskAssessment) {
        enhancedAnalysis.riskAssessment = {
            shortTerm: [],
            longTerm: [],
            mitigationStrategies: []
        };
    }

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
                            ${analysis.metrics.savingsRate}%
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
                            ${analysis.metrics.expenseRatio}%
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

        // Adjust for savings rate (target: 20%)
        if (savingsRate >= FINANCIAL_HEALTH_CONFIG.savingsRateTarget) healthScore += 15;
        else if (savingsRate > 0) healthScore += (savingsRate / FINANCIAL_HEALTH_CONFIG.savingsRateTarget) * 15;

        // Adjust for expense ratio (target: max 80%)
        if (expenseRatio <= FINANCIAL_HEALTH_CONFIG.expenseRatioMax) healthScore += 15;
        else healthScore -= ((expenseRatio - FINANCIAL_HEALTH_CONFIG.expenseRatioMax) / 20) * 15;

        // Adjust for emergency fund (target: 6 months)
        if (emergencyFundMonths >= FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget) healthScore += 20;
        else healthScore += (emergencyFundMonths / FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget) * 20;

        // Ensure score stays within 0-100
        healthScore = Math.min(100, Math.max(0, healthScore));

        // Generate insights
        const insights = [];
        
        // Savings insights
        if (savingsRate >= FINANCIAL_HEALTH_CONFIG.savingsRateTarget) {
            insights.push({
                type: "strength",
                title: "Excellent Savings Rate",
                description: `You're doing a great job saving ${savingsRate.toFixed(1)}% of your income, which is above the recommended target of ${FINANCIAL_HEALTH_CONFIG.savingsRateTarget}%. Keep up the great work!`,
                priority: "high",
                impact: "Maintaining this savings rate will significantly help you build long-term wealth and financial security.",
                trend: "stable"
            });
        } else if (savingsRate > 0) {
            insights.push({
                type: "opportunity",
                title: "Opportunity to Boost Your Savings",
                description: `Your current savings rate is ${savingsRate.toFixed(1)}%. You're on the right track, and with a few adjustments, you can reach the target of ${FINANCIAL_HEALTH_CONFIG.savingsRateTarget}%.`,
                priority: "medium",
                impact: "Increasing your savings will accelerate your progress towards your financial goals and improve your financial security.",
                trend: "improving"
            });
        } else {
            insights.push({
                type: "weakness",
                title: "Your Expenses are Higher Than Your Income",
                description: "It looks like you're spending more than you earn right now. It's important to address this to get back on track.",
                priority: "high",
                impact: "This situation is unsustainable and can lead to debt. Taking action now is crucial for your financial well-being.",
                trend: "declining"
            });
        }

        // Emergency fund insights
        if (emergencyFundMonths < FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget) {
            insights.push({
                type: "threat",
                title: "Build Up Your Emergency Fund",
                description: `Your emergency fund currently covers ${emergencyFundMonths.toFixed(1)} months of your expenses. Aiming for the recommended ${FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget} months will give you a stronger safety net.`,
                priority: "high",
                impact: "A fully-funded emergency fund will protect you from unexpected financial shocks without derailing your long-term goals.",
                trend: "stable"
            });
        }

        // Generate recommendations
        const recommendations = [];
        
        // Savings recommendations
        if (savingsRate < FINANCIAL_HEALTH_CONFIG.savingsRateTarget) {
            recommendations.push({
                title: "Boost Your Savings Rate",
                description: `A great first step is to set up an automatic transfer to your savings account. Try moving ${Math.min(20, FINANCIAL_HEALTH_CONFIG.savingsRateTarget - savingsRate).toFixed(0)}% of your income on payday. You won't even miss it!`,
                impact: "high",
                timeframe: "immediate",
                difficulty: "moderate",
                expectedOutcome: "You'll build your savings faster and improve your overall financial security.",
                alternativeSolutions: [
                    "Review your subscriptions and daily spending for easy cuts.",
                    "Consider a side-hustle or freelance work for an income boost."
                ]
            });
        }

        // Emergency fund recommendations
        if (emergencyFundMonths < FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget) {
            recommendations.push({
                title: "Build Your Emergency Fund",
                description: `Focus on allocating extra funds to your emergency savings until you reach the goal of ${FINANCIAL_HEALTH_CONFIG.emergencyFundMonthsTarget} months of expenses.`,
                impact: "high",
                timeframe: "short_term",
                difficulty: "moderate",
                expectedOutcome: "You will have a strong financial safety net to protect you against unexpected expenses.",
                alternativeSolutions: [
                    "Set up a recurring automatic transfer to your savings.",
                    "Dedicate any windfalls, like bonuses or tax refunds, to your emergency fund."
                ]
            });
        }

        // Expense management recommendations
        if (expenseRatio > FINANCIAL_HEALTH_CONFIG.expenseRatioMax) {
            recommendations.push({
                title: "Review and Reduce Your Expenses",
                description: `Take a close look at your monthly spending to find areas where you can cut back. Your goal is to get your expense ratio below ${FINANCIAL_HEALTH_CONFIG.expenseRatioMax}%.`,
                impact: "high",
                timeframe: "immediate",
                difficulty: "challenging",
                expectedOutcome: "You'll free up more cash, which will improve your ability to save and invest.",
                alternativeSolutions: [
                    "Create a detailed budget to track every peso.",
                    "Try negotiating your recurring bills like phone or internet."
                ]
            });
        }

        return {
            healthScore: Math.round(healthScore),
            summary: `Your financial health score is ${Math.round(healthScore)}/100. ${
                healthScore >= 80 ? "You're in excellent financial shape! Keep up the great work." :
                healthScore >= 60 ? "You're on the right track. A few small changes will make a big difference." :
                "There are opportunities for improvement, and I'm here to help you get started."
            }`,
            metrics: {
                savingsRate: parseFloat(savingsRate.toFixed(1)),
                debtToIncome: 0, // Not calculated in offline mode
                expenseRatio: parseFloat(expenseRatio.toFixed(1)),
                emergencyFundMonths: parseFloat(emergencyFundMonths.toFixed(1)),
                investmentAllocation: 0, // Not calculated in offline mode
                discretionarySpending: 0, // Not calculated in offline mode
                basicNecessitiesRatio: 0, // Not calculated in offline mode
                financialSustainability: 0 // Not calculated in offline mode
            },
            insights,
            recommendations,
            riskAssessment: {
                shortTerm: [
                    "Insufficient emergency fund coverage",
                    "High expense ratio"
                ],
                longTerm: [
                    "Retirement savings may be delayed",
                    "Limited investment growth"
                ],
                mitigationStrategies: [
                    "Build emergency fund systematically",
                    "Review and optimize monthly expenses",
                    "Set up automatic savings transfers"
                ]
            }
        };
    } catch (error) {
        console.error('Error in offline analysis:', error);
        // Return a minimal valid structure if there's an error
        return {
            healthScore: 50,
            summary: "Unable to calculate detailed metrics. Please try again later.",
            metrics: {
                savingsRate: 0,
                debtToIncome: 0,
                expenseRatio: 0,
                emergencyFundMonths: 0,
                investmentAllocation: 0,
                discretionarySpending: 0,
                basicNecessitiesRatio: 0,
                financialSustainability: 0
            },
            insights: [{
                type: "warning",
                title: "Analysis Limited",
                description: "Unable to perform complete analysis at this time",
                priority: "high",
                impact: "Please try again later",
                trend: "stable"
            }],
            recommendations: [{
                title: "Retry Analysis",
                description: "Please refresh the page to try the analysis again",
                impact: "high",
                timeframe: "immediate",
                difficulty: "easy",
                expectedOutcome: "Complete financial analysis",
                alternativeSolutions: ["Contact support if the issue persists"]
            }],
            riskAssessment: {
                shortTerm: ["Analysis currently limited"],
                longTerm: ["Unable to assess long-term risks"],
                mitigationStrategies: ["Retry analysis later"]
            }
        };
    }
}

// ... rest of the file remains unchanged ...
