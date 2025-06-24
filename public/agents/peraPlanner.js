/**
 * Pera Planner AI - Personalized Financial Planning with Gemini AI
 * Tailored to user's actual financial situation from Firestore
 */

// Import Firebase and Gemini API
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserData, getUserTransactions, getUserBankAccounts } from "../js/firestoredb.js";
import { GEMINI_API_KEY, GEMINI_MODEL } from "../js/config.js";

class PeraPlannerAI {
    constructor() {
        this.userProfile = null;
        this.financialPlan = null;
        this.planningComplete = false;
        this.currentAge = 28;
        this.testMode = window.location.search.includes('test=true');
        this.debugMode = window.location.search.includes('debug=true');
        this.simpleMode = window.location.search.includes('simple=true');
        
        // Firebase setup
        this.auth = getAuth();
        this.currentUser = null;
        
        this.initializeElements();
        this.loadFilipinoFinancialWisdom();
        this.setupAuthListener();
    }

    // Setup Firebase authentication
    setupAuthListener() {
        return new Promise((resolve) => {
            onAuthStateChanged(this.auth, (user) => {
                if (user) {
                    console.log('✅ User authenticated:', user.uid);
                    this.currentUser = user;
                } else {
                    console.log('❌ User not authenticated');
                    if (!this.testMode && !this.debugMode) {
                        window.location.href = '/pages/login.html';
                        return;
                    }
                }
                resolve();
            });
        });
    }

