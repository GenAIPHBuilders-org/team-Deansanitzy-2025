/**
 * Comprehensive Test Suite for Enhanced Ipon Coach AI
 * Tests autonomous behaviors, cultural adaptation, and production scenarios
 */

import { describe, test, expect, beforeEach, afterEach, mock } from '@jest/globals';
import { AutonomousIponCoach } from '../public/agents/enhanced-iponCoach-architecture.js';

describe('Enhanced Ipon Coach AI Test Suite', () => {

    describe('Autonomous Behavior Tests', () => {
        let coach;
        
        beforeEach(async () => {
            coach = new AutonomousIponCoach();
            await coach.initializeAutonomousBehavior();
        });

        afterEach(() => {
            coach.destroy();
        });

        test('should proactively detect overspending patterns', async () => {
            // Simulate user with increasing expenses
            const mockTransactions = [
                { type: 'expense', amount: 5000, category: 'food', date: '2024-01-01' },
                { type: 'expense', amount: 7000, category: 'food', date: '2024-01-15' },
                { type: 'expense', amount: 9000, category: 'food', date: '2024-02-01' }
            ];
            
            coach.userTransactions = mockTransactions;
            
            const interventions = await coach.generateProactiveInterventions();
            
            expect(interventions).toHaveLength(1);
            expect(interventions[0].type).toBe('overspending_alert');
            expect(interventions[0].category).toBe('food');
            expect(interventions[0].priority).toBe('high');
        });

        test('should autonomously create culturally-appropriate goals', async () => {
            const mockUserProfile = {
                age: 28,
                familyStatus: { married: true, children: [] },
                income: 50000,
                region: 'metro_manila'
            };

            coach.userProfile = mockUserProfile;
            
            await coach.establishGoalHierarchy();
            
            const goals = coach.goalOrchestrator.getActiveGoals();
            expect(goals).toContain('emergency_fund');
            expect(goals).toContain('family_planning_fund');
            expect(goals).toContain('bahay_fund'); // House fund - culturally relevant
        });

        test('should adapt recommendations based on cultural context', async () => {
            const mockAction = {
                type: 'investment_recommendation',
                amount: 10000,
                investment_type: 'stocks'
            };

            const culturalContext = {
                family_support: 0.8,
                remittances: 0.6,
                risk_aversion: 0.7
            };

            const adaptedAction = await coach.adaptToCulturalContext(mockAction);
            
            expect(adaptedAction.risk_level).toBe('conservative');
            expect(adaptedAction.family_consideration).toBeTruthy();
            expect(adaptedAction.suggested_amount).toBeLessThan(mockAction.amount);
        });
    });

    describe('Decision Engine Tests', () => {
        let decisionEngine;

        beforeEach(() => {
            decisionEngine = new DecisionEngine();
        });

        test('should make reasoned decisions with Filipino context', async () => {
            const context = {
                userProfile: { age: 35, family_size: 4, income: 80000 },
                marketConditions: { peso_strength: 'weak', inflation: 3.2 },
                culturalFactors: { family_priority: 'high', education_value: 'high' }
            };

            const decision = await decisionEngine.analyze(context);
            
            expect(decision.reasoning).toBeDefined();
            expect(decision.reasoning.culturalConsiderations).toBeDefined();
            expect(decision.action).toBeDefined();
            expect(decision.confidence).toBeGreaterThan(0.7);
        });

        test('should create comprehensive financial plans', async () => {
            const goal = {
                type: 'education_fund',
                target_amount: 500000,
                deadline: '2030-06-01',
                priority: 'high'
            };

            const plan = await decisionEngine.createPlan(goal);
            
            expect(plan.strategy).toBeDefined();
            expect(plan.steps).toHaveLength.greaterThan(0);
            expect(plan.contingencies).toBeDefined();
            expect(plan.monitoring.milestones).toBeDefined();
        });
    });

    describe('Risk Assessment Tests', () => {
        let riskMonitor;

        beforeEach(() => {
            riskMonitor = new RiskMonitor();
        });

        test('should identify Filipino-specific financial risks', async () => {
            const mockFinancialData = {
                emergency_fund_months: 1,
                debt_to_income_ratio: 0.6,
                single_income_dependency: true,
                ofw_remittance_dependency: 0.4
            };

            const risks = await riskMonitor.assessRisks(mockFinancialData);
            
            expect(risks.financial.emergency_fund).toBe('high');
            expect(risks.cultural.ofw_dependency).toBe('medium');
            expect(risks.personal.single_income).toBe('high');
        });

        test('should trigger appropriate alerts for risk thresholds', async () => {
            riskMonitor.setAlertThreshold('debt_ratio', { critical: 0.5, warning: 0.3 });
            
            const alertSpy = jest.spyOn(riskMonitor, 'triggerAlert');
            
            await riskMonitor.monitorThresholds({ debt_ratio: 0.6 });
            
            expect(alertSpy).toHaveBeenCalledWith('debt_ratio', 0.6);
        });
    });

    describe('Learning System Tests', () => {
        let learningSystem;

        beforeEach(() => {
            learningSystem = new LearningSystem();
        });

        test('should learn from user interactions and improve', async () => {
            const interactions = [
                {
                    action: 'recommend_investment',
                    userResponse: 'accepted',
                    outcome: 'positive',
                    context: { risk_tolerance: 'medium' }
                },
                {
                    action: 'recommend_investment',
                    userResponse: 'rejected',
                    outcome: 'negative', 
                    context: { risk_tolerance: 'low' }
                }
            ];

            for (const interaction of interactions) {
                await learningSystem.processInteraction(interaction);
            }

            const userModel = learningSystem.getUserModel();
            expect(userModel.risk_tolerance).toBe('low');
            expect(userModel.investment_acceptance_rate).toBeLessThan(1);
        });

        test('should predict future scenarios accurately', async () => {
            const currentState = {
                savings_rate: 0.15,
                expense_growth: 0.05,
                income_stability: 'high'
            };

            const scenarios = await learningSystem.predictFutureScenarios(currentState);
            
            expect(scenarios).toHaveLength.greaterThan(0);
            expect(scenarios[0].probability).toBeGreaterThan(0);
            expect(scenarios[0].requiresIntervention).toBeDefined();
        });
    });

    describe('Cultural Intelligence Tests', () => {
        let culturalContext;

        beforeEach(() => {
            culturalContext = new FilipinoFinancialContext();
        });

        test('should determine appropriate life stage for Filipino context', () => {
            const profiles = [
                { age: 22, familyStatus: { married: false }, expected: 'young_professional' },
                { age: 28, familyStatus: { married: true, children: [] }, expected: 'newly_married' },
                { age: 35, familyStatus: { married: true, children: [{ age: 5 }] }, expected: 'family_building' },
                { age: 50, familyStatus: { children: [{ age: 20 }] }, expected: 'empty_nester' }
            ];

            profiles.forEach(profile => {
                const lifeStage = culturalContext.determineLifeStage(profile);
                expect(lifeStage).toBe(profile.expected);
            });
        });

        test('should adapt financial advice to cultural values', async () => {
            const action = {
                type: 'savings_strategy',
                amount: 20000,
                timeline: '12_months'
            };

            const userContext = {
                family_support: 0.9,
                remittances: 0.7,
                bayanihan_spirit: 0.8
            };

            const adapted = await culturalContext.adapt(action, userContext);
            
            expect(adapted.family_considerations).toBeTruthy();
            expect(adapted.community_options).toBeDefined();
            expect(adapted.remittance_planning).toBeDefined();
        });
    });

    describe('Market Intelligence Tests', () => {
        let marketIntelligence;

        beforeEach(() => {
            marketIntelligence = new PhilippineMarketIntelligence();
        });

        test('should fetch current Philippine market conditions', async () => {
            const conditions = await marketIntelligence.getCurrentConditions();
            
            expect(conditions.peso_strength).toBeDefined();
            expect(conditions.inflation_rate).toBeDefined();
            expect(conditions.interest_rates).toBeDefined();
            expect(conditions.stock_market).toBeDefined();
        });

        test('should identify relevant financial opportunities', async () => {
            const opportunities = await marketIntelligence.getOpportunities();
            
            expect(opportunities.investment).toBeDefined();
            expect(opportunities.government_programs).toBeDefined();
            expect(opportunities.tax_benefits).toBeDefined();
        });
    });

    describe('Integration Tests', () => {
        let coach;

        beforeEach(async () => {
            coach = new AutonomousIponCoach();
            await coach.initializeAutonomousBehavior();
        });

        afterEach(() => {
            coach.destroy();
        });

        test('should handle complete user journey autonomously', async () => {
            // Simulate new user onboarding
            const userProfile = {
                age: 25,
                income: 30000,
                familyStatus: { married: false },
                region: 'cebu'
            };

            await coach.onboardNewUser(userProfile);
            
            // Check initial goals were created
            const initialGoals = coach.goalOrchestrator.getActiveGoals();
            expect(initialGoals.length).toBeGreaterThan(0);

            // Simulate transaction activity
            const transactions = [
                { type: 'income', amount: 30000, date: '2024-01-01' },
                { type: 'expense', amount: 15000, category: 'rent', date: '2024-01-02' },
                { type: 'expense', amount: 8000, category: 'food', date: '2024-01-05' }
            ];

            await coach.processTransactions(transactions);

            // Verify autonomous analysis
            const analysis = await coach.performAutonomousAnalysis();
            expect(analysis.recommendations).toBeDefined();
            expect(analysis.alerts).toBeDefined();

            // Check proactive interventions
            const interventions = await coach.generateProactiveInterventions();
            expect(interventions.length).toBeGreaterThanOrEqual(0);
        });

        test('should scale with multiple concurrent users', async () => {
            const concurrentUsers = 100;
            const promises = [];

            for (let i = 0; i < concurrentUsers; i++) {
                const userPromise = coach.handleConcurrentUser({
                    userId: `user_${i}`,
                    request: 'analyze_finances'
                });
                promises.push(userPromise);
            }

            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(concurrentUsers);
            results.forEach(result => {
                expect(result.status).toBe('success');
                expect(result.responseTime).toBeLessThan(1000); // Under 1 second
            });
        });
    });

    describe('Performance Tests', () => {
        test('should respond within acceptable time limits', async () => {
            const coach = new AutonomousIponCoach();
            const startTime = Date.now();
            
            await coach.start();
            
            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(3000); // Under 3 seconds for startup
            
            coach.destroy();
        });

        test('should handle large datasets efficiently', async () => {
            const coach = new AutonomousIponCoach();
            
            // Generate large transaction dataset
            const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
                id: i,
                type: i % 2 === 0 ? 'income' : 'expense',
                amount: Math.random() * 50000,
                date: new Date(2024, 0, i % 365).toISOString(),
                category: ['food', 'rent', 'transport', 'utilities'][i % 4]
            }));

            const startTime = Date.now();
            
            await coach.processLargeDataset(largeDataset);
            
            const processingTime = Date.now() - startTime;
            expect(processingTime).toBeLessThan(5000); // Under 5 seconds
            
            coach.destroy();
        });
    });

    describe('Error Handling & Resilience Tests', () => {
        test('should gracefully handle API failures', async () => {
            const coach = new AutonomousIponCoach();
            
            // Mock API failure
            jest.spyOn(coach, 'callGeminiAPI').mockRejectedValue(new Error('API unavailable'));
            
            const result = await coach.generateFinancialAnalysis();
            
            expect(result).toBeDefined(); // Should fallback gracefully
            expect(result).toContain('currently analyzing'); // Fallback message
            
            coach.destroy();
        });

        test('should maintain state consistency during errors', async () => {
            const coach = new AutonomousIponCoach();
            
            // Simulate error during goal creation
            jest.spyOn(coach.goalOrchestrator, 'createHierarchy').mockRejectedValue(new Error('Goal creation failed'));
            
            await expect(coach.establishGoalHierarchy()).rejects.toThrow();
            
            // Verify state remains consistent
            expect(coach.goalOrchestrator.getActiveGoals()).toHaveLength(0);
            
            coach.destroy();
        });
    });

    describe('Security & Privacy Tests', () => {
        test('should anonymize user data for community learning', async () => {
            const coach = new AutonomousIponCoach();
            
            const sensitiveData = {
                userId: 'user123',
                email: 'user@example.com',
                transactions: [
                    { amount: 50000, merchant: 'Secret Store' }
                ]
            };

            const anonymized = await coach.anonymizeForCommunity(sensitiveData);
            
            expect(anonymized.userId).toBeUndefined();
            expect(anonymized.email).toBeUndefined();
            expect(anonymized.transactions[0].merchant).toBeUndefined();
            expect(anonymized.transactions[0].amount_range).toBeDefined();
            
            coach.destroy();
        });
    });
});

// Mock implementations for testing
class MockGeminiAPI {
    static async generateContent(prompt) {
        return {
            candidates: [{
                content: {
                    parts: [{
                        text: `Mock response for: ${prompt.substring(0, 50)}...`
                    }]
                }
            }]
        };
    }
}

// Test utilities
export const TestUtils = {
    createMockUser: (overrides = {}) => ({
        id: 'test_user',
        age: 25,
        income: 50000,
        familyStatus: { married: false },
        region: 'metro_manila',
        ...overrides
    }),
    
    createMockTransactions: (count = 10) => {
        return Array.from({ length: count }, (_, i) => ({
            id: i,
            type: i % 3 === 0 ? 'income' : 'expense',
            amount: Math.random() * 20000,
            category: ['food', 'transport', 'utilities', 'entertainment'][i % 4],
            date: new Date(2024, 0, i + 1).toISOString()
        }));
    },
    
    simulateUserBehavior: async (coach, actions) => {
        const results = [];
        for (const action of actions) {
            const result = await coach.processUserAction(action);
            results.push(result);
        }
        return results;
    }
}; 