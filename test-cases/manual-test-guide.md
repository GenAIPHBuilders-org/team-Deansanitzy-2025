# 📋 Manual Testing Guide for Kita-Kita AI Agents

## Overview

This guide provides step-by-step instructions for judges to manually test and validate the behavior of our three AI agents. Each test includes expected outcomes and validation criteria to ensure reproducible results.

## 🚀 Prerequisites

Before starting tests, ensure:

1. **Application is running** - Navigate to the application URL
2. **Test user is logged in** - Use the provided test credentials
3. **Sample data is loaded** - Verify transactions are present in the system
4. **Browser console is open** (F12) - To monitor any errors

### Test Credentials

```
Email: maria.santos@test.com
Password: TestUser2025!
```

## 🎯 Test 1: Ipon Coach - Cultural Awareness

### Objective

Validate that Ipon Coach understands Filipino cultural financial context and provides appropriate savings advice.

### Pre-test Setup

1. Navigate to `public/agents/iponCoach.html`
2. Wait for agent to load (should show "AI Agent Active" indicator)
3. Verify transaction data is displayed (should show ~27 transactions)

### Test Scenario 1A: Christmas Savings Planning

**Step 1: Initiate Conversation**

```
Input: "Help me prepare for Christmas expenses this year. I want to make sure I don't overspend like last year."
```

**Expected Response Time:** <3 seconds

**Validation Criteria:**

- ✅ Agent acknowledges Filipino Christmas traditions
- ✅ Uses cultural terms: "Noche Buena", "aguinaldo", "13th month pay"
- ✅ Provides specific peso amounts for budgeting
- ✅ References extended family obligations
- ✅ Suggests starting Christmas savings in October

**Expected Behavior:**

```
Should mention:
- Christmas spending typically 15-25% of annual income
- Breakdown: Noche Buena (₱3-5k), gifts (₱5-8k), aguinaldo (₱1-2k)
- Strategy for 13th month pay allocation
- Importance of protecting emergency fund
```

**Pass/Fail Criteria:**

- PASS: Response includes at least 3 cultural terms and specific peso amounts
- FAIL: Generic Christmas advice without Filipino context

### Test Scenario 1B: Paluwagan Decision Support

**Step 2: Test Traditional Savings Understanding**

```
Input: "I'm thinking of joining another paluwagan group. Is this a good idea?"
```

**Validation Criteria:**

- ✅ Recognizes existing paluwagan commitment (₱2,000/month, position 7/10)
- ✅ Analyzes risk vs. modern investment alternatives
- ✅ Provides comparison with digital savings options
- ✅ Considers cash flow impact on family budget

**Expected Behavior:**

```
Should include:
- Analysis of current paluwagan position
- Comparison with GSave/Maya savings rates
- Risk assessment of multiple paluwagan commitments
- Alternative suggestions (digital savings, time deposits)
```

### Test Scenario 1C: Emergency Fund Sizing

**Step 3: Test Family-Aware Financial Planning**

```
Input: "How much should my emergency fund be? I heard different amounts from friends."
```

**Validation Criteria:**

- ✅ Calculates emergency fund with family obligations (padala ₱8k/month)
- ✅ Suggests higher target than standard 3-6 months (8-10 months)
- ✅ Includes healthcare buffer for aging parents
- ✅ References current savings progress (₱85,000)

**Expected Calculation:**

```
Base monthly expenses: ₱35-40k
Cultural buffer: ₱50-80k
Recommended target: ₱270-350k
```

---

## 🎯 Test 2: Pera Planner - Life Planning

### Objective

Validate that Pera Planner provides strategic financial planning with Filipino life milestones.

### Pre-test Setup

1. Navigate to `public/agents/peraPlanner.html`
2. Verify career path selector shows "Corporate", "OFW", "Entrepreneur"
3. Check that financial data is loaded

### Test Scenario 2A: Education Planning

**Step 1: College Fund Planning**

```
Input: "I need to plan for my children's college education. They're currently 8 and 10 years old."
```

**Validation Criteria:**

- ✅ Calculates timeline (8-10 years to college)
- ✅ Provides realistic college cost estimates for Philippines
- ✅ Suggests specific investment vehicles available locally
- ✅ Considers inflation impact on education costs

**Expected Response:**

```
Should include:
- Current college costs: ₱150-300k per child
- Inflation-adjusted future costs
- Monthly savings target calculation
- Investment options: UITF, mutual funds, education insurance
```

### Test Scenario 2B: House Purchase Planning

**Step 2: Home Ownership Goals**

```
Input: "We want to buy a house and lot in Metro Manila. What's realistic for our income?"
```

**Validation Criteria:**

- ✅ References current income (₱45,000/month)
- ✅ Provides realistic Metro Manila property prices
- ✅ Calculates monthly amortization capacity
- ✅ Suggests timeline for down payment accumulation

**Expected Analysis:**

```
Should calculate:
- Affordable property range: ₱2-3M
- Down payment needed: ₱400-600k
- Monthly amortization: ₱15-20k max
- Savings timeline: 5-8 years for down payment
```

