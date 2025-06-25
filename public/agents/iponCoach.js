/**
 * Ipon Coach AI - Dynamic Gemini-Powered Financial Assistant
 * Provides real-time AI analysis and personalized Filipino financial guidance
 */

import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { BaseAgent } from "./BaseAgent.js";

class IponCoachAI extends BaseAgent {
    constructor() {
        super('iponCoach', {
            autonomyLevel: 'high',
            planningHorizon: 'medium_term',
            learningRate: 0.2
        });
        
        this.geminiApiKey = 'AIzaSyCdyWLIr2dJmtPJ8eBXdj7nYNNz3cjMfFo'; // Your Gemini API key
        this.geminiModel = 'gemini-1.5-flash';
        this.conversationHistory = [];
        this.analysisCache = new Map();
        this.lastAnalysisTime = null;
        
        this.initializeElements();
        this.initializeEventListeners();
    }

    // Initialize DOM elements
    initializeElements() {
        this.elements = {
            loadingState: document.getElementById('loading-state'),
            contentLoaded: document.getElementById('content-loaded'),
            emptyState: document.getElementById('empty-state'),
            aiAnalysisContent: document.getElementById('ai-analysis-content'),
            aiRecommendationsContent: document.getElementById('ai-recommendations-content'),
            savingsGoalsList: document.getElementById('savings-goals-list'),
            financialHealthContent: document.getElementById('financial-health-content'),
            marketInsightsContent: document.getElementById('market-insights-content'),
            riskAssessmentContent: document.getElementById('risk-assessment-content'),
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            sendButton: document.getElementById('send-message')
        };

        // Validate elements
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Element ${key} not found in DOM`);
            }
        });
    }

    // Initialize event listeners
    initializeEventListeners() {
        if (this.elements.sendButton) {
            this.elements.sendButton.addEventListener('click', () => this.sendChatMessage());
        }
        
        if (this.elements.chatInput) {
            this.elements.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }
    }

    // Start the AI coach
    async start() {
        try {
            console.log("🤖 Starting Ipon Coach AI...");
            this.showLoadingState();
            
            // Wait for authentication
            await this.waitForAuth();
            
            if (!this.currentUser) {
                this.showEmptyState("Please log in to access AI financial coaching.");
                return;
            }

            // Initialize BaseAgent with timeout and wait for data loading
            try {
                await this.waitForInitialization();
                
                // Force data reload if BaseAgent initialization succeeded
                if (this.initialized) {
                    console.log("🔄 BaseAgent initialized, loading financial data...");
                    await this.loadUserFinancialData();
                }
            } catch (error) {
                console.warn("BaseAgent initialization failed, loading data manually:", error);
                await this.loadUserFinancialDataFallback();
            }
            
            // Wait a bit more for data to be processed
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Ensure arrays are initialized
            if (!this.userTransactions) this.userTransactions = [];
            if (!this.userAccounts) this.userAccounts = [];
            
            console.log("📊 Data check:", {
                transactions: this.userTransactions.length,
                accounts: this.userAccounts.length,
                initialized: this.initialized
            });
            
            // Check if we have data
            if (this.userTransactions.length === 0 && this.userAccounts.length === 0) {
                console.log("⚠️ No financial data found, showing empty state");
                this.showEmptyState();
                return;
            }

            // Load AI analysis
            await this.loadAIAnalysis();
            
            this.showContentState();
            console.log("✅ Ipon Coach AI initialized successfully");
            
        } catch (error) {
            console.error("❌ Error starting Ipon Coach AI:", error);
            this.showErrorMessage("Failed to initialize AI coach. Please try again.");
        }
    }

    // Wait for authentication
    async waitForAuth() {
        const auth = getAuth();
        return new Promise((resolve) => {
            if (auth.currentUser) {
                this.currentUser = auth.currentUser;
                resolve();
            } else {
                const unsubscribe = auth.onAuthStateChanged((user) => {
                    this.currentUser = user;
                    unsubscribe();
                    resolve();
                });
            }
        });
    }

    // Wait for BaseAgent initialization
    async waitForInitialization() {
        const maxWait = 10000; // 10 seconds max
        const checkInterval = 100; // Check every 100ms
        let waited = 0;

        while (!this.initialized && waited < maxWait) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
        }

        if (!this.initialized) {
            console.warn('⚠️ BaseAgent initialization timeout, proceeding with available data');
        }
        
        return this.initialized;
    }

    // Load comprehensive AI analysis
    async loadAIAnalysis() {
        try {
            console.log("🧠 Loading AI financial analysis...");

            // Generate multiple AI insights in parallel
            const analysisPromises = [
                this.generateFinancialAnalysis(),
                this.generatePersonalizedRecommendations(),
                this.generateSmartGoals(),
                this.generateHealthScore(),
                this.generateMarketInsights(),
                this.generateRiskAssessment()
            ];

            const [
                financialAnalysis,
                recommendations,
                goals,
                healthScore,
                marketInsights,
                riskAssessment
            ] = await Promise.all(analysisPromises);

            // Update UI with AI-generated content
            this.updateFinancialAnalysis(financialAnalysis);
            this.updateRecommendations(recommendations);
            this.updateGoals(goals);
            this.updateHealthScore(healthScore);
            this.updateMarketInsights(marketInsights);
            this.updateRiskAssessment(riskAssessment);

            // Add welcome message to chat
            this.addChatMessage("ai", "Kumusta! I'm your AI financial coach. I've analyzed your data and I'm here to help you achieve your financial goals. Ask me anything about your finances!");

        } catch (error) {
            console.error("Error loading AI analysis:", error);
            this.showErrorMessage("Failed to generate AI insights.");
        }
    }

    // Generate comprehensive financial analysis using Gemini AI
    async generateFinancialAnalysis() {
        try {
            const financialData = this.prepareFinancialData();
            
            const prompt = `As a Filipino financial advisor AI, analyze this user's financial data and provide personalized insights in a conversational, encouraging tone. Be specific about the data you see and give actionable advice.

Financial Data:
${JSON.stringify(financialData, null, 2)}

Provide analysis covering:
1. Overall financial health summary
2. Spending patterns and trends
3. Savings opportunities
4. Account optimization suggestions
5. Filipino-context financial advice

Keep response under 300 words, friendly tone, use some Filipino expressions naturally.`;

            const response = await this.callGeminiAPI(prompt);
            return response || "I'm analyzing your financial patterns to provide personalized insights...";
            
        } catch (error) {
            console.error("Error generating financial analysis:", error);
            return "I'm currently learning about your financial patterns. Let me gather more insights for you.";
        }
    }

    // Generate personalized recommendations
    async generatePersonalizedRecommendations() {
        try {
            const financialData = this.prepareFinancialData();
            
            const prompt = `Based on this Filipino user's financial data, generate 3-5 specific, actionable recommendations. Each should be practical and achievable.

Financial Data:
${JSON.stringify(financialData, null, 2)}

Format as JSON array with objects containing:
- title: Brief recommendation title
- description: Detailed explanation
- priority: "high", "medium", or "low"
- actionSteps: Array of specific steps to take

Focus on Filipino financial context (e.g., OFW remittances, peso inflation, local banking options).`;

            const response = await this.callGeminiAPI(prompt);
            
            try {
                return JSON.parse(response);
            } catch {
                // Fallback if JSON parsing fails
                return this.generateFallbackRecommendations();
            }
            
        } catch (error) {
            console.error("Error generating recommendations:", error);
            return this.generateFallbackRecommendations();
        }
    }

    // Generate smart savings goals
    async generateSmartGoals() {
        try {
            const financialData = this.prepareFinancialData();
            
            const prompt = `Create 2-4 personalized savings goals for this Filipino user based on their financial data. Make goals SMART (Specific, Measurable, Achievable, Relevant, Time-bound).

Financial Data:
${JSON.stringify(financialData, null, 2)}

Format as JSON array with objects containing:
- title: Goal name
- description: What this achieves
- targetAmount: Numeric amount in PHP
- timeframe: Realistic timeframe
- monthlyTarget: Monthly savings needed
- priority: "high", "medium", or "low"
- benefits: Array of benefits

Consider Filipino financial priorities: emergency fund, family support, education, business capital.`;

            const response = await this.callGeminiAPI(prompt);
            
            try {
                return JSON.parse(response);
            } catch {
                return this.generateFallbackGoals();
            }
            
        } catch (error) {
            console.error("Error generating smart goals:", error);
            return this.generateFallbackGoals();
        }
    }

    // Generate financial health score
    async generateHealthScore() {
        try {
            const financialData = this.prepareFinancialData();
            
            const prompt = `Calculate a financial health score (0-100) for this Filipino user and explain the scoring.

Financial Data:
${JSON.stringify(financialData, null, 2)}

Format as JSON object:
{
  "score": number (0-100),
  "level": "poor|fair|good|excellent",
  "factors": {
    "emergency_fund": {"score": number, "weight": number, "status": "string"},
    "debt_ratio": {"score": number, "weight": number, "status": "string"},
    "savings_rate": {"score": number, "weight": number, "status": "string"},
    "diversification": {"score": number, "weight": number, "status": "string"}
  },
  "summary": "Brief explanation",
  "improvements": ["improvement suggestions"]
}

Use Filipino financial standards and context.`;

            const response = await this.callGeminiAPI(prompt);
            
            try {
                return JSON.parse(response);
            } catch {
                return this.generateFallbackHealthScore();
            }
            
        } catch (error) {
            console.error("Error generating health score:", error);
            return this.generateFallbackHealthScore();
        }
    }

    // Generate market insights
    async generateMarketInsights() {
        try {
            const prompt = `Provide current financial market insights relevant to Filipino investors and savers. Include 3-4 brief insights about:

1. Philippine peso trends
2. Local interest rates
3. Investment opportunities
4. Economic outlook

Format as JSON array:
[
  {
    "title": "Insight title",
    "value": "Key metric or trend",
    "description": "Brief explanation",
    "impact": "How this affects the user"
  }
]

Keep current with 2024 Philippine economic context.`;

            const response = await this.callGeminiAPI(prompt);
            
            try {
                return JSON.parse(response);
            } catch {
                return this.generateFallbackMarketInsights();
            }
            
        } catch (error) {
            console.error("Error generating market insights:", error);
            return this.generateFallbackMarketInsights();
        }
    }

    // Generate risk assessment
    async generateRiskAssessment() {
        try {
            const financialData = this.prepareFinancialData();
            
            const prompt = `Assess financial risks for this Filipino user based on their data. Identify 3-5 specific risks.

Financial Data:
${JSON.stringify(financialData, null, 2)}

Format as JSON array:
[
  {
    "risk": "Risk description",
    "severity": "high|medium|low",
    "probability": "high|medium|low",
    "impact": "Impact description",
    "mitigation": "How to address this risk"
  }
]

Consider Filipino-specific risks: OFW dependency, peso volatility, natural disasters, healthcare costs.`;

            const response = await this.callGeminiAPI(prompt);
            
            try {
                return JSON.parse(response);
            } catch {
                return this.generateFallbackRiskAssessment();
            }
            
        } catch (error) {
            console.error("Error generating risk assessment:", error);
            return this.generateFallbackRiskAssessment();
        }
    }

    // Prepare financial data for AI analysis
    prepareFinancialData() {
        // Ensure we have arrays initialized
        if (!this.userTransactions) this.userTransactions = [];
        if (!this.userAccounts) this.userAccounts = [];
        
        const overview = this.getFinancialOverview();
        
        return {
            summary: {
                totalBalance: overview.totalBalance || 0,
                monthlyIncome: overview.monthlyIncome || 0,
                monthlyExpenses: overview.monthlyExpenses || 0,
                savingsRate: overview.savingsRate || 0,
                transactionCount: this.userTransactions.length,
                accountCount: this.userAccounts.length
            },
            accounts: this.userAccounts.map(acc => ({
                type: acc.category || 'unknown',
                balance: acc.balance || 0,
                provider: acc.provider || 'unknown'
            })),
            recentTransactions: this.userTransactions
                .slice(-20)
                .map(tx => ({
                    type: tx.type || 'unknown',
                    amount: tx.amount || 0,
                    category: tx.category || 'unknown',
                    date: tx.date || new Date().toISOString()
                })),
            spendingByCategory: this.getSpendingByCategory() || {},
            trends: this.getSpendingTrends() || {}
        };
    }

    // Fallback method for getFinancialOverview if BaseAgent doesn't provide it
    getFinancialOverview() {
        if (super.getFinancialOverview) {
            return super.getFinancialOverview();
        }
        
        // Fallback implementation
        const totalBalance = this.userAccounts ? 
            this.userAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0) : 0;
        
        const monthlyIncome = this.userTransactions ?
            this.userTransactions
                .filter(tx => tx.type === 'income' && this.isWithinLastMonth(tx.date))
                .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0) : 0;
        
        const monthlyExpenses = this.userTransactions ?
            this.userTransactions
                .filter(tx => tx.type === 'expense' && this.isWithinLastMonth(tx.date))
                .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0) : 0;
        
        const savingsRate = monthlyIncome > 0 ? 
            ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;
        
        return {
            totalBalance,
            monthlyIncome,
            monthlyExpenses,
            savingsRate,
            netMonthlyCashFlow: monthlyIncome - monthlyExpenses
        };
    }

    // Helper method to check if date is within last month
    isWithinLastMonth(dateString) {
        if (!dateString) return false;
        const date = new Date(dateString);
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return date >= lastMonth;
    }

    // Fallback method for getSpendingByCategory
    getSpendingByCategory() {
        if (super.getSpendingByCategory) {
            return super.getSpendingByCategory();
        }
        
        if (!this.userTransactions) return {};
        
        return this.userTransactions
            .filter(tx => tx.type === 'expense')
            .reduce((acc, tx) => {
                const category = tx.category || 'Other';
                acc[category] = (acc[category] || 0) + parseFloat(tx.amount || 0);
                return acc;
            }, {});
    }

    // Fallback method for getSpendingTrends
    getSpendingTrends() {
        if (super.getSpendingTrends) {
            return super.getSpendingTrends();
        }
        
        if (!this.userTransactions) return {};
        
        // Simple trend calculation
        const thisMonth = this.userTransactions
            .filter(tx => tx.type === 'expense' && this.isWithinLastMonth(tx.date))
            .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        
        return {
            currentMonth: thisMonth,
            trend: 'stable' // Simplified for fallback
        };
    }

    // Call Gemini AI API
    async callGeminiAPI(prompt, options = {}) {
        try {
            const requestBody = {
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
                    ...options
                }
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
        } catch (error) {
            console.error('Gemini API call failed:', error);
            throw error;
        }
    }

    // Handle chat messages
    async sendChatMessage() {
        const input = this.elements.chatInput;
        const message = input.value.trim();
        
        if (!message) return;
        
        // Clear input
        input.value = '';
        
        // Add user message
        this.addChatMessage('user', message);
        
        // Show typing indicator
        this.addChatMessage('ai', 'Thinking...', true);
        
        try {
            const financialData = this.prepareFinancialData();
            const conversationContext = this.conversationHistory.slice(-10);
            
            const prompt = `You are a helpful Filipino financial advisor AI. The user asked: "${message}"

User's financial context:
${JSON.stringify(financialData, null, 2)}

Recent conversation:
${conversationContext.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Provide a helpful, personalized response. Use Filipino expressions naturally when appropriate. Be encouraging and specific. Keep under 200 words.`;

            const response = await this.callGeminiAPI(prompt);
            
            // Remove typing indicator
            this.removeChatMessage();
            
            // Add AI response
            this.addChatMessage('ai', response);
            
            // Store in conversation history
            this.conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: response }
            );
            
        } catch (error) {
            console.error('Chat error:', error);
            this.removeChatMessage();
            this.addChatMessage('ai', 'Sorry, I encountered an error. Please try asking again.');
        }
    }

    // Add chat message to UI
    addChatMessage(sender, content, isTemporary = false) {
        const messagesContainer = this.elements.chatMessages;
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        if (isTemporary) messageDiv.classList.add('temporary');
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = content;
        
        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.appendChild(bubble);
        messageDiv.appendChild(time);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Remove last message (for typing indicator)
    removeChatMessage() {
        const messagesContainer = this.elements.chatMessages;
        if (!messagesContainer) return;
        
        const lastMessage = messagesContainer.querySelector('.message.temporary');
        if (lastMessage) {
            lastMessage.remove();
        }
    }

    // Update UI methods
    updateFinancialAnalysis(analysis) {
        if (this.elements.aiAnalysisContent) {
            this.elements.aiAnalysisContent.innerHTML = `
                <div class="coach-message">
                    <div class="coach-avatar">🤖</div>
                    <div class="coach-text">${analysis}</div>
                </div>
            `;
        }
    }

    updateRecommendations(recommendations) {
        if (this.elements.aiRecommendationsContent && Array.isArray(recommendations)) {
            this.elements.aiRecommendationsContent.innerHTML = recommendations.map(rec => `
                <div class="recommendation-item">
                    <div class="recommendation-priority priority-${rec.priority}">${rec.priority.toUpperCase()}</div>
                    <div class="recommendation-title">${rec.title}</div>
                    <div class="recommendation-desc">${rec.description}</div>
                </div>
            `).join('');
        }
    }

    updateGoals(goals) {
        if (this.elements.savingsGoalsList && Array.isArray(goals)) {
            this.elements.savingsGoalsList.innerHTML = goals.map(goal => `
                <div class="goal-item">
                    <div class="goal-header">
                        <h4>${goal.title}</h4>
                        <span class="goal-priority priority-${goal.priority}">${goal.priority}</span>
                    </div>
                    <p>${goal.description}</p>
                    <div class="goal-amounts">
                        <span>Target: ₱${goal.targetAmount?.toLocaleString() || 'TBD'}</span>
                        <span>Monthly: ₱${goal.monthlyTarget?.toLocaleString() || 'TBD'}</span>
                    </div>
                    <div class="goal-timeframe">Timeline: ${goal.timeframe}</div>
                </div>
            `).join('');
        }
    }

    updateHealthScore(scoreData) {
        if (this.elements.financialHealthContent && scoreData.score) {
            this.elements.financialHealthContent.innerHTML = `
                <div class="health-score-display">
                    <div class="score-circle" style="background: conic-gradient(var(--primary-green) ${scoreData.score * 3.6}deg, #333 0deg)">
                        <div class="score-number">${scoreData.score}</div>
                    </div>
                    <div class="score-label">${scoreData.level} Financial Health</div>
                    <p>${scoreData.summary}</p>
                    ${scoreData.improvements ? scoreData.improvements.map(imp => `<div class="recommendation-item"><div class="recommendation-desc">${imp}</div></div>`).join('') : ''}
                </div>
            `;
        }
    }

    updateMarketInsights(insights) {
        if (this.elements.marketInsightsContent && Array.isArray(insights)) {
            this.elements.marketInsightsContent.innerHTML = insights.map(insight => `
                <div class="market-insight-item">
                    <div class="insight-header">
                        <div class="insight-title">${insight.title}</div>
                        <div class="insight-value">${insight.value}</div>
                    </div>
                    <div class="insight-description">${insight.description}</div>
                </div>
            `).join('');
        }
    }

    updateRiskAssessment(risks) {
        if (this.elements.riskAssessmentContent && Array.isArray(risks)) {
            this.elements.riskAssessmentContent.innerHTML = risks.map(risk => `
                <div class="risk-item severity-${risk.severity}">
                    <div class="risk-desc">${risk.risk}</div>
                    <div class="risk-recommendation">${risk.mitigation}</div>
                </div>
            `).join('');
        }
    }

    // Fallback methods for when AI calls fail
    generateFallbackRecommendations() {
        const overview = this.getFinancialOverview();
        const recommendations = [];
        
        if (overview.savingsRate < 10) {
            recommendations.push({
                title: "Increase Your Savings Rate",
                description: "Try to save at least 10-20% of your income monthly for better financial security.",
                priority: "high"
            });
        }
        
        if (this.userAccounts.length < 2) {
            recommendations.push({
                title: "Diversify Your Accounts",
                description: "Consider opening different types of accounts to optimize your money management.",
                priority: "medium"
            });
        }
        
        return recommendations;
    }

    generateFallbackGoals() {
        const overview = this.getFinancialOverview();
        return [{
            title: "Emergency Fund",
            description: "Build an emergency fund covering 3-6 months of expenses",
            targetAmount: overview.monthlyExpenses * 3,
            timeframe: "6 months",
            monthlyTarget: overview.monthlyExpenses * 0.5,
            priority: "high"
        }];
    }

    generateFallbackHealthScore() {
        const overview = this.getFinancialOverview();
        let score = 50;
        
        if (overview.savingsRate > 15) score += 20;
        if (overview.totalBalance > overview.monthlyExpenses * 3) score += 15;
        if (this.userAccounts.length > 2) score += 10;
        
        return {
            score: Math.min(100, score),
            level: score >= 80 ? 'excellent' : score >= 60 ? 'good' : 'fair',
            summary: "Your financial health is being calculated based on your savings rate, emergency fund, and account diversification."
        };
    }

    generateFallbackMarketInsights() {
        return [
            {
                title: "Peso Strength",
                value: "Monitoring",
                description: "Keep track of peso performance against major currencies for better financial planning."
            },
            {
                title: "Interest Rates",
                value: "Stable",
                description: "Current interest rates remain favorable for savers and investors."
            }
        ];
    }

    generateFallbackRiskAssessment() {
        return [
            {
                risk: "Inflation Impact",
                severity: "medium",
                mitigation: "Maintain investments that can outpace inflation over time."
            },
            {
                risk: "Emergency Preparedness",
                severity: "high",
                mitigation: "Build and maintain an adequate emergency fund."
            }
        ];
    }

    // State management methods
    showLoadingState() {
        if (this.elements.loadingState) this.elements.loadingState.style.display = 'block';
        if (this.elements.contentLoaded) this.elements.contentLoaded.style.display = 'none';
        if (this.elements.emptyState) this.elements.emptyState.style.display = 'none';
    }

    showContentState() {
        if (this.elements.loadingState) this.elements.loadingState.style.display = 'none';
        if (this.elements.contentLoaded) this.elements.contentLoaded.style.display = 'block';
        if (this.elements.emptyState) this.elements.emptyState.style.display = 'none';
    }

    showEmptyState(message = null) {
        if (this.elements.loadingState) this.elements.loadingState.style.display = 'none';
        if (this.elements.contentLoaded) this.elements.contentLoaded.style.display = 'none';
        if (this.elements.emptyState) {
            this.elements.emptyState.style.display = 'block';
            if (message) {
                const p = this.elements.emptyState.querySelector('p');
                if (p) p.textContent = message;
            }
        }
    }

    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${message}</p>
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Starting Dynamic Ipon Coach AI...");
    const coach = new IponCoachAI();
    coach.start();
});

export default IponCoachAI;

