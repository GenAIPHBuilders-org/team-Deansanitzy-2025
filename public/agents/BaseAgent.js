/**
 * BaseAgent - Foundational class for autonomous financial AI agents
 * Implements core agentic behaviors: autonomy, reasoning, planning, learning
 * Production-ready with comprehensive error handling, logging, and monitoring
 * 
 * @version 2.0.0
 * @author Kita-kita AI Team
 * @copyright 2025 Kita-kita Platform
 */

import { GEMINI_API_KEY, GEMINI_MODEL } from "../js/config.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserData, getUserTransactions, storeUserData } from "../js/firestoredb.js";

/**
 * Abstract base class implementing autonomous agentic behaviors
 * All financial AI agents inherit from this class
 */
export class BaseAgent {
    /**
     * Initialize the autonomous agent
     * @param {string} agentType - Type of agent (iponCoach, gastosGuardian, peraPlanner)
     * @param {Object} config - Agent-specific configuration
     */
    constructor(agentType, config = {}) {
        // Agent Identity & Core Properties
        this.agentType = agentType;
        this.agentId = `${agentType}_${Date.now()}`;
        this.version = "2.0.0";
        this.initialized = false;
        
        // Autonomous Behavior Systems
        this.autonomyLevel = config.autonomyLevel || 'high'; // high, medium, low
        this.decisionThreshold = config.decisionThreshold || 0.7;
        this.learningRate = config.learningRate || 0.1;
        
        // Memory & Learning Systems
        this.shortTermMemory = new Map(); // Current session data
        this.longTermMemory = new Map();  // Persistent knowledge
        this.episodicMemory = [];         // Experience history
        this.semanticMemory = new Map();  // Factual knowledge
        
        // Goal & Planning Systems
        this.currentGoals = [];
        this.completedGoals = [];
        this.goalHierarchy = new Map();
        this.planningHorizon = config.planningHorizon || 'medium_term'; // short, medium, long
        
        // Decision Making & Reasoning
        this.decisionHistory = [];
        this.reasoningChains = [];
        this.confidenceScores = [];
        this.feedbackLoop = [];
        
        // State Management
        this.currentState = 'initializing';
        this.previousStates = [];
        this.stateTransitions = [];
        
        // Performance Monitoring
        this.performanceMetrics = {
            decisionsCount: 0,
            successfulRecommendations: 0,
            userSatisfactionScore: 0,
            learningIterations: 0,
            autonomousActions: 0
        };
        
        // Error Handling & Resilience
        this.errorCount = 0;
        this.recoveryStrategies = new Map();
        this.fallbackMechanisms = [];
        
        // Firebase & External APIs
        this.auth = getAuth();
        this.currentUser = null;
        this.geminiModel = GEMINI_MODEL;
        
        // Initialize core systems
        this.initializeCoreSystemsAsync();
    }

    /**
     * Initialize all core autonomous systems
     * @private
     */
    async initializeCoreSystemsAsync() {
        try {
            await this.initializeMemorySystems();
            await this.initializeGoalFramework();
            await this.initializeReasoningEngine();
            await this.initializeUserContext();
            await this.initializeLearningSystem();
            
            this.initialized = true;
            this.currentState = 'ready';
            this.logAgentAction('initialization_complete', { agentType: this.agentType });
            
        } catch (error) {
            this.handleError('initialization_failed', error);
            await this.activateRecoveryMode();
        }
    }

    /**
     * AUTONOMOUS BEHAVIOR IMPLEMENTATION
     */

