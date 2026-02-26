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

### 2.5. Plan thinkylinks

For each dataset/section in the dashboard, generate 1-3 contextual drill-down prompts — **natural language questions** that a user might want to ask next, based on the data they're seeing. These will be rendered as clickable buttons that send queries to OpenCode.

Examples of good thinkylinks:

| Dashboard section | Button text | Prompt sent to OpenCode |
|-------------------|-------------|------------------------|
| Branch comparison table showing North £142k vs South £98k | "Compare North vs South" | "Compare sales, margin, and customer counts between Branch North (£142,300 MTD) and Branch South (£98,450 MTD) for 2026-01-01 to 2026-02-26, broken down by week" |
| Top 10 customers row for "Acme Ltd (ACC-7823)" | "Deep dive: Acme Ltd" | "/customer-deep-dive ACC-7823" |
| Risk distribution showing 12 customers rated E/F | "List high-risk customers" | "List all 12 customers currently rated E or F with their balances, DBT, and most recent alert" |
| KBB pipeline showing 8 jobs in quote stage | "Show stalled quotes" | "Show the 8 KBB jobs currently in quote stage — which have been waiting more than 14 days?" |
| Weekly trend showing £45k→£31k drop w/c 2026-02-10→17 | "Investigate this drop" | "Analyse what caused the revenue drop from £45,200 (w/c 10 Feb) to £31,100 (w/c 17 Feb), breaking down by branch and product category" |
| Expiring contracts showing 5 due within 7 days | "Draft renewal outreach" | "Draft renewal call talking points for the 5 contracts expiring by 2026-03-05: [list the actual customer names/IDs from the table]" |

**Critical:** Every prompt must use the exact IDs, values, names, and dates from the data rendered in the dashboard — never generic placeholders. The agent populates these at generation time from the inline `DATA_N` arrays.

Rules for generating thinkylinks:
- Place them **inline near the relevant data** (below a table, beside a KPI card, in a chart caption)
- The visible text should be short and action-oriented ("Drill down", "Compare branches", "Investigate decline")
- The prompt should be specific and reference the actual data values/names from the dashboard
- Use skills (e.g. `/customer-deep-dive ABC001`) when a matching skill exists; use free-form prompts otherwise
- Generate 1-3 per section; skip sections where no meaningful drill-down exists
- Don't generate thinkylinks that would just repeat what's already shown

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

    /* ThinkyLinks */
    .thinkylink {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.3rem 0.75rem; margin: 0.25rem 0.15rem;
      font-size: 0.8rem; font-weight: 500;
      color: #4361ee; background: #eef1ff; border: 1px solid #c5cdf8;
      border-radius: 2rem; cursor: pointer; transition: all 0.15s;
      text-decoration: none; white-space: nowrap;
    }
    .thinkylink:hover { background: #dce1ff; border-color: #4361ee; }
    .thinkylink:disabled { opacity: 0.5; cursor: wait; }
    .thinkylink::before { content: '→'; font-weight: 700; }
    .thinkylink[data-status="sent"] { color: #198754; background: #e8f5e9; border-color: #a5d6a7; }
    .thinkylink[data-status="sent"]::before { content: '✓'; }
    .thinkylink[data-status="error"] { color: #dc3545; background: #fdecea; border-color: #f5c6cb; }
    .thinkylink[data-status="error"]::before { content: '!'; }
    .thinkylink-bar { display: flex; flex-wrap: wrap; margin-top: 0.5rem; }
    #thinkylink-status { position: fixed; bottom: 1rem; right: 1rem; z-index: 1050;
      padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.8rem; display: none; }
    #thinkylink-status.connected { display: block; background: #e8f5e9; color: #198754; }
    #thinkylink-status.disconnected { display: block; background: #fdecea; color: #dc3545; }
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

    <div id="thinkylink-status"></div>

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

    // ============================================================
    // THINKYLINKS — drill-down queries to OpenCode
    // ============================================================
    const OC = { base: 'http://localhost:4096', session: null, alive: false };

    // Health check on load — show/hide thinkylinks based on OpenCode availability
    (async () => {
      try {
        const r = await fetch(`${OC.base}/global/health`, { signal: AbortSignal.timeout(2000) });
        OC.alive = r.ok;
      } catch { OC.alive = false; }
      const el = document.getElementById('thinkylink-status');
      if (el) {
        el.className = OC.alive ? 'connected' : 'disconnected';
        el.textContent = OC.alive ? 'OpenCode connected' : 'OpenCode not running — start with: opencode serve';
        el.style.display = 'block';
        if (OC.alive) setTimeout(() => el.style.display = 'none', 3000);
      }
      document.querySelectorAll('.thinkylink').forEach(b => { b.style.display = OC.alive ? '' : 'none'; });
    })();

    async function thinkylink(el) {
      if (!OC.alive) return;
      const prompt = el.dataset.prompt;
      const orig = el.textContent;
      el.disabled = true;
      el.textContent = 'Sending…';
      try {
        if (!OC.session) {
          const r = await fetch(`${OC.base}/session`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Dashboard drill-down' })
          });
          OC.session = (await r.json()).id;
        }
        await fetch(`${OC.base}/session/${OC.session}/message`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parts: [{ type: 'text', text: prompt }] })
        });
        el.textContent = 'Sent — check OpenCode';
        el.dataset.status = 'sent';
      } catch (e) {
        el.textContent = orig;
        el.dataset.status = 'error';
        el.title = 'Failed to reach OpenCode';
      } finally {
        el.disabled = false;
      }
    }
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

## ThinkyLinks (Drill-Down Actions)

When generating the dashboard, add contextual drill-down buttons that let users
explore data further via OpenCode. These appear as small pill-shaped buttons near
the relevant data.

### How to add a thinkylink

```html
<div class="thinkylink-bar">
  <button class="thinkylink" data-prompt="THE OPENCODE QUERY" onclick="thinkylink(this)">
    Button Label
  </button>
</div>
```

### Placement rules

- Place a `<div class="thinkylink-bar">` below each table or chart card
- Generate 1-3 thinkylinks per section based on what a user would naturally want to explore next
- The `data-prompt` should be a specific, actionable query referencing actual values from the data
- Use skill invocations when a matching skill exists (e.g. `/customer-deep-dive ABC001`)
- Use free-form natural language prompts when no skill matches
- Skip sections where no meaningful drill-down exists
- Thinkylinks auto-hide when OpenCode is not running — so always include them

### Prompt quality guidelines

- **Use exact IDs and values from the rendered data** — every thinkylink must reference the real entity ID, account number, branch name, or value that appears in the adjacent table/chart. Never use placeholder or example IDs.
- Reference specific data points: "Compare Branch North (£142,300) vs Branch South (£98,450) revenue" — using the actual values from the table
- Include time ranges that match the data: "...for 2026-01-01 to 2026-02-26" using the actual date range from the query
- For customer drill-downs, use the exact account ID from the row: `data-prompt="/customer-deep-dive CUST12345"` where CUST12345 is the real ID shown in that table row
- For branch comparisons, name the exact branches from the data
- For trend investigation, reference the exact dates/weeks and values where the trend occurs
