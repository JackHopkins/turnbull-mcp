# Daily Risk Report

Generate a daily risk portfolio summary for the credit control team.

## Arguments
- `branch` (optional): Filter to a specific branch

## Steps

1. Call `current_alerts` (limit: 30) to get unreviewed alerts sorted by severity
2. Call `overview_metrics` to get aggregate portfolio health metrics
3. Call `risk_distribution` (with branch filter if provided) to get rating breakdown
4. Call `portfolio_summary` (with branch filter if provided) for AI analysis

## Output Format

### Daily Risk Report - [Date]
[Branch filter note if applicable]

#### Portfolio Health
| Metric | Value |
|--------|-------|
| Total Credit Balance | [from overview_metrics] |
| Risky Credit Balance | [risky_credit_balance] |
| Total Days Beyond Terms | [days_beyond_terms] |
| Open Invoices | [open_invoices] |
| Weighted Avg DBT | [weighted_avg_days_beyond_terms] |

#### Risk Distribution
| Rating | Count | Total Balance | Avg DBT |
|--------|-------|---------------|---------|
[One row per rating from risk_distribution]

#### Unreviewed Alerts (Top Priority)
[List top 10 alerts with: customer name, account, rating, score, summary]

#### AI Portfolio Analysis
[From portfolio_summary]

#### Action Items
[Prioritized list of recommended actions based on the data]