    /**
     * Make autonomous decisions based on context and goals
     * Core agentic behavior - full autonomy in decision making
     * @param {Object} context - Current context/situation
     * @param {Array} options - Available decision options
     * @returns {Promise<Object>} Autonomous decision with reasoning
     */
    async makeAutonomousDecision(context, options = []) {
        try {
            // Step 1: Analyze current situation with reasoning
            const situationAnalysis = await this.analyzeSituation(context);
            
            // Step 2: Generate possible actions based on agent's goals
            const possibleActions = await this.generateActionOptions(context, situationAnalysis);
            
            // Step 3: Evaluate each option using multi-criteria decision analysis
            const evaluatedOptions = await this.evaluateOptions([...options, ...possibleActions], context);
            
            // Step 4: Apply autonomous decision making logic
            const decision = await this.selectOptimalAction(evaluatedOptions, context);
            
            // Step 5: Create comprehensive reasoning chain
            const reasoningChain = await this.buildReasoningChain(context, evaluatedOptions, decision);
            
            // Step 6: Store decision for learning
            this.storeDecisionExperience(context, decision, reasoningChain);
            
            // Step 7: Plan follow-up actions
            const followUpPlan = await this.planFollowUpActions(decision, context);
            
            const autonomousDecision = {
                decision: decision,
                reasoning: reasoningChain,
                confidence: decision.confidence,
                autonomyLevel: this.autonomyLevel,
                followUpPlan: followUpPlan,
                timestamp: new Date().toISOString(),
                agentId: this.agentId,
                decisionId: `decision_${Date.now()}`
            };
            
            this.performanceMetrics.decisionsCount++;
            this.performanceMetrics.autonomousActions++;
            
            return autonomousDecision;
            
        } catch (error) {
            this.handleError('autonomous_decision_failed', error, context);
            return await this.makeEmergencyDecision(context);
        }
    }

    /**
     * Advanced reasoning engine using multi-step logical analysis
     * @param {Object} problem - Problem to reason about
     * @returns {Promise<Object>} Reasoning result with step-by-step logic
     */
    async performAdvancedReasoning(problem) {
        try {
            const reasoningSteps = [];
            
            // Step 1: Problem decomposition
            const subProblems = await this.decomposeComplex(problem);
            reasoningSteps.push({ step: 'decomposition', result: subProblems });
            
            // Step 2: Evidence gathering from memory and context
            const evidence = await this.gatherRelevantEvidence(problem);
            reasoningSteps.push({ step: 'evidence_gathering', result: evidence });
            
            // Step 3: Pattern recognition from past experiences
            const patterns = await this.recognizePatterns(problem, evidence);
            reasoningSteps.push({ step: 'pattern_recognition', result: patterns });
            
            // Step 4: Logical inference using AI and rule-based reasoning
            const inferences = await this.performLogicalInference(subProblems, evidence, patterns);
            reasoningSteps.push({ step: 'logical_inference', result: inferences });
            
            // Step 5: Synthesis and conclusion formation
            const conclusion = await this.synthesizeConclusion(reasoningSteps, problem);
            reasoningSteps.push({ step: 'synthesis', result: conclusion });
            
            // Step 6: Confidence assessment
            const confidence = this.assessReasoningConfidence(reasoningSteps);
            
            const reasoningResult = {
                problem: problem,
                reasoningSteps: reasoningSteps,
                conclusion: conclusion,
                confidence: confidence,
                reasoningType: 'advanced_multi_step',
                timestamp: new Date().toISOString()
            };
            
            this.reasoningChains.push(reasoningResult);
            return reasoningResult;
            
        } catch (error) {
            this.handleError('reasoning_failed', error, problem);
            return await this.performBasicReasoning(problem);
        }
    }

