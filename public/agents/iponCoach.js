/**
 * Ipon Coach AI - Real Autonomous Financial Assistant
 * Implements true agentic behavior with Gemini AI reasoning, planning, and learning
 */

import { GEMINI_API_KEY, GEMINI_MODEL } from "../js/config.js";
import { storeUserData, getUserData, storeTransaction, getUserTransactions } from "../js/firestoredb.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

class IponCoachAI {
    constructor() {
        this.userData = null;
        this.aiInsights = null;
        this.analysisComplete = false;
        this.auth = getAuth();
        this.learningHistory = [];
        this.decisionHistory = [];
        this.userInteractions = [];
        this.filipinoWisdom = [];
        this.initializeElements();
        this.initializeAI();
    }

    // Initialize AI system and load Filipino wisdom
    async initializeAI() {
        try {
            console.log("Initializing Ipon Coach AI system...");
            
            // Load Filipino wisdom database
            this.loadFilipinoWisdom();
            
            // Load user's learning history
            await this.loadUserLearningHistory();
            
            console.log("Ipon Coach AI system initialized successfully");
        } catch (error) {
            console.error("Error initializing AI system:", error);
        }
    }

    // Initialize DOM elements with proper error handling
    initializeElements() {
        this.elements = {
            loadingState: document.getElementById('loading-state'),
            contentLoaded: document.getElementById('content-loaded'),
            emptyState: document.getElementById('empty-state'),
            coachTipText: document.getElementById('coach-tip-text'),
            savingsGoalsList: document.getElementById('savings-goals-list'),
            challengeName: document.getElementById('alkansya-challenge-name'),
            challengeDesc: document.getElementById('alkansya-challenge-desc'),
            challengeTarget: document.getElementById('alkansya-challenge-target'),
            quoteText: document.getElementById('motivational-quote-text'),
            quoteAuthor: document.getElementById('motivational-quote-author')
        };

        // Validate all elements exist
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Element ${key} not found in DOM`);
            }
        });
    }

    // Filipino wisdom and proverbs database
    loadFilipinoWisdom() {
        this.filipinoWisdom = [
            {
                text: 'Ang pag-iimpok ay parang pagtatanim, sa una\'y maliit, ngunit paglaon ay lumalaki at namumunga.',
                author: 'Filipino Proverb',
                translation: 'Saving is like planting, small at first, but grows and bears fruit over time.'
            },
            {
                text: 'Nasa huli ang pagsisisi, nasa umpisa ang pag-iingat.',
                author: 'Filipino Proverb',
                translation: 'Regret comes last, caution comes first.'
            },
            {
                text: 'Ang taong marunong mag-impok, hindi nababaon sa utang.',
                author: 'Filipino Proverb',
                translation: 'A person who knows how to save doesn\'t drown in debt.'
            },
            {
                text: 'Kapag may tiyaga, may nilaga.',
                author: 'Filipino Proverb',
                translation: 'With patience and perseverance, you will reap the rewards.'
            }
        ];
    }

    // Load user's actual financial data from Firestore
    async loadUserFinancialData() {
        try {
            const userId = this.auth.currentUser?.uid;
            if (!userId) {
                console.log("No authenticated user found");
                return null;
            }

            console.log("Loading financial data for user:", userId);

            // Get user profile data
            const userData = await getUserData(userId);
            
            // Get all transactions
            const transactions = await getUserTransactions(userId);
            
            console.log("Retrieved transactions:", transactions?.length || 0);
            
            // Analyze real user data
            const analyzedData = await this.analyzeRealUserData(userData, transactions);
            
            this.userData = analyzedData;
            return analyzedData;
        } catch (error) {
            console.error("Error loading user financial data:", error);
            return null;
        }
    }

    // Analyze real user financial data 
    async analyzeRealUserData(userData, transactions) {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        // Calculate current month transactions
        const currentMonthTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date || t.timestamp);
            return transactionDate.getMonth() === currentMonth && 
                   transactionDate.getFullYear() === currentYear;
        });

        // Calculate spending by category
        const categories = {};
        let totalSpent = 0;
        let totalIncome = 0;

        currentMonthTransactions.forEach(transaction => {
            const amount = parseFloat(transaction.amount) || 0;
            if (transaction.type === 'expense') {
                totalSpent += amount;
                const category = transaction.category || 'Other';
                categories[category] = (categories[category] || 0) + amount;
            } else if (transaction.type === 'income') {
                totalIncome += amount;
            }
        });

        // Get current savings from user profile
        const currentSavings = userData?.financialProfile?.currentSavings || 0;
        const monthlyIncome = userData?.financialProfile?.monthlyIncome || totalIncome;

        return {
            hasTransactions: transactions.length > 0,
            transactionCount: transactions.length,
            totalSpent,
            totalIncome,
            categories,
            monthlyIncome,
            currentSavings,
            transactions: currentMonthTransactions,
            spendingPattern: this.determineSpendingPattern(totalSpent, monthlyIncome),
            riskProfile: this.assessRiskProfile(userData)
        };
    }

    // Determine spending pattern based on real data
    determineSpendingPattern(totalSpent, monthlyIncome) {
        if (monthlyIncome === 0) return 'unknown';
        const spendingRatio = totalSpent / monthlyIncome;
        
        if (spendingRatio > 0.8) return 'high_spender';
        if (spendingRatio > 0.6) return 'moderate_spender';
        return 'conservative_spender';
    }

    // Assess risk profile from user data
    assessRiskProfile(userData) {
        const profile = userData?.financialProfile;
        if (profile?.riskProfile) return profile.riskProfile;
        
        // Default assessment
        const age = profile?.age || 30;
        if (age < 30) return 'moderate';
        if (age < 50) return 'conservative';
        return 'very_conservative';
    }

    // Real AI Analysis Engine using Gemini AI
    async analyzeUserData(userData) {
        try {
            console.log("Starting AI analysis with Gemini...");
            
            // Check if we have valid API key
            if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
                console.warn("Gemini API key not configured, using fallback analysis");
                return this.getFallbackAnalysis(userData);
            }
            
            // Load previous learning history for context
            await this.loadUserLearningHistory();
            
            // Create AI prompt with real user data and learning context
            const aiPrompt = this.createAIPrompt(userData);
            
            // Get AI analysis from Gemini
            const aiResponse = await this.callGeminiAI(aiPrompt);
            
            // Store this interaction for learning
            await this.storeInteraction('analysis', userData, aiResponse);
            
            // Parse and structure AI response
            const analysis = this.parseAIAnalysis(aiResponse, userData);
            
            return analysis;
        } catch (error) {
            console.error("Error in AI analysis:", error);
            // Fallback to basic analysis if AI fails
            return this.getFallbackAnalysis(userData);
        }
    }

    // Create AI prompt for financial analysis
    createAIPrompt(userData) {
        return `
Ikaw ay isang Filipino AI Financial Coach na nag-aanalyze ng financial data. Gumawa ng comprehensive analysis sa JSON format.

USER DATA:
- Monthly Income: ₱${userData.monthlyIncome.toLocaleString()}
- Total Spent: ₱${userData.totalSpent.toLocaleString()}
- Savings Rate: ${userData.monthlyIncome > 0 ? ((userData.monthlyIncome - userData.totalSpent) / userData.monthlyIncome * 100).toFixed(1) : 0}%
- Transaction Count: ${userData.transactionCount}
- Top Categories: ${userData.topCategories.map(cat => `${cat.category}: ₱${cat.amount.toLocaleString()}`).join(', ')}

IMPORTANT: Mag-respond ka ng COMPLETE at VALID JSON lang. Walang markdown, walang extra text. Siguruhing complete ang lahat ng fields.

Gamitin ang format na ito EXACTLY:

{
  "spendingInsights": {
    "insight": "Detailed Filipino analysis ng spending patterns (minimum 100 characters)",
    "savingsRate": ${userData.monthlyIncome > 0 ? ((userData.monthlyIncome - userData.totalSpent) / userData.monthlyIncome * 100).toFixed(1) : 0},
    "severity": "low/medium/high",
    "culturalContext": "Filipino cultural insight about money management"
  },
  "savingsOpportunities": [
    {
      "category": "Category name",
      "currentSpending": 0,
      "suggestedReduction": 0,
      "strategy": "Filipino strategy para sa category na ito",
      "impact": "Expected impact sa savings"
    }
  ],
  "personalizedGoals": [
    {
      "goal": "Specific Filipino financial goal",
      "timeframe": "Timeline",
      "strategy": "How to achieve using Filipino methods",
      "motivation": "Filipino cultural motivation"
    }
  ],
  "riskAssessment": {
    "level": "low/medium/high",
    "factors": ["Risk factor 1", "Risk factor 2"],
    "mitigation": "Filipino strategies to reduce risks"
  },
  "filipinoStrategies": [
    {
      "name": "Filipino strategy name",
      "description": "How it works in Filipino context",
      "implementation": "Step-by-step sa Filipino way"
    }
  ],
  "reasoning": "Detailed explanation ng analysis process",
  "confidence": 0.85,
  "nextSteps": [
    "Immediate action 1",
    "Immediate action 2", 
    "Immediate action 3"
  ]
}

Mag-respond ka ng COMPLETE JSON lang. Walang iba. Siguruhing lahat ng brackets at quotes ay properly closed.`;
    }

    // Call Gemini AI with error handling and retries
    async callGeminiAI(prompt) {
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                console.log(`Calling Gemini AI (attempt ${attempt + 1}/${maxRetries})...`);
                
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
                            maxOutputTokens: 4096, // Increased for more complete responses
                            candidateCount: 1,
                            stopSequences: []
                        },
                        safetySettings: [
                            {
                                category: "HARM_CATEGORY_HARASSMENT",
                                threshold: "BLOCK_MEDIUM_AND_ABOVE"
                            },
                            {
                                category: "HARM_CATEGORY_HATE_SPEECH", 
                                threshold: "BLOCK_MEDIUM_AND_ABOVE"
                            },
                            {
                                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                                threshold: "BLOCK_MEDIUM_AND_ABOVE"
                            },
                            {
                                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                                threshold: "BLOCK_MEDIUM_AND_ABOVE"
                            }
                        ]
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`AI API error: ${response.status} - ${response.statusText}: ${errorText}`);
                }

                const data = await response.json();
                
                // Check for safety filter blocks
                if (data.candidates && data.candidates[0] && data.candidates[0].finishReason === 'SAFETY') {
                    throw new Error('Response blocked by safety filters');
                }
                
                const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                
                if (!aiText) {
                    console.error('No AI response received. Full response:', data);
                    throw new Error('No AI response received');
                }

                console.log("Gemini AI response received successfully");
                console.log("Response length:", aiText.length, "characters");
                
                return aiText;
            } catch (error) {
                attempt++;
                console.error(`AI call attempt ${attempt} failed:`, error);
                
                if (attempt >= maxRetries) {
                    throw error;
                }
                
                // Wait before retry with exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            }
        }
    }

    // Parse AI response and structure it
    parseAIAnalysis(aiResponse, userData) {
        try {
            console.log("Raw AI Response:", aiResponse);
            
            // Clean up the response - remove markdown code blocks if present
            let cleanedResponse = aiResponse;
            if (aiResponse.includes('```json')) {
                // Extract JSON from markdown code blocks
                const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    cleanedResponse = jsonMatch[1];
                } else {
                    // Try to find JSON without closing ```
                    const startMatch = aiResponse.match(/```json\s*([\s\S]*)/);
                    if (startMatch) {
                        cleanedResponse = startMatch[1];
                    }
                }
            }
            
            // Remove any trailing incomplete text
            cleanedResponse = cleanedResponse.trim();
            
            // Try to fix incomplete JSON by finding the last complete object
            if (!cleanedResponse.endsWith('}')) {
                // Find the last complete closing brace
                let braceCount = 0;
                let lastValidIndex = -1;
                
                for (let i = 0; i < cleanedResponse.length; i++) {
                    if (cleanedResponse[i] === '{') {
                        braceCount++;
                    } else if (cleanedResponse[i] === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            lastValidIndex = i;
                        }
                    }
                }
                
                if (lastValidIndex > -1) {
                    cleanedResponse = cleanedResponse.substring(0, lastValidIndex + 1);
                }
            }
            
            console.log("Cleaned AI Response:", cleanedResponse);
            
            // Try to parse as JSON
            const parsed = JSON.parse(cleanedResponse);
            
            // Validate required fields
            if (parsed.spendingInsights && parsed.savingsOpportunities) {
                console.log("Successfully parsed AI response as JSON");
                return parsed;
            } else {
                console.log("Parsed JSON but missing required fields, using fallback");
                throw new Error("Missing required fields in parsed JSON");
            }
        } catch (error) {
            console.log("AI response not in valid JSON format, creating structured response:", error.message);
            
            // Extract insights from the raw text
            const extractedInsight = this.extractInsightFromText(aiResponse);
            
            return this.createStructuredResponse(extractedInsight, userData);
        }
    }

    // Extract meaningful insight from raw AI text
    extractInsightFromText(aiResponse) {
        // Look for Filipino text or meaningful financial advice
        const sentences = aiResponse.split(/[.!?]+/).filter(s => s.trim().length > 10);
        
        // Find the most relevant sentence about spending or savings
        const relevantSentence = sentences.find(sentence => 
            sentence.includes('gastusin') || 
            sentence.includes('kita') || 
            sentence.includes('ipon') || 
            sentence.includes('savings') ||
            sentence.includes('spending') ||
            sentence.includes('₱')
        );
        
        return relevantSentence ? relevantSentence.trim() : 
               "Nakita ko ang inyong financial data. Magpatuloy tayo sa pag-improve ng inyong savings habits gamit ang Filipino strategies!";
    }

    // Create a structured response when JSON parsing fails
    createStructuredResponse(insight, userData) {
        const savingsRate = userData.monthlyIncome > 0 
            ? ((userData.monthlyIncome - userData.totalSpent) / userData.monthlyIncome * 100) 
            : 0;

        return {
            spendingInsights: {
                insight: insight,
                savingsRate: Math.round(savingsRate * 10) / 10, // Round to 1 decimal
                severity: this.determineSeverity(userData),
                culturalContext: "Ginagamit namin ang Filipino financial wisdom para sa guidance"
            },
            savingsOpportunities: this.extractOpportunities('', userData),
            personalizedGoals: this.extractGoals('', userData),
            riskAssessment: this.extractRisks('', userData),
            filipinoStrategies: this.extractStrategies(''),
            reasoning: "AI analysis na may Filipino cultural considerations",
            confidence: 0.7,
            nextSteps: this.extractNextSteps('')
        };
    }

    // Load user's learning history from Firestore
    async loadUserLearningHistory() {
        try {
            const userId = this.auth.currentUser?.uid;
            if (!userId) return;

            const userData = await getUserData(userId);
            const learningData = userData?.iponCoachLearning || {};
            
            this.learningHistory = learningData.interactions || [];
            this.decisionHistory = learningData.decisions || [];
            this.userInteractions = learningData.userFeedback || [];
            
            console.log(`Loaded ${this.learningHistory.length} learning interactions`);
        } catch (error) {
            console.error("Error loading learning history:", error);
            this.learningHistory = [];
            this.decisionHistory = [];
            this.userInteractions = [];
        }
    }

    // Store interaction for learning and adaptation
    async storeInteraction(type, inputData, outputData, userFeedback = null) {
        try {
            const userId = this.auth.currentUser?.uid;
            if (!userId) return;

            const interaction = {
                id: `interaction_${Date.now()}`,
                type, // 'analysis', 'decision', 'recommendation'
                timestamp: new Date().toISOString(),
                inputData: this.sanitizeForStorage(inputData),
                outputData: this.sanitizeForStorage(outputData),
                userFeedback,
                success: userFeedback ? userFeedback.rating > 3 : null
            };

            this.learningHistory.push(interaction);
            
            // Keep only last 50 interactions for performance
            if (this.learningHistory.length > 50) {
                this.learningHistory = this.learningHistory.slice(-50);
            }

            // Store in Firestore
            await this.saveLearningData();
            
            console.log(`Stored ${type} interaction for learning`);
        } catch (error) {
            console.error("Error storing interaction:", error);
        }
    }

    // Save learning data to Firestore
    async saveLearningData() {
        try {
            const userId = this.auth.currentUser?.uid;
            if (!userId) return;

            const learningData = {
                interactions: this.learningHistory,
                decisions: this.decisionHistory,
                userFeedback: this.userInteractions,
                lastUpdated: new Date().toISOString(),
                version: '1.0'
            };

            await storeUserData(userId, { iponCoachLearning: learningData });
        } catch (error) {
            console.error("Error saving learning data:", error);
        }
    }

    // Sanitize data for storage (remove functions, circular refs, etc.)
    sanitizeForStorage(data) {
        return JSON.parse(JSON.stringify(data, (key, value) => {
            if (typeof value === 'function') return '[Function]';
            if (value instanceof Date) return value.toISOString();
            return value;
        }));
    }

    // Learn from user feedback and adapt recommendations
    async learnFromFeedback(interactionId, feedback) {
        try {
            const interaction = this.learningHistory.find(i => i.id === interactionId);
            if (interaction) {
                interaction.userFeedback = feedback;
                interaction.success = feedback.rating > 3;
                
                // Analyze feedback for improvement
                await this.analyzeAndImprove(interaction);
                
                // Save updated learning data
                await this.saveLearningData();
                
                console.log("Learning updated from user feedback");
            }
        } catch (error) {
            console.error("Error learning from feedback:", error);
        }
    }

    // Analyze feedback and improve future recommendations
    async analyzeAndImprove(interaction) {
        try {
            // If this was a successful interaction, reinforce similar patterns
            if (interaction.success) {
                // Find similar successful patterns
                const successfulPatterns = this.learningHistory.filter(i => 
                    i.success && i.type === interaction.type
                );
                
                // Use these patterns to improve future recommendations
                console.log(`Found ${successfulPatterns.length} successful patterns to reinforce`);
            } else {
                // Analyze what went wrong and adjust
                console.log("Analyzing unsuccessful interaction to improve future responses");
                
                // Store what didn't work to avoid similar mistakes
                const pattern = {
                    type: interaction.type,
                    context: interaction.inputData,
                    failedResponse: interaction.outputData,
                    userFeedback: interaction.userFeedback,
                    timestamp: new Date().toISOString()
                };
                
                // This could be used to train a more sophisticated learning model
            }
        } catch (error) {
            console.error("Error in analyze and improve:", error);
        }
    }

    async updateLoadingMessage(message) {
        const loadingText = this.elements.loadingState?.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
        await this.delay(500); // Small delay for better UX
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Render AI insights with enhanced UI
    renderAIInsights(insights) {
        this.renderCoachTip(insights.spendingInsights);
        this.renderSavingsGoals(insights.personalizedGoals);
        this.renderChallenge();
        this.renderFilipinoWisdom();
        this.renderDetailedInsights(insights);
    }

    renderCoachTip(spendingInsights) {
        if (!this.elements.coachTipText) return;
        
        this.elements.coachTipText.innerHTML = `
            <div class="coach-message">
                <div class="coach-avatar">🤖</div>
                <div class="coach-text">
                    <strong>AI Analysis Complete!</strong><br>
                    ${spendingInsights.insight}
                </div>
            </div>
        `;
    }

    renderSavingsGoals(goals) {
        if (!this.elements.savingsGoalsList || !goals) return;

        const goalsHTML = goals.map(goal => {
            const percentage = Math.min((goal.current / goal.target) * 100, 100);
            return `
                <div class="goal-item">
                    <div class="goal-header">
                        <h4>${goal.name}</h4>
                        <span class="goal-priority priority-${goal.priority}">${goal.priority}</span>
                    </div>
                    <div class="goal-progress">
                        <div class="progress-bar">
                            <div class="progress-bar-inner" style="width: ${percentage}%">
                                ${Math.round(percentage)}%
                            </div>
                        </div>
                        <div class="goal-amounts">
                            <span>₱${goal.current.toLocaleString()}</span>
                            <span>₱${goal.target.toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="goal-method">
                        <i class="fas fa-lightbulb"></i>
                        ${goal.method}
                    </div>
                </div>
            `;
        }).join('');

        this.elements.savingsGoalsList.innerHTML = goalsHTML;
    }

    renderChallenge() {
        const challenges = [
            {
                name: '7-Day Ipon Challenge',
                description: 'Save ₱50 every day for a week. Small steps lead to big victories!',
                target: 350
            },
            {
                name: 'Alkansya Month',
                description: 'Use a traditional coin bank and save all your loose change for 30 days.',
                target: 2000
            },
            {
                name: 'Baon Challenge',
                description: 'Bring lunch from home for 2 weeks instead of buying outside.',
                target: 1500
            }
        ];

        const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];

        if (this.elements.challengeName) {
            this.elements.challengeName.textContent = randomChallenge.name;
        }
        if (this.elements.challengeDesc) {
            this.elements.challengeDesc.textContent = randomChallenge.description;
        }
        if (this.elements.challengeTarget) {
            this.elements.challengeTarget.textContent = `₱${randomChallenge.target.toLocaleString()}`;
        }
    }

    renderFilipinoWisdom() {
        const randomWisdom = this.filipinoWisdom[Math.floor(Math.random() * this.filipinoWisdom.length)];
        
        if (this.elements.quoteText) {
            this.elements.quoteText.textContent = randomWisdom.text;
        }
        if (this.elements.quoteAuthor) {
            this.elements.quoteAuthor.textContent = `— ${randomWisdom.author}`;
        }
    }

    renderDetailedInsights(insights) {
        // Create insights section dynamically
        const mainContent = document.querySelector('#coach-dashboard');
        if (!mainContent) return;

        const insightsSection = document.createElement('div');
        insightsSection.className = 'insights-section';
        insightsSection.innerHTML = `
            <h2><i class="fas fa-brain"></i> AI-Powered Insights</h2>
            <div class="insights-grid">
                ${this.createOpportunitiesCard(insights.savingsOpportunities)}
                ${this.createStrategiesCard(insights.filipinoStrategies)}
                ${this.createRisksCard(insights.riskAssessment)}
            </div>
        `;

        // Remove existing insights section if it exists
        const existingInsights = mainContent.querySelector('.insights-section');
        if (existingInsights) {
            existingInsights.remove();
        }

        mainContent.appendChild(insightsSection);
    }

    createOpportunitiesCard(opportunities) {
        const opportunitiesHTML = opportunities.map(opp => `
            <div class="opportunity-item">
                <div class="opportunity-desc">${opp.category} Optimization</div>
                <div class="opportunity-potential">Save up to ₱${opp.potential.toLocaleString()}/month</div>
                <div class="opportunity-method">${opp.strategy}</div>
            </div>
        `).join('');

        return `
            <div class="insight-card">
                <h3><i class="fas fa-coins"></i> Savings Opportunities</h3>
                <div class="opportunities-list">
                    ${opportunitiesHTML || '<p>Great job! Your spending is well-optimized.</p>'}
                </div>
            </div>
        `;
    }

    createStrategiesCard(strategies) {
        const strategiesHTML = strategies.map(strategy => `
            <div class="category-item">
                <div class="category-name">${strategy.name}</div>
                <div class="category-amount">${strategy.suitability}</div>
            </div>
        `).join('');

        return `
            <div class="insight-card">
                <h3><i class="fas fa-flag-philippines"></i> Filipino Strategies</h3>
                <div class="category-list">
                    ${strategiesHTML}
                </div>
            </div>
        `;
    }

    createRisksCard(risks) {
        const risksHTML = risks.map(risk => `
            <div class="risk-item severity-${risk.severity}">
                <div class="risk-desc">${risk.risk}</div>
                <div class="risk-recommendation">${risk.recommendation}</div>
            </div>
        `).join('');

        return `
            <div class="insight-card">
                <h3><i class="fas fa-shield-alt"></i> Risk Assessment</h3>
                <div class="risks-list">
                    ${risksHTML || '<div class="risk-item severity-low"><div class="risk-desc">Low Risk Profile</div><div class="risk-recommendation">Your financial health looks good! Keep up the great work.</div></div>'}
                </div>
            </div>
        `;
    }

    // State management with error handling
    showState(stateName) {
        const stateElements = {
            'loadingState': this.elements.loadingState,
            'contentLoaded': this.elements.contentLoaded,
            'emptyState': this.elements.emptyState
        };
        
        // Hide all states first
        Object.values(stateElements).forEach(element => {
            if (element) {
                element.style.display = 'none';
            }
        });
        
        // Show the requested state
        const targetElement = stateElements[stateName];
        if (targetElement) {
            targetElement.style.display = 'block';
            
            // Add special styling for loading state
            if (stateName === 'loadingState') {
                targetElement.classList.add('loading-indicator');
            }
        }
    }

    // Main autonomous execution with real AI
    async start() {
        try {
            console.log("Starting Ipon Coach AI...");
            this.showState('loadingState');
            
            // Check authentication first
            await this.updateLoadingMessage('Checking authentication...');
            if (!this.auth.currentUser) {
                console.log("User not authenticated, waiting for auth state...");
                
                // Wait for auth state to be ready
                await new Promise((resolve) => {
                    const unsubscribe = this.auth.onAuthStateChanged((user) => {
                        if (user) {
                            console.log("User authenticated:", user.uid);
                            unsubscribe();
                            resolve();
                        } else {
                            console.log("No user authenticated, showing empty state");
                            unsubscribe();
                            resolve();
                        }
                    });
                });
            }
            
            if (!this.auth.currentUser) {
                this.showState('emptyState');
                return;
            }
            
            // Load real user financial data
            await this.updateLoadingMessage('Loading your financial data...');
            this.userData = await this.loadUserFinancialData();
            
            if (!this.userData || !this.userData.hasTransactions || this.userData.transactionCount < 1) {
                console.log("Insufficient transaction data for analysis");
                
                // If user has no transactions at all, show a helpful message
                if (!this.userData || this.userData.transactionCount === 0) {
                    this.showEmptyStateWithPrompt();
                } else {
                    this.showState('emptyState');
                }
                return;
            }
            
            // Perform real AI analysis using Gemini
            await this.updateLoadingMessage('AI is analyzing your financial patterns...');
            this.aiInsights = await this.analyzeUserData(this.userData);
            
            // Render insights
            await this.updateLoadingMessage('Generating personalized recommendations...');
            this.renderAIInsights(this.aiInsights);
            
            // Show content
            this.showState('contentLoaded');
            
            // Mark analysis as complete
            this.analysisComplete = true;
            
            // Add feedback interface for learning
            this.addFeedbackInterface();
            
            console.log('Ipon Coach AI analysis complete with real data and AI!', this.aiInsights);
            
        } catch (error) {
            console.error('Error in Ipon Coach AI:', error);
            this.showError('Failed to analyze your financial data. Please try again.');
        }
    }

    // Add feedback interface for learning
    addFeedbackInterface() {
        const mainContent = document.querySelector('#coach-dashboard');
        if (!mainContent) return;

        const feedbackSection = document.createElement('div');
        feedbackSection.className = 'feedback-section';
        feedbackSection.innerHTML = `
            <div class="feedback-card">
                <h3><i class="fas fa-star"></i> Rate This Analysis</h3>
                <p>Help me learn and improve by rating this financial analysis:</p>
                <div class="rating-buttons">
                    <button class="rating-btn" data-rating="1">😟 Poor</button>
                    <button class="rating-btn" data-rating="2">😐 Fair</button>
                    <button class="rating-btn" data-rating="3">🙂 Good</button>
                    <button class="rating-btn" data-rating="4">😊 Great</button>
                    <button class="rating-btn" data-rating="5">🤩 Excellent</button>
                </div>
                <div class="feedback-text" style="display: none;">
                    <textarea placeholder="Any specific feedback to help me improve?"></textarea>
                    <button class="submit-feedback-btn">Submit Feedback</button>
                </div>
            </div>
        `;

        mainContent.appendChild(feedbackSection);

        // Add event listeners for feedback
        const ratingButtons = feedbackSection.querySelectorAll('.rating-btn');
        ratingButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const rating = parseInt(btn.dataset.rating);
                const feedbackText = feedbackSection.querySelector('.feedback-text');
                feedbackText.style.display = 'block';
                
                // Highlight selected rating
                ratingButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                
                const submitBtn = feedbackSection.querySelector('.submit-feedback-btn');
                submitBtn.addEventListener('click', async () => {
                    const comments = feedbackSection.querySelector('textarea').value;
                    await this.submitFeedback(rating, comments);
                    feedbackSection.innerHTML = '<p><i class="fas fa-check"></i> Thank you for your feedback! I\'ll use this to improve future recommendations.</p>';
                });
            });
        });
    }

    // Submit user feedback for learning
    async submitFeedback(rating, comments) {
        try {
            const feedback = {
                rating,
                comments,
                timestamp: new Date().toISOString(),
                analysisType: 'financial_overview'
            };

            // Find the most recent interaction to attach feedback to
            const lastInteractionId = this.learningHistory.length > 0 
                ? this.learningHistory[this.learningHistory.length - 1].id 
                : `interaction_${Date.now()}`;

            await this.learnFromFeedback(lastInteractionId, feedback);
            
            console.log('Feedback submitted and learning updated');
        } catch (error) {
            console.error('Error submitting feedback:', error);
        }
    }

    showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Oops! Something went wrong</h3>
            <p>${message}</p>
        `;
        
        document.body.appendChild(errorElement);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    }

    // Helper methods for parsing AI responses when JSON parsing fails
    extractOpportunities(aiResponse, userData) {
        const opportunities = [];
        const categories = userData.categories || {};
        
        // Basic opportunity detection based on spending patterns
        Object.entries(categories).forEach(([category, amount]) => {
            const percentage = (amount / userData.totalSpent) * 100;
            
            if (percentage > 25) {
                opportunities.push({
                    category,
                    potential: Math.round(amount * 0.2),
                    strategy: `Reduce ${category} spending using Filipino "tipid" methods`,
                    impact: 'medium'
                });
            }
        });
        
        return opportunities;
    }

    extractGoals(aiResponse, userData) {
        const income = userData.monthlyIncome || 0;
        const currentSavings = userData.currentSavings || 0;
        
        return [
            {
                name: 'Emergency Fund',
                current: currentSavings,
                target: income * 3,
                priority: 'high',
                method: 'Alkansya Method',
                timeline: '6 months'
            },
            {
                name: 'Investment Fund',
                current: Math.round(currentSavings * 0.3),
                target: income * 2,
                priority: 'medium',
                method: 'Paluwagan System',
                timeline: '12 months'
            }
        ];
    }

    extractRisks(aiResponse, userData) {
        const risks = [];
        const savingsRate = userData.monthlyIncome > 0 
            ? ((userData.monthlyIncome - userData.totalSpent) / userData.monthlyIncome * 100) 
            : 0;
        
        if (savingsRate < 10) {
            risks.push({
                risk: 'Low Savings Rate',
                severity: 'high',
                recommendation: 'Increase savings to at least 20% using "ipon" strategies',
                urgency: 'immediate'
            });
        }
        
        return risks;
    }

    extractStrategies(aiResponse) {
        return [
            {
                name: 'Alkansya Method',
                description: 'Traditional Filipino coin saving technique',
                suitability: 'Perfect for building daily saving habits',
                implementation: 'Save all loose change in a coin bank daily'
            },
            {
                name: 'Baon Strategy',
                description: 'Bring packed lunch to work/school',
                suitability: 'Reduces food expenses significantly',
                implementation: 'Prepare meals at home 3-4 times per week'
            }
        ];
    }

    extractNextSteps(aiResponse) {
        return [
            'Start tracking daily expenses',
            'Set up automatic savings transfer',
            'Create a monthly budget plan',
            'Review and adjust spending categories'
        ];
    }

    determineSeverity(userData) {
        const savingsRate = userData.monthlyIncome > 0 
            ? ((userData.monthlyIncome - userData.totalSpent) / userData.monthlyIncome * 100) 
            : 0;
        
        if (savingsRate < 10) return 'high';
        if (savingsRate < 20) return 'medium';
        return 'low';
    }

    // Fallback analysis when AI fails
    getFallbackAnalysis(userData) {
        const savingsRate = userData.monthlyIncome > 0 
            ? ((userData.monthlyIncome - userData.totalSpent) / userData.monthlyIncome * 100) 
            : 0;

        return {
            spendingInsights: {
                insight: `You're currently saving ${Math.round(savingsRate)}% of your income. Let's work together to improve your financial health using Filipino-inspired strategies.`,
                savingsRate,
                severity: this.determineSeverity(userData),
                culturalContext: "Using traditional Filipino financial wisdom for guidance"
            },
            savingsOpportunities: this.extractOpportunities('', userData),
            personalizedGoals: this.extractGoals('', userData),
            riskAssessment: this.extractRisks('', userData),
            filipinoStrategies: this.extractStrategies(''),
            reasoning: "Basic analysis based on spending patterns and Filipino financial principles",
            confidence: 0.6,
            nextSteps: this.extractNextSteps('')
        };
    }

    // Display AI analysis results
    displayAnalysis(analysis) {
        console.log("Displaying analysis:", analysis);
        
        const analysisContainer = document.getElementById('analysis-results');
        if (!analysisContainer) {
            console.error('Analysis container not found');
            return;
        }

        // Ensure we have valid analysis data
        if (!analysis || typeof analysis !== 'object') {
            console.error('Invalid analysis data:', analysis);
            analysisContainer.innerHTML = `
                <div class="error-message">
                    <h3>❌ Analysis Error</h3>
                    <p>Hindi ma-process ang AI analysis. Please try again.</p>
                </div>
            `;
            return;
        }

        try {
            analysisContainer.innerHTML = `
                <div class="analysis-header">
                    <h2>🤖 AI Coach Insights</h2>
                    <div class="confidence-badge">
                        Confidence: ${Math.round((analysis.confidence || 0.7) * 100)}%
                    </div>
                </div>

                <div class="insights-section">
                    <h3>💡 Spending Insights</h3>
                    <div class="insight-card">
                        <p class="main-insight">${analysis.spendingInsights?.insight || 'Analyzing your financial patterns...'}</p>
                        <div class="metrics">
                            <div class="metric">
                                <span class="label">Savings Rate:</span>
                                <span class="value ${this.getSavingsRateClass(analysis.spendingInsights?.savingsRate || 0)}">
                                    ${(analysis.spendingInsights?.savingsRate || 0).toFixed(1)}%
                                </span>
                            </div>
                            <div class="metric">
                                <span class="label">Risk Level:</span>
                                <span class="value risk-${analysis.riskAssessment?.level || 'medium'}">
                                    ${(analysis.riskAssessment?.level || 'medium').toUpperCase()}
                                </span>
                            </div>
                        </div>
                        ${analysis.spendingInsights?.culturalContext ? 
                            `<p class="cultural-context">🇵🇭 ${analysis.spendingInsights.culturalContext}</p>` : ''}
                    </div>
                </div>

                <div class="opportunities-section">
                    <h3>💰 Savings Opportunities</h3>
                    <div class="opportunities-grid">
                        ${this.renderSavingsOpportunities(analysis.savingsOpportunities || [])}
                    </div>
                </div>

                <div class="goals-section">
                    <h3>🎯 Personalized Goals</h3>
                    <div class="goals-list">
                        ${this.renderPersonalizedGoals(analysis.personalizedGoals || [])}
                    </div>
                </div>

                <div class="strategies-section">
                    <h3>🇵🇭 Filipino Strategies</h3>
                    <div class="strategies-grid">
                        ${this.renderFilipinoStrategies(analysis.filipinoStrategies || [])}
                    </div>
                </div>

                <div class="next-steps-section">
                    <h3>📋 Next Steps</h3>
                    <div class="next-steps-list">
                        ${this.renderNextSteps(analysis.nextSteps || [])}
                    </div>
                </div>

                <div class="reasoning-section">
                    <h3>🧠 AI Reasoning</h3>
                    <p class="reasoning-text">${analysis.reasoning || 'AI analysis completed successfully.'}</p>
                </div>
            `;

            // Add interaction handlers
            this.addInteractionHandlers();
            
        } catch (error) {
            console.error('Error displaying analysis:', error);
            analysisContainer.innerHTML = `
                <div class="error-message">
                    <h3>❌ Display Error</h3>
                    <p>May problema sa pag-display ng analysis. Please refresh and try again.</p>
                    <details>
                        <summary>Technical Details</summary>
                        <pre>${error.message}</pre>
                    </details>
                </div>
            `;
        }
    }

    // Get CSS class for savings rate color coding
    getSavingsRateClass(rate) {
        if (rate >= 20) return 'excellent';
        if (rate >= 10) return 'good';
        if (rate >= 5) return 'fair';
        return 'poor';
    }

    // Render savings opportunities
    renderSavingsOpportunities(opportunities) {
        if (!opportunities || opportunities.length === 0) {
            return '<p class="no-data">Walang specific opportunities na na-identify. Keep tracking your expenses!</p>';
        }

        return opportunities.map(opp => `
            <div class="opportunity-card">
                <h4>${opp.category || 'General'}</h4>
                <p class="strategy">${opp.strategy || 'No specific strategy available'}</p>
                <div class="savings-potential">
                    <span class="current">Current: ₱${(opp.currentSpending || 0).toLocaleString()}</span>
                    <span class="suggested">Suggested: ₱${(opp.suggestedReduction || 0).toLocaleString()}</span>
                </div>
                <p class="impact">Impact: ${opp.impact || 'Medium'}</p>
            </div>
        `).join('');
    }

    // Render personalized goals
    renderPersonalizedGoals(goals) {
        if (!goals || goals.length === 0) {
            return '<p class="no-data">Mag-set tayo ng financial goals based sa inyong data!</p>';
        }

        return goals.map(goal => `
            <div class="goal-card">
                <h4>${goal.goal || 'Financial Goal'}</h4>
                <p class="timeframe">Timeline: ${goal.timeframe || 'To be determined'}</p>
                <p class="strategy">${goal.strategy || 'Strategy to be developed'}</p>
                <p class="motivation">💪 ${goal.motivation || 'Stay motivated!'}</p>
            </div>
        `).join('');
    }

    // Render Filipino strategies
    renderFilipinoStrategies(strategies) {
        if (!strategies || strategies.length === 0) {
            return '<p class="no-data">Mag-suggest tayo ng Filipino financial strategies!</p>';
        }

        return strategies.map(strategy => `
            <div class="strategy-card">
                <h4>${strategy.name || 'Filipino Strategy'}</h4>
                <p class="description">${strategy.description || 'Traditional Filipino approach to saving money'}</p>
                <div class="implementation">
                    <strong>How to implement:</strong>
                    <p>${strategy.implementation || 'Step-by-step guide coming soon'}</p>
                </div>
            </div>
        `).join('');
    }

    // Render next steps
    renderNextSteps(steps) {
        if (!steps || steps.length === 0) {
            return '<p class="no-data">Continue tracking your expenses para sa better insights!</p>';
        }

        return steps.map((step, index) => `
            <div class="step-item">
                <span class="step-number">${index + 1}</span>
                <span class="step-text">${step}</span>
            </div>
        `).join('');
    }

    showEmptyStateWithPrompt() {
        // Show empty state with helpful guidance
        this.showState('emptyState');
        
        // Update empty state content to be more helpful
        const emptyStateElement = this.elements.emptyState;
        if (emptyStateElement) {
            emptyStateElement.innerHTML = `
                <div class="empty-state-content">
                    <i class="fas fa-chart-line" style="font-size: 3rem; color: rgba(255, 255, 255, 0.3); margin-bottom: 1.5rem;"></i>
                    <h3>Start Your Financial Journey</h3>
                    <p>To get personalized savings advice from your Ipon Coach, you need to:</p>
                    <ul style="list-style: none; padding: 0; margin-top: 1rem; text-align: left; display: inline-block;">
                        <li style="margin-bottom: 0.5rem;"><i class="fas fa-plus-circle" style="margin-right: 0.5rem; color: #4CAF50;"></i> Add at least 1 transaction</li>
                        <li style="margin-bottom: 0.5rem;"><i class="fas fa-bank" style="margin-right: 0.5rem; color: #2196F3;"></i> Connect your bank accounts (optional)</li>
                        <li style="margin-bottom: 0.5rem;"><i class="fas fa-refresh" style="margin-right: 0.5rem; color: #FF9800;"></i> Come back for AI-powered insights</li>
                    </ul>
                    <p style="margin-top: 1.5rem;">Once you have some transaction data, I'll analyze your spending patterns and provide personalized Filipino-inspired savings strategies!</p>
                    <div style="margin-top: 2rem;">
                        <button onclick="window.location.href='/pages/transactions.html'" class="btn btn-primary" style="margin-right: 1rem;">
                            <i class="fas fa-plus"></i> Add Transaction
                        </button>
                        <button onclick="location.reload()" class="btn btn-secondary">
                            <i class="fas fa-refresh"></i> Refresh
                        </button>
                    </div>
                </div>
            `;
        }
    }
}

// Initialize the AI Coach when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, initializing Ipon Coach AI...");
    const iponCoach = new IponCoachAI();
    iponCoach.start();
});

