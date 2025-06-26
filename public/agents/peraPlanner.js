/**
 * Pera Planner AI - Comprehensive Financial Planning Assistant
 * 
 * A highly autonomous AI agent designed for personal financial planning in the Filipino context.
 * This agent implements sophisticated reasoning, planning, and learning capabilities to provide
 * personalized financial guidance.
 * 
 * Key Features:
 * - Autonomous financial analysis and decision-making
 * - Adaptive learning from user behavior and financial patterns
 * - Context-aware recommendations considering Filipino financial landscape
 * - Proactive goal tracking and adjustment
 * 
 * @version 2.0.0
 * @license MIT
 */

import { GEMINI_API_KEY, GEMINI_MODEL } from "../js/config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserData, getUserTransactions, getUserBankAccounts, storeUserData } from "../js/firestoredb.js";
import { BaseAgent } from "./BaseAgent.js";

// Constants for financial planning
const FINANCIAL_CONSTANTS = {
    EMERGENCY_FUND_MONTHS: 6,
    MIN_SAVINGS_RATE: 0.2,
    RISK_LEVELS: ['conservative', 'moderate', 'aggressive'],
    PLANNING_HORIZONS: ['short_term', 'medium_term', 'long_term']
};

class PeraPlannerAI extends BaseAgent {
    constructor() {
        super('peraPlannerAI', {
            autonomyLevel: 'high',
            planningHorizon: 'long_term',
            learningRate: 0.5,
            riskTolerance: 'moderate'
        });
        
        // Initialize state with immutable defaults
        this.goals = new Map();
        this.recommendations = [];
        this.insights = [];
        this.learningHistory = [];
        this.userFinancialProfile = this.getDefaultProfile();
        
        // Initialize autonomous behaviors
        this.initializeAutonomousBehaviors();
    }

    /**
     * Initialize autonomous behaviors and monitoring systems
     * @private
     */
    initializeAutonomousBehaviors() {
        this.monitoringIntervals = {
            goalProgress: setInterval(() => this.monitorGoalProgress(), 3600000), // Every hour
            marketConditions: setInterval(() => this.analyzeMarketConditions(), 86400000), // Daily
            userBehavior: setInterval(() => this.analyzeUserBehavior(), 43200000) // Every 12 hours
        };
    }

    /**
     * Initialize the AI agent with user data and start autonomous operations
     * @returns {Promise<boolean>} Success status of initialization
     */
    async initialize() {
        try {
            const auth = getAuth();
            const user = auth.currentUser;
            
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Load user data using imported functions
            this.userAccounts = await getUserBankAccounts(user.uid);
            this.userTransactions = await getUserTransactions(user.uid);
            
            // Initialize AI features
            await this.initializeFinancialPlanning();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize PeraPlanner:', error);
            return false;
        }
    }

    /**
     * Initialize comprehensive financial planning with parallel processing
     * @private
     */
    async initializeFinancialPlanning() {
        await Promise.all([
            this.analyzeFinancialProfile(),
            this.generateRecommendations(),
            this.generateInsights()
        ]);
    }

    /**
     * Analyze financial profile with machine learning
     * @private
     */
    async analyzeFinancialProfile() {
        if (!this.userTransactions?.length) return;

        const prompt = this.buildProfileAnalysisPrompt();
        
        try {
            const analysis = await this.callGeminiAI(prompt);
            this.updateFinancialProfile(analysis);
        } catch (error) {
            console.error('Failed to analyze financial profile:', error);
        }
    }

    /**
     * Generate personalized recommendations using AI
     * @private
     */
    async generateRecommendations() {
        if (!this.userTransactions?.length) return;

        const prompt = this.buildRecommendationsPrompt();
        
        try {
            const recommendations = await this.callGeminiAI(prompt);
            this.recommendations = recommendations;
        } catch (error) {
            console.error('Failed to generate recommendations:', error);
        }
    }

    /**
     * Generate financial insights
     * @private
     */
    async generateInsights() {
        if (!this.userTransactions?.length) return;

        const prompt = this.buildInsightsPrompt();
        
        try {
            const insights = await this.callGeminiAI(prompt);
            this.insights = insights;
        } catch (error) {
            console.error('Failed to generate insights:', error);
        }
    }

    // Helper methods for building prompts
    buildProfileAnalysisPrompt() {
        return `As a Filipino financial planning AI, analyze this user's financial profile:
            Transactions: ${JSON.stringify(this.userTransactions)}
            Accounts: ${JSON.stringify(this.userAccounts)}
            Current Profile: ${JSON.stringify(this.userFinancialProfile)}
            Please provide analysis in JSON format.`;
    }

