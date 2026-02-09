# Turnbull Company Context

## About Turnbull
Turnbull is a building materials distributor operating through multiple branches across the UK. The company sells to trade customers (builders, contractors, construction companies) on credit accounts managed through the Kerridge ERP system.

## Data Systems

### TARMS (MySQL)
- Source: Kerridge ERP via CSV export
- Contains: Transactions, invoices, payments, debtor days, credit status, outstanding orders, payment plans
- Account numbers are the primary customer identifier (e.g., "ABC001")
- Transaction types: "SL" = Sales Ledger (the main transaction type)

### Customer Risk Profile Database (PostgreSQL)
- Source: ML pipeline processing TARMS data
- Contains: Customer profiles, risk events, alerts, metrics, Companies House data
- The materialized view `mv_customer_metrics` is the single source of truth for customer data
- Risk ratings are 1-6 (A-F): 1/A = lowest risk, 6/F = critical

### Brevo + SES
- Used for email notifications: risk alerts, missing info requests, activity reports
- Brevo handles template-based transactional emails
- AWS SES handles pipeline-generated reports

## Data Dictionary

### Account Number Format
- Alphanumeric codes like "ABC001", "XYZ123"
- This is the primary business identifier for customers

### Risk Rating Scale
| Numeric | Letter | Description |
|---------|--------|-------------|
| 1 | A | Lowest risk |
| 2 | B | Low risk |
| 3 | C | Moderate risk |
| 4 | D | Elevated risk |
| 5 | E | High risk |
| 6 | F | Critical risk |
| -1 | N/A | Unrated (prospects) |

### Metric Types
Available in `customer_metric_history`:
- `risk_rating` - ML risk rating (1-6)
- `risk_score` - Raw ML score (0-1)
- `transaction_volume` - Monthly transaction total
- `ytd_transaction_volume` - Year-to-date transactions
- `running_balance` - Current outstanding balance
- `credit_usage` - Balance / Credit limit percentage
- `days_beyond_terms` - Days past agreed terms
- `weighted_days_beyond_terms` - Balance-weighted DBT
- `remaining_invoice_balance` - Unpaid invoice total
- `allocated_transaction_volume` - Allocated (matched) transactions
- `on_stop_status` - Stop status flag
- `experian_credit_limit` - Experian-derived credit limit
- `experian_credit_score` - Experian credit score

### Alert Ratings
Alerts use the letter rating (A-F) and include:
- `score`: ML risk score (0-1)
- `feature_data`: JSON with input features
- `explanation`: Full text explanation
- `explanation_summary`: Brief summary
- `action`: Reviewer action taken (null = unreviewed)
