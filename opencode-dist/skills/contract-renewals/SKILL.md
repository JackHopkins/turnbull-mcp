---
name: contract-renewals
description: Generate a contract renewal pipeline report showing expiring contracts with customer details, revenue history, and risk flags.
---

# Contract Renewals

Generate a contract renewal pipeline report with risk flags.

## Arguments
- `daysAhead` (optional): Number of days ahead to look for expiring contracts, defaults to 60
- `branchName` (optional): Filter by branch name

## Steps

1. Call `mis_contracts_expiring` with daysAhead and optional branch filter to get the renewal pipeline
2. For each expiring contract (up to 10), call `mis_customer_detail` with the account number
3. For each expiring contract (up to 10), call `mis_sales_summary` with the account number, period: year, last 12 months
4. If risk data is available, call `customer_profile` for each account to get risk ratings

## Output Format

### Contract Renewal Pipeline
**Looking ahead:** [daysAhead] days | **Branch:** [branchName or "All"]

#### Summary
| Metric | Value |
|--------|-------|
| Contracts Expiring | [count] |
| Total Products Covered | [sum of product_counts] |
| Customers Affected | [distinct customer count] |

#### Renewal Pipeline
| Expiry | Customer | Contract | Products | 12m Revenue | Risk |
|--------|----------|----------|----------|-------------|------|
[One row per expiring contract, sorted by expiry date]

#### Priority Actions
**Immediate (< 14 days):**
[List contracts expiring within 14 days with customer details]

**This Month:**
[List contracts expiring within 30 days]

**Next Month:**
[List remaining contracts]

#### Risk Flags
[Highlight any high-risk customers, declining revenue, or large contracts needing attention]

#### Recommended Actions
[Specific renewal strategies based on customer value and risk]
