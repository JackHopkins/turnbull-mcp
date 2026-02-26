---
name: audit
description: Verify every claim, number, and inference from this conversation by re-querying source tools, running arithmetic checks via code, and producing a cited audit report with confidence scoring.
---

# Conversation Audit

Systematically verify every factual claim made by the assistant during this conversation. Re-query source tools, execute arithmetic checks in code, and produce a structured audit report with verdicts and confidence scoring.

## Arguments

- `scope` (optional): Limit the audit to a specific section of the conversation (e.g. "the customer review for ABC001", "the KBB pipeline section"). Omit for a full conversation audit.
- `strict` (optional): When true, treat UNVERIFIABLE claims as failures in the confidence score. Default: false.

## Steps

### 1. Extract claims

Scan every assistant message in the conversation (or the scoped section). Extract each discrete factual claim into a numbered list. A "claim" is any of:

- **Data point**: a specific number, name, date, or value attributed to a source (e.g. "ABC001 has a risk rating of D")
- **Aggregation**: a sum, average, count, or total (e.g. "total risky balance is £142,300")
- **Comparison**: a relative statement (e.g. "Branch North outperformed Branch South by 12%")
- **Trend**: a directional statement (e.g. "revenue increased week-on-week for the last 3 weeks")
- **Ranking**: an ordered list (e.g. "the top 3 customers by revenue are...")
- **Inference**: a conclusion drawn from data (e.g. "this suggests seasonal demand is declining")

For each claim, record:
- **Claim text**: the exact quote from the assistant message
- **Claim type**: one of the types above
- **Likely source tool**: the MCP tool that would have provided this data (see mapping table in Step 2)

### 2. Map claims to source tools

Use this reference table to identify which tool to re-query for verification:

| Data domain | Verification tool(s) |
|-------------|---------------------|
| Customer profile, rating, DBT, balance | `customer_profile` |
| Customer list, sorting, filtering | `customer_list` |
| Risk distribution (by rating) | `risk_distribution` |
| Portfolio overview metrics | `overview_metrics` |
| Risk alerts | `current_alerts` |
| AI portfolio summary | `portfolio_summary` |
| Sales revenue, margin, volume | `mis_sales_summary` |
| Top customers by sales | `mis_top_customers` |
| Branch comparison | `mis_branch_comparison` |
| Sales trends over time | `mis_sales_trends` |
| Product analysis | `mis_product_analysis` |
| KBB pipeline (jobs, quotes) | `mis_kbb_pipeline` |
| KBB search/jobs | `kbb_search_jobs` |
| Contract renewals / expiry | `mis_contracts_expiring` |
| Overdue invoices | `mis_overdue_invoices` |
| Brevo contacts | `brevo_get_contacts`, `brevo_get_contact_info` |
| Brevo deals | `brevo_get_deals`, `brevo_get_deal` |
| Brevo campaigns | `brevo_get_email_campaigns`, `brevo_get_campaign` |
| Brevo email activity | `brevo_get_transac_emails` |

Group claims that share the same tool call (same tool + same parameters) to minimize redundant queries.

### 3. Re-query source tools

For each unique tool + parameter combination identified in Step 2:

1. Call the tool with the **same parameters** that were used (or would have been used) in the original conversation
2. Store the fresh result
3. Compare the fresh data against every claim mapped to this tool call

**Important:** Do NOT rely on conversation memory or cached results. Always make fresh tool calls to get current data.

### 4. Run arithmetic verification

For every claim involving a calculation (sums, averages, percentages, rankings, growth rates, comparisons):

1. Write a code block (Python or JavaScript) that:
   - Accepts the raw data from the re-queried tool results
   - Performs the exact calculation described in the claim
   - Compares the calculated result to the claimed value
   - Outputs PASS or FAIL with both values

**Do NOT do mental math — always use code.** This is the primary failure mode the audit addresses. Every arithmetic claim must have a corresponding executed code block.

