// Transaction analysis utilities for AI agents
import { formatCurrency, formatDate, callGeminiAI } from './agentCommon.js';

// Get transaction insights
export async function getTransactionInsights(transactions, options = {}) {
    if (!transactions || transactions.length === 0) {
        return {
            totalSpent: 0,
            totalIncome: 0,
            netFlow: 0,
            categoryBreakdown: {},
            insights: ['No transactions to analyze'],
            trends: []
        };
    }

    const totalSpent = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);

    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount) || 0, 0);

    const netFlow = totalIncome - totalSpent;

    // Category breakdown
    const categoryBreakdown = {};
    transactions.forEach(transaction => {
        const category = transaction.category || 'Other';
        const amount = Math.abs(parseFloat(transaction.amount) || 0);
        
        if (!categoryBreakdown[category]) {
            categoryBreakdown[category] = {
                total: 0,
                count: 0,
                type: transaction.type
            };
        }
        
        categoryBreakdown[category].total += amount;
        categoryBreakdown[category].count += 1;
    });

    // Generate insights
    const insights = [];
    const sortedCategories = Object.entries(categoryBreakdown)
        .sort(([,a], [,b]) => b.total - a.total);

    if (sortedCategories.length > 0) {
        const topCategory = sortedCategories[0];
        insights.push(`Your top spending category is ${topCategory[0]} with ${formatCurrency(topCategory[1].total)}`);
    }

    if (netFlow > 0) {
        insights.push(`Great! You have a positive cash flow of ${formatCurrency(netFlow)}`);
    } else if (netFlow < 0) {
        insights.push(`You're spending ${formatCurrency(Math.abs(netFlow))} more than you earn`);
    }

    // Identify trends
    const trends = [];
    if (transactions.length >= 7) {
        const recent = transactions.slice(-7);
        const recentSpending = recent
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);

        if (recentSpending > totalSpent * 0.3) {
            trends.push('High spending activity in recent transactions');
        }
    }

    return {
        totalSpent,
        totalIncome,
        netFlow,
        categoryBreakdown,
        insights,
        trends
    };
}

// Analyze a single transaction
export function analyzeTransaction(transaction) {
    if (!transaction) {
        return {
            analysis: 'No transaction provided',
            suggestions: [],
            risk: 'low'
        };
    }

    const amount = Math.abs(parseFloat(transaction.amount) || 0);
    const analysis = [];
    const suggestions = [];
    let risk = 'low';

    // Amount analysis
    if (amount > 1000) {
        analysis.push('Large transaction amount');
        suggestions.push('Consider if this expense is necessary');
        risk = 'medium';
    }

    if (amount > 5000) {
        analysis.push('Very large transaction');
        suggestions.push('Review this expense carefully');
        risk = 'high';
    }

    // Category-based suggestions
    const category = transaction.category?.toLowerCase() || '';
    
    if (category.includes('food') || category.includes('dining')) {
        suggestions.push('Consider meal planning to reduce food expenses');
    } else if (category.includes('entertainment')) {
        suggestions.push('Look for free or low-cost entertainment alternatives');
    } else if (category.includes('shopping')) {
        suggestions.push('Wait 24 hours before making non-essential purchases');
    }

    // Date analysis
    const transactionDate = new Date(transaction.date);
    const dayOfWeek = transactionDate.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        analysis.push('Weekend transaction');
    }

    return {
        analysis: analysis.join(', ') || 'Regular transaction',
        suggestions,
        risk,
        amount: formatCurrency(amount),
        date: formatDate(transaction.date)
    };
}

// Predict future transactions based on historical data
export function predictFutureTransactions(transactions, daysAhead = 30) {
    if (!transactions || transactions.length === 0) {
        return {
            predictions: [],
            expectedSpending: 0,
            expectedIncome: 0,
            confidence: 0
        };
    }

    // Calculate daily averages
    const expenses = transactions.filter(t => t.type === 'expense');
    const income = transactions.filter(t => t.type === 'income');

    const totalDays = Math.max(30, transactions.length); // Assume at least 30 days of data
    
    const avgDailySpending = expenses.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0) / totalDays;
    const avgDailyIncome = income.reduce((sum, t) => sum + parseFloat(t.amount) || 0, 0) / totalDays;

    // Project for the specified days ahead
    const expectedSpending = avgDailySpending * daysAhead;
    const expectedIncome = avgDailyIncome * daysAhead;

    // Generate category-based predictions
    const categoryAverages = {};
    expenses.forEach(transaction => {
        const category = transaction.category || 'Other';
        const amount = Math.abs(parseFloat(transaction.amount) || 0);
        
        if (!categoryAverages[category]) {
            categoryAverages[category] = { total: 0, count: 0 };
        }
        
        categoryAverages[category].total += amount;
        categoryAverages[category].count += 1;
    });

    const predictions = Object.entries(categoryAverages).map(([category, data]) => ({
        category,
        predictedAmount: (data.total / totalDays) * daysAhead,
        confidence: Math.min(95, (data.count / totalDays) * 100) // Higher confidence with more frequent transactions
    }));

    // Calculate overall confidence based on data quality
    const confidence = Math.min(90, (transactions.length / 30) * 100);

    return {
        predictions,
        expectedSpending,
        expectedIncome,
        confidence,
        period: `${daysAhead} days`,
        netPrediction: expectedIncome - expectedSpending
    };
}

// Generate spending recommendations based on transaction patterns
export function generateSpendingRecommendations(transactions) {
    const recommendations = [];
    
    if (!transactions || transactions.length === 0) {
        return ['Start tracking your transactions to get personalized recommendations'];
    }

    const insights = getTransactionInsights(transactions);
    const categoryBreakdown = insights.categoryBreakdown;

    // Check for high spending categories
    const sortedCategories = Object.entries(categoryBreakdown)
        .filter(([, data]) => data.type === 'expense')
        .sort(([,a], [,b]) => b.total - a.total);

    if (sortedCategories.length > 0) {
        const topCategory = sortedCategories[0];
        if (topCategory[1].total > insights.totalSpent * 0.3) {
            recommendations.push(`Consider reducing spending on ${topCategory[0]} - it represents ${Math.round((topCategory[1].total / insights.totalSpent) * 100)}% of your total expenses`);
        }
    }

    // Check for frequent small transactions
    const smallFrequentTransactions = transactions.filter(t => 
        t.type === 'expense' && Math.abs(parseFloat(t.amount) || 0) < 50
    );

    if (smallFrequentTransactions.length > transactions.length * 0.5) {
        recommendations.push('Many small expenses can add up - consider consolidating purchases or setting a daily spending limit');
    }

    // Check savings rate
    if (insights.netFlow < insights.totalIncome * 0.2) {
        recommendations.push('Try to save at least 20% of your income for financial security');
    }

    return recommendations.length > 0 ? recommendations : ['Keep tracking your expenses to identify improvement opportunities'];
} 