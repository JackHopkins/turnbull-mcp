---
name: dashboard
description: Generate a self-contained HTML dashboard from conversation data with AG Grid tables, Plotly charts, and Bootstrap 5 LUX styling. Opens directly in any browser — no backend required.
---

# Dashboard Generator

Generate a self-contained static HTML dashboard from data already gathered during this conversation via MCP tool calls. The output is a single `.html` file that opens directly in any browser with no backend, no Python, and no dependencies beyond CDN resources.

## Arguments

- `title` (optional): Dashboard title. If omitted, derive from the data topic (e.g. "Brevo Deals Pipeline", "Risk Portfolio Overview").
- `filename` (optional): Output filename. Default: `{topic-slug}-{YYYY-MM-DD}.html` (e.g. `risk-portfolio-2026-02-26.html`).

## Steps

### 1. Inventory conversation data

Scan this conversation for all tool call results that returned structured data (arrays of objects, tables, metrics). For each dataset note:
- Source tool name and call description
- Column names and data types (string, number, date, boolean)
- Row count
- Whether it contains single-value metrics vs multi-row tabular data

If **no structured data** is found in the conversation, stop and tell the user:
> "I don't see any data in our conversation yet. Please gather data first using the available MCP tools (e.g. `current_alerts`, `mis_branch_comparison`, `brevo_get_deals`), then run `/dashboard` again."

### 2. Plan visualizations

Apply these decision rules to each dataset:

| Data shape | Visualization |
|-----------|---------------|
| Single-value metrics (1-8 values) | KPI cards in a row (`col-md-3` grid) |
| Category column + numeric column | Bar chart (Plotly) |
| Date/time column + numeric column | Line chart (Plotly) |
| Date column + numeric column + category column | Multi-line chart (Plotly, one trace per category) |
| Two numeric columns | Scatter plot (Plotly) |
| Any multi-row dataset (>1 row) | AG Grid table — **always** rendered below any charts for that dataset |

Additional rules:
- If there are **>3 distinct datasets**, group them into Bootstrap nav-tabs (one tab per dataset or logical group)
- If there are **<=3 datasets**, render them all on a single scrollable page
- If a dataset has **>500 rows**, add a note above the table: "Showing all N rows — consider filtering or aggregating for faster load"
- **Skip empty datasets** — don't render empty charts or tables

### 3. Generate the HTML file

Build a complete self-contained HTML file using the template below. Inline all data as JavaScript constants (`const DATA_0 = [...]`). Do not use any external data files.

### 4. Save the file

Write the HTML file to the current working directory using the naming convention:
`{topic-slug}-{YYYY-MM-DD}.html`

Report the full file path to the user.

### 5. Offer daily regeneration

Ask the user:
> "Would you like me to set up a daily cronjob to regenerate this dashboard? It would re-run the same MCP queries and rebuild the HTML file each morning."

If yes, use the scheduler plugin to configure it.

---

## HTML Template

