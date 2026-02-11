# Common Workflow Patterns

## Full Customer Review
When asked to review a customer, follow this sequence:

1. `customer_profile` - Get complete metrics snapshot
2. `customer_alerts_history` - Recent risk alerts
3. `debtor_days` - Aged debtor analysis trends
4. `transaction_history` - Recent trading activity
5. `payment_history` - Payment behavior
6. `customer_intelligence` - Field notes from reps
7. `company_profile` - Companies House status (if company_number available)
8. `analyze_customer_risk` - AI-generated narrative

Present the review as:
- Summary header (name, account, rating, key metrics)
- Risk assessment section
- Financial overview section
- Recent activity section
- Field intelligence section
- Recommended actions

## Daily Risk Triage
For morning risk review:

1. `current_alerts` (limit: 20) - Unreviewed alerts by severity
2. `overview_metrics` - Portfolio health snapshot
3. `risk_distribution` - Rating distribution across portfolio
4. `portfolio_summary` - AI-generated portfolio analysis

Present as a dashboard-style summary.

## Customer Comparison
When comparing customers:

1. `customer_profile` for each customer
2. `compare_customers` with all account numbers
3. Present side-by-side table of key metrics

## Overdue Follow-up
For payment chase prioritization:

1. `customer_list` sorted by `days_beyond_terms` DESC
2. For top customers: `outstanding_invoices` + `payment_history`
3. Check `customer_intelligence` for recent contact
4. Prioritize by: amount * days beyond terms (exposure-weighted)

## New Customer Onboarding Check
For newly onboarded customers:

1. `customer_profile` - Basic info and initial metrics
2. `company_profile` - Companies House check
3. `company_officers` - Director information
4. `ccj_records` - Any CCJs
5. `company_filings` - Recent filing activity

## Multi-Tool Best Practices

- Always call `customer_profile` first for any customer-specific query
- Use account numbers consistently (not customer IDs)
- When querying TARMS data (financial tools), allow for slightly longer response times due to SSH tunnel
- Cache-friendly: repeated queries within TTL windows return instantly
- For portfolio-level queries, use `customer_list` with filters rather than querying individual customers
