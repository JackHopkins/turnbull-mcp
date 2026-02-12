---
name: morning-briefing
description: Generate a daily morning briefing combining risk alerts, sales performance, KBB pipeline, and expiring contracts across all data sources. Ideal for starting the day with a full picture of portfolio health.
---

# Morning Briefing

Generate a comprehensive daily briefing combining risk alerts, sales performance, KBB pipeline status, and contract renewals across all Turnbull data sources.

## Arguments

- `branch` (optional): Filter the entire briefing to a specific branch name. Omit for company-wide view.
- `date` (optional): The date to report on (YYYY-MM-DD). Defaults to today.

## Steps

1. Call `current_alerts` with limit: 15 to get the highest-severity unreviewed risk alerts
2. Call `overview_metrics` to get aggregate portfolio health (total credit balance, risky balance, open invoices, weighted DBT)
3. Call `risk_distribution` to get customer count and balance by risk rating
4. Call `mis_branch_comparison` with startDate as first of current month and endDate as today for month-to-date branch performance
5. Call `mis_top_customers` with startDate as first of current month and endDate as today, limit: 10, filtered by branch if provided
6. Call `mis_kbb_pipeline` filtered by branch if provided, for current KBB pipeline health
7. Call `mis_contracts_expiring` with daysAhead: 14, filtered by branch if provided, for imminent contract renewals
8. Call `mis_sales_trends` with startDate 30 days ago, endDate today, granularity: week, filtered by branch if provided

## Output Format

### Morning Briefing — [date]
**Scope:** [branch name or "All Branches"]

---

#### Risk Portfolio Health
| Metric | Value |
|--------|-------|
| Total Credit Balance | [from overview_metrics] |
| Risky Credit Balance | [risky_credit_balance] |
| Open Invoices | [open_invoices] |
| Weighted Avg DBT | [weighted_avg_days_beyond_terms] |

**Risk Distribution:**
| Rating | Customers | Balance |
|--------|-----------|---------|
[One row per rating from risk_distribution]

---

#### Priority Alerts (Unreviewed)
| Customer | Account | Rating | Score | Summary |
|----------|---------|--------|-------|---------|
[Top 10 alerts sorted by severity — flag any rating 5+ prominently]

---

#### Month-to-Date Sales Performance
| Branch | Revenue | Margin | Margin % | Customers | AOV |
|--------|---------|--------|----------|-----------|-----|
[Top 10 branches from branch_comparison, or single branch if filtered]

**Top 10 Customers MTD:**
| Customer | Revenue | Margin | Transactions |
|----------|---------|--------|--------------|
[From top_customers]

---

#### Weekly Revenue Trend (Last 4 Weeks)
| Week Starting | Revenue | Volume | Customers |
|---------------|---------|--------|-----------|
[From sales_trends]

---

#### KBB Pipeline
| Stage | Jobs | Quote Value | Weighted Value |
|-------|------|-------------|----------------|
[From kbb_pipeline]

---

#### Contracts Expiring This Fortnight
| Expiry Date | Customer | Contract | Products |
|-------------|----------|----------|----------|
[From contracts_expiring — flag any with 0 days remaining]

---

#### Action Items
[Prioritised list of 5-8 recommended actions based on the data above, combining risk alerts, sales opportunities, pipeline actions, and contract renewals]