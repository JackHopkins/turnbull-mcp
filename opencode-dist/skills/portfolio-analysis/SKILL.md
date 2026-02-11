---
name: portfolio-analysis
description: Generate a comprehensive portfolio-level risk analysis with rating distribution, exposure rankings, overdue rankings, and AI assessment.
---

# Portfolio Analysis

Generate a comprehensive portfolio-level risk analysis, optionally filtered by branch or account manager.

## Arguments
- `branch` (optional): Filter to a specific branch
- `repId` (optional): Filter to a specific account manager

## Steps

1. Call `risk_distribution` (with branch filter if provided) to get the full rating breakdown
2. Call `overview_metrics` to get aggregate portfolio metrics
3. Call `customer_list` with sortBy: "running_balance", sortOrder: "DESC", limit: 10 (with filters) to get highest exposure customers
4. Call `customer_list` with sortBy: "risk_rating", sortOrder: "DESC", limit: 10 (with filters) to get highest risk customers
5. Call `customer_list` with sortBy: "days_beyond_terms", sortOrder: "DESC", limit: 10 (with filters) to get most overdue customers
6. Call `portfolio_summary` (with filters) for AI analysis

## Output Format

### Portfolio Analysis - [Date]
[Filters: Branch/Rep if applicable]

#### Risk Distribution Overview
| Rating | Count | % | Total Balance | Avg DBT | Total Credit Limit |
|--------|-------|----|---------------|---------|-------------------|
[One row per rating A-F plus unrated]

**Total Customers:** [sum of counts]
**Total Credit Exposure:** [sum of balances]

#### Aggregate Metrics
| Metric | All Customers | Risky (D-F) |
|--------|--------------|-------------|
| Credit Balance | [credit_balance] | [risky_credit_balance] |
| Days Beyond Terms | [days_beyond_terms] | [risky_days_beyond_terms] |
| Weighted Avg DBT | [weighted_avg] | [risky_weighted_avg] |
| Open Invoices | [open_invoices] | [risky_open_invoices] |

#### Top 10 by Exposure
[Table: Name, Account, Balance, Rating, DBT]

#### Top 10 by Risk Rating
[Table: Name, Account, Rating, Score, Balance, DBT]

#### Top 10 Most Overdue
[Table: Name, Account, DBT, Balance, Rating]

#### AI Portfolio Assessment
[From portfolio_summary]

#### Key Findings
[Bullet points highlighting concentrations, trends, and concerns]

#### Recommended Actions
[Prioritized action items]