    initializeElements() {
        this.elements = {
            loadingState: document.getElementById('loading-state'),
            contentState: document.getElementById('content-state'),
            emptyState: document.getElementById('empty-state'),
            financialTimeline: document.getElementById('financial-timeline'),
            investmentContent: document.getElementById('investment-content'),
            careerContent: document.getElementById('career-content'),
            balancingActContent: document.getElementById('balancing-act-content')
        };

        let missingElements = [];
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Element ${key} not found in DOM`);
                missingElements.push(key);
            }
        });

        if (missingElements.length > 0) {
            console.warn(`Missing DOM elements: ${missingElements.join(', ')}`);
        }
    }

    loadFilipinoFinancialWisdom() {
        this.filipinoLifeStages = {
            early20s: {
                name: "Fresh Graduate / Young Professional",
                ageRange: "22-26",
                priorities: ["Emergency Fund", "Skill Building", "Basic Insurance"],
                strategies: ["Ipon Challenge", "Side Hustle", "Professional Development"],
                savingsRate: 0.15
            },
            late20s: {
                name: "Career Building Phase",
                ageRange: "27-32",
                priorities: ["Investment Start", "Career Growth", "Relationship Planning"],
                strategies: ["Stock Market Entry", "Real Estate Research", "Professional Certification"],
                savingsRate: 0.20
            },
            early30s: {
                name: "Family Formation Stage",
                ageRange: "33-38",
                priorities: ["Family Planning", "Home Ownership", "Children's Education"],
                strategies: ["House Down Payment", "Educational Insurance", "Family Budget"],
                savingsRate: 0.18
            },
            late30s: {
                name: "Wealth Accumulation Phase",
                ageRange: "39-45",
                priorities: ["Investment Growth", "Business Opportunities", "Parent Care"],
                strategies: ["Diversified Portfolio", "Business Investment", "Health Insurance"],
                savingsRate: 0.25
            },
            40s: {
                name: "Peak Earning Years",
                ageRange: "46-52",
                priorities: ["Retirement Planning", "Children's College", "Wealth Preservation"],
                strategies: ["Retirement Fund Max", "College Fund", "Insurance Review"],
                savingsRate: 0.30
            }
        };

        this.filipinoInvestmentLadder = {
            beginner: {
                name: "Simula (Beginning)",
                instruments: ["Digital Banks", "Time Deposits", "UITF", "Pag-IBIG MP2"],
                riskLevel: "Low",
                expectedReturn: "3-6%",
                platforms: ["CIMB Bank", "ING Bank", "Tonik", "Maya Bank"]
            },
            intermediate: {
                name: "Paglaki (Growth)",
                instruments: ["Stock Market", "Index Funds", "Real Estate", "Bonds"],
                riskLevel: "Medium",
                expectedReturn: "6-12%",
                platforms: ["COL Financial", "BPI Trade", "First Metro Securities"]
            },
            advanced: {
                name: "Yaman (Wealth)",
                instruments: ["Blue Chip Stocks", "REITs", "Business", "International Funds"],
                riskLevel: "Medium-High",
                expectedReturn: "8-15%",
                platforms: ["BDO Nomura", "Philequity", "AREIT", "Ayala Land Premier"]
            }
        };
    }

    // Generate user profile from real Firestore data
    async generateUserProfile() {
        try {
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }

            console.log('📊 Fetching real user data from Firestore...');
            
            // Get actual user data from Firestore
            const [userData, transactions, bankAccounts] = await Promise.all([
                getUserData(this.currentUser.uid),
                getUserTransactions(this.currentUser.uid),
                getUserBankAccounts(this.currentUser.uid)
            ]);

            console.log('📊 Real data fetched:', { userData, transactions, bankAccounts });

            // Calculate financial metrics from real transaction data
            const financialMetrics = this.calculateFinancialMetrics(transactions, bankAccounts);
            
            // Extract comprehensive user profile
            const profile = {
                // Basic info
                age: userData?.age || this.currentAge,
                name: userData?.name || 'User',
                location: userData?.location || 'Philippines',
                
                // Financial data from real transactions
                monthlyIncome: financialMetrics.monthlyIncome,
                monthlyExpenses: financialMetrics.monthlyExpenses,
                currentSavings: financialMetrics.totalSavings,
                savingsRate: financialMetrics.savingsRate,
                
                // Employment info
                employmentType: userData?.employmentType || 'employed',
                industry: userData?.industry || 'General',
                monthlyIncomeFromProfile: userData?.monthlyIncome || financialMetrics.monthlyIncome,
                
                // Personal info
                dependents: userData?.dependents || 0,
                maritalStatus: userData?.maritalStatus || 'single',
                
                // Financial preferences
                lifeStage: this.determineLifeStage(userData?.age || this.currentAge),
                riskTolerance: userData?.riskTolerance || 'moderate',
                primaryGoals: userData?.primaryGoals || ['emergency_fund', 'retirement'],
                
                // Insurance and investments
                hasInsurance: userData?.hasInsurance || false,
                hasInvestments: financialMetrics.hasInvestments,
                investmentExperience: userData?.investmentExperience || 'beginner',
                
                // Financial knowledge
                financialKnowledge: userData?.financialKnowledge || 'beginner',
                
                // Data metrics
                transactionCount: transactions.length,
                accountCount: bankAccounts.length,
                dataQuality: this.assessDataQuality(transactions, bankAccounts, userData),
                
                // Raw data for AI analysis
                recentTransactions: transactions.slice(0, 20), // Last 20 transactions
                spendingCategories: financialMetrics.spendingCategories,
                incomePattern: financialMetrics.incomePattern
            };

            console.log('✅ Generated comprehensive user profile:', profile);
            return profile;

        } catch (error) {
            console.error('❌ Error generating user profile:', error);
            return this.generateFallbackProfile();
        }
    }

    // Calculate detailed financial metrics from real transaction data
    calculateFinancialMetrics(transactions, bankAccounts) {
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        
        // Filter recent transactions (last 3 months)
        const recentTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            return txDate >= threeMonthsAgo;
        });

        // Calculate income and expenses by category
        let totalIncome = 0;
        let totalExpenses = 0;
        let hasInvestments = false;
        const spendingCategories = {};
        const incomePattern = [];

        recentTransactions.forEach(tx => {
            const amount = parseFloat(tx.amount) || 0;
            const category = tx.category || 'Other';
            
            if (tx.type === 'income') {
                totalIncome += amount;
                incomePattern.push({
                    amount,
                    date: tx.date || tx.timestamp,
                    source: tx.name || 'Income'
                });
            } else if (tx.type === 'expense') {
                totalExpenses += amount;
                spendingCategories[category] = (spendingCategories[category] || 0) + amount;
            }
            
            // Check for investment activity
            if (category && (
                category.toLowerCase().includes('investment') ||
                category.toLowerCase().includes('stock') ||
                category.toLowerCase().includes('mutual') ||
                category.toLowerCase().includes('crypto') ||
                tx.name.toLowerCase().includes('col financial') ||
                tx.name.toLowerCase().includes('bpi trade')
            )) {
                hasInvestments = true;
            }
        });

        // Calculate monthly averages
        const monthlyIncome = Math.round(totalIncome / 3);
        const monthlyExpenses = Math.round(totalExpenses / 3);
        const savingsRate = monthlyIncome > 0 ? (monthlyIncome - monthlyExpenses) / monthlyIncome : 0;

        // Calculate total savings from bank accounts
        const totalSavings = bankAccounts.reduce((sum, account) => {
            return sum + (parseFloat(account.balance) || 0);
        }, 0);

        return {
            monthlyIncome: monthlyIncome || 50000,
            monthlyExpenses: monthlyExpenses || 35000,
            totalSavings: totalSavings || 100000,
            savingsRate: Math.max(0, savingsRate),
            hasInvestments,
            spendingCategories,
            incomePattern
        };
    }

    // Assess data quality for better AI recommendations
    assessDataQuality(transactions, bankAccounts, userData) {
        let score = 0;
        const factors = [];

        // Transaction data quality
        if (transactions.length >= 20) {
            score += 30;
            factors.push('Rich transaction history');
        } else if (transactions.length >= 10) {
            score += 20;
            factors.push('Moderate transaction history');
        } else if (transactions.length > 0) {
            score += 10;
            factors.push('Limited transaction history');
        }

        // Bank account data
        if (bankAccounts.length >= 2) {
            score += 20;
            factors.push('Multiple bank accounts');
        } else if (bankAccounts.length === 1) {
            score += 15;
            factors.push('Single bank account');
        }

        // Profile completeness
        if (userData?.age && userData?.employmentType && userData?.monthlyIncome) {
            score += 25;
            factors.push('Complete profile information');
        } else if (userData?.age || userData?.employmentType) {
            score += 15;
            factors.push('Partial profile information');
        }

        // Recent activity
        const recentTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.date || tx.timestamp);
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            return txDate >= oneMonthAgo;
        });

        if (recentTransactions.length >= 5) {
            score += 25;
            factors.push('Recent financial activity');
        }

        return {
            score: Math.min(100, score),
            factors,
            level: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'limited'
        };
    }

    // Determine life stage based on age
    determineLifeStage(age) {
        if (age >= 22 && age <= 26) return 'early20s';
        if (age >= 27 && age <= 32) return 'late20s';
        if (age >= 33 && age <= 38) return 'early30s';
        if (age >= 39 && age <= 45) return 'late30s';
        if (age >= 46 && age <= 52) return '40s';
        return 'late20s'; // default
    }

    // Generate fallback profile for test/debug modes
    generateFallbackProfile() {
        return {
            age: this.currentAge,
            name: 'Demo User',
            monthlyIncome: 50000,
            monthlyExpenses: 35000,
            currentSavings: 100000,
            savingsRate: 0.30,
            employmentType: 'employed',
            industry: 'General',
            dependents: 0,
            lifeStage: 'late20s',
            riskTolerance: 'moderate',
            primaryGoals: ['emergency_fund', 'retirement'],
            hasInsurance: false,
            hasInvestments: false,
            location: 'Philippines',
            financialKnowledge: 'beginner',
            transactionCount: 0,
            accountCount: 0,
            dataQuality: { score: 50, level: 'demo', factors: ['Demo data'] },
            isUsingFallback: true
        };
    }

    // Call Gemini AI for personalized financial analysis
    async callGeminiAI(prompt) {
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
                        maxOutputTokens: 1024,
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Error calling Gemini AI:', error);
            return null;
        }
    }

    // Create AI-powered financial plan
    async createFinancialPlan(profile) {
        console.log('🧠 Creating AI-powered financial plan...');
        
        // Create Gemini AI prompt with user's real data
        const aiPrompt = `
You are a Filipino financial planning expert. Analyze this user's real financial data and create a personalized plan:

USER PROFILE:
- Age: ${profile.age}
- Monthly Income: ₱${profile.monthlyIncome.toLocaleString()}
- Monthly Expenses: ₱${profile.monthlyExpenses.toLocaleString()}
- Current Savings: ₱${profile.currentSavings.toLocaleString()}
- Savings Rate: ${(profile.savingsRate * 100).toFixed(1)}%
- Life Stage: ${profile.lifeStage}
- Employment: ${profile.employmentType} in ${profile.industry}
- Dependents: ${profile.dependents}
- Risk Tolerance: ${profile.riskTolerance}
- Investment Experience: ${profile.investmentExperience || 'beginner'}
- Has Investments: ${profile.hasInvestments ? 'Yes' : 'No'}
- Data Quality: ${profile.dataQuality.level} (${profile.dataQuality.score}/100)

SPENDING PATTERNS:
${profile.spendingCategories ? Object.entries(profile.spendingCategories).map(([cat, amount]) => `- ${cat}: ₱${amount.toLocaleString()}`).join('\n') : 'No spending data available'}

RECENT TRANSACTIONS: ${profile.transactionCount} transactions, ${profile.accountCount} bank accounts

Please provide:
1. Three specific, actionable financial milestones for the next 5 years with exact peso amounts
2. Investment strategy recommendations based on their current situation
3. Career growth projections considering their industry and age
4. Personal vs family financial balance recommendations

Format as JSON with this structure:
{
  "milestones": [
    {"year": 2025, "age": 29, "goal": "Emergency Fund", "target": 210000, "strategy": "specific strategy", "priority": "high"},
    {"year": 2027, "age": 31, "goal": "Investment Portfolio", "target": 500000, "strategy": "specific strategy", "priority": "high"},
    {"year": 2030, "age": 34, "goal": "House Down Payment", "target": 1000000, "strategy": "specific strategy", "priority": "medium"}
  ],
  "investment": {
    "stage": "beginner/intermediate/advanced",
    "monthlyBudget": 15000,
    "allocation": {"stocks": 60, "bonds": 25, "realEstate": 10, "cash": 5},
    "platforms": ["COL Financial", "BPI Trade"],
    "reasoning": "explanation based on user data"
  },
  "career": {
    "projections": [
      {"year": 2029, "age": 33, "income": 75000, "level": "Senior Level"},
      {"year": 2034, "age": 38, "income": 120000, "level": "Management Level"}
    ],
    "recommendations": ["specific career advice"]
  },
  "balance": {
    "personalGoals": 18000,
    "familyObligations": 12000,
    "recommendations": ["specific balancing advice"]
  }
}
`;

        // Get AI recommendations
        const aiResponse = await this.callGeminiAI(aiPrompt);
        
        let aiPlan = null;
        if (aiResponse) {
            try {
                // Extract JSON from AI response
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    aiPlan = JSON.parse(jsonMatch[0]);
                }
            } catch (error) {
                console.error('Error parsing AI response:', error);
            }
        }

        // Create comprehensive plan (with AI enhancement or fallback)
        return {
            financialRoadmap: aiPlan?.milestones || this.createFinancialRoadmap(profile),
            investmentStrategy: aiPlan?.investment || this.developInvestmentStrategy(profile),
            careerProjection: aiPlan?.career || this.projectCareerPath(profile),
            familyBalancing: aiPlan?.balance || this.analyzeLifeBalance(profile),
            aiInsights: aiResponse ? this.extractAIInsights(aiResponse) : null,
            dataQuality: profile.dataQuality
        };
    }

    // Extract key insights from AI response
    extractAIInsights(aiResponse) {
        const insights = [];
        
        // Look for key phrases in AI response
        if (aiResponse.includes('emergency fund')) {
            insights.push('🚨 Emergency fund prioritization recommended');
        }
        if (aiResponse.includes('investment') || aiResponse.includes('invest')) {
            insights.push('📈 Investment strategy customized to your profile');
        }
        if (aiResponse.includes('career') || aiResponse.includes('income')) {
            insights.push('🚀 Career growth opportunities identified');
        }
        if (aiResponse.includes('family') || aiResponse.includes('dependent')) {
            insights.push('👨‍👩‍👧‍👦 Family financial planning considered');
        }

        return insights;
    }

    // Fallback methods (used when AI is unavailable)
    createFinancialRoadmap(profile) {
        const currentYear = new Date().getFullYear();
        const roadmap = [];

        // Emergency Fund
        const emergencyTarget = profile.monthlyExpenses * 6;
        roadmap.push({
            year: currentYear + 1,
            age: profile.age + 1,
            goal: "Emergency Fund Complete",
            target: emergencyTarget,
            strategy: `Save ₱${Math.round(emergencyTarget/12).toLocaleString()}/month using automated transfers`,
            priority: "high"
        });

        // Investment Start
        const investmentTarget = profile.monthlyIncome * 12;
        roadmap.push({
            year: currentYear + 2,
            age: profile.age + 2,
            goal: "Investment Portfolio Launch",
            target: investmentTarget,
            strategy: `Invest ₱${Math.round(profile.monthlyIncome * 0.2).toLocaleString()}/month in index funds`,
            priority: "high"
        });

        // Major Goal (House/Business)
        const majorTarget = profile.monthlyIncome * 24;
        roadmap.push({
            year: currentYear + 5,
            age: profile.age + 5,
            goal: profile.age < 35 ? "House Down Payment" : "Business Capital",
            target: majorTarget,
            strategy: `Combine savings and investment returns for major milestone`,
            priority: "medium"
        });

        return roadmap;
    }

    developInvestmentStrategy(profile) {
        const monthlyInvestment = Math.round(profile.monthlyIncome * 0.20);
        
        // Determine stage based on actual data
        let stage = 'beginner';
        if (profile.hasInvestments || profile.currentSavings > 500000) {
            stage = 'intermediate';
        }
        if (profile.currentSavings > 2000000 || profile.investmentExperience === 'advanced') {
            stage = 'advanced';
        }

        const stageInfo = this.filipinoInvestmentLadder[stage];
        
        return {
            stage: stage,
            monthlyBudget: monthlyInvestment,
            assetAllocation: this.calculateAssetAllocation(profile),
            platforms: stageInfo.platforms,
            instruments: stageInfo.instruments,
            expectedReturn: stageInfo.expectedReturn,
            reasoning: `Based on your ${profile.dataQuality.level} data quality and ${stage} investor profile`
        };
    }

    calculateAssetAllocation(profile) {
        const age = profile.age;
        const riskTolerance = profile.riskTolerance;
        
        // Base allocation on age (rule of 100 minus age for stocks)
        let stockPercentage = Math.max(20, 100 - age);
        
        // Adjust for risk tolerance
        if (riskTolerance === 'conservative') {
            stockPercentage -= 20;
        } else if (riskTolerance === 'aggressive') {
            stockPercentage += 10;
        }
        
        stockPercentage = Math.max(20, Math.min(80, stockPercentage));
        
        return {
            stocks: stockPercentage,
            bonds: Math.round((100 - stockPercentage) * 0.6),
            realEstate: Math.round((100 - stockPercentage) * 0.3),
            cash: Math.round((100 - stockPercentage) * 0.1)
        };
    }

    projectCareerPath(profile) {
        const projections = [];
        const currentIncome = profile.monthlyIncome;
        
        // Industry-specific growth rates
        const growthRates = {
            'IT/Technology': 0.12,
            'Finance/Banking': 0.08,
            'Healthcare': 0.07,
            'Education': 0.05,
            'Government': 0.04,
            'Business/Sales': 0.09
        };
        
        const growthRate = growthRates[profile.industry] || 0.07;
        
        for (let i = 5; i <= 20; i += 5) {
            const futureAge = profile.age + i;
            const futureIncome = Math.round(currentIncome * Math.pow(1 + growthRate, i));
            
            projections.push({
                year: new Date().getFullYear() + i,
                age: futureAge,
                income: futureIncome,
                level: this.determineCareerLevel(futureAge)
            });
        }
        
        return {
            projections,
            recommendations: [
                `Focus on ${profile.industry} skill development`,
                `Target ${Math.round(growthRate * 100)}% annual income growth`,
                `Consider leadership roles by age ${profile.age + 10}`
            ]
        };
    }

    determineCareerLevel(age) {
        if (age < 30) return "Junior Level";
        if (age < 35) return "Senior Level";
        if (age < 40) return "Lead/Supervisory Level";
        if (age < 45) return "Management Level";
        return "Executive Level";
    }

    analyzeLifeBalance(profile) {
        const monthlyIncome = profile.monthlyIncome;
        const dependents = profile.dependents;
        
        // Adjust allocation based on dependents
        const personalPercentage = dependents > 0 ? 0.25 : 0.35;
        const familyPercentage = dependents > 0 ? 0.20 : 0.10;
        
        const personalGoals = Math.round(monthlyIncome * personalPercentage);
        const familyObligations = Math.round(monthlyIncome * familyPercentage);
        
        return {
            personalGoals,
            familyObligations,
            balanceScore: this.calculateBalanceScore(personalGoals, familyObligations, profile),
            recommendations: [
                `Allocate ₱${personalGoals.toLocaleString()}/month for personal goals`,
                `Budget ₱${familyObligations.toLocaleString()}/month for family obligations`,
                dependents > 0 ? 'Consider family insurance coverage' : 'Build personal wealth foundation first'
            ]
        };
    }

    calculateBalanceScore(personalGoals, familyObligations, profile) {
        let score = 70; // Base score
        
        // Adjust based on savings rate
        if (profile.savingsRate > 0.25) score += 15;
        else if (profile.savingsRate > 0.15) score += 10;
        else if (profile.savingsRate < 0.05) score -= 20;
        
        // Adjust based on emergency fund
        const emergencyFundMonths = profile.currentSavings / profile.monthlyExpenses;
        if (emergencyFundMonths >= 6) score += 15;
        else if (emergencyFundMonths >= 3) score += 5;
        else score -= 10;
        
        return Math.max(0, Math.min(100, score));
    }

    showState(stateName) {
        const states = ['loading-state', 'content-state', 'empty-state'];
        
        states.forEach(state => {
            const element = document.getElementById(state);
            if (element) {
                if (state === stateName) {
                    element.style.display = 'block';
                    element.classList.remove('hidden');
                } else {
                    element.style.display = 'none';
                    element.classList.add('hidden');
                }
            }
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async updateLoadingMessage(message) {
        const loadingText = this.elements.loadingState?.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
        await this.delay(800);
    }

    renderTestContent() {
        if (this.elements.financialTimeline) {
            this.elements.financialTimeline.innerHTML = `
                <div class="timeline-event">
                    <div class="timeline-date">2025 (Age 29)</div>
                    <div class="timeline-title">Emergency Fund Complete</div>
                    <div class="timeline-description">
                        <p><strong>Goal:</strong> Build 6-month emergency fund</p>
                        <p><strong>Target:</strong> ₱210,000</p>
                        <p><strong>Strategy:</strong> Automated savings + Side hustle</p>
                    </div>
                </div>
            `;
        }

        if (this.elements.investmentContent) {
            this.elements.investmentContent.innerHTML = `
                <h3>Your Investment Stage: Paglaki (Growth)</h3>
                <p><strong>Monthly Investment Budget:</strong> ₱10,000</p>
                <h4>Recommended Asset Allocation:</h4>
                <ul>
                    <li>Stocks: 60%</li>
                    <li>Bonds: 25%</li>
                    <li>Real Estate: 10%</li>
                    <li>Cash: 5%</li>
                </ul>
            `;
        }

        if (this.elements.careerContent) {
            this.elements.careerContent.innerHTML = `
                <h3>Career Projection</h3>
                <ul>
                    <li><strong>2029</strong> (Age 33): ₱66,000/month - Senior Level</li>
                    <li><strong>2034</strong> (Age 38): ₱89,000/month - Lead Level</li>
                </ul>
            `;
        }

        if (this.elements.balancingActContent) {
            this.elements.balancingActContent.innerHTML = `
                <h3>Balance Score: 75/100</h3>
                <p>Personal Goals: ₱15,000/month | Family: ₱10,000/month</p>
            `;
        }
    }

    renderPlan(plan, profile) {
        console.log('🎨 Rendering personalized financial plan...');
        
        // Render data quality indicator
        this.renderDataQuality(profile);
        
        // Render AI insights if available
        if (plan.aiInsights) {
            this.renderAIInsights(plan.aiInsights);
        }
        
        // Render roadmap
        if (this.elements.financialTimeline && plan.financialRoadmap) {
            let timelineHTML = '';
            plan.financialRoadmap.forEach(milestone => {
                timelineHTML += `
                    <div class="timeline-event">
                        <div class="timeline-date">${milestone.year} (Age ${milestone.age})</div>
                        <div class="timeline-title">${milestone.goal}</div>
                        <div class="timeline-description">
                            <p><strong>Target:</strong> ₱${milestone.target.toLocaleString()}</p>
                            <p><strong>Strategy:</strong> ${milestone.strategy}</p>
                            <span class="priority-badge priority-${milestone.priority}">${milestone.priority} priority</span>
                        </div>
                    </div>
                `;
            });
            this.elements.financialTimeline.innerHTML = timelineHTML;
        }

        // Render investment strategy
        if (this.elements.investmentContent && plan.investmentStrategy) {
            const strategy = plan.investmentStrategy;
            this.elements.investmentContent.innerHTML = `
                <h3>Investment Strategy: ${strategy.stage.charAt(0).toUpperCase() + strategy.stage.slice(1)}</h3>
                <p><strong>Monthly Budget:</strong> ₱${strategy.monthlyBudget.toLocaleString()}</p>
                ${strategy.reasoning ? `<p class="ai-insight">💡 ${strategy.reasoning}</p>` : ''}
                
                <h4>Asset Allocation:</h4>
                <div class="allocation-bars">
                    <div class="allocation-item">
                        <span>Stocks: ${strategy.assetAllocation.stocks}%</span>
                        <div class="progress-bar"><div class="progress-fill" style="width: ${strategy.assetAllocation.stocks}%"></div></div>
                    </div>
                    <div class="allocation-item">
                        <span>Bonds: ${strategy.assetAllocation.bonds}%</span>
                        <div class="progress-bar"><div class="progress-fill" style="width: ${strategy.assetAllocation.bonds}%"></div></div>
                    </div>
                    <div class="allocation-item">
                        <span>Real Estate: ${strategy.assetAllocation.realEstate}%</span>
                        <div class="progress-bar"><div class="progress-fill" style="width: ${strategy.assetAllocation.realEstate}%"></div></div>
                    </div>
                    <div class="allocation-item">
                        <span>Cash: ${strategy.assetAllocation.cash}%</span>
                        <div class="progress-bar"><div class="progress-fill" style="width: ${strategy.assetAllocation.cash}%"></div></div>
                    </div>
                </div>
                
                <h4>Recommended Platforms:</h4>
                <ul>
                    ${strategy.platforms.map(platform => `<li>${platform}</li>`).join('')}
                </ul>
                <p><strong>Expected Return:</strong> ${strategy.expectedReturn} annually</p>
            `;
        }

        // Render career projection
        if (this.elements.careerContent && plan.careerProjection) {
            const career = plan.careerProjection;
            let careerHTML = '<h3>Career Growth Projection</h3>';
            
            if (career.projections) {
                careerHTML += '<ul>';
                career.projections.forEach(projection => {
                    careerHTML += `
                        <li><strong>${projection.year}</strong> (Age ${projection.age}): 
                        ₱${projection.income.toLocaleString()}/month - ${projection.level}</li>
                    `;
                });
                careerHTML += '</ul>';
            }
            
            if (career.recommendations) {
                careerHTML += '<h4>Career Recommendations:</h4><ul>';
                career.recommendations.forEach(rec => {
                    careerHTML += `<li>${rec}</li>`;
                });
                careerHTML += '</ul>';
            }
            
            this.elements.careerContent.innerHTML = careerHTML;
        }

        // Render life balance
        if (this.elements.balancingActContent && plan.familyBalancing) {
            const balance = plan.familyBalancing;
            this.elements.balancingActContent.innerHTML = `
                <h3>Financial Balance Score: ${balance.balanceScore}/100</h3>
                
                <div class="balance-allocation">
                    <div class="balance-item">
                        <h4>Personal Goals</h4>
                        <p class="amount">₱${balance.personalGoals.toLocaleString()}/month</p>
                    </div>
                    <div class="balance-item">
                        <h4>Family Obligations</h4>
                        <p class="amount">₱${balance.familyObligations.toLocaleString()}/month</p>
                    </div>
                </div>
                
                <h4>Recommendations:</h4>
                <ul>
                    ${balance.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            `;
        }
    }

    renderDataQuality(profile) {
        if (!this.elements.financialTimeline) return;
        
        const qualityHTML = `
            <div class="data-quality-indicator">
                <h3>📊 Your Financial Data Analysis</h3>
                <div class="quality-score quality-${profile.dataQuality.level}">
                    <span class="score">${profile.dataQuality.score}/100</span>
                    <span class="level">${profile.dataQuality.level.toUpperCase()}</span>
                </div>
                <div class="quality-factors">
                    ${profile.dataQuality.factors.map(factor => `<span class="factor">✓ ${factor}</span>`).join('')}
                </div>
                <p class="data-note">
                    ${profile.isUsingFallback ? 
                        '⚠️ Using demo data. Add transactions for personalized recommendations.' : 
                        '✅ Recommendations based on your real financial data.'
                    }
                </p>
            </div>
        `;
        
        this.elements.financialTimeline.innerHTML = qualityHTML + this.elements.financialTimeline.innerHTML;
    }

    renderAIInsights(insights) {
        if (!this.elements.financialTimeline || !insights.length) return;
        
        const insightsHTML = `
            <div class="ai-insights">
                <h3>🤖 AI-Powered Insights</h3>
                <div class="insights-list">
                    ${insights.map(insight => `<div class="insight-item">${insight}</div>`).join('')}
                </div>
            </div>
        `;
        
        this.elements.financialTimeline.innerHTML = this.elements.financialTimeline.innerHTML + insightsHTML;
    }

    async start() {
        try {
            console.log('🚀 Starting Personalized Pera Planner AI...');
            this.showState('loading-state');
            
            // Test mode - quick rendering
            if (this.testMode) {
                console.log('🧪 TEST MODE: Quick rendering...');
                await this.delay(2000);
                this.renderTestContent();
                this.showState('content-state');
                return;
            }

            // Simple mode - basic content
            if (this.simpleMode) {
                console.log('🔧 SIMPLE MODE: Basic content...');
                await this.delay(1000);
                this.renderTestContent();
                this.showState('content-state');
                return;
            }

            // Wait for authentication
            await this.updateLoadingMessage('Authenticating user...');
            await this.setupAuthListener();
            
            if (!this.currentUser && !this.debugMode) {
                this.showState('empty-state');
                return;
            }

            // Generate user profile from real data
            await this.updateLoadingMessage('Analyzing your financial data...');
            this.userProfile = this.debugMode ? 
                this.generateFallbackProfile() : 
                await this.generateUserProfile();
            
            // Check if we have sufficient data
            if (!this.userProfile.isUsingFallback && 
                this.userProfile.transactionCount === 0 && 
                this.userProfile.accountCount === 0) {
                this.showState('empty-state');
                return;
            }

            // Create AI-powered financial plan
            await this.updateLoadingMessage('Creating personalized financial plan...');
            this.financialPlan = await this.createFinancialPlan(this.userProfile);
            
            // Render the personalized plan
            await this.updateLoadingMessage('Rendering your financial roadmap...');
            this.renderPlan(this.financialPlan, this.userProfile);
            
            this.showState('content-state');
            this.planningComplete = true;
            
            console.log('✅ Personalized Pera Planner AI complete!');
            
        } catch (error) {
            console.error('❌ Error in Pera Planner:', error);
            this.showState('empty-state');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Pera Planner DOM loaded, initializing...');
    try {
        const peraPlanner = new PeraPlannerAI();
        
        // Add timeout fallback
        const timeoutId = setTimeout(() => {
            console.error('⏰ Pera Planner timeout - showing fallback');
            const loadingState = document.getElementById('loading-state');
            const emptyState = document.getElementById('empty-state');
            if (loadingState) loadingState.style.display = 'none';
            if (emptyState) {
                emptyState.style.display = 'block';
                emptyState.classList.remove('hidden');
            }
        }, 15000);
        
        peraPlanner.start().then(() => {
            clearTimeout(timeoutId);
            console.log('✅ Pera Planner completed successfully');
        }).catch((error) => {
            clearTimeout(timeoutId);
            console.error('❌ Pera Planner failed:', error);
        });
        
    } catch (error) {
        console.error('❌ Error initializing Pera Planner:', error);
        const loadingState = document.getElementById('loading-state');
        const emptyState = document.getElementById('empty-state');
        if (loadingState) loadingState.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.classList.remove('hidden');
        }
    }
});
