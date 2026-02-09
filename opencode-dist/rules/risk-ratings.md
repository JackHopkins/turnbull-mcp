# Risk Rating Interpretation Guide

## Rating Calculation

The risk rating is calculated from an ML classifier output combined with business rule modifiers:

1. **Base Score** (ML classifier output, 0-1):
   - Score < 0.5 -> Base rating 1
   - Score 0.5-0.8 -> Base rating 2
   - Score >= 0.8 -> Base rating 3

2. **Balance Check**:
   - If running balance <= 200 -> Override to rating 1 (low exposure, low risk)

3. **Modifiers** (each adds +1 to rating):
   - Running balance exceeds insurance limit
   - Running balance exceeds credit limit
   - Days beyond terms > 0
   - No payments made on account
   - Sales anomaly detected (z-score > 3)

4. **Critical Override**:
   - Overdue invoices in first month of account -> Rating 6 (F)

5. **Cap**: Maximum rating is 6

## When to Escalate

### Immediate Escalation (Rating 5-6 / E-F)
- Contact credit control manager
- Consider placing account on stop
- Review insurance coverage
- Check for CCJs or insolvency signals via Companies House

### Enhanced Monitoring (Rating 3-4 / C-D)
- Weekly balance review
- Monitor payment patterns
- Request field intelligence from reps
- Check for credit limit adequacy

### Routine (Rating 1-2 / A-B)
- Monthly review cycle
- Standard credit terms
- No special action needed

## Insurance Limit Significance

The insurance limit represents the maximum trade credit insurance coverage for a customer. When running balance exceeds this:
- Turnbull carries uninsured exposure
- This is a significant risk factor
- Should prompt credit limit review
- May require additional guarantees

## Key Warning Signs

1. **Deteriorating payment pattern**: Days beyond terms increasing over 3+ months
2. **Balance exceeding limits**: Credit or insurance limit breaches
3. **Companies House signals**: New CCJs, insolvency flags, director resignations
4. **Transaction volume spike**: Unusual increase in ordering (potential front-running default)
5. **No field intelligence**: Customer going quiet, not returning calls
6. **On-stop history**: Repeated on-stop events suggest chronic issues
