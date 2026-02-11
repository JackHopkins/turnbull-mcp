---
name: branch-report
description: Generate a comprehensive branch performance dashboard with revenue, rep leaderboard, KBB pipeline, top products, and team composition.
---

# Branch Report

Generate a comprehensive branch performance dashboard.

## Arguments
- `branchName` (required): The branch name to report on
- `startDate` (optional): Start date (YYYY-MM-DD), defaults to start of current month
- `endDate` (optional): End date (YYYY-MM-DD), defaults to today

## Steps

1. Call `mis_branch_sales_summary` with the branch name and date range to get revenue, COGS, margin, and customer count
2. Call `mis_customers_by_branch` with the branch name (limit: 20, sortBy: creditLimit) to get top customers
3. Call `mis_rep_leaderboard` with the date range filtered by branch to rank rep performance
4. Call `mis_kbb_pipeline` with the branch name to get KBB design pipeline summary
5. Call `mis_top_products` with the date range filtered by branch (limit: 20) to get best-selling products
6. Call `mis_staff_by_branch` with the branch name to get team composition

## Output Format

### [Branch Name] — Performance Report
**Period:** [startDate] to [endDate]

#### Revenue Summary
| Metric | Value |
|--------|-------|
| Total Revenue | [total_sales] |
| Cost of Goods | [total_cogs] |
| Gross Margin | [gross_margin] |
| Margin % | [margin_pct]% |
| Transactions | [transaction_count] |
| Active Customers | [customer_count] |

#### Sales Team Leaderboard
| Rank | Rep | Revenue | Customers | Avg Order |
|------|-----|---------|-----------|-----------|
[One row per rep from rep_leaderboard]

#### Top 20 Products
| Product | Revenue | Margin | Qty |
|---------|---------|--------|-----|
[One row per product]

#### KBB Pipeline
| Stage | Jobs | Quote Value | Weighted |
|-------|------|-------------|----------|
[One row per stage from kbb_pipeline]

#### Team
[Staff list with roles]

#### Key Observations
[3-5 bullet points highlighting notable trends, concerns, or achievements]