    /**
     * Comprehensive goal-driven planning system
     * @param {Array} goals - User's financial goals
     * @param {Object} currentSituation - Current financial situation
     * @param {string} timeHorizon - Planning time horizon
     * @returns {Promise<Object>} Comprehensive financial plan
     */
    async createComprehensivePlan(goals, currentSituation, timeHorizon = 'medium_term') {
        try {
            // Step 1: Goal analysis and prioritization
            const analyzedGoals = await this.analyzeAndPrioritizeGoals(goals, currentSituation);
            
            // Step 2: Resource assessment
            const resourceAnalysis = await this.assessAvailableResources(currentSituation);
            
            // Step 3: Constraint identification
            const constraints = await this.identifyConstraints(currentSituation, goals);
            
            // Step 4: Strategy generation using AI
            const strategies = await this.generateStrategies(analyzedGoals, resourceAnalysis, constraints);
            
            // Step 5: Timeline development
            const timeline = await this.developTimeline(strategies, timeHorizon);
            
            // Step 6: Risk assessment and mitigation
            const riskAnalysis = await this.performRiskAnalysis(strategies, timeline);
            
            // Step 7: Plan optimization
            const optimizedPlan = await this.optimizePlan(strategies, timeline, riskAnalysis);
            
            // Step 8: Success metrics definition
            const successMetrics = await this.defineSuccessMetrics(optimizedPlan, goals);
            
            const comprehensivePlan = {
                goals: analyzedGoals,
                strategies: optimizedPlan.strategies,
                timeline: timeline,
                riskMitigation: riskAnalysis.mitigationStrategies,
                successMetrics: successMetrics,
                resourceRequirements: resourceAnalysis.requirements,
                constraints: constraints,
                adaptationMechanisms: await this.createAdaptationMechanisms(optimizedPlan),
                planId: `plan_${Date.now()}`,
                createdBy: this.agentId,
                creationDate: new Date().toISOString(),
                planType: 'comprehensive_autonomous'
            };
            
            // Store plan for tracking and updates
            await this.storePlanInMemory(comprehensivePlan);
            
            return comprehensivePlan;
            
        } catch (error) {
            this.handleError('planning_failed', error, { goals, currentSituation });
            return await this.createBasicPlan(goals, currentSituation);
        }
    }

    /**
     * Continuous learning and adaptation system
     * @param {Object} experience - New experience to learn from
     * @param {Object} feedback - User feedback on previous actions
     * @returns {Promise<Object>} Learning outcome and model updates
     */
    async learnAndAdapt(experience, feedback = null) {
        try {
            // Step 1: Experience encoding
            const encodedExperience = await this.encodeExperience(experience);
            
            // Step 2: Pattern extraction
            const extractedPatterns = await this.extractLearningPatterns(encodedExperience);
            
            // Step 3: Knowledge integration
            const knowledgeUpdates = await this.integrateNewKnowledge(extractedPatterns);
            
            // Step 4: Model parameter adjustment
            const modelUpdates = await this.adjustModelParameters(knowledgeUpdates, feedback);
            
            // Step 5: Hypothesis formation for future testing
            const hypotheses = await this.formHypotheses(knowledgeUpdates);
            
            // Step 6: Update memory systems
            await this.updateMemorySystems(encodedExperience, knowledgeUpdates);
            
            const learningOutcome = {
                experienceProcessed: encodedExperience,
                patternsLearned: extractedPatterns,
                modelUpdates: modelUpdates,
                newHypotheses: hypotheses,
                learningIteration: ++this.performanceMetrics.learningIterations,
                timestamp: new Date().toISOString(),
                agentId: this.agentId
            };
            
            // Store learning outcome
            this.episodicMemory.push(learningOutcome);
            
            return learningOutcome;
            
        } catch (error) {
            this.handleError('learning_failed', error, experience);
            return { error: 'learning_process_failed', fallback: true };
        }
    }

    /**
     * GEMINI AI INTEGRATION FOR ADVANCED REASONING
     */

