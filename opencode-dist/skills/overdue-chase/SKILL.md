# Overdue Chase

Generate a prioritized list of overdue customers for payment chasing.

## Arguments
- `branch` (optional): Filter to a specific branch
- `minDays` (optional): Minimum days beyond terms (default: 1)

## Steps

1. Call `customer_list` with sortBy: "days_beyond_terms", sortOrder: "DESC", limit: 30, and branch filter if provided
2. For the top 10 customers by days beyond terms:
   a. Call `outstanding_invoices` to get unpaid invoice details
   b. Call `payment_history` (days: 90) to check recent payment activity
   c. Call `customer_intelligence` (limit: 3) to check for recent contact
3. Calculate chase priority: running_balance * days_beyond_terms for each customer

## Output Format

### Overdue Chase List - [Date]
[Branch filter note if applicable]

#### Chase Priority Queue

For each customer (sorted by priority score):

**[Priority #] - [Customer Name] ([accountNumber])**
- Balance: [running_balance] | DBT: [days_beyond_terms] days | Priority Score: [calculated]
- Credit Limit: [creditLimit] | Insurance Limit: [insurance_limit]
- Outstanding Invoices: [count] totalling [sum of remaining_balance]
- Oldest Unpaid Invoice: [date] - [amount]
- Last Payment: [date] - [amount] (or "No recent payments")
- Last Contact: [from intelligence, or "No recent intelligence"]
- **Suggested Action**: [Based on pattern analysis]

#### Summary Statistics
- Total overdue customers: [count]
- Total overdue balance: [sum]
- Average days beyond terms: [avg]
- Customers with no recent payment: [count]
