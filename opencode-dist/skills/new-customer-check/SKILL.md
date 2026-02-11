---
name: new-customer-check
description: Perform a due diligence check on a newly onboarded customer or prospect using risk profile, Companies House data, officers, CCJs, and early trading patterns.
---

# New Customer Check

Perform a due diligence check on a newly onboarded customer or prospect.

## Arguments
- `accountNumber` (required): The customer account number to check
- `companyNumber` (optional): Direct Companies House number if known

## Steps

1. Call `customer_profile` with the account number
2. If company_number is available (from profile or argument):
   a. Call `company_profile` with companyNumber
   b. Call `company_officers` with companyNumber
   c. Call `ccj_records` with companyNumber
   d. Call `company_filings` with companyNumber (limit: 10)
3. Call `customer_metric_history` with metricType: "risk_rating" and days: 90 to check initial risk trajectory
4. Call `transaction_history` with days: 90 to see early trading pattern

## Output Format

### New Customer Due Diligence - [Customer Name]
**Account:** [accountNumber] | **Opened:** [accountSince] | **Branch:** [branch]

#### Customer Profile
| Field | Value |
|-------|-------|
| Credit Limit | [creditLimit] |
| Credit Terms | [creditTerms] |
| Account Manager | [accountManagerName] |
| Risk Rating | [risk_rating] |

#### Companies House Check
[If company data available:]
- **Company:** [company_name] ([company_number])
- **Status:** [company_status]
- **Type:** [company_type]
- **Incorporated:** [incorporation_date]
- **SIC Codes:** [sic_codes]
- **Insolvency History:** [has_insolvency_history]
- **Charges:** [has_charges]
- **Registered Address:** [full address]

#### Directors & Officers
[List of current officers with roles and appointment dates]

#### CCJ Check
[List any CCJs or confirm none found]

#### Recent Filings
[List last 5 filings with dates and types]

#### Early Trading Activity
[Summary of first transactions if any]

#### Risk Assessment
- **Overall Risk Level:** [assessment]
- **Key Concerns:** [bullet points]
- **Credit Limit Recommendation:** [based on analysis]
- **Recommended Actions:** [specific next steps]