Use the following structure as the base. Replace all `{{placeholders}}` with actual values. The template uses CDN-hosted libraries so the file works standalone.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{DASHBOARD_TITLE}}</title>

  <!-- Bootstrap 5 LUX theme -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootswatch@5/dist/lux/bootstrap.min.css">

  <!-- AG Grid Community -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ag-grid-community/styles/ag-grid.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ag-grid-community/styles/ag-theme-quartz.css">
  <script src="https://cdn.jsdelivr.net/npm/ag-grid-community/dist/ag-grid-community.min.noStyle.js"></script>

  <!-- Plotly.js -->
  <script src="https://cdn.plot.ly/plotly-2.35.0.min.js"></script>

  <style>
    body { background: #f8f9fa; }
    .kpi-card { text-align: center; padding: 1.5rem 1rem; }
    .kpi-value { font-size: 2rem; font-weight: 700; color: #1a1a2e; }
    .kpi-label { font-size: 0.85rem; color: #6c757d; text-transform: uppercase; letter-spacing: 0.05em; }
    .chart-container { min-height: 320px; }
    .ag-theme-quartz { width: 100%; }
  </style>
</head>
<body>
  <div class="container-fluid py-4">

    <!-- Header -->
    <div class="card shadow-sm border-0 mb-4">
      <div class="card-body">
        <h3 class="mb-1">{{DASHBOARD_TITLE}}</h3>
        <p class="text-muted mb-0">Generated {{GENERATION_DATE}} &middot; {{ROW_SUMMARY}}</p>
      </div>
    </div>

    <!-- KPI Cards (for single-value metrics) -->
    <!-- Render one row of cards per metric group -->
    <div class="row g-3 mb-4">
      <!-- Repeat for each KPI -->
      <div class="col-md-3">
        <div class="card shadow-sm border-0">
          <div class="card-body kpi-card">
            <div class="kpi-value">{{KPI_VALUE}}</div>
            <div class="kpi-label">{{KPI_LABEL}}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts (one row per chart, or two per row for bar+line combos) -->
    <div class="row g-3 mb-4">
      <div class="col-md-6">
        <div class="card shadow-sm border-0">
          <div class="card-body">
            <div id="chart-0" class="chart-container"></div>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card shadow-sm border-0">
          <div class="card-body">
            <div id="chart-1" class="chart-container"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- AG Grid Tables (one card per dataset) -->
    <div class="card shadow-sm border-0 mb-4">
      <div class="card-body">
        <h5 class="mb-3">{{TABLE_TITLE}}</h5>
        <div id="grid-0" class="ag-theme-quartz" style="height: 500px;"></div>
      </div>
    </div>

    <!-- Tabbed layout (use ONLY when >3 datasets) -->
    <!--
    <ul class="nav nav-tabs mb-3" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-0" type="button" role="tab">Tab 0</button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-1" type="button" role="tab">Tab 1</button>
      </li>
    </ul>
    <div class="tab-content">
      <div class="tab-pane fade show active" id="tab-0" role="tabpanel">
        Content for tab 0
      </div>
      <div class="tab-pane fade" id="tab-1" role="tabpanel">
        Content for tab 1
      </div>
    </div>
    -->

  </div>

  <!-- Bootstrap JS (needed for tabs) -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5/dist/js/bootstrap.bundle.min.js"></script>

  <script>
    // ============================================================
    // DATA — inline all datasets as JS constants
    // ============================================================
    // const DATA_0 = [ {col1: "val", col2: 123}, ... ];
    // const DATA_1 = [ ... ];

    // ============================================================
    // AG GRID SETUP
    // ============================================================
    // Column definition rules:
    //
    // Money columns:
    //   valueFormatter: p => p.value == null ? '' : '£' + p.value.toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2})
    //
    // Percentage columns:
    //   valueFormatter: p => p.value == null ? '' : (p.value * 100).toFixed(0) + '%'
    //
    // Date columns:
    //   valueFormatter: p => p.value ? new Date(p.value).toISOString().split('T')[0] : ''
    //
    // First text column:     pinned: 'left', minWidth: 220
    // Grand Total column:    pinned: 'right'
    // __* columns:           hide: true
    //
    // Example grid initialization:
    //
    // const gridOptions0 = {
    //   rowData: DATA_0,
    //   columnDefs: [
    //     { field: 'name', pinned: 'left', minWidth: 220, sortable: true, filter: true, resizable: true },
    //     { field: 'amount', sortable: true, filter: true, resizable: true, type: 'numericColumn',
    //       valueFormatter: p => p.value == null ? '' : '£' + p.value.toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2}) },
    //     { field: 'Grand Total', pinned: 'right', sortable: true, filter: true, resizable: true, type: 'numericColumn',
    //       valueFormatter: p => p.value == null ? '' : '£' + p.value.toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2}) },
    //     { field: '__internal', hide: true }
    //   ],
    //   defaultColDef: {
    //     flex: 1,
    //     minWidth: 110,
    //     floatingFilter: true,
    //     wrapText: true,
    //     autoHeight: true,
    //     sortable: true,
    //     filter: true,
    //     resizable: true
    //   },
    //   pagination: true,
    //   paginationPageSize: 50,
    //   animateRows: true
    // };
    // agGrid.createGrid(document.querySelector('#grid-0'), gridOptions0);

    // ============================================================
    // PLOTLY CHARTS
    // ============================================================
    // Plotly layout matching the Brevo dashboard style_fig():
    //
    // const LAYOUT_BASE = {
    //   template: 'plotly_white',
    //   margin: { l: 40, r: 10, t: 40, b: 40 },
    //   height: 320,
    //   paper_bgcolor: 'white',
    //   plot_bgcolor: 'white',
    //   font: { size: 12 },
    //   legend: {
    //     orientation: 'h',
    //     yanchor: 'bottom',
    //     y: 1.02,
    //     xanchor: 'right',
    //     x: 1,
    //     title: { text: '' }
    //   },
    //   xaxis: { showgrid: false, zeroline: false },
    //   yaxis: { zeroline: false, separatethousands: true }
    // };
    //
    // Bar chart example:
    // Plotly.newPlot('chart-0', [{
    //   x: DATA_0.map(d => d.category),
    //   y: DATA_0.map(d => d.value),
    //   type: 'bar',
    //   marker: { color: '#4361ee' }
    // }], { ...LAYOUT_BASE, title: { text: 'Chart Title', x: 0.02, xanchor: 'left' } });
    //
    // Line chart example:
    // Plotly.newPlot('chart-1', [{
    //   x: DATA_1.map(d => d.date),
    //   y: DATA_1.map(d => d.value),
    //   type: 'scatter',
    //   mode: 'lines+markers',
    //   name: 'Series',
    //   line: { width: 2 }
    // }], { ...LAYOUT_BASE, title: { text: 'Trend', x: 0.02, xanchor: 'left' } });
    //
    // Multi-line chart (one trace per category):
    // const categories = [...new Set(DATA_2.map(d => d.category))];
    // const traces = categories.map(cat => ({
    //   x: DATA_2.filter(d => d.category === cat).map(d => d.date),
    //   y: DATA_2.filter(d => d.category === cat).map(d => d.value),
    //   type: 'scatter',
    //   mode: 'lines+markers',
    //   name: cat
    // }));
    // Plotly.newPlot('chart-2', traces, { ...LAYOUT_BASE, title: { text: 'By Category', x: 0.02, xanchor: 'left' } });
    //
    // Scatter plot example:
    // Plotly.newPlot('chart-3', [{
    //   x: DATA_3.map(d => d.metric_a),
    //   y: DATA_3.map(d => d.metric_b),
    //   type: 'scatter',
    //   mode: 'markers',
    //   marker: { size: 8, color: '#4361ee' }
    // }], { ...LAYOUT_BASE, title: { text: 'Scatter', x: 0.02, xanchor: 'left' } });
  </script>
</body>
</html>
```

## Column Definition Rules (reference)

When building `columnDefs` for AG Grid, apply these rules to each column:

| Column pattern | AG Grid config |
|---------------|----------------|
| Money values (amount, revenue, balance, value, total with currency) | `type: 'numericColumn'`, `valueFormatter: p => p.value == null ? '' : '£' + p.value.toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2})` |
| Percentage values (rate, %, conversion, ratio) | `valueFormatter: p => p.value == null ? '' : (p.value * 100).toFixed(0) + '%'` |
| Date values (date, created, updated, expiry) | `valueFormatter: p => p.value ? new Date(p.value).toISOString().split('T')[0] : ''` |
| First text/name column in the dataset | `pinned: 'left'`, `minWidth: 220` |
| Column named "Grand Total" | `pinned: 'right'` |
| Columns starting with `__` | `hide: true` |
| All other columns | `sortable: true`, `filter: true`, `resizable: true`, `minWidth: 110` |

## Plotly Layout Reference

Match the `style_fig()` function from the Brevo dashboard:

```javascript
const LAYOUT_BASE = {
  template: 'plotly_white',
  margin: { l: 40, r: 10, t: 40, b: 40 },
  height: 320,
  paper_bgcolor: 'white',
  plot_bgcolor: 'white',
  font: { size: 12 },
  legend: {
    orientation: 'h',
    yanchor: 'bottom',
    y: 1.02,
    xanchor: 'right',
    x: 1,
    title: { text: '' }
  },
  xaxis: { showgrid: false, zeroline: false },
  yaxis: { zeroline: false, separatethousands: true }
};
```

Add `title: { text: 'Chart Title', x: 0.02, xanchor: 'left' }` when a title is needed.

For money axes: add `yaxis: { ...LAYOUT_BASE.yaxis, tickprefix: '£' }`.

## Naming Convention

`{topic-slug}-{YYYY-MM-DD}.html`

Examples:
- `risk-portfolio-2026-02-26.html`
- `brevo-deals-pipeline-2026-02-26.html`
- `branch-performance-2026-02-26.html`
- `kbb-designer-review-2026-02-26.html`

Derive the topic slug from the data content — use lowercase, hyphen-separated words describing the main subject.

## Edge Cases

- **No data in conversation**: Tell the user to gather data first, suggest relevant MCP tools
- **>500 rows in a single dataset**: Include all rows but add a note above the table
- **>3 datasets**: Use Bootstrap nav-tabs to organize (include `bootstrap.bundle.min.js` for tab JS)
- **Empty dataset**: Skip it entirely — don't render an empty chart or table
- **Mixed data sources**: Group related datasets together (e.g. all risk data in one tab, all sales in another)
- **Single metric values**: Render as KPI cards, not as a 1-row table
