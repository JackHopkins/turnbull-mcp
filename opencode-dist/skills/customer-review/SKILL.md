# Customer Review

Generate a comprehensive risk review for a customer account.

## Arguments
- `accountNumber` (required): The customer account number to review

## Steps

1. Call `customer_profile` with the account number to get the complete metrics snapshot
2. Call `customer_alerts_history` with the account number (limit: 10) to get recent risk alerts
3. Call `debtor_days` with the account number to get aged debtor analysis
4. Call `transaction_history` with the account number (days: 180) to get recent transactions
5. Call `customer_intelligence` with the account number (limit: 10) to get field notes
6. If the customer has a company_number, call `company_profile` with the account number
7. Call `analyze_customer_risk` with the account number for AI narrative

## Output Format

Present the review as a structured report:

### [Customer Name] - Account Review
**Account:** [accountNumber] | **Rating:** [risk_rating] ([letter]) | **Branch:** [branch]

#### Risk Summary
- Risk Score: [risk_score] | Rating: [risk_rating]
- AI Analysis: [from analyze_customer_risk]

#### Financial Overview
| Metric | Value |
|--------|-------|
| Credit Limit | [creditLimit] |
| Running Balance | [running_balance] |
| Credit Usage | [credit_usage]% |
| Insurance Limit | [insurance_limit] |
| Days Beyond Terms | [days_beyond_terms] |
| YTD Transactions | [ytd_transaction_volume] |

#### Recent Alerts
[List recent alerts with dates, ratings, and summaries]

#### Debtor Days Trend
[Show last 6 months of debtor days data]

#### Recent Transactions
[Summarize transaction activity and patterns]

#### Field Intelligence
[Show recent notes from reps]

#### Companies House
[Show company status, any CCJs, recent filings if available]

#### Recommended Actions
[Specific actions based on the analysis]
