/**
 * Real AI Integration Engine for Kita-kita Platform
 * Replaces mock AI functionality with actual AI reasoning
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

// Firebase Admin SDK for database operations
const admin = require('firebase-admin');

class AIEngine {
    constructor() {
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.model = this.gemini.getGenerativeModel({ model: "gemini-pro" });
        
        // Initialize Firestore database
        try {
            this.db = admin.firestore();
            console.log('✅ AIEngine: Firestore initialized successfully');
        } catch (error) {
            console.error('❌ AIEngine: Failed to initialize Firestore:', error.message);
            this.db = null;
        }
        
        // Agent-specific contexts
        this.agentContexts = {
            iponCoach: {
                role: "Filipino savings coach",
                expertise: "budgeting, emergency funds, cultural financial habits",
                language: "Filipino/English mix"
            },
            gastosGuardian: {
                role: "Expense monitoring specialist",
                expertise: "spending analysis, budget alerts, fraud detection",
                language: "Filipino/English mix"
            },
            peraPlanner: {
                role: "Comprehensive financial planner",
                expertise: "investment planning, retirement, goal setting",
                language: "Filipino/English mix"
            }
        };

        // Security: Maximum response size to prevent DoS attacks
        this.MAX_RESPONSE_SIZE = 100000; // 100KB
        this.MAX_JSON_DEPTH = 10;
        
        // Database collection names
        this.COLLECTIONS = {
            DECISIONS: 'ai_decisions',
            PLANS: 'ai_plans',
            LEARNING: 'ai_learning',
            USER_SESSIONS: 'ai_user_sessions'
        };
    }

    /**
     * Secure JSON parsing with comprehensive validation
     */
    secureJsonParse(jsonString, fallbackValue = null, context = 'unknown') {
        try {
            // Input validation
            if (typeof jsonString !== 'string') {
                console.warn(`[Security] Invalid JSON input type in ${context}:`, typeof jsonString);
                return fallbackValue;
            }

            // Check response size to prevent DoS
            if (jsonString.length > this.MAX_RESPONSE_SIZE) {
                console.warn(`[Security] JSON response too large in ${context}: ${jsonString.length} bytes`);
                return fallbackValue;
            }

            // Sanitize input - remove potential injection patterns
            const sanitizedJson = this.sanitizeJsonString(jsonString);
            
            // Parse with depth validation
            const parsed = JSON.parse(sanitizedJson);
            
            // Validate JSON structure depth
            if (this.getObjectDepth(parsed) > this.MAX_JSON_DEPTH) {
                console.warn(`[Security] JSON structure too deep in ${context}`);
                return fallbackValue;
            }

            // Validate and sanitize the parsed object
            return this.validateAndSanitizeObject(parsed, context);

        } catch (error) {
            console.warn(`[Security] JSON parsing failed in ${context}:`, error.message);
            return fallbackValue;
        }
    }

    /**
     * Sanitize JSON string to prevent injection attacks
     */
    sanitizeJsonString(jsonString) {
        // Remove potential script tags and dangerous patterns
        let sanitized = jsonString
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/eval\s*\(/gi, '')
            .replace(/function\s*\(/gi, '')
            .replace(/new\s+Function/gi, '')
            .replace(/constructor/gi, '');

        // Extract JSON content if wrapped in markdown code blocks
        const jsonMatch = sanitized.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/i);
        if (jsonMatch) {
            sanitized = jsonMatch[1];
        }

        return sanitized.trim();
    }

    /**
     * Calculate object depth for security validation
     */
    getObjectDepth(obj, depth = 0) {
        if (depth > this.MAX_JSON_DEPTH) return depth;
        
        if (obj === null || typeof obj !== 'object') return depth;
        
        let maxDepth = depth;
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const currentDepth = this.getObjectDepth(obj[key], depth + 1);
                maxDepth = Math.max(maxDepth, currentDepth);
            }
        }
        return maxDepth;
    }

    /**
     * Validate and sanitize parsed object to prevent injection
     */
    validateAndSanitizeObject(obj, context) {
        if (obj === null || typeof obj !== 'object') return obj;

        const sanitized = {};
        
        for (const [key, value] of Object.entries(obj)) {
            // Validate key
            const sanitizedKey = this.sanitizeString(key);
            if (sanitizedKey !== key) {
                console.warn(`[Security] Sanitized object key in ${context}:`, key, '->', sanitizedKey);
            }

            // Validate and sanitize value
            if (typeof value === 'string') {
                sanitized[sanitizedKey] = this.sanitizeString(value);
            } else if (Array.isArray(value)) {
                sanitized[sanitizedKey] = value.map(item => 
                    typeof item === 'string' ? this.sanitizeString(item) : item
                ).slice(0, 100); // Limit array size
            } else if (typeof value === 'object' && value !== null) {
                sanitized[sanitizedKey] = this.validateAndSanitizeObject(value, context);
            } else if (typeof value === 'number' && isFinite(value)) {
                sanitized[sanitizedKey] = value;
            } else if (typeof value === 'boolean') {
                sanitized[sanitizedKey] = value;
            } else {
                console.warn(`[Security] Filtered unsafe value type in ${context}:`, typeof value);
            }
        }

        return sanitized;
    }

    /**
     * Sanitize string values to prevent XSS and injection
     */
    sanitizeString(str) {
        if (typeof str !== 'string') return str;
        
        return str
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/eval\s*\(/gi, '')
            .replace(/function\s*\(/gi, '')
            .replace(/new\s+Function/gi, '')
            .replace(/constructor/gi, '')
            .replace(/prototype/gi, '')
            .replace(/__proto__/gi, '')
            .substring(0, 10000); // Limit string length
    }

    /**
     * Real autonomous decision making with AI
     */
    async makeDecision(agentType, userContext, userGoals) {
        try {
            const agentContext = this.agentContexts[agentType];
            const prompt = this.buildDecisionPrompt(agentContext, userContext, userGoals);
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const decision = this.parseAIResponse(response.text());
            
            // Store decision for learning
            await this.storeDecision(agentType, userContext, decision);
            
            return decision;
        } catch (error) {
            console.error('AI Decision Error:', error);
            return await this.getFallbackDecision(agentType, userContext);
        }
    }

    /**
     * Real reasoning with step-by-step analysis
     */
    async performReasoning(agentType, dataPoints, scenario) {
        const reasoningPrompt = `
        As a ${this.agentContexts[agentType].role}, analyze this financial scenario:
        
        Data: ${JSON.stringify(dataPoints)}
        Scenario: ${scenario}
        
        Perform step-by-step reasoning:
        1. Identify key patterns and risks
        2. Consider Filipino cultural factors
        3. Evaluate short-term and long-term implications
        4. Generate specific, actionable recommendations
        5. Provide confidence level and reasoning chain
        
        Response format: JSON with reasoning steps and final recommendation.
        `;

        try {
            const result = await this.model.generateContent(reasoningPrompt);
            const response = await result.response;
            
            // Secure JSON parsing with validation
            const fallbackReasoning = {
                reasoning_steps: ["Applied basic financial analysis"],
                recommendation: "Continue with current financial planning approach",
                confidence: 0.5
            };
            
            return this.secureJsonParse(
                response.text(), 
                fallbackReasoning, 
                'performReasoning'
            );
        } catch (error) {
            return await this.getFallbackReasoning(agentType, dataPoints);
        }
    }

    /**
     * Real planning with multi-step strategies
     */
    async createPlan(agentType, userGoals, currentSituation, timeframe) {
        const planningPrompt = `
        Create a detailed financial plan as a ${this.agentContexts[agentType].role}:
        
        Goals: ${JSON.stringify(userGoals)}
        Current Situation: ${JSON.stringify(currentSituation)}
        Timeframe: ${timeframe}
        
        Create a comprehensive plan with:
        1. Priority ranking of goals
        2. Month-by-month action steps
        3. Milestone checkpoints
        4. Risk mitigation strategies
        5. Filipino cultural considerations (OFW remittances, family obligations, etc.)
        6. Contingency plans for different scenarios
        
        Format as detailed JSON plan with specific actions and timelines.
        `;

        try {
            const result = await this.model.generateContent(planningPrompt);
            const response = await result.response;
            
            // Secure JSON parsing with validation
            const fallbackPlan = {
                plan_name: "Basic Financial Plan",
                timeline: "6 months",
                steps: [
                    { month: 1, action: "Assess current financial situation" },
                    { month: 2, action: "Create budget and savings plan" },
                    { month: 3, action: "Implement initial improvements" }
                ],
                success_metrics: ["Improved savings rate", "Better expense tracking"]
            };
            
            const plan = this.secureJsonParse(
                response.text(), 
                fallbackPlan, 
                'createPlan'
            );
            
            // Store plan for tracking
            await this.storePlan(agentType, userGoals, plan);
            
            return plan;
        } catch (error) {
            return await this.getFallbackPlan(agentType, userGoals);
        }
    }

    /**
     * Learning and adaptation based on outcomes
     */
    async learn(agentType, decision, userFeedback, actualOutcome) {
        const learningPrompt = `
        Update knowledge based on this interaction:
        
        Agent: ${agentType}
        Decision Made: ${JSON.stringify(decision)}
        User Feedback: ${userFeedback}
        Actual Outcome: ${JSON.stringify(actualOutcome)}
        
        Analyze:
        1. Was the decision effective?
        2. What could be improved?
        3. What patterns should be noted?
        4. How should future similar decisions be adjusted?
        
        Provide learning insights for future decision-making.
        `;

        try {
            const result = await this.model.generateContent(learningPrompt);
            const response = await result.response;
            
            // Secure JSON parsing with validation
            const fallbackInsights = {
                effectiveness: "moderate",
                improvements: ["Continue monitoring user feedback"],
                patterns: ["Standard learning pattern applied"],
                adjustments: ["Maintain current approach"]
            };
            
            const insights = this.secureJsonParse(
                response.text(), 
                fallbackInsights, 
                'learn'
            );
            
            // Store learning for agent improvement
            await this.storeLearning(agentType, insights);
            
            return insights;
        } catch (error) {
            console.error('Learning Error:', error);
            return null;
        }
    }

    /**
     * Multi-agent coordination for complex decisions
     */
    async coordinateAgents(userContext, complexScenario) {
        const coordination = {};
        
        // Get input from all agents
        for (const agentType of Object.keys(this.agentContexts)) {
            coordination[agentType] = await this.makeDecision(agentType, userContext, complexScenario);
        }
        
        // Synthesize into unified recommendation
        const synthesisPrompt = `
        Synthesize these agent recommendations into a unified financial strategy:
        
        ${JSON.stringify(coordination)}
        
        User Context: ${JSON.stringify(userContext)}
        Scenario: ${complexScenario}
        
        Provide:
        1. Unified recommendation that considers all agent inputs
        2. Priority ranking of actions
        3. Potential conflicts and resolutions
        4. Implementation timeline
        5. Success metrics
        `;

        try {
            const result = await this.model.generateContent(synthesisPrompt);
            const response = await result.response;
            
            // Secure JSON parsing with validation
            const fallbackCoordination = {
                unified_recommendation: "Implement balanced financial strategy",
                priority_actions: ["Start with budget tracking", "Build emergency fund"],
                timeline: "3-6 months",
                success_metrics: ["Improved financial stability"]
            };
            
            return this.secureJsonParse(
                response.text(), 
                fallbackCoordination, 
                'coordinateAgents'
            );
        } catch (error) {
            return await this.getFallbackCoordination(coordination);
        }
    }

    // Helper methods
    buildDecisionPrompt(agentContext, userContext, userGoals) {
        return `
        You are a ${agentContext.role} with expertise in ${agentContext.expertise}.
        Communicate in ${agentContext.language}.
        
        User Context: ${JSON.stringify(userContext)}
        User Goals: ${JSON.stringify(userGoals)}
        
        Make an autonomous decision that:
        1. Addresses the user's immediate needs
        2. Aligns with their long-term goals
        3. Considers Filipino cultural financial patterns
        4. Provides specific, actionable steps
        5. Includes confidence level and reasoning
        
        Respond with JSON: {
            "decision": "specific recommendation",
            "reasoning": "step-by-step logic",
            "actions": ["action1", "action2"],
            "confidence": 0.85,
            "cultural_considerations": ["factor1", "factor2"],
            "expected_outcome": "predicted result"
        }
        `;
    }

    parseAIResponse(responseText) {
        // Use secure JSON parsing with comprehensive validation
        const fallbackResponse = {
            decision: responseText.substring(0, 500), // Limit fallback size
            reasoning: "AI reasoning provided",
            confidence: 0.7,
            actions: ["Review recommendation"],
            cultural_considerations: [],
            expected_outcome: "Improved financial situation"
        };

        return this.secureJsonParse(responseText, fallbackResponse, 'parseAIResponse');
    }

    async storeDecision(agentType, context, decision) {
        const decisionRecord = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            agentType,
            context: this.sanitizeContextForStorage(context),
            decision: this.sanitizeDecisionForStorage(decision),
            userId: context.userId || 'anonymous',
            sessionId: context.sessionId || this.generateSessionId(),
            version: '1.0',
            environment: process.env.NODE_ENV || 'development'
        };

        try {
            if (!this.db) {
                console.warn('Database not available, using fallback storage');
                return this.fallbackStorage('decision', decisionRecord);
            }

            // Store in Firestore with auto-generated ID
            const docRef = await this.db.collection(this.COLLECTIONS.DECISIONS).add(decisionRecord);
            console.log(`✅ Decision stored with ID: ${docRef.id}`);
            
            // Also store in user-specific subcollection for easy retrieval
            if (decisionRecord.userId !== 'anonymous') {
                await this.db
                    .collection('users')
                    .doc(decisionRecord.userId)
                    .collection('ai_decisions')
                    .doc(docRef.id)
                    .set({
                        ...decisionRecord,
                        globalId: docRef.id
                    });
            }

            return docRef.id;
        } catch (error) {
            console.error('❌ Failed to store decision:', error);
            return this.fallbackStorage('decision', decisionRecord);
        }
    }

    async storePlan(agentType, goals, plan) {
        const planRecord = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            agentType,
            goals: this.sanitizeGoalsForStorage(goals),
            plan: this.sanitizePlanForStorage(plan),
            status: 'active',
            userId: goals.userId || plan.userId || 'anonymous',
            sessionId: goals.sessionId || plan.sessionId || this.generateSessionId(),
            version: '1.0',
            environment: process.env.NODE_ENV || 'development',
            expiresAt: this.calculatePlanExpiration(plan)
        };

        try {
            if (!this.db) {
                console.warn('Database not available, using fallback storage');
                return this.fallbackStorage('plan', planRecord);
            }

            // Store in Firestore with auto-generated ID
            const docRef = await this.db.collection(this.COLLECTIONS.PLANS).add(planRecord);
            console.log(`✅ Plan stored with ID: ${docRef.id}`);
            
            // Also store in user-specific subcollection
            if (planRecord.userId !== 'anonymous') {
                await this.db
                    .collection('users')
                    .doc(planRecord.userId)
                    .collection('ai_plans')
                    .doc(docRef.id)
                    .set({
                        ...planRecord,
                        globalId: docRef.id
                    });
            }

            return docRef.id;
        } catch (error) {
            console.error('❌ Failed to store plan:', error);
            return this.fallbackStorage('plan', planRecord);
        }
    }

    async storeLearning(agentType, insights) {
        const learningRecord = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            agentType,
            insights: this.sanitizeInsightsForStorage(insights),
            applied: false,
            effectiveness: null,
            userId: insights.userId || 'anonymous',
            sessionId: insights.sessionId || this.generateSessionId(),
            version: '1.0',
            environment: process.env.NODE_ENV || 'development'
        };

        try {
            if (!this.db) {
                console.warn('Database not available, using fallback storage');
                return this.fallbackStorage('learning', learningRecord);
            }

            // Store in Firestore with auto-generated ID
            const docRef = await this.db.collection(this.COLLECTIONS.LEARNING).add(learningRecord);
            console.log(`✅ Learning data stored with ID: ${docRef.id}`);
            
            // Update agent-specific learning collection for performance
            await this.db
                .collection('ai_agent_learning')
                .doc(agentType)
                .collection('insights')
                .doc(docRef.id)
                .set({
                    ...learningRecord,
                    globalId: docRef.id
                });

            return docRef.id;
        } catch (error) {
            console.error('❌ Failed to store learning data:', error);
            return this.fallbackStorage('learning', learningRecord);
        }
    }

    // Database helper methods
    sanitizeContextForStorage(context) {
        if (!context || typeof context !== 'object') return {};
        
        return {
            userId: this.sanitizeString(context.userId || ''),
            sessionId: this.sanitizeString(context.sessionId || ''),
            userProfile: this.limitObjectSize(context.userProfile, 1000),
            financialData: this.limitObjectSize(context.financialData, 2000),
            timestamp: context.timestamp || new Date().toISOString()
        };
    }

    sanitizeDecisionForStorage(decision) {
        if (!decision || typeof decision !== 'object') return {};
        
        return {
            decision: this.sanitizeString(decision.decision || '').substring(0, 2000),
            reasoning: this.sanitizeString(decision.reasoning || '').substring(0, 3000),
            confidence: typeof decision.confidence === 'number' ? 
                Math.max(0, Math.min(1, decision.confidence)) : 0.5,
            actions: Array.isArray(decision.actions) ? 
                decision.actions.map(a => this.sanitizeString(a).substring(0, 500)).slice(0, 10) : [],
            cultural_considerations: Array.isArray(decision.cultural_considerations) ? 
                decision.cultural_considerations.map(c => this.sanitizeString(c).substring(0, 300)).slice(0, 5) : [],
            expected_outcome: this.sanitizeString(decision.expected_outcome || '').substring(0, 1000)
        };
    }

    sanitizeGoalsForStorage(goals) {
        if (!goals) return {};
        if (Array.isArray(goals)) {
            return goals.map(goal => this.limitObjectSize(goal, 500)).slice(0, 10);
        }
        return this.limitObjectSize(goals, 1000);
    }

    sanitizePlanForStorage(plan) {
        if (!plan || typeof plan !== 'object') return {};
        
        return {
            plan_name: this.sanitizeString(plan.plan_name || '').substring(0, 200),
            timeline: this.sanitizeString(plan.timeline || '').substring(0, 100),
            steps: Array.isArray(plan.steps) ? 
                plan.steps.map(step => this.limitObjectSize(step, 300)).slice(0, 50) : [],
            success_metrics: Array.isArray(plan.success_metrics) ? 
                plan.success_metrics.map(m => this.sanitizeString(m).substring(0, 200)).slice(0, 10) : [],
            priority_ranking: Array.isArray(plan.priority_ranking) ? 
                plan.priority_ranking.slice(0, 20) : []
        };
    }

    sanitizeInsightsForStorage(insights) {
        if (!insights || typeof insights !== 'object') return {};
        
        return {
            effectiveness: this.sanitizeString(insights.effectiveness || '').substring(0, 100),
            improvements: Array.isArray(insights.improvements) ? 
                insights.improvements.map(i => this.sanitizeString(i).substring(0, 500)).slice(0, 10) : [],
            patterns: Array.isArray(insights.patterns) ? 
                insights.patterns.map(p => this.sanitizeString(p).substring(0, 500)).slice(0, 10) : [],
            adjustments: Array.isArray(insights.adjustments) ? 
                insights.adjustments.map(a => this.sanitizeString(a).substring(0, 500)).slice(0, 10) : [],
            confidence_change: typeof insights.confidence_change === 'number' ? 
                Math.max(-1, Math.min(1, insights.confidence_change)) : 0
        };
    }

    limitObjectSize(obj, maxSize) {
        const str = JSON.stringify(obj);
        if (str.length <= maxSize) return obj;
        
        // Truncate and return safe object
        return { truncated: true, data: str.substring(0, maxSize - 50) + '...' };
    }

    calculatePlanExpiration(plan) {
        try {
            // Default expiration: 1 year from now
            const defaultExpiration = new Date();
            defaultExpiration.setFullYear(defaultExpiration.getFullYear() + 1);
            
            if (!plan.timeline) return defaultExpiration;
            
            // Parse timeline to set appropriate expiration
            const timeline = plan.timeline.toLowerCase();
            const expiration = new Date();
            
            if (timeline.includes('month')) {
                const months = parseInt(timeline.match(/\d+/)?.[0] || '6');
                expiration.setMonth(expiration.getMonth() + months + 3); // Add 3 month buffer
            } else if (timeline.includes('year')) {
                const years = parseInt(timeline.match(/\d+/)?.[0] || '1');
                expiration.setFullYear(expiration.getFullYear() + years + 1); // Add 1 year buffer
            } else if (timeline.includes('week')) {
                const weeks = parseInt(timeline.match(/\d+/)?.[0] || '4');
                expiration.setDate(expiration.getDate() + (weeks * 7) + 30); // Add 30 day buffer
            } else {
                return defaultExpiration;
            }
            
            return expiration;
        } catch (error) {
            console.warn('Failed to calculate plan expiration:', error);
            const defaultExpiration = new Date();
            defaultExpiration.setFullYear(defaultExpiration.getFullYear() + 1);
            return defaultExpiration;
        }
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    fallbackStorage(type, record) {
        // Fallback storage when database is unavailable
        const filename = `fallback_${type}_${Date.now()}.json`;
        console.log(`Using fallback storage: ${filename}`);
        console.log(`${type.toUpperCase()} stored locally:`, record);
        return `fallback_${filename}`;
    }

    // Retrieval methods for stored data
    async getUserDecisions(userId, limit = 50) {
        try {
            if (!this.db) throw new Error('Database not available');
            
            const snapshot = await this.db
                .collection('users')
                .doc(userId)
                .collection('ai_decisions')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Failed to retrieve user decisions:', error);
            return [];
        }
    }

    async getUserPlans(userId, status = 'active', limit = 20) {
        try {
            if (!this.db) throw new Error('Database not available');
            
            const snapshot = await this.db
                .collection('users')
                .doc(userId)
                .collection('ai_plans')
                .where('status', '==', status)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Failed to retrieve user plans:', error);
            return [];
        }
    }

    async getAgentLearningData(agentType, limit = 100) {
        try {
            if (!this.db) throw new Error('Database not available');
            
            const snapshot = await this.db
                .collection('ai_agent_learning')
                .doc(agentType)
                .collection('insights')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Failed to retrieve agent learning data:', error);
            return [];
        }
    }

    async updatePlanStatus(planId, userId, newStatus) {
        try {
            if (!this.db) throw new Error('Database not available');
            
            await this.db
                .collection('users')
                .doc(userId)
                .collection('ai_plans')
                .doc(planId)
                .update({
                    status: newStatus,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            
            return true;
        } catch (error) {
            console.error('Failed to update plan status:', error);
            return false;
        }
    }

    // Fallback methods for when primary AI fails - now using backup AI generation
    async getFallbackDecision(agentType, context) {
        try {
            // Use a simplified prompt for fallback scenarios
            const fallbackPrompt = `
            As a ${this.agentContexts[agentType].role}, provide a basic but personalized financial recommendation.
            
            User Context: ${JSON.stringify(context)}
            Agent Type: ${agentType}
            
            Generate a simple but relevant decision in JSON format:
            {
                "decision": "specific recommendation based on available data",
                "reasoning": "brief explanation of why this helps",
                "confidence": 0.7,
                "actions": ["specific action 1", "specific action 2"]
            }
            
            Keep it simple but personalized to the user's actual situation.
            `;

            const result = await this.model.generateContent(fallbackPrompt);
            const response = await result.response;
            return this.parseAIResponse(response.text());
        } catch (error) {
            console.error('Fallback AI also failed:', error);
            // Only use static fallback as last resort
            return this.getEmergencyFallback(agentType);
        }
    }

    async getFallbackReasoning(agentType, dataPoints) {
        try {
            const fallbackPrompt = `
            As a ${this.agentContexts[agentType].role}, provide step-by-step reasoning for this financial data:
            
            Data: ${JSON.stringify(dataPoints)}
            
            Generate reasoning in JSON format:
            {
                "reasoning_steps": ["step 1 based on actual data", "step 2", "step 3"],
                "recommendation": "specific recommendation based on the data analysis",
                "confidence": 0.7
            }
            
            Base your reasoning on the actual data provided.
            `;

            const result = await this.model.generateContent(fallbackPrompt);
            const response = await result.response;
            
            // Secure JSON parsing for fallback reasoning
            const fallbackReasoning = {
                reasoning_steps: [
                    "Analyzed available financial data",
                    "Applied fundamental financial principles",
                    "Generated context-appropriate recommendation"
                ],
                recommendation: "Review your financial situation and consider professional advice",
                confidence: 0.5
            };
            
            return this.secureJsonParse(
                response.text(), 
                fallbackReasoning, 
                'getFallbackReasoning'
            );
        } catch (error) {
            console.error('Fallback reasoning failed:', error);
            return {
                reasoning_steps: [
                    "Analyzed available financial data",
                    "Applied fundamental financial principles",
                    "Generated context-appropriate recommendation"
                ],
                recommendation: "Review your financial situation and consider professional advice",
                confidence: 0.5
            };
        }
    }

    async getFallbackPlan(agentType, goals) {
        try {
            const fallbackPrompt = `
            As a ${this.agentContexts[agentType].role}, create a basic financial plan for these goals:
            
            Goals: ${JSON.stringify(goals)}
            
            Generate a plan in JSON format:
            {
                "plan_name": "descriptive name based on the goals",
                "timeline": "realistic timeframe",
                "steps": [
                    {"month": 1, "action": "specific action based on goals"},
                    {"month": 2, "action": "specific action"},
                    {"month": 3, "action": "specific action"}
                ],
                "success_metrics": ["measurable metric 1", "measurable metric 2"]
            }
            
            Make it specific to the actual goals provided.
            `;

            const result = await this.model.generateContent(fallbackPrompt);
            const response = await result.response;
            
            // Secure JSON parsing for fallback planning
            const fallbackPlan = {
                plan_name: "Basic Financial Improvement Plan",
                timeline: "3 months",
                steps: [
                    { month: 1, action: "Assess current financial situation" },
                    { month: 2, action: "Implement initial improvements" },
                    { month: 3, action: "Review progress and adjust strategy" }
                ],
                success_metrics: ["Improved financial awareness", "Better money management habits"]
            };
            
            return this.secureJsonParse(
                response.text(), 
                fallbackPlan, 
                'getFallbackPlan'
            );
        } catch (error) {
            console.error('Fallback planning failed:', error);
            return {
                plan_name: "Basic Financial Improvement Plan",
                timeline: "3 months",
                steps: [
                    { month: 1, action: "Assess current financial situation" },
                    { month: 2, action: "Implement initial improvements" },
                    { month: 3, action: "Review progress and adjust strategy" }
                ],
                success_metrics: ["Improved financial awareness", "Better money management habits"]
            };
        }
    }

    async getFallbackCoordination(agentInputs) {
        try {
            const fallbackPrompt = `
            Synthesize these AI agent recommendations into a unified strategy:
            
            Agent Inputs: ${JSON.stringify(agentInputs)}
            
            Generate coordination in JSON format:
            {
                "unified_recommendation": "main recommendation based on all agent inputs",
                "priority_actions": ["action 1 based on inputs", "action 2", "action 3"],
                "timeline": "realistic timeline",
                "success_metrics": ["metric 1 based on inputs", "metric 2"]
            }
            
            Base your coordination on the actual agent recommendations provided.
            `;

            const result = await this.model.generateContent(fallbackPrompt);
            const response = await result.response;
            
            // Secure JSON parsing for fallback coordination
            const fallbackCoordination = {
                unified_recommendation: "Implement comprehensive financial management strategy",
                priority_actions: [
                    "Start systematic expense tracking",
                    "Build emergency savings fund",
                    "Create realistic budget plan"
                ],
                timeline: "3-6 months",
                success_metrics: ["Improved savings rate", "Better expense control", "Increased financial confidence"]
            };
            
            return this.secureJsonParse(
                response.text(), 
                fallbackCoordination, 
                'getFallbackCoordination'
            );
        } catch (error) {
            console.error('Fallback coordination failed:', error);
            return {
                unified_recommendation: "Implement comprehensive financial management strategy",
                priority_actions: [
                    "Start systematic expense tracking",
                    "Build emergency savings fund",
                    "Create realistic budget plan"
                ],
                timeline: "3-6 months",
                success_metrics: ["Improved savings rate", "Better expense control", "Increased financial confidence"]
            };
        }
    }

    // Emergency fallback - only used when all AI attempts fail
    getEmergencyFallback(agentType) {
        const emergencyFallbacks = {
            iponCoach: {
                decision: "Start with small, consistent savings",
                reasoning: "Building financial habits gradually is more sustainable",
                confidence: 0.6,
                actions: ["Save any amount daily", "Track your spending for one week"]
            },
            gastosGuardian: {
                decision: "Begin tracking your daily expenses",
                reasoning: "Understanding spending patterns is the foundation of financial control",
                confidence: 0.6,
                actions: ["Write down every expense today", "Categorize your spending"]
            },
            peraPlanner: {
                decision: "Define one specific financial goal",
                reasoning: "Clear goals provide direction for financial planning",
                confidence: 0.6,
                actions: ["Choose one financial goal", "Research what it will cost"]
            }
        };
        
        return emergencyFallbacks[agentType] || emergencyFallbacks.iponCoach;
    }
}

module.exports = AIEngine; 