---

## 🎯 Test 3: Gastos Guardian - Expense Analysis

### Objective

Validate that Gastos Guardian detects Filipino spending patterns and provides culturally relevant optimization suggestions.

### Pre-test Setup

1. Navigate to `public/agents/gastosGuardian.html`
2. Wait for expense analysis to complete
3. Verify Filipino categories are displayed

### Test Scenario 3A: Spending Pattern Recognition

**Step 1: Verify Category Detection**

**Visual Validation:**

- ✅ "Padala & Remittance" category shows ₱31,000
- ✅ "Fiesta & Celebrations" category detected
- ✅ "Load & E-wallet" expenses categorized
- ✅ Christmas spending spike visible in December

**Expected Categories:**

```
Major categories should show:
- Padala: ₱31,000 (highest cultural expense)
- Christmas: ₱20,200 (seasonal spike)
- Savings: ₱33,000 (including paluwagan)
- Regular expenses properly categorized
```

### Test Scenario 3B: Spending Leak Detection

**Step 2: Ask for Optimization Advice**

```
Input: "Where am I wasting money? Help me find ways to save."
```

**Validation Criteria:**

- ✅ Identifies small frequent purchases (load, street food)
- ✅ Suggests local alternatives (karinderya vs restaurant)
- ✅ Recognizes transportation optimization opportunities
- ✅ Provides culturally appropriate suggestions

**Expected Recommendations:**

```
Should suggest:
- Bulk load purchases vs frequent small amounts
- Palengke shopping vs supermarket for groceries
- Baon preparation vs daily food purchases
- Transportation optimization (carpooling)
```

### Test Scenario 3C: Cultural Expense Optimization

**Step 3: Test Cultural Understanding**

```
Input: "My Christmas expenses were high this year. How can I reduce them next year without affecting family traditions?"
```

**Validation Criteria:**

- ✅ Acknowledges importance of Filipino Christmas traditions
- ✅ Suggests cost-reduction without tradition loss
- ✅ Provides specific alternatives for expensive items
- ✅ Respects family obligation dynamics

---

## 📊 Overall System Validation

### Integration Testing

**Step 1: Cross-Agent Consistency**

1. Note savings recommendations from Ipon Coach
2. Check if Pera Planner's timelines align
3. Verify Gastos Guardian's expense categorization matches

**Step 2: Data Synchronization**

1. Add a new transaction in the main dashboard
2. Refresh each agent page
3. Verify the new transaction appears in all agents

**Step 3: Cultural Context Consistency**

1. Ask similar questions across agents
2. Verify consistent Filipino terminology usage
3. Check for aligned cultural understanding

### Performance Validation

**Response Time Targets:**

- Initial page load: <5 seconds
- AI response generation: <3 seconds
- Data refresh: <2 seconds

**Error Handling:**

- Test with invalid inputs
- Verify graceful degradation
- Check error message clarity

## 📋 Validation Checklist

### For Judges - Quick Validation

**Cultural Awareness (30 points)**

- [ ] Uses Filipino financial terms correctly
- [ ] Understands traditional saving methods (paluwagan, alkansya)
- [ ] Recognizes cultural events (Christmas, fiesta)
- [ ] Acknowledges family obligation dynamics

**Technical Implementation (25 points)**

- [ ] Accurate financial calculations
- [ ] Realistic budget recommendations
- [ ] Proper risk assessments
- [ ] Sound investment advice

**Personalization (25 points)**

- [ ] Tailored to user's income level
- [ ] Considers family size and obligations
- [ ] Accounts for existing commitments
- [ ] Adapts to user's goals

**User Experience (20 points)**

- [ ] Intuitive interface navigation
- [ ] Clear, actionable responses
- [ ] Appropriate response times
- [ ] Error-free functionality

## 🚨 Troubleshooting

### Common Issues

**Issue: AI not responding**

- Solution: Check internet connection, refresh page
- Fallback: Use sample responses in `expected-outputs/`

**Issue: Data not loading**

- Solution: Clear browser cache, re-login with test credentials
- Verification: Check browser console for error messages

**Issue: Cultural terms not recognized**

- Solution: Try alternative phrasings from test scenarios
- Documentation: Report specific terms that failed

## 📝 Scoring Rubric

### Total Score: 100 points

**Exceptional (90-100 points):**

- All cultural terms used correctly
- Accurate financial calculations
- Highly personalized responses
- Smooth user experience

**Proficient (75-89 points):**

- Most cultural elements present
- Generally accurate calculations
- Good personalization
- Minor UX issues

**Developing (60-74 points):**

- Basic cultural awareness
- Some calculation errors
- Limited personalization
- Noticeable UX problems

**Needs Improvement (<60 points):**

- Poor cultural understanding
- Significant errors
- Generic responses
- Major functionality issues

---

**Estimated Testing Time:** 45-60 minutes for complete validation
**Recommended Approach:** Start with Scenario 1A, then sample other tests based on time constraints
