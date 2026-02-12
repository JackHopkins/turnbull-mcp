---
name: designer-review
description: Generate a KBB designer performance scorecard with targets vs actuals, conversion rates, revenue, and lost job analysis.
---

# Designer Review

Generate a KBB designer performance scorecard.

## Arguments
- `designerId` (required): The designer ID to review
- `period` (optional): Period in YYYY-MM format, defaults to current month
- `startDate` (optional): Start date for performance window (YYYY-MM-DD), defaults to 12 months ago
- `endDate` (optional): End date for performance window (YYYY-MM-DD), defaults to today

## Steps

1. Call `mis_kbb_designer_targets` with the designer ID and period for targets vs actuals
2. Call `mis_kbb_designer_performance` with the designer ID and date range for overall metrics
3. Call `mis_kbb_jobs` with the designer ID (limit: 50) to see recent jobs
4. Call `mis_kbb_lost_analysis` with the date range filtered by designer ID for lost job reasons

## Output Format

### [Designer Name] — Performance Scorecard
**Period:** [startDate] to [endDate]

#### Monthly Targets vs Actuals ([period])
| Metric | Target | Actual | % Achievement |
|--------|--------|--------|---------------|
| Quotes | [quoteTarget] | [actual_quotes] | [%] |
| Sales Revenue | [saleTarget] | [actual_sales] | [%] |
| Margin | [marginTarget] | [actual_margin] | [%] |

#### Overall Performance
| Metric | Value |
|--------|-------|
| Total Jobs | [total_jobs] |
| Won | [won_jobs] |
| Lost | [lost_jobs] |
| Open Quotes | [open_quotes] |
| Conversion Rate | [conversion_rate]% |
| Total Revenue | [total_revenue] |
| Total Margin | [total_margin] |
| Avg Sale Value | [avg_sale_value] |

#### Recent Jobs
| Order | Status | Customer | Quote Value | Sale Value |
|-------|--------|----------|-------------|------------|
[Last 20 jobs]

#### Lost Job Analysis
| Reason | Count | Total Value |
|--------|-------|-------------|
[From lost analysis]

#### Coaching Notes
[Observations and recommendations based on the data]
