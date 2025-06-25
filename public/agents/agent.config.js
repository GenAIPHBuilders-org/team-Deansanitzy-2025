/**
 * AI Agent Configuration - Production-Ready Autonomous Behavior Settings
 * Defines autonomous behavior parameters, scalability settings, and production features
 * Now properly separated between development and production environments
 * 
 * @version 2.0.0
 * @author Kita-kita AI Team
 */

import { isProduction, isDevelopment, getEnvironmentConfig } from "../js/utils/environment.js";

// Get current environment configuration
const envConfig = getEnvironmentConfig();

// Base configuration that applies to all environments
const AGENT_CONFIG = {
    version: '2.0.0',
    environment: envConfig.environment,
    
    // Autonomous Behavior Configuration
    autonomy: {
        levels: {
            HIGH: {
                name: 'high',
                decisionThreshold: 0.75,
                autonomousActions: true,
                proactivePlanning: true,
                selfLearning: true,
                goalEvolution: true,
                userConfirmationRequired: false
            },
            MEDIUM: {
                name: 'medium',
                decisionThreshold: 0.60,
                autonomousActions: true,
                proactivePlanning: false,
                selfLearning: true,
                goalEvolution: false,
                userConfirmationRequired: true
            },
            LOW: {
                name: 'low',
                decisionThreshold: 0.50,
                autonomousActions: false,
                proactivePlanning: false,
                selfLearning: false,
                goalEvolution: false,
                userConfirmationRequired: true
            }
        },
        
        // Default autonomy settings per agent type
        defaults: {
            iponCoach: 'HIGH',
            gastosGuardian: 'HIGH',
            peraPlanner: 'MEDIUM'
        }
    },

    // Reasoning Engine Configuration
    reasoning: {
        maxReasoningSteps: 10,
        confidenceThreshold: 0.6,
        evidenceWeights: {
            historical_data: 0.4,
            user_preferences: 0.3,
            expert_knowledge: 0.2,
            market_conditions: 0.1
        },
        
        // Cultural reasoning factors
        culturalFactors: {
            filipino_values: 0.3,
            family_considerations: 0.4,
            community_influence: 0.2,
            traditional_practices: 0.1
        },
        
        // Reasoning quality thresholds
        quality: {
            excellent: 0.9,
            good: 0.7,
            acceptable: 0.5,
            poor: 0.3
        }
    },

    // Planning System Configuration
    planning: {
        horizons: {
            short_term: { months: 3, weight: 0.4 },
            medium_term: { months: 12, weight: 0.4 },
            long_term: { months: 60, weight: 0.2 }
        },
        
        // Goal prioritization weights
        goalWeights: {
            emergency_fund: 0.4,
            debt_reduction: 0.3,
            savings_goals: 0.2,
            investment_goals: 0.1
        },
        
        // Planning quality metrics
        qualityMetrics: {
            completeness: 0.3,
            feasibility: 0.3,
            cultural_relevance: 0.2,
            user_alignment: 0.2
        }
    },

    // Learning System Configuration
    learning: {
        rates: {
            fast: 0.2,
            normal: 0.1,
            slow: 0.05
        },
        
        // Memory management
        memory: {
            shortTermCapacity: 100,
            longTermCapacity: 1000,
            episodicCapacity: 800,
            semanticCapacity: 500
        },
        
        // Learning triggers
        triggers: {
            userFeedback: true,
            outcomeTracking: true,
            patternRecognition: true,
            errorCorrection: true
        },
        
        // Feedback importance weights
        feedbackWeights: {
            explicit_rating: 0.4,
            behavioral_signals: 0.3,
            outcome_success: 0.2,
            time_to_action: 0.1
        }
    },

    // Agent-Specific Configurations
    agents: {
        iponCoach: {
            name: 'Enhanced Ipon Coach',
            specialization: 'savings_optimization',
            culturalFocus: 'filipino_financial_habits',
            autonomyLevel: 'high',
            
            // Savings targets and strategies
            savingsGoals: {
                emergency_fund: { months: 6, priority: 'critical' },
                short_term: { timeframe: '1-2 years', priority: 'high' },
                medium_term: { timeframe: '3-5 years', priority: 'medium' },
                long_term: { timeframe: '10+ years', priority: 'medium' }
            },
            
            // Filipino-specific savings strategies
            strategies: {
                paluwagan: { enabled: true, risk_assessment: 'medium' },
                cooperative: { enabled: true, risk_assessment: 'low' },
                time_deposits: { enabled: true, risk_assessment: 'low' },
                mutual_funds: { enabled: true, risk_assessment: 'medium' }
            },
            
            // Behavioral analysis
            behaviorAnalysis: {
                spending_patterns: 'comprehensive',
                saving_consistency: 'detailed',
                goal_adherence: 'tracked',
                cultural_factors: 'integrated'
            }
        },

        gastosGuardian: {
            name: 'Enhanced Gastos Guardian',
            specialization: 'expense_optimization',
            culturalFocus: 'filipino_spending_patterns',
            autonomyLevel: 'high',
            
            // Expense categories (Filipino context)
            categories: {
                necessities: ['food', 'transportation', 'utilities', 'shelter'],
                family_obligations: ['padala', 'tuition', 'medical', 'celebrations'],
                lifestyle: ['entertainment', 'clothing', 'personal_care'],
                investments: ['insurance', 'mutual_funds', 'emergency_fund']
            },
            
            // Alert thresholds
            alerts: {
                unusual_spending: 0.3, // 30% increase from average
                budget_overrun: 0.1,   // 10% over budget
                category_concentration: 0.4 // 40% in single category
            },
            
            // Optimization strategies
            optimization: {
                tipid_tips: 'culturally_relevant',
                bulk_buying: 'recommended',
                loyalty_programs: 'maximized',
                seasonal_planning: 'enabled'
            }
        },

        peraPlanner: {
            name: 'Enhanced Pera Planner',
            specialization: 'comprehensive_financial_planning',
            culturalFocus: 'filipino_life_stages',
            autonomyLevel: 'medium',
            
            // Life stage planning
            lifeStages: {
                young_professional: { age_range: [22, 30], savings_rate: 0.15 },
                career_building: { age_range: [30, 40], savings_rate: 0.20 },
                family_formation: { age_range: [35, 45], savings_rate: 0.18 },
                wealth_accumulation: { age_range: [40, 50], savings_rate: 0.25 },
                pre_retirement: { age_range: [50, 60], savings_rate: 0.30 }
            },
            
            // Investment recommendations
            investmentLadder: {
                beginner: { risk_level: 'low', expected_return: 0.06 },
                intermediate: { risk_level: 'medium', expected_return: 0.10 },
                advanced: { risk_level: 'medium_high', expected_return: 0.14 }
            },
            
            // Planning complexity
            planningDepth: {
                goal_analysis: 'comprehensive',
                resource_assessment: 'detailed',
                timeline_development: 'precise',
                risk_analysis: 'thorough'
            }
        }
    },

    // Production Configuration
    production: {
        // Error handling configuration
        errorHandling: {
            maxRetries: 3,
            retryDelay: 1000, // milliseconds
            fallbackTimeout: 5000,
            circuitBreakerThreshold: 5,
            recoveryAttempts: 3
        },
        
        // Performance monitoring
        monitoring: {
            enableMetrics: true,
            metricsInterval: 60000, // 1 minute
            performanceThresholds: {
                responseTime: 2000, // 2 seconds
                memoryUsage: 0.8,   // 80% of available
                errorRate: 0.05     // 5% error rate
            },
            
            // Logging configuration
            logging: {
                level: 'info',
                enableStructuredLogs: true,
                enablePerformanceLogs: true,
                enableDecisionLogs: true,
                enableDebugLogs: false
            }
        },
        
        // Memory management
        memory: {
            gcInterval: 300000, // 5 minutes
            memoryLimits: {
                shortTerm: 50, // MB
                longTerm: 100, // MB
                episodic: 75,  // MB
                semantic: 25   // MB
            },
            
            // Cleanup policies
            cleanup: {
                episodicMemoryAge: 2592000000, // 30 days in milliseconds
                shortTermMemoryAge: 3600000,   // 1 hour
                cacheExpiry: 1800000           // 30 minutes
            }
        },
        
        // API and external service configuration
        external: {
            geminiAI: {
                timeout: 30000, // 30 seconds
                maxRetries: 3,
                rateLimiting: {
                    requestsPerMinute: 60,
                    burstLimit: 10
                }
            },
            
            firebase: {
                timeout: 10000, // 10 seconds
                maxRetries: 2,
                connectionPoolSize: 10
            }
        },
        
        // Security configuration
        security: {
            inputSanitization: true,
            outputFiltering: true,
            rateLimiting: true,
            accessControl: true,
            
            // AI safety measures
            aiSafety: {
                biasDetection: true,
                outputValidation: true,
                humanOversight: {
                    enabled: true,
                    threshold: 0.95 // Confidence threshold for human review
                }
            }
        }
    },

    // Development Configuration (only applied in development)
    development: {
        // Debug settings
        debug: {
            enableVerboseLogs: envConfig.enableVerboseLogging,
            enableReasoningTrace: envConfig.enableDebugLogs,
            enablePerformanceTrace: envConfig.enableDebugLogs,
            mockExternalAPIs: false
        },
        
        // Testing configuration
        testing: {
            enableTestMode: envConfig.enableTestMode,
            useMockData: envConfig.features.mockData,
            simulateErrors: false,
            performanceSimulation: false
        },
        
        // Development-only monitoring
        monitoring: {
            enableMetrics: true,
            metricsInterval: 30000, // 30 seconds (more frequent in dev)
            logging: {
                level: 'debug',
                enableStructuredLogs: true,
                enablePerformanceLogs: true,
                enableDecisionLogs: true,
                enableDebugLogs: true
            }
        }
    },

    // Cultural Intelligence Configuration
    cultural: {
        filipino: {
            // Core values integration
            values: {
                family_first: 0.4,
                community_support: 0.2,
                respect_for_elders: 0.15,
                future_planning: 0.15,
                resourcefulness: 0.1
            },
            
            // Communication preferences
            communication: {
                language_mix: true, // Taglish support
                cultural_references: true,
                respectful_tone: true,
                family_context: true
            },
            
            // Financial behavior patterns
            financialBehavior: {
                remittance_considerations: true,
                extended_family_support: true,
                traditional_saving_methods: true,
                community_financial_activities: true
            }
        }
    },

    // Feature Flags (environment-aware)
    features: {
        autonomousDecisionMaking: true,
        advancedReasoning: true,
        comprehensivePlanning: true,
        continuousLearning: true,
        culturalIntelligence: true,
        performanceMonitoring: true,
        errorRecovery: true,
        userFeedbackLoop: true,
        proactiveRecommendations: true,
        goalEvolution: isProduction() ? false : true // Only enabled in development for safety
    }
};

// Apply environment-specific configurations
if (isProduction()) {
    // Production-specific overrides
    AGENT_CONFIG.production.monitoring.enableMetrics = true;
    AGENT_CONFIG.production.security.humanOversight.enabled = true;
    AGENT_CONFIG.production.logging = {
        level: 'info',
        enableDebugLogs: false,
        enableVerboseLogs: false
    };
}

if (isDevelopment()) {
    // Development-specific overrides
    AGENT_CONFIG.development.debug.enableVerboseLogs = envConfig.enableVerboseLogging;
    AGENT_CONFIG.development.testing.enableTestMode = envConfig.enableTestMode;
    AGENT_CONFIG.production.security.humanOversight.threshold = 0.8;
}

// Helper function to get environment-specific config
export const getAgentConfig = () => {
    const config = { ...AGENT_CONFIG };
    
    // Return only relevant configuration based on environment
    if (isProduction()) {
        // In production, remove development config
        delete config.development;
    } else {
        // In development, merge development overrides
        config.production.monitoring = {
            ...config.production.monitoring,
            ...config.development.monitoring
        };
    }
    
    return config;
};

// Export configuration
export default AGENT_CONFIG; 