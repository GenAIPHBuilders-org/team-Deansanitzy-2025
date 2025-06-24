/**
 * AI Agent Configuration - Production-Ready Autonomous Behavior Settings
 * Defines autonomous behavior parameters, scalability settings, and production features
 * 
 * @version 2.0.0
 * @author Kita-kita AI Team
 */

export const AGENT_CONFIG = {
    // Global Agent Settings
    version: "2.0.0",
    environment: process.env.NODE_ENV || 'development',
    
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
            specialization: 'savings_and_goals',
            culturalFocus: 'filipino_savings_culture',
            autonomyLevel: 'high',
            
            // Specialized settings
            savingsStrategies: {
                alkansya_method: { weight: 0.3, cultural_relevance: 'high' },
                paluwagan_system: { weight: 0.4, cultural_relevance: 'very_high' },
                modern_digital: { weight: 0.2, cultural_relevance: 'medium' },
                hybrid_approach: { weight: 0.1, cultural_relevance: 'high' }
            },
            
            // Motivational factors
            motivationFactors: {
                family_security: 0.4,
                future_opportunities: 0.3,
                financial_independence: 0.2,
                emergency_preparedness: 0.1
            },
            
            // Performance thresholds
            performance: {
                recommendationAccuracy: 0.8,
                userEngagement: 0.7,
                goalAchievementRate: 0.6
            }
        },

        gastosGuardian: {
            name: 'Enhanced Gastos Guardian',
            specialization: 'expense_analysis_optimization',
            culturalFocus: 'filipino_spending_patterns',
            autonomyLevel: 'high',
            
            // Analysis capabilities
            analysisDepth: {
                pattern_recognition: 'advanced',
                anomaly_detection: 'high',
                cultural_spending: 'expert',
                optimization_suggestions: 'comprehensive'
            },
            
            // Detection thresholds
            thresholds: {
                spending_leak: 0.15,    // 15% above optimal
                anomaly_detection: 0.25, // 25% deviation
                optimization_potential: 0.10 // 10% savings possible
            },
            
            // Cultural expense categories
            culturalCategories: {
                food_dining: { optimal_ratio: 0.25, max_ratio: 0.35 },
                family_support: { optimal_ratio: 0.15, max_ratio: 0.25 },
                transportation: { optimal_ratio: 0.12, max_ratio: 0.18 },
                utilities: { optimal_ratio: 0.12, max_ratio: 0.15 },
                entertainment: { optimal_ratio: 0.08, max_ratio: 0.12 }
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

    // Production & Scalability Settings
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
                level: process.env.LOG_LEVEL || 'info',
                enableStructuredLogs: true,
                enablePerformanceLogs: true,
                enableDecisionLogs: true
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

    // Development & Testing Configuration
    development: {
        // Debug settings
        debug: {
            enableVerboseLogs: false,
            enableReasoningTrace: false,
            enablePerformanceTrace: false,
            mockExternalAPIs: false
        },
        
        // Testing configuration
        testing: {
            enableTestMode: false,
            useMockData: false,
            simulateErrors: false,
            performanceSimulation: false
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

    // Feature Flags
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
        goalEvolution: false // Disabled by default for safety
    }
};

// Environment-specific overrides
if (AGENT_CONFIG.environment === 'production') {
    // Production optimizations
    AGENT_CONFIG.development.debug.enableVerboseLogs = false;
    AGENT_CONFIG.production.monitoring.enableMetrics = true;
    AGENT_CONFIG.production.security.humanOversight.enabled = true;
}

if (AGENT_CONFIG.environment === 'development') {
    // Development conveniences
    AGENT_CONFIG.development.debug.enableVerboseLogs = true;
    AGENT_CONFIG.development.testing.enableTestMode = true;
    AGENT_CONFIG.production.security.humanOversight.threshold = 0.8;
}

// Export configuration
export default AGENT_CONFIG; 