    buildRecommendationsPrompt() {
        return `Generate personalized financial recommendations based on:
            Profile: ${JSON.stringify(this.userFinancialProfile)}
            Transactions: ${JSON.stringify(this.userTransactions)}
            Accounts: ${JSON.stringify(this.userAccounts)}
            Consider Filipino financial context and goals
            Please provide recommendations in JSON format.`;
    }

    buildInsightsPrompt() {
        return `Generate financial insights based on:
            Profile: ${JSON.stringify(this.userFinancialProfile)}
            Transactions: ${JSON.stringify(this.userTransactions)}
            Recommendations: ${JSON.stringify(this.recommendations)}
            Focus on actionable Filipino financial insights
            Please provide insights in JSON format.`;
    }

    // Helper method to get default profile
    getDefaultProfile() {
        return {
            // Basic info
            incomeLevel: 'unknown',
            expenseLevel: 'unknown',
            savingsRate: 0,
            
            // Risk profile
            riskTolerance: 'moderate',
            investmentExperience: 'beginner',
            
            // Financial status
            employmentType: 'unknown',
            dependents: 0,
            maritalStatus: 'single',
            
            // Financial preferences
            lifeStage: 'adult',
            riskTolerance: 'moderate',
            primaryGoals: ['emergency_fund', 'savings'],
            
            // Data quality
            dataQuality: {
                score: 0,
                level: 'insufficient',
                hasAccounts: false,
                hasTransactions: false,
                message: 'Not enough data available. Please add transactions or update your profile.'
            }
        };
    }

    // Helper method to update financial profile
    updateFinancialProfile(analysis) {
        this.userFinancialProfile = {
            ...this.userFinancialProfile,
            ...analysis
        };
    }

    /**
     * Clean up resources and stop autonomous operations
     * @public
     */
    cleanup() {
        // Clear all intervals
        Object.values(this.monitoringIntervals).forEach(clearInterval);
        
        // Stop autonomous operations
        Object.values(this.autonomousOperations).forEach(operation => {
            if (operation?.stop) operation.stop();
        });
    }
}

// Initialize UI with error boundaries
const loadingState = document.getElementById('loading-state');
const contentState = document.getElementById('content-state');
const emptyState = document.getElementById('empty-state');

// Initialize the AI agent as a singleton
const peraPlannerAI = new PeraPlannerAI();

// Error boundary for content processing
async function processAndDisplayAIContent(userData, transactions) {
    try {
        if (!peraPlannerAI) {
            throw new Error('PeraPlannerAI not initialized');
        }

        // Initialize with error handling
        peraPlannerAI.userTransactions = transactions;
        const initSuccess = await peraPlannerAI.initialize();

        if (!initSuccess) {
            throw new Error('Initialization failed');
        }

        // Update UI based on data availability
        if (transactions?.length > 0) {
            await peraPlannerAI.initializeFinancialPlanning();
            setUIState('content');
        } else {
            setUIState('empty');
        }
    } catch (error) {
        console.error('Error processing AI content:', error);
        handleProcessingError(error);
    }
}

// Main initialization with error boundary
async function initializeApp(user) {
    try {
        setUIState('loading');
        const [userData, transactions] = await Promise.all([
            getUserData(user.uid),
            getUserTransactions(user.uid)
        ]);

        await processAndDisplayAIContent(userData, transactions);
    } catch (error) {
        console.error("Initialization failed:", error);
        handleInitError(error);
    }
}

// UI State Management with validation
function setUIState(state) {
    if (!['loading', 'content', 'empty'].includes(state)) {
        console.error('Invalid UI state:', state);
        state = 'empty'; // Fallback to safe state
    }

    loadingState.classList.toggle('hidden', state !== 'loading');
    contentState.classList.toggle('hidden', state !== 'content');
    emptyState.classList.toggle('hidden', state !== 'empty');
}

// Error Handlers
function handleProcessingError(error) {
    setUIState('empty');
    // Implement error reporting and recovery
}

function handleInitError(error) {
    setUIState('empty');
    // Implement error reporting and recovery
}

// Initialize with auth state monitoring
onAuthStateChanged(getAuth(), (user) => {
    if (user) {
        initializeApp(user);
    } else {
        window.location.href = '/pages/login.html';
    }
});

// Cleanup on page unload
window.addEventListener('unload', () => {
    peraPlannerAI.cleanup();
});
