/**
 * Gastos Guardian AI - Autonomous Expense Analysis Assistant
 * Implements agentic behavior with reasoning, planning, and autonomy
 */

class GastosGuardianAI {
    constructor() {
        this.expenseData = null;
        this.analysisResults = null;
        this.chart = null;
        this.processingComplete = false;
        this.initializeElements();
        this.loadFilipinoExpenseWisdom();
    }

    // Initialize DOM elements with error handling
    initializeElements() {
        this.elements = {
            loadingState: document.getElementById('loading-state'),
            contentState: document.getElementById('content-state'),
            emptyState: document.getElementById('empty-state'),
            expenseChart: document.getElementById('expense-chart'),
            spendingLeaksContent: document.getElementById('spending-leaks-content'),
            tipidTipsContent: document.getElementById('tipid-tips-content')
        };

        // Validate all elements exist
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Element ${key} not found in DOM`);
            }
        });
    }

    // Filipino expense wisdom and strategies
    loadFilipinoExpenseWisdom() {
        this.filipinoStrategies = {
            tipidTips: [
                {
                    category: 'Food',
                    tip: 'Try "Baon Strategy" - bring home-cooked meals instead of buying outside',
                    savings: '₱200-500/day',
                    impact: 'high'
                },
                {
                    category: 'Transportation',
                    tip: 'Use "Sakay-Sakay Method" - combine jeepney, tricycle, and walking',
                    savings: '₱100-300/day',
                    impact: 'medium'
                },
                {
                    category: 'Shopping',
                    tip: 'Apply "Tawad Power" - always negotiate and compare prices',
                    savings: '10-30% on purchases',
                    impact: 'medium'
                },
                {
                    category: 'Entertainment',
                    tip: 'Embrace "Libreng Kasiyahan" - free activities like parks and festivals',
                    savings: '₱500-1000/week',
                    impact: 'high'
                }
            ],
            spendingPatterns: {
                'Filipino Lifestyle': {
                    food: { typical: 0.35, optimal: 0.25 },
                    transportation: { typical: 0.15, optimal: 0.12 },
                    family: { typical: 0.20, optimal: 0.18 },
                    entertainment: { typical: 0.10, optimal: 0.08 },
                    utilities: { typical: 0.15, optimal: 0.12 },
                    others: { typical: 0.05, optimal: 0.05 }
                }
            }
        };
    }

    // Generate realistic mock expense data
    generateMockExpenseData() {
        const categories = [
            { name: 'Food & Dining', amount: 15000, color: '#FF6B6B' },
            { name: 'Transportation', amount: 8000, color: '#4ECDC4' },
            { name: 'Shopping', amount: 12000, color: '#45B7D1' },
            { name: 'Bills & Utilities', amount: 6000, color: '#96CEB4' },
            { name: 'Entertainment', amount: 5000, color: '#FFEAA7' },
            { name: 'Healthcare', amount: 3000, color: '#DDA0DD' },
            { name: 'Family Support', amount: 8000, color: '#98D8C8' },
            { name: 'Others', amount: 2000, color: '#F7DC6F' }
        ];

        const totalExpenses = categories.reduce((sum, cat) => sum + cat.amount, 0);
        const monthlyIncome = 65000;

        return {
            categories,
            totalExpenses,
            monthlyIncome,
            transactionCount: 89,
            averageDaily: Math.round(totalExpenses / 30),
            topCategory: categories.reduce((prev, current) => (prev.amount > current.amount) ? prev : current)
        };
    }

    // AI Analysis Engine - Autonomous reasoning and planning
    async analyzeExpenseData(data) {
        const analysis = {
            spendingPattern: this.analyzeSpendingPattern(data),
            spendingLeaks: this.identifySpendingLeaks(data),
            categoryInsights: this.analyzeCategorySpending(data),
            filipinoStrategies: this.recommendFilipinoStrategies(data),
            budgetOptimization: this.optimizeBudget(data),
            riskAssessment: this.assessSpendingRisks(data)
        };

        // Simulate AI processing time
        await this.simulateAIProcessing();
        return analysis;
    }

    // Analyze overall spending pattern with AI reasoning
    analyzeSpendingPattern(data) {
        const spendingRate = (data.totalExpenses / data.monthlyIncome) * 100;
        const dailyAverage = data.averageDaily;
        
        let pattern = '';
        let severity = 'low';
        let recommendations = [];

        if (spendingRate > 90) {
            pattern = 'High Risk Spender';
            severity = 'high';
            recommendations = [
                'Implement "Emergency Brake" - stop all non-essential spending immediately',
                'Use "Envelope Method" - allocate cash for each category',
                'Start "Ipon Challenge" - save ₱20 daily to build emergency fund'
            ];
        } else if (spendingRate > 75) {
            pattern = 'Moderate Risk Spender';
            severity = 'medium';
            recommendations = [
                'Apply "50-30-20 Filipino Rule" - adjust for local lifestyle',
                'Try "Paluwagan System" for forced savings',
                'Use "Weekly Gastos Audit" - review expenses every week'
            ];
        } else {
            pattern = 'Balanced Spender';
            severity = 'low';
            recommendations = [
                'Maintain current discipline with "Tipid Mindset"',
                'Consider "Investment Opportunities" for surplus',
                'Explore "Passive Income" strategies'
            ];
        }

        return {
            pattern,
            spendingRate: Math.round(spendingRate),
            dailyAverage,
            severity,
            recommendations
        };
    }

    // Identify spending leaks with autonomous detection
    identifySpendingLeaks(data) {
        const leaks = [];
        const optimalRatios = this.filipinoStrategies.spendingPatterns['Filipino Lifestyle'];

        data.categories.forEach(category => {
            const categoryKey = this.mapCategoryToKey(category.name);
            const currentRatio = category.amount / data.totalExpenses;
            const optimalRatio = optimalRatios[categoryKey]?.optimal || 0.05;

            if (currentRatio > optimalRatio) {
                const excessAmount = (currentRatio - optimalRatio) * data.totalExpenses;
                leaks.push({
                    category: category.name,
                    excessAmount: Math.round(excessAmount),
                    currentSpend: category.amount,
                    recommendedSpend: Math.round(optimalRatio * data.totalExpenses),
                    strategy: this.getLeakStrategy(category.name),
                    priority: excessAmount > 3000 ? 'high' : excessAmount > 1500 ? 'medium' : 'low'
                });
            }
        });

        return leaks.sort((a, b) => b.excessAmount - a.excessAmount);
    }

    // Map category names to strategy keys
    mapCategoryToKey(categoryName) {
        const mapping = {
            'Food & Dining': 'food',
            'Transportation': 'transportation',
            'Shopping': 'others',
            'Bills & Utilities': 'utilities',
            'Entertainment': 'entertainment',
            'Family Support': 'family',
            'Healthcare': 'others',
            'Others': 'others'
        };
        return mapping[categoryName] || 'others';
    }

    // Get specific strategy for spending leaks
    getLeakStrategy(categoryName) {
        const strategies = {
            'Food & Dining': 'Try "Lutong Bahay Strategy" - cook at home 4-5 days a week',
            'Transportation': 'Use "Commute Optimization" - find cheapest route combinations',
            'Shopping': 'Apply "List Discipline" - stick to shopping lists strictly',
            'Entertainment': 'Practice "Free Fun Friday" - enjoy cost-free weekend activities',
            'Bills & Utilities': 'Implement "Conservation Mode" - reduce consumption habits',
            'Family Support': 'Optimize "Family Budget" - set sustainable support limits',
            'Healthcare': 'Use "Prevention Focus" - invest in health to reduce future costs',
            'Others': 'Practice "Mindful Spending" - question every purchase'
        };
        return strategies[categoryName] || 'Review and optimize this spending category';
    }

    // Analyze individual category spending
    analyzeCategorySpending(data) {
        return data.categories.map(category => {
            const percentage = (category.amount / data.totalExpenses) * 100;
            let status = 'optimal';
            let recommendation = '';

            if (percentage > 35) {
                status = 'too_high';
                recommendation = `Consider reducing ${category.name} expenses using Filipino "Tipid" methods`;
            } else if (percentage > 25) {
                status = 'moderate';
                recommendation = `Monitor ${category.name} spending and look for savings opportunities`;
            } else {
                status = 'optimal';
                recommendation = `Good control over ${category.name} expenses`;
            }

            return {
                ...category,
                percentage: Math.round(percentage),
                status,
                recommendation
            };
        });
    }

    // Recommend Filipino financial strategies
    recommendFilipinoStrategies(data) {
        const applicableStrategies = [];
        
        // Analyze which Filipino strategies apply
        data.categories.forEach(category => {
            const strategy = this.filipinoStrategies.tipidTips.find(tip => 
                category.name.toLowerCase().includes(tip.category.toLowerCase())
            );
            
            if (strategy && category.amount > 5000) {
                applicableStrategies.push({
                    ...strategy,
                    currentSpend: category.amount,
                    applicableCategory: category.name
                });
            }
        });

        // Add general Filipino strategies
        applicableStrategies.push(
            {
                category: 'General',
                tip: 'Use "Tawad at Diskarte" - negotiate prices and find creative solutions',
                savings: '5-15% on most purchases',
                impact: 'medium'
            },
            {
                category: 'Mindset',
                tip: 'Practice "Kuripot Pride" - be proud of smart spending choices',
                savings: 'Long-term wealth building',
                impact: 'high'
            }
        );

        return applicableStrategies;
    }

    // Optimize budget with AI planning
    optimizeBudget(data) {
        const optimizedBudget = [];
        const targetSavingsRate = 0.20; // 20% savings goal
        const targetSpendingAmount = data.monthlyIncome * (1 - targetSavingsRate);

        data.categories.forEach(category => {
            const categoryKey = this.mapCategoryToKey(category.name);
            const optimalRatio = this.filipinoStrategies.spendingPatterns['Filipino Lifestyle'][categoryKey]?.optimal || 0.05;
            const recommendedAmount = Math.round(targetSpendingAmount * optimalRatio);
            const potentialSavings = Math.max(0, category.amount - recommendedAmount);

            optimizedBudget.push({
                category: category.name,
                current: category.amount,
                recommended: recommendedAmount,
                savings: potentialSavings,
                method: this.getOptimizationMethod(category.name)
            });
        });

        const totalPotentialSavings = optimizedBudget.reduce((sum, item) => sum + item.savings, 0);

        return {
            optimizedBudget,
            totalPotentialSavings,
            newSavingsRate: Math.round(((data.monthlyIncome - targetSpendingAmount) / data.monthlyIncome) * 100),
            achievabilityScore: this.calculateAchievabilityScore(optimizedBudget)
        };
    }

    // Get optimization method for each category
    getOptimizationMethod(categoryName) {
        const methods = {
            'Food & Dining': 'Weekly meal prep + "Baon Challenge"',
            'Transportation': 'Route optimization + carpooling',
            'Shopping': 'List-based shopping + "Tawad Strategy"',
            'Entertainment': 'Free activities + "Libreng Kasiyahan"',
            'Bills & Utilities': 'Conservation habits + auto-pay discounts',
            'Family Support': 'Structured assistance + family budgeting',
            'Healthcare': 'Preventive care + health maintenance',
            'Others': 'Mindful spending + necessity evaluation'
        };
        return methods[categoryName] || 'Careful evaluation and reduction';
    }

    // Calculate how achievable the optimization plan is
    calculateAchievabilityScore(optimizedBudget) {
        let score = 100;
        
        optimizedBudget.forEach(item => {
            const reductionPercentage = (item.savings / item.current) * 100;
            if (reductionPercentage > 50) score -= 20;
            else if (reductionPercentage > 30) score -= 10;
            else if (reductionPercentage > 15) score -= 5;
        });

        return Math.max(0, score);
    }

    // Assess spending risks
    assessSpendingRisks(data) {
        const risks = [];
        const spendingRate = (data.totalExpenses / data.monthlyIncome) * 100;

        if (spendingRate > 85) {
            risks.push({
                risk: 'Insufficient Emergency Buffer',
                severity: 'high',
                description: 'Very little room for unexpected expenses',
                solution: 'Implement immediate "Emergency Fund Challenge" - save ₱50 daily'
            });
        }

        const foodSpending = data.categories.find(cat => cat.name.includes('Food'));
        if (foodSpending && (foodSpending.amount / data.totalExpenses) > 0.4) {
            risks.push({
                risk: 'Food Expense Dominance',
                severity: 'medium',
                description: 'Food expenses taking up too much of budget',
                solution: 'Start "Lutong Bahay Campaign" - cook at home more often'
            });
        }

        if (data.averageDaily > 2000) {
            risks.push({
                risk: 'High Daily Burn Rate',
                severity: 'medium',
                description: 'Daily spending exceeds sustainable levels',
                solution: 'Apply "Daily Limit Strategy" - set and track daily spending caps'
            });
        }

        return risks;
    }

    // Simulate AI processing with realistic delays
    async simulateAIProcessing() {
        const stages = [
            { message: 'Scanning expense patterns...', delay: 1000 },
            { message: 'Identifying spending leaks...', delay: 1200 },
            { message: 'Analyzing Filipino spending behaviors...', delay: 900 },
            { message: 'Generating Tipid strategies...', delay: 800 },
            { message: 'Optimizing your budget...', delay: 700 }
        ];

        for (const stage of stages) {
            await this.updateLoadingMessage(stage.message);
            await this.delay(stage.delay);
        }
    }

    async updateLoadingMessage(message) {
        const loadingText = this.elements.loadingState?.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Render the expense chart
    renderExpenseChart(data) {
        console.log("Rendering expense chart with data:", data);
        
        if (!this.elements.expenseChart) {
            console.error('Expense chart canvas element not found');
            return;
        }

        try {
            const ctx = this.elements.expenseChart.getContext('2d');
            
            if (!ctx) {
                console.error('Could not get 2D context from canvas');
                return;
            }
            
            // Destroy existing chart if it exists
            if (this.chart) {
                console.log("Destroying existing chart");
                this.chart.destroy();
                this.chart = null;
            }

            // Ensure we have valid data
            if (!data.categories || data.categories.length === 0) {
                console.error('No categories data available for chart');
                this.showChartError();
                return;
            }

            console.log("Creating new chart with categories:", data.categories.length);

            // Create center text plugin
            const centerTextPlugin = {
                id: 'centerText',
                beforeDraw: function(chart) {
                    const ctx = chart.ctx;
                    const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                    const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Total amount
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 16px Poppins, sans-serif';
                    ctx.fillText('Total Expenses', centerX, centerY - 15);
                    
                    ctx.font = 'bold 20px Poppins, sans-serif';
                    ctx.fillStyle = '#4ECDC4';
                    ctx.fillText(`₱${data.totalExpenses.toLocaleString()}`, centerX, centerY + 15);
                    
                    ctx.restore();
                }
            };

            this.chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.categories.map(cat => cat.name),
                    datasets: [{
                        data: data.categories.map(cat => cat.amount),
                        backgroundColor: data.categories.map(cat => cat.color),
                        borderColor: '#1a1a1a',
                        borderWidth: 2,
                        hoverBorderWidth: 3,
                        hoverBackgroundColor: data.categories.map(cat => this.lightenColor(cat.color, 20))
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#fff',
                                usePointStyle: true,
                                padding: 20,
                                font: {
                                    size: 12,
                                    family: 'Poppins, sans-serif'
                                },
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    if (data.labels.length && data.datasets.length) {
                                        return data.labels.map((label, i) => {
                                            const dataset = data.datasets[0];
                                            const total = dataset.data.reduce((a, b) => a + b, 0);
                                            const value = dataset.data[i];
                                            const percentage = ((value / total) * 100).toFixed(1);
                                            
                                            return {
                                                text: `${label} (${percentage}%)`,
                                                fillStyle: dataset.backgroundColor[i],
                                                strokeStyle: dataset.borderColor,
                                                lineWidth: dataset.borderWidth,
                                                hidden: false,
                                                index: i
                                            };
                                        });
                                    }
                                    return [];
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#333',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((context.raw / total) * 100).toFixed(1);
                                    return `${context.label}: ₱${context.raw.toLocaleString()} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    cutout: '60%',
                    animation: {
                        animateRotate: true,
                        duration: 2000,
                        onComplete: function() {
                            console.log("Chart animation completed");
                        }
                    },
                    onHover: (event, activeElements) => {
                        event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                    }
                },
                plugins: [centerTextPlugin]
            });

            console.log("Chart created successfully:", this.chart);

        } catch (error) {
            console.error('Error creating expense chart:', error);
            this.showChartError();
        }
    }

    // Lighten color for hover effect
    lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    // Show chart error message
    showChartError() {
        if (!this.elements.expenseChart) return;
        
        const chartContainer = this.elements.expenseChart.parentElement;
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div class="chart-error">
                    <i class="fas fa-chart-pie" style="font-size: 3rem; color: #666; margin-bottom: 1rem;"></i>
                    <h3>Chart Unavailable</h3>
                    <p>Unable to load expense breakdown chart. Please refresh the page.</p>
                    <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 1rem;">
                        <i class="fas fa-refresh"></i> Refresh Page
                    </button>
                </div>
            `;
        }
    }

    // Render spending leaks analysis
    renderSpendingLeaks(leaks) {
        if (!this.elements.spendingLeaksContent || !leaks.length) {
            this.elements.spendingLeaksContent.innerHTML = '<p>Great news! No major spending leaks detected. Your Guardian is impressed! 🎉</p>';
            return;
        }

        const leaksHTML = leaks.slice(0, 3).map(leak => `
            <div class="leak-item priority-${leak.priority}">
                <div class="leak-header">
                    <h4>${leak.category}</h4>
                    <span class="leak-amount">-₱${leak.excessAmount.toLocaleString()}</span>
                </div>
                <div class="leak-details">
                    <p><strong>Current:</strong> ₱${leak.currentSpend.toLocaleString()}</p>
                    <p><strong>Recommended:</strong> ₱${leak.recommendedSpend.toLocaleString()}</p>
                    <p><strong>Strategy:</strong> ${leak.strategy}</p>
                </div>
            </div>
        `).join('');

        this.elements.spendingLeaksContent.innerHTML = leaksHTML;
    }

    // Render Filipino Tipid tips
    renderTipidTips(strategies) {
        if (!this.elements.tipidTipsContent) return;

        const tipsHTML = strategies.slice(0, 4).map((strategy, index) => `
            <div class="tip-item">
                <div class="tip-number">${index + 1}</div>
                <div class="tip-content">
                    <h4>${strategy.tip}</h4>
                    <div class="tip-details">
                        <span class="tip-category">${strategy.category}</span>
                        <span class="tip-savings">${strategy.savings}</span>
                        <span class="tip-impact impact-${strategy.impact}">${strategy.impact} impact</span>
                    </div>
                </div>
            </div>
        `).join('');

        this.elements.tipidTipsContent.innerHTML = tipsHTML;
    }

    // State management
    showState(stateName) {
        const stateElements = {
            'loadingState': this.elements.loadingState,
            'contentState': this.elements.contentState,
            'emptyState': this.elements.emptyState
        };

        // Hide all states
        Object.values(stateElements).forEach(element => {
            if (element) {
                element.classList.add('hidden');
            }
        });

        // Show the requested state
        const targetElement = stateElements[stateName];
        if (targetElement) {
            targetElement.classList.remove('hidden');
        }
    }

    // Main autonomous execution
    async start() {
        try {
            this.showState('loadingState');
            
            // Check if Chart.js is loaded
            if (typeof Chart === 'undefined') {
                console.error('Chart.js is not loaded');
                this.showError('Chart.js library failed to load. Please refresh the page.');
                return;
            }
            
            console.log('Chart.js version:', Chart.version);
            
            // Simulate data fetching
            await this.delay(1000);
            
            // Generate expense data (in real app, this would fetch from backend)
            this.expenseData = this.generateMockExpenseData();
            
            console.log('Generated expense data:', this.expenseData);
            
            // Check if user has sufficient data
            if (!this.expenseData.transactionCount || this.expenseData.transactionCount < 1) {
                // If user has no transactions at all, show a helpful message
                if (this.expenseData.transactionCount === 0) {
                    this.showEmptyStateWithPrompt();
                } else {
                    this.showState('emptyState');
                }
                return;
            }

            // Perform AI analysis
            this.analysisResults = await this.analyzeExpenseData(this.expenseData);
            
            console.log('Analysis results:', this.analysisResults);
            
            // Show content first
            this.showState('contentState');
            
            // Wait a bit for DOM to be ready
            await this.delay(500);
            
            // Render all components
            this.renderExpenseChart(this.expenseData);
            this.renderSpendingLeaks(this.analysisResults.spendingLeaks);
            this.renderTipidTips(this.analysisResults.filipinoStrategies);
            
            // Mark analysis as complete
            this.processingComplete = true;
            
            console.log('Gastos Guardian AI analysis complete!');
            
        } catch (error) {
            console.error('Error in Gastos Guardian AI:', error);
            this.showError('An error occurred while analyzing your expenses. Please refresh and try again.');
        }
    }

    showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Analysis Error</h3>
            <p>${message}</p>
        `;
        
        document.body.appendChild(errorElement);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    }

    showEmptyStateWithPrompt() {
        if (!this.elements.emptyState) return;
        
        this.elements.emptyState.innerHTML = `
            <div class="empty-state-content">
                <i class="fas fa-shield-alt" style="font-size: 3rem; color: rgba(255, 255, 255, 0.3); margin-bottom: 1.5rem;"></i>
                <h3>Your Gastos Guardian is Ready!</h3>
                <p>To start analyzing your expenses and find spending leaks, you need to:</p>
                <ul style="list-style: none; padding: 0; margin-top: 1rem; text-align: left; display: inline-block;">
                    <li style="margin-bottom: 0.5rem;"><i class="fas fa-plus-circle" style="margin-right: 0.5rem; color: #4CAF50;"></i> Add at least 1 expense transaction</li>
                    <li style="margin-bottom: 0.5rem;"><i class="fas fa-chart-pie" style="margin-right: 0.5rem; color: #FF6B6B;"></i> Track different spending categories</li>
                    <li style="margin-bottom: 0.5rem;"><i class="fas fa-lightbulb" style="margin-right: 0.5rem; color: #FFC107;"></i> Get personalized Filipino "tipid" tips</li>
                </ul>
                <p style="margin-top: 1.5rem;">Once you start tracking expenses, I'll help you identify spending leaks and provide culturally-relevant money-saving strategies!</p>
                <div style="margin-top: 2rem;">
                    <button onclick="window.location.href='/pages/transactions.html'" class="btn btn-primary" style="margin-right: 1rem;">
                        <i class="fas fa-plus"></i> Add Expense
                    </button>
                    <button onclick="location.reload()" class="btn btn-secondary">
                        <i class="fas fa-refresh"></i> Refresh
                    </button>
                </div>
            </div>
        `;
        
        this.showState('emptyState');
    }
}

// Initialize the Gastos Guardian AI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const gastosGuardian = new GastosGuardianAI();
    gastosGuardian.start();
});
