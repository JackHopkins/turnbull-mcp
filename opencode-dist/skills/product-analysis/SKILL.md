---
name: product-analysis
description: Analyze product performance including revenue, margin, customer adoption, top buyers, and monthly sales trends.
---

# Product Analysis

Analyze product performance including revenue, margin, and customer adoption.

## Arguments
- `productCode` (required): The product code to analyze
- `startDate` (optional): Start date (YYYY-MM-DD), defaults to 12 months ago
- `endDate` (optional): End date (YYYY-MM-DD), defaults to today

## Steps

1. Call `mis_product_detail` with the product code for full product information
2. Call `mis_transactions_by_product` with the product code and date range (limit: 2000) for sales data
3. Call `mis_margin_analysis` with groupBy: product, date range, limit: 1 — filtered context for this product's margin

## Output Format

### Product Analysis — [productCode]
**Description:** [description]
**Supplier:** [supplierName] | **Category:** [pac2] > [pac3]

#### Pricing
| Price Type | Amount |
|------------|--------|
| List Price | [listPrice] |
| Cost Price | [costPrice] |
| Sale Price | [salePrice or N/A] |
| Standard Margin | [calculated from list - cost] |

#### Sales Performance ([startDate] to [endDate])
| Metric | Value |
|--------|-------|
| Total Revenue | [sum of sales_amount] |
| Total COGS | [sum of cogs_amount] |
| Gross Margin | [revenue - COGS] |
| Margin % | [margin_pct]% |
| Units Sold | [sum of quantity] |
| Transaction Count | [count] |
| Unique Customers | [distinct customer count] |

#### Top Customers for This Product
| Customer | Account | Revenue | Qty |
|----------|---------|---------|-----|
[Top 10 customers by revenue from transaction data]

#### Monthly Trend
| Month | Revenue | Qty | Customers |
|-------|---------|-----|-----------|
[Monthly aggregation from transaction data]

#### Observations
[Key insights about the product's performance, customer concentration, trend direction]
