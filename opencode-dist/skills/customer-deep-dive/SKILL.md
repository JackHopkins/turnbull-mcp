---
name: customer-deep-dive
description: Generate a 360-degree customer view combining MIS commercial data with risk profile data including lifetime value, product affinity, contracts, KBB activity, and event history.
---

# Customer Deep Dive

Generate a 360-degree customer view combining MIS commercial data with risk profile data.

## Arguments
- `accountNumber` (required): The customer account number

## Steps

1. Call `mis_customer_detail` with the account number for full MIS customer record
2. Call `customer_profile` with the account number for risk metrics (if available)
3. Call `mis_sales_summary` with the account number, period: year, last 3 years date range
4. Call `mis_customer_lifetime_value` with the account number for LTV metrics
5. Call `mis_customer_product_affinity` with the account number (limit: 20) for purchase patterns
6. Call `mis_customer_contracts` with the account number to see active contracts
7. Call `mis_customer_deals` with the account number to see special pricing
8. Call `mis_kbb_jobs` with the account number to see any KBB design activity
9. Call `mis_customer_contacts` with the account number for contact details
10. Call `mis_customer_events` with the account number for event participation

## Output Format

### [Customer Name] — 360 Customer View
**Account:** [accountNumber] | **Branch:** [branchName] | **Rep:** [repName]

#### Customer Profile
| Field | Value |
|-------|-------|
| Credit Terms | [creditTerms] |
| Credit Limit | [creditLimit] |
| On Stop | [onStop] |
| Risk Rating | [from customer_profile if available] |

#### Lifetime Value
| Metric | Value |
|--------|-------|
| Total Revenue | [total_revenue] |
| Total Margin | [total_margin] |
| Margin % | [margin_pct]% |
| Tenure | [tenure_months] months |
| Monthly Avg Revenue | [monthly_avg_revenue] |
| Transaction Count | [transaction_count] |

#### Annual Sales Trend
| Year | Revenue | COGS | Margin | Transactions |
|------|---------|------|--------|--------------|
[One row per year from sales_summary]

#### Top Products
| Product | Revenue | Qty | Last Purchased |
|---------|---------|-----|----------------|
[From product_affinity]

#### Active Contracts & Deals
[List contracts with dates and product counts]
[List deals with products and prices]

#### KBB Activity
[List any KBB jobs with status and values]

#### Contacts
[List contacts with email, phone, interests]

#### Event History
[List event participation]

#### Risk Assessment
[From customer_profile if available — risk score, rating, alerts]

#### Recommended Actions
[Specific actions based on the full picture]
