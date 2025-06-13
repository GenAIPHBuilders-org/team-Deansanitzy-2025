# 🧪 Test Cases for Kita-Kita AI Banking Platform

## Overview

This folder contains comprehensive test cases for validating the behavior of our three AI agents under specific conditions. These test cases help judges understand and validate how our system functions with reproducibility in mind.

## 🤖 AI Agents Under Test

### 1. **Ipon Coach** - Autonomous Savings Agent

- **Location**: `public/agents/iponCoach.html`
- **Purpose**: Provides personalized savings guidance using Filipino cultural context
- **Key Features**: Transaction analysis, savings recommendations, goal tracking

### 2. **Pera Planner** - Financial Life Planning Agent

- **Location**: `public/agents/peraPlanner.html`
- **Purpose**: Strategic financial planning across life stages with Filipino milestones
- **Key Features**: Career path optimization, milestone planning, investment recommendations

### 3. **Gastos Guardian** - Expense Analysis Agent

- **Location**: `public/agents/gastosGuardian.html`
- **Purpose**: Intelligent expense analysis with Filipino spending patterns
- **Key Features**: Spending leak detection, cultural category analysis, local alternatives

## 📁 Test Case Structure

```
test-cases/
├── README.md                          # This file
├── sample-data/                       # Sample input data
│   ├── user-profiles/                 # Test user profiles
│   ├── transactions/                  # Sample transaction data
│   └── scenarios/                     # Specific test scenarios
├── expected-outputs/                  # Expected AI responses and behaviors
├── test-scripts/                      # Automated test scripts
├── validation-logs/                   # Execution logs and results
└── manual-test-guide.md              # Step-by-step manual testing guide
```

## 🎯 Test Categories

### 1. **Functional Testing**

- Agent response accuracy
- Data processing capabilities
- UI functionality
- Firebase integration

### 2. **Cultural Context Testing**

- Filipino financial terminology understanding
- Cultural event recognition (Christmas, Fiesta, etc.)
- Traditional saving method integration
- OFW family scenario handling

### 3. **AI Behavior Testing**

- Autonomous decision making
- Proactive recommendations
- Learning and adaptation
- Context-aware responses

### 4. **Edge Case Testing**

- Large transaction volumes
- Missing data scenarios
- Network connectivity issues
- Invalid input handling

## 🚀 Quick Start Guide

### Prerequisites

1. Ensure the main application is running
2. Valid Firebase authentication
3. Sample data loaded (see `sample-data/` folder)

### Running Test Cases

1. **Automated Tests** (recommended for judges):

   ```bash
   # Run all test cases
   npm run test:agents

   # Run specific agent tests
   npm run test:ipon-coach
   npm run test:pera-planner
   npm run test:gastos-guardian
   ```

2. **Manual Testing** (for detailed validation):
   - Follow the `manual-test-guide.md`
   - Use sample data from `sample-data/` folder
   - Compare results with `expected-outputs/`

## 📊 Test Metrics

### Success Criteria

- **Response Accuracy**: >95% correct cultural context understanding
- **Performance**: <2 seconds for typical AI responses
- **User Experience**: Smooth interaction flow without errors
- **Data Integrity**: Consistent financial calculations

### Validation Points

- ✅ Cultural terminology recognition
- ✅ Appropriate savings recommendations
- ✅ Accurate financial calculations
- ✅ Proactive insight generation
- ✅ Mobile responsiveness
- ✅ Firebase data synchronization

## 🔍 Judge Validation Guide

For competition judges, we recommend:

1. **Start with Scenario 1** (typical Filipino family)
2. **Run automated tests** for comprehensive coverage
3. **Review validation logs** for detailed outputs
4. **Try manual scenarios** for interactive experience

Each test case includes:

- **Input data** (JSON format)
- **Expected output** (detailed descriptions)
- **Validation criteria** (specific metrics)
- **Cultural context** (Filipino financial relevance)

## 📞 Support

For questions about test cases or unexpected behavior:

- Check `validation-logs/` for detailed execution logs
- Review `troubleshooting.md` for common issues
- Contact team members (details in main README.md)

---

_Last updated: January 2025_
_Version: 1.0.0_