Example:
```python
# Verify: "total risky balance is £142,300"
risky_ratings = ['D', 'E', 'F']
risky_customers = [c for c in data if c['risk_rating'] in risky_ratings]
calculated_total = sum(c['running_balance'] for c in risky_customers)
claimed_total = 142300
print(f"Calculated: £{calculated_total:,.2f}")
print(f"Claimed:    £{claimed_total:,.2f}")
print(f"Result:     {'PASS' if abs(calculated_total - claimed_total) < 0.01 else 'FAIL'}")
```

### 5. Classify each claim

Assign one of these 6 verdicts to every extracted claim:

| Verdict | Meaning | Criteria |
|---------|---------|----------|
| VERIFIED | Matches source data exactly | Fresh tool data confirms the claim precisely |
| MINOR DISCREPANCY | Close but not exact | Difference is due to rounding, formatting, or display precision (e.g. £142,300 vs £142,299.87) |
| DISCREPANCY | Contradicts source data | Fresh tool data shows a different value than claimed |
| CALCULATION ERROR | Arithmetic is wrong | Code execution proves the calculation does not match raw data |
| STALE DATA | Data changed since original query | Fresh data differs from original, but the original claim was likely correct at query time |
| UNVERIFIABLE | Cannot be verified | Subjective inference, no matching source tool, or claim is an opinion/recommendation |

### 6. Compute confidence score

Calculate the overall confidence score:

```
confidence = (VERIFIED + 0.8 * MINOR_DISCREPANCY) / (total - UNVERIFIABLE) * 100
```

Where each term is the count of claims with that verdict.

If `strict` mode is enabled, UNVERIFIABLE claims are NOT excluded from the denominator.

Apply these thresholds:

| Score | Rating |
|-------|--------|
| >= 95% | HIGH |
| >= 80% | MEDIUM |
| < 80% | LOW |

## Output Format

### Audit Report — [date]

**Scope:** [scoped section or "Full Conversation"]
**Claims extracted:** [N]
**Confidence score:** [X%] — [HIGH/MEDIUM/LOW]

---

#### Summary

| Verdict | Count | % |
|---------|-------|---|
| VERIFIED | [n] | [%] |
| MINOR DISCREPANCY | [n] | [%] |
| DISCREPANCY | [n] | [%] |
| CALCULATION ERROR | [n] | [%] |
| STALE DATA | [n] | [%] |
| UNVERIFIABLE | [n] | [%] |

---

#### Verified Claims

| # | Claim | Source Tool | Verdict |
|---|-------|------------|---------|
| 1 | [brief claim text] | `tool_name` — field | VERIFIED |
| ... | ... | ... | ... |

---

#### Issues Found

For each DISCREPANCY, CALCULATION ERROR, or STALE DATA:

> **Claim #[N]:** "[exact claim quote]"
>
> **Verdict:** [DISCREPANCY / CALCULATION ERROR / STALE DATA]
>
> **Source:** `tool_name` — [specific field or parameter]
>
> **Expected (from source):** [actual value from fresh tool call]
>
> **Reported (in conversation):** [value stated in the claim]
>
> **Verification:**
> ```python
> # [code that verified this claim]
> ```
> **Code output:** [PASS/FAIL with values]
>
> **Impact:** [HIGH — affects key decision / MEDIUM — misleading but not critical / LOW — cosmetic]

---

#### Minor Discrepancies

| # | Claim | Reported | Actual | Difference | Likely Cause |
|---|-------|----------|--------|------------|-------------|
| [n] | [brief text] | [value] | [value] | [delta] | Rounding / Formatting / Display |

---

#### Unverifiable Claims

| # | Claim | Reason |
|---|-------|--------|
| [n] | [brief text] | [Subjective inference / No source tool / Recommendation] |

---

#### Corrections

If any DISCREPANCY or CALCULATION ERROR was found, provide corrected statements:

> **Original:** "[incorrect claim]"
> **Corrected:** "[corrected statement]" — *Source: `tool_name` — field*

---

#### Audit Metadata

| Metric | Value |
|--------|-------|
| Total claims extracted | [N] |
| Tool calls made | [N] |
| Code blocks executed | [N] |
| Confidence score | [X%] ([RATING]) |
| Audit scope | [scope or "Full Conversation"] |
| Strict mode | [Yes/No] |
