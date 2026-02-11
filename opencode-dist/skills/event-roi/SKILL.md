---
name: event-roi
description: Analyze event return on investment including registration rates, reward payouts, revenue uplift for registered customers, and ROI calculations.
---

# Event ROI

Analyze event return on investment including revenue lift, registration rates, and reward payouts.

## Arguments
- `eventId` (required): The event ID to analyze

## Steps

1. Call `mis_events_list` (includeArchived: true) to find the event details
2. Call `mis_event_registrations` with the event ID to get all registrations with contacts
3. Call `mis_event_rewards` with the event ID to get reward calculations and payment status
4. For registered customers (up to 10), call `mis_sales_summary` with account number, period: month, covering the event period vs prior period

## Output Format

### Event ROI Analysis — [Event Name]
**Type:** [eventType] | **Period:** [startDate] to [endDate]

#### Registration Summary
| Metric | Value |
|--------|-------|
| Total Registrations | [count] |
| Confirmed | [confirmed count] |
| Targets/Invited | [target count] |
| Linked Accounts | [count with customer] |

#### Reward Summary
| Metric | Value |
|--------|-------|
| Total Rewards Calculated | [sum of calculatedAmount] |
| Rewards Paid | [sum where status=paid] |
| Rewards Pending | [sum where status=pending] |
| Avg Reward per Customer | [average] |

#### Top Reward Earners
| Customer | Contact | Calculated | Status |
|----------|---------|------------|--------|
[Top 10 by reward amount]

#### Revenue Impact (Sample of Registered Customers)
| Customer | Pre-Event Revenue | During-Event Revenue | Uplift |
|----------|------------------|---------------------|--------|
[Compare monthly revenue for sample customers]

#### ROI Summary
| Metric | Value |
|--------|-------|
| Total Reward Cost | [total paid + pending] |
| Estimated Revenue Uplift | [from sample extrapolation] |
| ROI Multiple | [uplift / cost] |

#### Key Findings
[3-5 bullet points on event effectiveness, customer engagement, and recommendations for future events]