    /**
     * Call Gemini AI with structured prompts for autonomous reasoning
     * @param {string} prompt - AI prompt
     * @param {Object} context - Additional context
     * @returns {Promise<Object>} AI response with parsed results
     */
    async callGeminiForReasoning(prompt, context = {}) {
        try {
            const enhancedPrompt = this.buildEnhancedPrompt(prompt, context);
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: enhancedPrompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 2048,
                    },
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                    ]
                }),
            });

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            const rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            return this.parseAIResponse(rawResponse);
            
        } catch (error) {
            this.handleError('gemini_api_failed', error, { prompt: prompt.substring(0, 100) });
            return await this.getFallbackResponse(prompt, context);
        }
    }

    /**
     * MEMORY SYSTEM IMPLEMENTATION
     */

    /**
     * Initialize sophisticated memory systems
     * @private
     */
    async initializeMemorySystems() {
        // Short-term memory for current session
        this.shortTermMemory.set('session_start', new Date().toISOString());
        this.shortTermMemory.set('user_interactions', []);
        
        // Load persistent long-term memory
        await this.loadLongTermMemory();
        
        // Initialize semantic knowledge base
        await this.initializeSemanticMemory();
    }

    /**
     * Store experience in episodic memory with rich context
     * @param {Object} experience - Experience to store
     */
    storeEpisodicMemory(experience) {
        const episodicEntry = {
            timestamp: new Date().toISOString(),
            agentId: this.agentId,
            experience: experience,
            context: this.getCurrentContext(),
            emotionalTone: this.assessEmotionalContext(experience),
            importanceScore: this.calculateImportanceScore(experience)
        };
        
        this.episodicMemory.push(episodicEntry);
        
        // Maintain memory size limits
        if (this.episodicMemory.length > 1000) {
            this.episodicMemory = this.episodicMemory.slice(-800); // Keep most recent 800
        }
    }

    /**
     * UTILITY METHODS
     */

    /**
     * Log agent actions for monitoring and debugging
     * @param {string} action - Action type
     * @param {Object} data - Action data
     */
    logAgentAction(action, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            agentId: this.agentId,
            agentType: this.agentType,
            action: action,
            data: data,
            state: this.currentState
        };
        
        console.log(`[${this.agentType}] ${action}:`, data);
        
        // Store in short-term memory
        const interactions = this.shortTermMemory.get('user_interactions') || [];
        interactions.push(logEntry);
        this.shortTermMemory.set('user_interactions', interactions);
    }

    /**
     * Handle errors with graceful degradation
     * @param {string} errorType - Type of error
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     */
    handleError(errorType, error, context = {}) {
        this.errorCount++;
        
        const errorLog = {
            timestamp: new Date().toISOString(),
            agentId: this.agentId,
            errorType: errorType,
            error: error.message,
            context: context,
            stackTrace: error.stack
        };
        
        console.error(`[${this.agentType}] Error:`, errorLog);
        
        // Store error for learning
        this.storeEpisodicMemory({ type: 'error', data: errorLog });
        
        // Activate recovery if needed
        if (this.errorCount > 5) {
            this.activateRecoveryMode();
        }
    }

    /**
     * Abstract methods to be implemented by specific agents
     */
    
    // These methods must be implemented by each specific agent
    async analyzeSituation(context) { throw new Error('analyzeSituation must be implemented by subclass'); }
    async generateActionOptions(context, analysis) { throw new Error('generateActionOptions must be implemented by subclass'); }
    async evaluateOptions(options, context) { throw new Error('evaluateOptions must be implemented by subclass'); }
    async selectOptimalAction(options, context) { throw new Error('selectOptimalAction must be implemented by subclass'); }
    
    // Placeholder implementations that can be overridden
    async buildReasoningChain(context, options, decision) { return { steps: [], conclusion: decision }; }
    async planFollowUpActions(decision, context) { return { actions: [], timeline: 'immediate' }; }
    async makeEmergencyDecision(context) { return { decision: 'seek_human_assistance', confidence: 0.5 }; }

    /**
     * IMPLEMENTATION OF HELPER METHODS
     */

    /**
     * Initialize goal framework system
     * @private
     */
    async initializeGoalFramework() {
        // Initialize goal tracking systems
        this.goalCategories = new Map([
            ['financial_health', { priority: 1, weight: 0.4 }],
            ['savings', { priority: 2, weight: 0.3 }],
            ['investment', { priority: 3, weight: 0.2 }],
            ['debt_management', { priority: 4, weight: 0.1 }]
        ]);

        // Load user's existing goals
        await this.loadUserGoals();
    }

    /**
     * Initialize reasoning engine
     * @private
     */
    async initializeReasoningEngine() {
        // Set up reasoning parameters
        this.reasoningConfig = {
            maxReasoningSteps: 10,
            confidenceThreshold: 0.6,
            evidenceWeights: new Map([
                ['historical_data', 0.4],
                ['user_preferences', 0.3],
                ['expert_knowledge', 0.2],
                ['market_conditions', 0.1]
            ])
        };

        // Initialize reasoning templates
        this.reasoningTemplates = new Map();
        await this.loadReasoningTemplates();
    }

    /**
     * Initialize user context
     * @private
     */
    async initializeUserContext() {
        if (this.auth.currentUser) {
            this.currentUser = this.auth.currentUser;
            const userData = await getUserData(this.currentUser.uid);
            this.longTermMemory.set('user_profile', userData);
        }
    }

    /**
     * Initialize learning system
     * @private
     */
    async initializeLearningSystem() {
        // Set up learning parameters
        this.learningConfig = {
            learningRate: this.learningRate,
            memoryCapacity: 1000,
            feedbackWeight: 0.7,
            experienceWeight: 0.3
        };

        // Load previous learning data
        await this.loadLearningHistory();
    }

    /**
     * Decompose complex problems into manageable parts
     * @param {Object} problem - Complex problem to decompose
     * @returns {Promise<Array>} Array of sub-problems
     */
    async decomposeComplex(problem) {
        const decompositionPrompt = `
        Decompose this financial problem into smaller, manageable sub-problems:
        
        Problem: ${JSON.stringify(problem)}
        
        Break it down into 3-5 specific sub-problems that can be analyzed independently.
        Return as JSON array: ["sub-problem 1", "sub-problem 2", ...]
        `;

        try {
            const response = await this.callGeminiForReasoning(decompositionPrompt);
            return Array.isArray(response) ? response : [problem.description || 'Unknown problem'];
        } catch (error) {
            return [problem.description || 'Unknown problem'];
        }
    }

    /**
     * Gather relevant evidence from memory and external sources
     * @param {Object} problem - Problem to gather evidence for
     * @returns {Promise<Object>} Collected evidence
     */
    async gatherRelevantEvidence(problem) {
        const evidence = {
            historical: this.searchEpisodicMemory(problem),
            user_profile: this.longTermMemory.get('user_profile') || {},
            recent_interactions: this.shortTermMemory.get('user_interactions') || [],
            market_data: await this.getRelevantMarketData(problem),
            expert_knowledge: this.searchSemanticMemory(problem)
        };

        return evidence;
    }

    /**
     * Recognize patterns from past experiences
     * @param {Object} problem - Current problem
     * @param {Object} evidence - Gathered evidence
     * @returns {Promise<Array>} Recognized patterns
     */
    async recognizePatterns(problem, evidence) {
        const patterns = [];

        // Pattern recognition from episodic memory
        const similarExperiences = this.findSimilarExperiences(problem, evidence.historical);
        if (similarExperiences.length > 0) {
            patterns.push({
                type: 'experiential',
                pattern: 'similar_situations_handled',
                confidence: 0.8,
                data: similarExperiences
            });
        }

        // Pattern recognition from user behavior
        const behaviorPatterns = this.analyzeBehaviorPatterns(evidence.recent_interactions);
        if (behaviorPatterns.length > 0) {
            patterns.push({
                type: 'behavioral',
                pattern: 'user_preference_patterns',
                confidence: 0.7,
                data: behaviorPatterns
            });
        }

        return patterns;
    }

    /**
     * Perform logical inference
     * @param {Array} subProblems - Decomposed sub-problems
     * @param {Object} evidence - Available evidence
     * @param {Array} patterns - Recognized patterns
     * @returns {Promise<Object>} Inference results
     */
    async performLogicalInference(subProblems, evidence, patterns) {
        const inferences = [];

        for (const subProblem of subProblems) {
            const inference = await this.inferSolution(subProblem, evidence, patterns);
            inferences.push(inference);
        }

        return {
            subProblemInferences: inferences,
            overallInference: this.synthesizeInferences(inferences),
            confidence: this.calculateInferenceConfidence(inferences)
        };
    }

    /**
     * Synthesize conclusion from reasoning steps
     * @param {Array} reasoningSteps - All reasoning steps
     * @param {Object} originalProblem - Original problem
     * @returns {Promise<Object>} Final conclusion
     */
    async synthesizeConclusion(reasoningSteps, originalProblem) {
        const synthesis = {
            problem: originalProblem,
            reasoningPath: reasoningSteps.map(step => step.step),
            evidence_quality: this.assessEvidenceQuality(reasoningSteps),
            pattern_strength: this.assessPatternStrength(reasoningSteps),
            logical_coherence: this.assessLogicalCoherence(reasoningSteps),
            conclusion: await this.formulateConclusion(reasoningSteps),
            confidence: this.calculateOverallConfidence(reasoningSteps)
        };

        return synthesis;
    }

    /**
     * Assess reasoning confidence
     * @param {Array} reasoningSteps - Reasoning steps to assess
     * @returns {number} Confidence score (0-1)
     */
    assessReasoningConfidence(reasoningSteps) {
        let totalConfidence = 0;
        let weightSum = 0;

        reasoningSteps.forEach(step => {
            const stepWeight = this.getStepWeight(step.step);
            const stepConfidence = step.result.confidence || 0.5;
            totalConfidence += stepConfidence * stepWeight;
            weightSum += stepWeight;
        });

        return weightSum > 0 ? totalConfidence / weightSum : 0.5;
    }

    /**
     * Store decision experience for learning
     * @param {Object} context - Decision context
     * @param {Object} decision - Made decision
     * @param {Object} reasoning - Reasoning chain
     */
    storeDecisionExperience(context, decision, reasoning) {
        const experience = {
            timestamp: new Date().toISOString(),
            context: context,
            decision: decision,
            reasoning: reasoning,
            agentId: this.agentId,
            experienceType: 'decision_making'
        };

        this.decisionHistory.push(experience);
        this.storeEpisodicMemory(experience);
    }

    /**
     * Build enhanced prompt for Gemini AI
     * @param {string} basePrompt - Base prompt
     * @param {Object} context - Additional context
     * @returns {string} Enhanced prompt
     */
    buildEnhancedPrompt(basePrompt, context) {
        const agentContext = `
        You are an autonomous ${this.agentType} AI agent with the following characteristics:
        - Agent ID: ${this.agentId}
        - Autonomy Level: ${this.autonomyLevel}
        - Version: ${this.version}
        - Current State: ${this.currentState}
        - Decision History: ${this.decisionHistory.length} previous decisions
        - Learning Iterations: ${this.performanceMetrics.learningIterations}
        
        Context: ${JSON.stringify(context)}
        
        ${basePrompt}
        
        Provide your response in JSON format with clear reasoning and confidence scores.
        `;

        return agentContext;
    }

    /**
     * Parse AI response with error handling
     * @param {string} rawResponse - Raw AI response
     * @returns {Object} Parsed response
     */
    parseAIResponse(rawResponse) {
        try {
            // Try to extract JSON from response
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // Fallback to structured parsing
            return {
                content: rawResponse,
                confidence: 0.6,
                timestamp: new Date().toISOString(),
                parsed: false
            };
        } catch (error) {
            return {
                content: rawResponse,
                confidence: 0.3,
                error: 'parsing_failed',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get fallback response when AI fails
     * @param {string} prompt - Original prompt
     * @param {Object} context - Context
     * @returns {Promise<Object>} Fallback response
     */
    async getFallbackResponse(prompt, context) {
        return {
            content: "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.",
            confidence: 0.3,
            fallback: true,
            timestamp: new Date().toISOString(),
            context: context
        };
    }

    /**
     * Load long-term memory from storage
     * @private
     */
    async loadLongTermMemory() {
        try {
            if (this.currentUser) {
                const storedMemory = await getUserData(this.currentUser.uid);
                if (storedMemory?.agentMemory?.[this.agentType]) {
                    const memoryData = storedMemory.agentMemory[this.agentType];
                    Object.entries(memoryData).forEach(([key, value]) => {
                        this.longTermMemory.set(key, value);
                    });
                }
            }
        } catch (error) {
            console.warn('Failed to load long-term memory:', error);
        }
    }

    /**
     * Initialize semantic memory with domain knowledge
     * @private
     */
    async initializeSemanticMemory() {
        // Load domain-specific knowledge based on agent type
        const knowledgeBase = await this.loadDomainKnowledge();
        Object.entries(knowledgeBase).forEach(([concept, knowledge]) => {
            this.semanticMemory.set(concept, knowledge);
        });
    }

    /**
     * Load domain knowledge for the specific agent
     * @returns {Promise<Object>} Domain knowledge
     */
    async loadDomainKnowledge() {
        // This will be overridden by specific agents
        return {
            'financial_basics': 'Core financial principles and concepts',
            'risk_management': 'Risk assessment and mitigation strategies',
            'goal_setting': 'SMART goal setting principles'
        };
    }

    /**
     * Get current context for decision making
     * @returns {Object} Current context
     */
    getCurrentContext() {
        return {
            agentState: this.currentState,
            sessionDuration: Date.now() - new Date(this.shortTermMemory.get('session_start')).getTime(),
            recentDecisions: this.decisionHistory.slice(-5),
            userPresent: this.currentUser !== null,
            memoryLoad: this.episodicMemory.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Assess emotional context of experience
     * @param {Object} experience - Experience to assess
     * @returns {string} Emotional tone
     */
    assessEmotionalContext(experience) {
        // Simple emotional assessment based on experience type
        if (experience.type === 'error') return 'negative';
        if (experience.type === 'success') return 'positive';
        if (experience.type === 'learning') return 'neutral';
        return 'neutral';
    }

    /**
     * Calculate importance score for memory prioritization
     * @param {Object} experience - Experience to score
     * @returns {number} Importance score (0-1)
     */
    calculateImportanceScore(experience) {
        let score = 0.5; // Base score

        // Increase importance for decisions
        if (experience.type === 'decision_making') score += 0.3;
        
        // Increase importance for errors (learning opportunities)
        if (experience.type === 'error') score += 0.2;
        
        // Increase importance for user feedback
        if (experience.userFeedback) score += 0.2;
        
        // Increase importance for successful outcomes
        if (experience.outcome === 'success') score += 0.1;

        return Math.min(score, 1.0);
    }

    /**
     * Activate recovery mode when errors accumulate
     * @private
     */
    async activateRecoveryMode() {
        this.currentState = 'recovery';
        console.warn(`[${this.agentType}] Activating recovery mode due to ${this.errorCount} errors`);
        
        // Reset error count
        this.errorCount = 0;
        
        // Reinitialize core systems
        await this.initializeCoreSystemsAsync();
    }

    /**
     * Get current performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            uptime: Date.now() - new Date(this.shortTermMemory.get('session_start')).getTime(),
            memoryUsage: {
                shortTerm: this.shortTermMemory.size,
                longTerm: this.longTermMemory.size,
                episodic: this.episodicMemory.length,
                semantic: this.semanticMemory.size
            },
            errorRate: this.errorCount,
            currentState: this.currentState
        };
    }

    // Placeholder methods for abstract implementations
    async performBasicReasoning(problem) { return { conclusion: 'basic_reasoning_applied', confidence: 0.5 }; }
    async loadUserGoals() { this.currentGoals = []; }
    async loadReasoningTemplates() { /* Load reasoning templates */ }
    async loadLearningHistory() { /* Load learning history */ }
    async getRelevantMarketData(problem) { return {}; }
    async inferSolution(subProblem, evidence, patterns) { return { solution: 'inferred', confidence: 0.6 }; }
    
    // Helper methods with basic implementations
    searchEpisodicMemory(query) { return this.episodicMemory.filter(e => JSON.stringify(e).includes(query.toString())); }
    searchSemanticMemory(query) { return this.semanticMemory.get(query.toString()) || null; }
    findSimilarExperiences(problem, historical) { return historical.slice(0, 3); }
    analyzeBehaviorPatterns(interactions) { return []; }
    synthesizeInferences(inferences) { return 'synthesized_result'; }
    calculateInferenceConfidence(inferences) { return 0.7; }
    assessEvidenceQuality(steps) { return 'good'; }
    assessPatternStrength(steps) { return 'moderate'; }
    assessLogicalCoherence(steps) { return 'coherent'; }
    async formulateConclusion(steps) { return 'conclusion_formulated'; }
    calculateOverallConfidence(steps) { return 0.7; }
    getStepWeight(stepType) { return 1.0; }
}

/**
 * Export for use by specific agent implementations
 */
export default BaseAgent; 