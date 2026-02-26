from __future__ import annotations

from datetime import datetime
from io import BytesIO
from pathlib import Path
import logging
from typing import Any, Iterable

import pandas as pd
import plotly.express as px

from dash import Dash, Input, Output, State, dcc, html, no_update
import dash_bootstrap_components as dbc
import dash_ag_grid as dag


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("brevo_dashboard")

EXCEL_FILE = Path("input.xlsx")   
SHEET = 2

THEME = dbc.themes.LUX
PLOTLY_TEMPLATE = "plotly_white"

AMOUNT_COL = "brevoDealAmount"
UPDATED_COL = "brevoDealLastUpdateDate"
PIPELINE_COL = "brevoPipeline"
STAGE_COL = "brevoDealStage"
USER_COL = "kerridgeUserId"
REASON_COL = "brevoLostReason"
CLOSE_COL = "brevoActualCloseDate"
CUSTOMER_COL = "customerName"


def load_data() -> pd.DataFrame:
    """Load the Excel file and do minimal type cleaning."""
    if not EXCEL_FILE.exists():
        raise FileNotFoundError(f"Couldn't find {EXCEL_FILE.name}. Put it next to this script.")

    dff = pd.read_excel(EXCEL_FILE, sheet_name=SHEET)
    dff.columns = dff.columns.astype(str).str.strip()
    dff = dff.fillna("")


    if "brevoDealLink" in dff.columns:
        s = dff["brevoDealLink"].astype(str).str.strip()
        s = s.str.extract(r'(https?://[^"\s]+)', expand=False).fillna(s)
        s = s.where(s.str.match(r"^https?://", na=False), "")
        dff["brevoDealLink"] = s


    if AMOUNT_COL in dff.columns:
        dff[AMOUNT_COL] = pd.to_numeric(dff[AMOUNT_COL], errors="coerce")

    for c in [UPDATED_COL, CLOSE_COL, "brevoDealCreatedDate", "brevoDealCloseDate"]:
        if c in dff.columns:
            dff[c] = pd.to_datetime(dff[c], errors="coerce")

    dff = dff[dff['brevoDealCreatedDate'] >= '2026-02-01'] #date filter to remove old entries

    log.info("Loaded %d rows, %d columns", len(dff), len(dff.columns))
    return dff


df = load_data()


def stamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def clean_export_df(dff: pd.DataFrame) -> pd.DataFrame:
    """Remove helper columns (__*) before exporting."""
    if dff is None or dff.empty:
        return pd.DataFrame()
    out = dff.copy()
    drop_cols = [c for c in out.columns if str(c).startswith("__")]
    return out.drop(columns=drop_cols, errors="ignore")


def df_to_excel_bytes(dff: pd.DataFrame, sheet_name: str = "Data") -> bytes:
    """Return an .xlsx as bytes."""
    out = clean_export_df(dff)
    bio = BytesIO()
    with pd.ExcelWriter(bio, engine="openpyxl") as writer:
        out.to_excel(writer, index=False, sheet_name=sheet_name[:31])
    bio.seek(0)
    return bio.read()


def is_zero(v: Any) -> bool:
    if v is None:
        return True
    try:
        return abs(float(str(v).replace(",", "").strip())) < 1e-9
    except Exception:
        return False


def options_for(col: str) -> list[dict[str, str]]:
    if col not in df.columns:
        return [{"label": "All", "value": "__ALL__"}]
    vals = (
        df[col]
        .replace("", pd.NA)
        .dropna()
        .astype(str)
        .unique()
        .tolist()
    )
    vals = sorted(vals)
    return [{"label": "All", "value": "__ALL__"}] + [{"label": v, "value": v} for v in vals]


PIPELINE_OPTS = options_for(PIPELINE_COL)


def apply_common_filters(dff: pd.DataFrame, pipeline_value: str, closed_mode: str | None = None) -> pd.DataFrame:
    if PIPELINE_COL in dff.columns and pipeline_value and pipeline_value != "__ALL__":
        dff = dff[dff[PIPELINE_COL].astype(str).str.strip() == str(pipeline_value).strip()]

    if closed_mode == "open_only" and CLOSE_COL in dff.columns:
        dff = dff[dff[CLOSE_COL].isna()]

    return dff


def nice_detail_columns(dff: pd.DataFrame) -> pd.DataFrame:
    """
    Keep ALL columns for drill-down, but reorder so the most useful ones come first.
    """
    preferred = [
        "branchName",
        CUSTOMER_COL,
        "customerAccountNumber",
        "customerEmail",
        USER_COL,
        "contactName",
        "contactEmail",
        "kerridgeQuoteNumber",
        "kerridgeDescription",
        "brevoDealName",
        STAGE_COL,
        PIPELINE_COL,
        AMOUNT_COL,
        UPDATED_COL,
        "brevoDealLink",
        REASON_COL,
    ]
    cols_first = [c for c in preferred if c in dff.columns]
    cols_rest = [c for c in dff.columns if c not in cols_first]
    return dff[cols_first + cols_rest]


def add_markdown_link_column(
    dff: pd.DataFrame,
    url_col: str = "brevoDealLink",
    number_col: str = "kerridgeQuoteNumber",
    out_col: str = "Link",
) -> pd.DataFrame:
    dff = dff.copy()
    if url_col not in dff.columns:
        return dff

    s = dff[url_col].astype(str).str.strip()
    is_url = s.str.match(r"^https?://", na=False)

    dff[out_col] = ""

    def make_link(row: pd.Series) -> str:
        url = str(row.get(url_col, "")).strip()
        quote = str(row.get(number_col, "")).strip()
        if not url.startswith("http"):
            return ""
        return f"[View Quote #{quote}]({url})" if quote else f"[Open Deal]({url})"

    dff.loc[is_url, out_col] = dff.loc[is_url].apply(make_link, axis=1)
    return dff


def col_defs_with_links(dff: pd.DataFrame) -> list[dict[str, Any]]:
    col_defs: list[dict[str, Any]] = []
    for c in dff.columns:
        if c == "Link":
            col_defs.append(
                {
                    "field": c,
                    "pinned": "right",
                    "minWidth": 120,
                    "maxWidth": 160,
                    "cellRenderer": "markdown",
                    "cellRendererParams": {"linkTarget": "_blank"},
                    "sortable": False,
                    "filter": False,
                }
            )
        elif c == "brevoDealLink":
            col_defs.append({"field": c, "hide": True})
        else:
            col_defs.append(
                {
                    "field": c,
                    "sortable": True,
                    "filter": True,
                    "resizable": True,
                    "minWidth": 140,
                }
            )
    return col_defs


def add_weeks_bucket(dff: pd.DataFrame, date_col: str = UPDATED_COL) -> pd.DataFrame:
    if date_col not in dff.columns:
        raise KeyError(f"Missing column: {date_col}")

    today = pd.Timestamp.today().normalize()
    out = dff.copy()
    out = out[out[date_col].notna()].copy()
    out["bucket"] = ((out[date_col].dt.normalize() - today).dt.days // 7)
    out["bucket"] = pd.to_numeric(out["bucket"], errors="coerce").astype("Int64")
    return out


def add_year_month_bucket(dff: pd.DataFrame, date_col: str = UPDATED_COL) -> pd.DataFrame:
    if date_col not in dff.columns:
        raise KeyError(f"Missing column: {date_col}")

    out = dff.copy()
    out = out[out[date_col].notna()].copy()
    out["bucket"] = out[date_col].dt.strftime("%Y %b")
    return out


def month_sort_key(label: str):
    return pd.to_datetime("01 " + label, format="%d %Y %b", errors="coerce")


FMT_MONEY = {"function": "params.value == null ? '' : ('£' + d3.format(',.2f')(params.value))"}
FMT_PCT = {"function": "params.value == null ? '' : d3.format('.0%')(params.value)"}


def col_defs_for_sum_pivot(pivot_df: pd.DataFrame, row_dims: list[str], money: bool = True) -> list[dict[str, Any]]:
    defs: list[dict[str, Any]] = []
    for c in pivot_df.columns:
        if str(c).startswith("__"):
            defs.append({"field": c, "hide": True})
            continue

        c = str(c)
        cd: dict[str, Any] = {"field": c, "sortable": True, "resizable": True, "minWidth": 110, "filter": True}

        if c in row_dims:
            cd["pinned"] = "left"
            cd["minWidth"] = 220 if c != USER_COL else 180
        else:
            cd["type"] = "numericColumn"
            cd["valueFormatter"] = FMT_MONEY if money else {"function": "d3.format(',.2f')(params.value)"}
            if c == "Grand Total":
                cd["pinned"] = "right"
                cd["minWidth"] = 150

        defs.append(cd)
    return defs


def col_defs_for_percent_pivot(pivot_df: pd.DataFrame, row_dim: str) -> list[dict[str, Any]]:
    defs: list[dict[str, Any]] = []
    for c in pivot_df.columns:
        if str(c).startswith("__"):
            defs.append({"field": c, "hide": True})
            continue

        c = str(c)
        cd: dict[str, Any] = {"field": c, "sortable": True, "resizable": True, "minWidth": 110, "filter": True}

        if c == row_dim:
            cd["pinned"] = "left"
            cd["minWidth"] = 220
        else:
            cd["valueFormatter"] = FMT_PCT
            if c == "Grand Total":
                cd["pinned"] = "right"
                cd["minWidth"] = 140

        defs.append(cd)
    return defs

def pivot_sum(dff: pd.DataFrame, row_dims: list[str]) -> pd.DataFrame:
    required = row_dims + [AMOUNT_COL, "bucket"]
    missing = [c for c in required if c not in dff.columns]
    if missing:
        raise KeyError(f"Missing required columns for pivot: {missing}")

    p = pd.pivot_table(
        dff,
        index=row_dims,
        columns="bucket",
        values=AMOUNT_COL,
        aggfunc="sum",
        fill_value=0,
        dropna=False,
    ).reset_index()

    p.columns = [str(c) for c in p.columns]
    bucket_cols = [c for c in p.columns if c not in row_dims]
    p["Grand Total"] = p[bucket_cols].sum(axis=1)

    for dim in row_dims:
        p[f"__{dim}"] = p[dim].astype(str).str.strip()

    return p


def build_customer_sum_pivot(dff: pd.DataFrame, date_col: str = UPDATED_COL) -> pd.DataFrame:
    out = dff.copy()
    out[AMOUNT_COL] = pd.to_numeric(out.get(AMOUNT_COL), errors="coerce").fillna(0)
    out[CUSTOMER_COL] = out.get(CUSTOMER_COL, "").astype(str).str.strip()

    out[date_col] = pd.to_datetime(out.get(date_col), errors="coerce")
    out = out[out[date_col].notna()].copy()
    out["year_month"] = out[date_col].dt.strftime("%Y-%m")

    pivot = (
        out.pivot_table(
            index=CUSTOMER_COL,
            columns="year_month",
            values=AMOUNT_COL,
            aggfunc="sum",
            fill_value=0,
        )
        .sort_index()
    )
    pivot["Grand Total"] = pivot.sum(axis=1)
    pivot = pivot.reset_index()
    pivot.columns = [str(c) for c in pivot.columns]
    pivot["__customer"] = pivot[CUSTOMER_COL].astype(str).str.strip()
    return pivot


def build_customer_conversion_pivot(dff: pd.DataFrame, date_col: str = UPDATED_COL) -> pd.DataFrame:
    out = dff.copy()
    out[AMOUNT_COL] = pd.to_numeric(out.get(AMOUNT_COL), errors="coerce").fillna(0)
    out[CUSTOMER_COL] = out.get(CUSTOMER_COL, "").astype(str).str.strip()

    out[date_col] = pd.to_datetime(out.get(date_col), errors="coerce")
    out = out[out[date_col].notna()].copy()
    out["year_month"] = out[date_col].dt.strftime("%Y-%m")

    won = out[out[STAGE_COL].astype(str).str.strip() == "Won"]
    lost = out[out[STAGE_COL].astype(str).str.strip() == "Lost"]

    w = won.pivot_table(index=CUSTOMER_COL, columns="year_month", values=AMOUNT_COL, aggfunc="sum", fill_value=0)
    l = lost.pivot_table(index=CUSTOMER_COL, columns="year_month", values=AMOUNT_COL, aggfunc="sum", fill_value=0)

    idx = w.index.union(l.index)
    cols = w.columns.union(l.columns)

    w = w.reindex(index=idx, columns=cols, fill_value=0)
    l = l.reindex(index=idx, columns=cols, fill_value=0)

    denom = w + l
    conv = w.div(denom.where(denom != 0), fill_value=0)

    conv_df = conv.reset_index()
    conv_df.columns = [str(c) for c in conv_df.columns]

    won_total = w.sum(axis=1)
    lost_total = l.sum(axis=1)
    denom_total = won_total + lost_total
    conv_df["Grand Total"] = (won_total / denom_total.where(denom_total != 0)).values

    conv_df["__customer"] = conv_df[CUSTOMER_COL].astype(str).str.strip()

    month_cols = [c for c in conv_df.columns if c not in [CUSTOMER_COL, "Grand Total", "__customer"]]
    conv_df = conv_df[[CUSTOMER_COL] + sorted(month_cols) + ["Grand Total", "__customer"]]
    return conv_df


def build_id_conversion_pivot(pipeline_value: str) -> pd.DataFrame:
    dff = apply_common_filters(df.copy(), pipeline_value)
    dff = add_year_month_bucket(dff, date_col=UPDATED_COL)

    def sum_by(stage: str) -> pd.DataFrame:
        sub = dff[dff[STAGE_COL].astype(str).str.strip() == stage]
        p = pd.pivot_table(sub, index=[USER_COL], columns="bucket", values=AMOUNT_COL, aggfunc="sum", fill_value=0)
        p.index = p.index.astype(str)
        p.columns = p.columns.astype(str)
        return p

    won = sum_by("Won")
    lost = sum_by("Lost")

    idx = won.index.union(lost.index)
    cols = won.columns.union(lost.columns)

    won = won.reindex(index=idx, columns=cols, fill_value=0)
    lost = lost.reindex(index=idx, columns=cols, fill_value=0)

    denom = won + lost
    conv = won.div(denom.where(denom != 0), fill_value=0)

    conv_df = conv.reset_index()
    conv_df["__id"] = conv_df[USER_COL].astype(str).str.strip()

    won_total = won.sum(axis=1)
    lost_total = lost.sum(axis=1)
    denom_total = won_total + lost_total
    conv_df["Grand Total"] = (won_total / denom_total.where(denom_total != 0)).values

    month_cols = [c for c in conv_df.columns if c not in [USER_COL, "Grand Total", "__id"]]
    month_cols_sorted = sorted(month_cols, key=month_sort_key)

    conv_df = conv_df[[USER_COL] + month_cols_sorted + ["Grand Total", "__id"]]
    conv_df.columns = [str(c) for c in conv_df.columns]
    return conv_df


def hide_zero_rows(pivot_df: pd.DataFrame) -> pd.DataFrame:
    if pivot_df is None or pivot_df.empty or "Grand Total" not in pivot_df.columns:
        return pivot_df
    gt = pd.to_numeric(pivot_df["Grand Total"], errors="coerce").fillna(0)
    return pivot_df.loc[gt != 0].copy()


def make_grid(grid_id: str, height: str):
    return dag.AgGrid(
        id=grid_id,
        rowData=[],
        columnDefs=[],
        dangerously_allow_code=True,
        defaultColDef={
            "flex": 1,
            "minWidth": 110,
            "floatingFilter": True,
            "wrapText": True,
            "autoHeight": True,
            "sortable": True,
            "filter": True,
            "resizable": True,
        },
        dashGridOptions={
            "rowSelection": "single",
            "pagination": True,
            "paginationPageSize": 50,
            "animateRows": True,
        },
        className="ag-theme-quartz",
        style={"height": height, "width": "100%"},
    )


def export_bar(prefix: str):
    return dbc.Row(
        className="g-2 mb-2",
        children=[
            dbc.Col(dbc.Button("Export Pivot (Excel)", id=f"{prefix}-export-pivot", color="primary", size="sm"), md="auto"),
            dbc.Col(dbc.Button("Export Drill-down (Excel)", id=f"{prefix}-export-detail", color="secondary", size="sm"), md="auto"),
            dcc.Download(id=f"{prefix}-download"),
        ],
    )

def style_fig(fig, title: str | None = None):
    fig.update_layout(
        template=PLOTLY_TEMPLATE,
        margin=dict(l=10, r=10, t=40 if title else 10, b=10),
        height=320,
        paper_bgcolor="white",
        plot_bgcolor="white",
        font=dict(size=12),
        title=dict(text=title, x=0.02, xanchor="left") if title else None,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1,
            title_text="",
        ),
    )
    fig.update_xaxes(showgrid=False, zeroline=False)
    fig.update_yaxes(zeroline=False, separatethousands=True)
    return fig

app = Dash(__name__, external_stylesheets=[THEME], suppress_callback_exceptions=True)
server = app.server
app.title = "Brevo Dashboard"


def tab_viz_layout():
    return dbc.Container(
        fluid=True,
        children=[
            dbc.Card(
                className="shadow-sm border-0 mb-3",
                children=dbc.CardBody(
                    dbc.Row(
                        className="g-3",
                        children=[
                            dbc.Col(
                                [
                                    html.Div("Pipeline", className="text-muted small"),
                                    dbc.Select(id="viz-pipeline", options=PIPELINE_OPTS, value="__ALL__"),
                                ],
                                md=4,
                            ),
                            dbc.Col(
                                [
                                    html.Div("Closed filter (ActualCloseDate)", className="text-muted small"),
                                    dbc.Select(
                                        id="viz-closed",
                                        options=[
                                            {"label": "All", "value": "all"},
                                            {"label": "Only open (ActualCloseDate blank)", "value": "open_only"},
                                        ],
                                        value="all",
                                    ),
                                ],
                                md=4,
                            ),
                            dbc.Col(
                                [
                                    html.Div("Date basis", className="text-muted small"),
                                    dbc.Select(
                                        id="viz-date-mode",
                                        options=[
                                            {"label": "Year/Month (for trends)", "value": "ym"},
                                            {"label": "Weeks from today (for recency)", "value": "weeks"},
                                        ],
                                        value="ym",
                                    ),
                                ],
                                md=4,
                            ),
                        ],
                    )
                ),
            ),
            dbc.Row(
                className="g-3",
                children=[
                    dbc.Col(
                        dbc.Card(
                            className="shadow-sm border-0",
                            children=dbc.CardBody([dcc.Graph(id="viz-stage-bar")]),
                        ),
                        md=6,
                    ),
                    dbc.Col(
                        dbc.Card(
                            className="shadow-sm border-0",
                            children=dbc.CardBody([dcc.Graph(id="viz-trend-line")]),
                        ),
                        md=6,
                    ),
                ],
            ),
            dbc.Row(
                className="g-3 mt-1",
                children=[
                    dbc.Col(
                        dbc.Card(
                            className="shadow-sm border-0",
                            children=dbc.CardBody([dcc.Graph(id="viz-user-bar")]),
                        ),
                        md=12,
                    )
                ],
            ),
            dbc.Card(
                className="shadow-sm border-0 mt-3",
                children=dbc.CardBody(
                    [
                        html.H5("Drill-down", className="mb-2"),
                        html.Div(id="viz-debug", className="text-muted small mb-2"),
                        dbc.Row(
                            className="g-2 mb-2",
                            children=[
                                dbc.Col(
                                    dbc.Button("Export Filtered Data (Excel)", id="viz-export-filtered", color="primary", size="sm"),
                                    md="auto",
                                ),
                                dbc.Col(
                                    dbc.Button("Export Drill-down (Excel)", id="viz-export-detail", color="secondary", size="sm"),
                                    md="auto",
                                ),
                                dcc.Download(id="viz-download"),
                            ],
                        ),
                        make_grid("viz-detail", "45vh"),
                    ]
                ),
            ),
        ],
    )


def tab_raw_layout():
    col_defs = [{"field": c, "filter": True, "sortable": True, "resizable": True} for c in df.columns]
    return dbc.Card(
        className="shadow-sm border-0",
        children=dbc.CardBody(
            [
                export_bar("raw"),
                dag.AgGrid(
                    id="raw-grid",
                    rowData=df.to_dict("records"),
                    columnDefs=col_defs,
                    defaultColDef={
                        "flex": 1,
                        "minWidth": 140,
                        "floatingFilter": True,
                        "sortable": True,
                        "filter": True,
                        "resizable": True,
                    },
                    dashGridOptions={"pagination": True, "paginationPageSize": 25, "animateRows": True},
                    className="ag-theme-quartz",
                    style={"height": "70vh", "width": "100%"},
                ),
            ]
        ),
    )


def tab_open_layout():
    return dbc.Container(
        fluid=True,
        children=[
            dbc.Card(
                className="shadow-sm border-0 mb-3",
                children=dbc.CardBody(
                    dbc.Row(
                        className="g-3",
                        children=[
                            dbc.Col(
                                [
                                    html.Div("Pipeline", className="text-muted small"),
                                    dbc.Select(id="open-pipeline", options=PIPELINE_OPTS, value="__ALL__"),
                                ],
                                md=4,
                            ),
                            dbc.Col(
                                [
                                    html.Div("Closed filter (ActualCloseDate)", className="text-muted small"),
                                    dbc.Select(
                                        id="open-closed",
                                        options=[
                                            {"label": "All", "value": "all"},
                                            {"label": "Only open (ActualCloseDate blank)", "value": "open_only"},
                                        ],
                                        value="all",
                                    ),
                                ],
                                md=5,
                            ),
                        ],
                    )
                ),
            ),
            dbc.Card(
                className="shadow-sm border-0",
                children=dbc.CardBody([html.Div(id="open-debug", className="text-muted small mb-2"), export_bar("open"), make_grid("open-grid", "55vh")]),
            ),
            dbc.Card(className="shadow-sm border-0 mt-3", children=dbc.CardBody([html.H5("Drill-down", className="mb-2"), make_grid("open-detail", "40vh")])),
        ],
    )


def tab_lost_layout():
    return dbc.Container(
        fluid=True,
        children=[
            dbc.Card(
                className="shadow-sm border-0 mb-3",
                children=dbc.CardBody(
                    dbc.Row(
                        className="g-3",
                        children=[
                            dbc.Col(
                                [
                                    html.Div("Pipeline", className="text-muted small"),
                                    dbc.Select(id="lost-pipeline", options=PIPELINE_OPTS, value="__ALL__"),
                                ],
                                md=4,
                            ),
                            dbc.Col(
                                [
                                    html.Div("Stage", className="text-muted small"),
                                    dbc.Select(id="lost-stage", options=options_for(STAGE_COL), value="Lost"),
                                ],
                                md=4,
                            ),
                            dbc.Col(
                                [
                                    html.Div("Closed filter (ActualCloseDate)", className="text-muted small"),
                                    dbc.Select(
                                        id="lost-closed",
                                        options=[
                                            {"label": "All", "value": "all"},
                                            {"label": "Only open (ActualCloseDate blank)", "value": "open_only"},
                                        ],
                                        value="all",
                                    ),
                                ],
                                md=4,
                            ),
                        ],
                    )
                ),
            ),
            dbc.Card(
                className="shadow-sm border-0",
                children=dbc.CardBody([html.Div(id="lost-debug", className="text-muted small mb-2"), export_bar("lost"), make_grid("lost-grid", "55vh")]),
            ),
            dbc.Card(className="shadow-sm border-0 mt-3", children=dbc.CardBody([html.H5("Drill-down", className="mb-2"), make_grid("lost-detail", "40vh")])),
        ],
    )


def tab_wonid_layout():
    return dbc.Container(
        fluid=True,
        children=[
            dbc.Card(
                className="shadow-sm border-0 mb-3",
                children=dbc.CardBody(
                    dbc.Row(
                        className="g-3",
                        children=[
                            dbc.Col(
                                [
                                    html.Div("Pipeline", className="text-muted small"),
                                    dbc.Select(id="wonid-pipeline", options=PIPELINE_OPTS, value="__ALL__"),
                                ],
                                md=6,
                            )
                        ],
                    )
                ),
            ),
            dbc.Card(className="shadow-sm border-0", children=dbc.CardBody([html.Div(id="wonid-debug", className="text-muted small mb-2"), export_bar("wonid"), make_grid("wonid-grid", "55vh")])),
            dbc.Card(className="shadow-sm border-0 mt-3", children=dbc.CardBody([html.H5("Drill-down", className="mb-2"), make_grid("wonid-detail", "40vh")])),
        ],
    )


def tab_lostid_layout():
    return dbc.Container(
        fluid=True,
        children=[
            dbc.Card(
                className="shadow-sm border-0 mb-3",
                children=dbc.CardBody(
                    dbc.Row(
                        className="g-3",
                        children=[
                            dbc.Col(
                                [
                                    html.Div("Pipeline", className="text-muted small"),
                                    dbc.Select(id="lostid-pipeline", options=PIPELINE_OPTS, value="__ALL__"),
                                ],
                                md=6,
                            )
                        ],
                    )
                ),
            ),
            dbc.Card(className="shadow-sm border-0", children=dbc.CardBody([html.Div(id="lostid-debug", className="text-muted small mb-2"), export_bar("lostid"), make_grid("lostid-grid", "55vh")])),
            dbc.Card(className="shadow-sm border-0 mt-3", children=dbc.CardBody([html.H5("Drill-down", className="mb-2"), make_grid("lostid-detail", "40vh")])),
        ],
    )


def tab_convid_layout():
    return dbc.Container(
        fluid=True,
        children=[
            dbc.Card(
                className="shadow-sm border-0 mb-3",
                children=dbc.CardBody(
                    dbc.Row(
                        className="g-3",
                        children=[
                            dbc.Col(
                                [
                                    html.Div("Pipeline", className="text-muted small"),
                                    dbc.Select(id="convid-pipeline", options=PIPELINE_OPTS, value="__ALL__"),
                                ],
                                md=6,
                            )
                        ],
                    )
                ),
            ),
            dbc.Card(className="shadow-sm border-0", children=dbc.CardBody([html.Div(id="convid-debug", className="text-muted small mb-2"), export_bar("convid"), make_grid("convid-grid", "55vh")])),
            dbc.Card(className="shadow-sm border-0 mt-3", children=dbc.CardBody([html.H5("Drill-down", className="mb-2"), make_grid("convid-detail", "40vh")])),
        ],
    )


def tab_customer_layout(prefix: str, default_stage: str):
    return dbc.Container(
        fluid=True,
        children=[
            dbc.Card(
                className="shadow-sm border-0 mb-3",
                children=dbc.CardBody(
                    dbc.Row(
                        className="g-3 align-items-end",
                        children=[
                            dbc.Col(
                                [
                                    html.Div("Pipeline", className="text-muted small"),
                                    dbc.Select(id=f"{prefix}-pipeline", options=PIPELINE_OPTS, value="__ALL__"),
                                ],
                                md=5,
                            ),
                            dbc.Col(
                                [
                                    html.Div("Stage", className="text-muted small"),
                                    dbc.Select(id=f"{prefix}-stage", options=options_for(STAGE_COL), value=default_stage),
                                ],
                                md=5,
                            ),
                            dbc.Col(
                                dbc.Checklist(
                                    id=f"{prefix}-hidezero",
                                    options=[{"label": "Hide zero rows", "value": 1}],
                                    value=[],
                                    switch=True,
                                    className="mb-0",
                                ),
                                md=2,
                            ),
                        ],
                    )
                ),
            ),
            dbc.Card(
                className="shadow-sm border-0",
                children=dbc.CardBody(
                    className="pt-2",
                    children=[
                        dbc.Alert(id=f"{prefix}-debug", color="light", className="py-2 mb-2", style={"fontSize": "0.9rem"}),
                        export_bar(prefix),
                        dag.AgGrid(
                            id=f"{prefix}-grid",
                            rowData=[],
                            columnDefs=[],
                            defaultColDef={
                                "flex": 1,
                                "minWidth": 110,
                                "floatingFilter": True,
                                "sortable": True,
                                "filter": True,
                                "resizable": True,
                                "wrapText": False,
                                "autoHeight": False,
                            },
                            dashGridOptions={
                                "rowSelection": "single",
                                "pagination": True,
                                "paginationPageSize": 50,
                                "animateRows": True,
                                "headerHeight": 36,
                                "rowHeight": 34,
                            },
                            className="ag-theme-quartz",
                            style={"height": "55vh", "width": "100%"},
                        ),
                    ],
                ),
            ),
            dbc.Card(className="shadow-sm border-0 mt-3", children=dbc.CardBody([html.H5("Drill-down", className="mb-2"), make_grid(f"{prefix}-detail", "40vh")])),
        ],
    )


def tab_convcust_layout():
    return dbc.Container(
        fluid=True,
        children=[
            dbc.Card(
                className="shadow-sm border-0 mb-3",
                children=dbc.CardBody(
                    dbc.Row(
                        [
                            dbc.Col(
                                [
                                    html.Div("Pipeline", className="text-muted small"),
                                    dbc.Select(id="convcust-pipeline", options=PIPELINE_OPTS, value="__ALL__"),
                                ],
                                md=6,
                            )
                        ]
                    )
                ),
            ),
            dbc.Card(className="shadow-sm border-0", children=dbc.CardBody([html.Div(id="convcust-debug", className="text-muted small mb-2"), export_bar("convcust"), make_grid("convcust-grid", "55vh")])),
            dbc.Card(className="shadow-sm border-0 mt-3", children=dbc.CardBody([html.H5("Drill-down", className="mb-2"), make_grid("convcust-detail", "40vh")])),
        ],
    )


app.layout = dbc.Container(
    fluid=True,
    className="py-4",
    children=[
        dbc.Card(
            className="shadow-sm border-0 mb-3",
            children=dbc.CardBody(
                [
                    html.H3("Brevo Dashboard", className="mb-1"),
                    dbc.Row(
                        className="g-2 align-items-center mt-2",
                        children=[
                            dbc.Col(dbc.Switch(id="hidezero-global", value=False, label="Hide zero rows"), md="auto"),
                        ],
                    ),
                ]
            ),
        ),
        dcc.Tabs(
            id="tabs",
            value="tab-open",
            children=[
                dcc.Tab(label="Visualisations", value="tab-viz"),
                dcc.Tab(label="Open Quotes (Weeks)", value="tab-open"),
                dcc.Tab(label="Recent Lost (Weeks)", value="tab-lost"),
                dcc.Tab(label="Won ID (Year/Month)", value="tab-wonid"),
                dcc.Tab(label="Lost ID (Year/Month)", value="tab-lostid"),
                dcc.Tab(label="Conversion % ID", value="tab-conv-id"),
                dcc.Tab(label="Won Customers (£)", value="tab-won-cust"),
                dcc.Tab(label="Lost Customers (£)", value="tab-lost-cust"),
                dcc.Tab(label="Conversion % Customer", value="tab-conv-cust"),
                #dcc.Tab(label="Raw Data", value="tab-raw"),
            ],
        ),
        html.Div(id="tab-content", className="mt-3"),
    ],
)


@app.callback(Output("tab-content", "children"), Input("tabs", "value"))
def render_tab(tab: str):
    if tab == "tab-viz":
        return tab_viz_layout()
    if tab == "tab-open":
        return tab_open_layout()
    if tab == "tab-lost":
        return tab_lost_layout()
    if tab == "tab-wonid":
        return tab_wonid_layout()
    if tab == "tab-lostid":
        return tab_lostid_layout()
    if tab == "tab-conv-id":
        return tab_convid_layout()
    if tab == "tab-won-cust":
        return tab_customer_layout("woncust", default_stage="Won")
    if tab == "tab-lost-cust":
        return tab_customer_layout("lostcust", default_stage="Lost")
    if tab == "tab-conv-cust":
        return tab_convcust_layout()
    if tab == "tab-raw":
        return tab_raw_layout()
    return html.Div("Unknown tab")


@app.callback(
    Output("open-grid", "rowData"),
    Output("open-grid", "columnDefs"),
    Input("open-pipeline", "value"),
    Input("open-closed", "value"),
    Input("hidezero-global", "value"),
)
def open_update(pipeline_value: str, closed_mode: str, hide_zero: bool):
    dff = add_weeks_bucket(apply_common_filters(df.copy(), pipeline_value, closed_mode))
    row_dims = [STAGE_COL, USER_COL]
    pivot_df = pivot_sum(dff, row_dims=row_dims)

    if hide_zero:
        pivot_df = hide_zero_rows(pivot_df)

    bucket_cols = [c for c in pivot_df.columns if c not in row_dims + ["Grand Total"] and not str(c).startswith("__")]
    pivot_df = pivot_df[row_dims + sorted(bucket_cols, key=lambda x: int(x)) + ["Grand Total"] + [f"__{d}" for d in row_dims]]
    return pivot_df.to_dict("records"), col_defs_for_sum_pivot(pivot_df, row_dims, money=True)


@app.callback(
    Output("open-detail", "rowData"),
    Output("open-detail", "columnDefs"),
    Output("open-debug", "children"),
    Input("open-grid", "selectedRows"),
    Input("open-grid", "cellClicked"),
    State("open-pipeline", "value"),
    State("open-closed", "value"),
)
def open_drill(selected_rows, cell_clicked, pipeline_value, closed_mode):
    if not selected_rows:
        return [], [], " "

    row = selected_rows[0]
    stage = str(row.get(f"__{STAGE_COL}", "")).strip()
    user = str(row.get(f"__{USER_COL}", "")).strip()

    if not cell_clicked:
        return [], [], f"Selected stage='{stage}', user='{user}'. Now click a week column cell."

    col_id = str(cell_clicked.get("colId", "")).strip()
    val = cell_clicked.get("value", None)

    if col_id in (STAGE_COL, USER_COL, "Grand Total", f"__{STAGE_COL}", f"__{USER_COL}", ""):
        return no_update, no_update, f"Clicked '{col_id}' (not a week). Click a week number column."

    try:
        week = int(col_id)
    except Exception:
        return no_update, no_update, f"Couldn’t parse week from '{col_id}'."

    if is_zero(val):
        return [], [], f"Week {week}: 0 value — no rows to show."

    base = add_weeks_bucket(apply_common_filters(df.copy(), pipeline_value, closed_mode))
    base["_stage"] = base[STAGE_COL].astype(str).str.strip()
    base["_user"] = base[USER_COL].astype(str).str.strip()

    match = base[(base["_stage"] == stage) & (base["_user"] == user) & (base["bucket"] == week)].copy()
    match = nice_detail_columns(match)
    match = add_markdown_link_column(match, url_col="brevoDealLink", out_col="Link")
    return match.to_dict("records"), col_defs_with_links(match), f"stage='{stage}', user='{user}', week={week} → {len(match)} row(s)"


@app.callback(
    Output("lost-grid", "rowData"),
    Output("lost-grid", "columnDefs"),
    Input("lost-pipeline", "value"),
    Input("lost-stage", "value"),
    Input("lost-closed", "value"),
    Input("hidezero-global", "value"),
)
def lost_update(pipeline_value, stage_value, closed_mode, hide_zero):
    dff = apply_common_filters(df.copy(), pipeline_value, closed_mode)
    if STAGE_COL in dff.columns and stage_value and stage_value != "__ALL__":
        dff = dff[dff[STAGE_COL].astype(str).str.strip() == str(stage_value).strip()]

    dff = add_weeks_bucket(dff)
    row_dims = [USER_COL, REASON_COL]
    pivot_df = pivot_sum(dff, row_dims=row_dims)

    if hide_zero:
        pivot_df = hide_zero_rows(pivot_df)

    bucket_cols = [c for c in pivot_df.columns if c not in row_dims + ["Grand Total"] and not str(c).startswith("__")]
    pivot_df = pivot_df[row_dims + sorted(bucket_cols, key=lambda x: int(x)) + ["Grand Total"] + [f"__{d}" for d in row_dims]]
    return pivot_df.to_dict("records"), col_defs_for_sum_pivot(pivot_df, row_dims, money=True)


@app.callback(
    Output("lost-detail", "rowData"),
    Output("lost-detail", "columnDefs"),
    Output("lost-debug", "children"),
    Input("lost-grid", "selectedRows"),
    Input("lost-grid", "cellClicked"),
    State("lost-pipeline", "value"),
    State("lost-stage", "value"),
    State("lost-closed", "value"),
)
def lost_drill(selected_rows, cell_clicked, pipeline_value, stage_value, closed_mode):
    if not selected_rows:
        return [], [], " "

    row = selected_rows[0]
    user = str(row.get(f"__{USER_COL}", "")).strip()
    reason = str(row.get(f"__{REASON_COL}", "")).strip()

    if not cell_clicked:
        return [], [], f"Selected user='{user}', reason='{reason}'. Now click a week column cell."

    col_id = str(cell_clicked.get("colId", "")).strip()
    val = cell_clicked.get("value", None)

    if col_id in (USER_COL, REASON_COL, "Grand Total", f"__{USER_COL}", f"__{REASON_COL}", ""):
        return no_update, no_update, f"Clicked '{col_id}' (not a week). Click a week number column."

    try:
        week = int(col_id)
    except Exception:
        return no_update, no_update, f"Couldn’t parse week from '{col_id}'."

    if is_zero(val):
        return [], [], f"Week {week}: 0 value — no rows to show."

    base = apply_common_filters(df.copy(), pipeline_value, closed_mode)
    if STAGE_COL in base.columns and stage_value and stage_value != "__ALL__":
        base = base[base[STAGE_COL].astype(str).str.strip() == str(stage_value).strip()]

    base = add_weeks_bucket(base)
    base["_user"] = base[USER_COL].astype(str).str.strip()
    base["_reason"] = base[REASON_COL].astype(str).str.strip()

    match = base[(base["_user"] == user) & (base["_reason"] == reason) & (base["bucket"] == week)].copy()
    match = nice_detail_columns(match)
    match = add_markdown_link_column(match, url_col="brevoDealLink", out_col="Link")
    return match.to_dict("records"), col_defs_with_links(match), f"user='{user}', reason='{reason}', week={week} → {len(match)} row(s)"


def ym_build(stage_value: str, pipeline_value: str) -> pd.DataFrame:
    dff = df.copy()
    if PIPELINE_COL in dff.columns and pipeline_value and pipeline_value != "__ALL__":
        dff = dff[dff[PIPELINE_COL].astype(str).str.strip() == str(pipeline_value).strip()]
    if STAGE_COL in dff.columns:
        dff = dff[dff[STAGE_COL].astype(str).str.strip() == stage_value]
    return add_year_month_bucket(dff, date_col=UPDATED_COL)


@app.callback(
    Output("wonid-grid", "rowData"),
    Output("wonid-grid", "columnDefs"),
    Input("wonid-pipeline", "value"),
    Input("hidezero-global", "value"),
)
def wonid_update(pipeline_value, hide_zero):
    dff = ym_build("Won", pipeline_value)
    row_dims = [USER_COL]
    pivot_df = pivot_sum(dff, row_dims=row_dims)

    if hide_zero:
        pivot_df = hide_zero_rows(pivot_df)

    bucket_cols = [c for c in pivot_df.columns if c not in row_dims + ["Grand Total"] and not str(c).startswith("__")]
    pivot_df = pivot_df[row_dims + sorted(bucket_cols, key=month_sort_key) + ["Grand Total"] + [f"__{d}" for d in row_dims]]
    return pivot_df.to_dict("records"), col_defs_for_sum_pivot(pivot_df, row_dims, money=True)


@app.callback(
    Output("wonid-detail", "rowData"),
    Output("wonid-detail", "columnDefs"),
    Output("wonid-debug", "children"),
    Input("wonid-grid", "selectedRows"),
    Input("wonid-grid", "cellClicked"),
    State("wonid-pipeline", "value"),
)
def wonid_drill(selected_rows, cell_clicked, pipeline_value):
    if not selected_rows:
        return [], [], " "

    user = str(selected_rows[0].get(f"__{USER_COL}", "")).strip()

    if not cell_clicked:
        return [], [], f"Selected user='{user}'. Now click a month column cell."

    bucket = str(cell_clicked.get("colId", "")).strip()
    val = cell_clicked.get("value", None)

    if bucket in (USER_COL, "Grand Total", f"__{USER_COL}", ""):
        return no_update, no_update, f"Clicked '{bucket}' (not a month). Click a month column."

    if is_zero(val):
        return [], [], f"{bucket}: 0 value — no rows to show."

    base = ym_build("Won", pipeline_value)
    base["_user"] = base[USER_COL].astype(str).str.strip()

    match = base[(base["_user"] == user) & (base["bucket"] == bucket)].copy()
    match = nice_detail_columns(match)
    match = add_markdown_link_column(match, url_col="brevoDealLink", out_col="Link")
    return match.to_dict("records"), col_defs_with_links(match), f"user='{user}', month='{bucket}' → {len(match)} row(s)"


@app.callback(
    Output("lostid-grid", "rowData"),
    Output("lostid-grid", "columnDefs"),
    Input("lostid-pipeline", "value"),
    Input("hidezero-global", "value"),
)
def lostid_update(pipeline_value, hide_zero):
    dff = ym_build("Lost", pipeline_value)
    row_dims = [USER_COL]
    pivot_df = pivot_sum(dff, row_dims=row_dims)

    if hide_zero:
        pivot_df = hide_zero_rows(pivot_df)

    bucket_cols = [c for c in pivot_df.columns if c not in row_dims + ["Grand Total"] and not str(c).startswith("__")]
    pivot_df = pivot_df[row_dims + sorted(bucket_cols, key=month_sort_key) + ["Grand Total"] + [f"__{d}" for d in row_dims]]
    return pivot_df.to_dict("records"), col_defs_for_sum_pivot(pivot_df, row_dims, money=True)


@app.callback(
    Output("lostid-detail", "rowData"),
    Output("lostid-detail", "columnDefs"),
    Output("lostid-debug", "children"),
    Input("lostid-grid", "selectedRows"),
    Input("lostid-grid", "cellClicked"),
    State("lostid-pipeline", "value"),
)
def lostid_drill(selected_rows, cell_clicked, pipeline_value):
    if not selected_rows:
        return [], [], " "

    user = str(selected_rows[0].get(f"__{USER_COL}", "")).strip()

    if not cell_clicked:
        return [], [], f"Selected user='{user}'. Now click a month column cell."

    bucket = str(cell_clicked.get("colId", "")).strip()
    val = cell_clicked.get("value", None)

    if bucket in (USER_COL, "Grand Total", f"__{USER_COL}", ""):
        return no_update, no_update, f"Clicked '{bucket}' (not a month). Click a month column."

    if is_zero(val):
        return [], [], f"{bucket}: 0 value — no rows to show."

    base = ym_build("Lost", pipeline_value)
    base["_user"] = base[USER_COL].astype(str).str.strip()

    match = base[(base["_user"] == user) & (base["bucket"] == bucket)].copy()
    match = nice_detail_columns(match)
    match = add_markdown_link_column(match, url_col="brevoDealLink", out_col="Link")
    return match.to_dict("records"), col_defs_with_links(match), f"user='{user}', month='{bucket}' → {len(match)} row(s)"

@app.callback(
    Output("convid-grid", "rowData"),
    Output("convid-grid", "columnDefs"),
    Input("convid-pipeline", "value"),
    Input("hidezero-global", "value"),
)
def convid_update(pipeline_value, hide_zero):
    conv_df = build_id_conversion_pivot(pipeline_value)
    if hide_zero:
        conv_df = hide_zero_rows(conv_df)
    return conv_df.to_dict("records"), col_defs_for_percent_pivot(conv_df, USER_COL)


@app.callback(
    Output("convid-detail", "rowData"),
    Output("convid-detail", "columnDefs"),
    Output("convid-debug", "children"),
    Input("convid-grid", "selectedRows"),
    Input("convid-grid", "cellClicked"),
    State("convid-pipeline", "value"),
)
def convid_drill(selected_rows, cell_clicked, pipeline_value):
    if not selected_rows:
        return [], [], " "

    user = str(selected_rows[0].get("__id", "")).strip()

    if not cell_clicked:
        return [], [], f"Selected user='{user}'. Now click a month % cell."

    bucket = str(cell_clicked.get("colId", "")).strip()
    val = cell_clicked.get("value", None)

    if bucket in (USER_COL, "Grand Total", "__id", ""):
        return no_update, no_update, f"Clicked '{bucket}' (not a month). Click a month column."

    if is_zero(val):
        return [], [], f"{bucket}: 0% — no rows to show."

    base = df.copy()
    if PIPELINE_COL in base.columns and pipeline_value and pipeline_value != "__ALL__":
        base = base[base[PIPELINE_COL].astype(str).str.strip() == str(pipeline_value).strip()]
    base = add_year_month_bucket(base, date_col=UPDATED_COL)

    base["_user"] = base[USER_COL].astype(str).str.strip()
    base["_stage"] = base[STAGE_COL].astype(str).str.strip()

    match = base[(base["_user"] == user) & (base["bucket"] == bucket) & (base["_stage"].isin(["Won", "Lost"]))].copy()
    match = nice_detail_columns(match)
    match = add_markdown_link_column(match, url_col="brevoDealLink", out_col="Link")
    pct = "" if val is None else f"{round(val * 100)}%"
    return match.to_dict("records"), col_defs_with_links(match), f"user='{user}', month='{bucket}', conversion={pct} → {len(match)} row(s)"


def customer_grid_col_defs(pivot: pd.DataFrame) -> list[dict[str, Any]]:
    defs: list[dict[str, Any]] = []
    for c in pivot.columns:
        c = str(c)
        cd: dict[str, Any] = {"field": c, "sortable": True, "filter": True, "resizable": True, "minWidth": 120}
        if c == CUSTOMER_COL:
            cd["headerName"] = "Customer Name"
            cd["pinned"] = "left"
            cd["minWidth"] = 260
        elif c == "Grand Total" or c.startswith("20"):
            cd["type"] = "numericColumn"
            cd["valueFormatter"] = FMT_MONEY
            if c == "Grand Total":
                cd["pinned"] = "right"
        elif c.startswith("__"):
            cd["hide"] = True
        defs.append(cd)
    return defs


@app.callback(
    Output("woncust-grid", "rowData"),
    Output("woncust-grid", "columnDefs"),
    Input("woncust-pipeline", "value"),
    Input("woncust-stage", "value"),
    Input("woncust-hidezero", "value"),
)
def woncust_update(pipeline_value, stage_value, hide_zero_list):
    hide_zero = 1 in (hide_zero_list or [])
    dff = df.copy()

    if PIPELINE_COL in dff.columns and pipeline_value and pipeline_value != "__ALL__":
        dff = dff[dff[PIPELINE_COL].astype(str).str.strip() == str(pipeline_value).strip()]
    if stage_value and stage_value != "__ALL__":
        dff = dff[dff[STAGE_COL].astype(str).str.strip() == str(stage_value).strip()]

    pivot = build_customer_sum_pivot(dff, date_col=UPDATED_COL)
    if hide_zero:
        pivot = hide_zero_rows(pivot)

    return pivot.to_dict("records"), customer_grid_col_defs(pivot)


@app.callback(
    Output("lostcust-grid", "rowData"),
    Output("lostcust-grid", "columnDefs"),
    Input("lostcust-pipeline", "value"),
    Input("lostcust-stage", "value"),
    Input("lostcust-hidezero", "value"),
)
def lostcust_update(pipeline_value, stage_value, hide_zero_list):
    hide_zero = 1 in (hide_zero_list or [])
    dff = df.copy()

    if PIPELINE_COL in dff.columns and pipeline_value and pipeline_value != "__ALL__":
        dff = dff[dff[PIPELINE_COL].astype(str).str.strip() == str(pipeline_value).strip()]
    if stage_value and stage_value != "__ALL__":
        dff = dff[dff[STAGE_COL].astype(str).str.strip() == str(stage_value).strip()]

    pivot = build_customer_sum_pivot(dff, date_col=UPDATED_COL)
    if hide_zero:
        pivot = hide_zero_rows(pivot)

    return pivot.to_dict("records"), customer_grid_col_defs(pivot)


def customer_month_drill(
    selected_rows,
    cell,
    pipeline_value: str,
    stage_value: str,
):
    if not selected_rows or not cell:
        return [], [], " "

    col_id = str(cell.get("colId", "")).strip()
    val = cell.get("value", None)

    try:
        pd.to_datetime(col_id, format="%Y-%m")
        is_month_col = True
    except Exception:
        is_month_col = False

    if not is_month_col:
        return no_update, no_update, f"Clicked '{col_id}' (not a month column)."

    if is_zero(val):
        return [], [], f"{col_id}: 0 value — no rows to show."

    customer = str(selected_rows[0].get("__customer", "")).strip()
    if not customer:
        return [], [], "Couldn’t read customer from selected row."

    dff = df.copy()
    if PIPELINE_COL in dff.columns and pipeline_value and pipeline_value != "__ALL__":
        dff = dff[dff[PIPELINE_COL].astype(str).str.strip() == str(pipeline_value).strip()]
    if stage_value and stage_value != "__ALL__":
        dff = dff[dff[STAGE_COL].astype(str).str.strip() == str(stage_value).strip()]

    match = dff[dff[CUSTOMER_COL].astype(str).str.strip() == customer].copy()
    match = match[match[UPDATED_COL].notna()].copy()
    match["_month"] = match[UPDATED_COL].dt.to_period("M").astype(str)
    match = match[match["_month"] == col_id].drop(columns=["_month"], errors="ignore")

    match[AMOUNT_COL] = pd.to_numeric(match[AMOUNT_COL], errors="coerce")
    match = match[match[AMOUNT_COL].notna() & (match[AMOUNT_COL] != 0)]
    match = nice_detail_columns(match)

    if match.empty:
        return [], [], f"{customer} | {col_id}: no contributing rows."

    match = add_markdown_link_column(match, url_col="brevoDealLink", out_col="Link")
    return match.to_dict("records"), col_defs_with_links(match), f"{customer} | {col_id}: {len(match)} deal(s)"


@app.callback(
    Output("woncust-detail", "rowData"),
    Output("woncust-detail", "columnDefs"),
    Output("woncust-debug", "children"),
    Input("woncust-grid", "selectedRows"),
    Input("woncust-grid", "cellClicked"),
    State("woncust-pipeline", "value"),
    State("woncust-stage", "value"),
)
def woncust_drill(selected_rows, cell, pipeline_value, stage_value):
    return customer_month_drill(selected_rows, cell, pipeline_value, stage_value)


@app.callback(
    Output("lostcust-detail", "rowData"),
    Output("lostcust-detail", "columnDefs"),
    Output("lostcust-debug", "children"),
    Input("lostcust-grid", "selectedRows"),
    Input("lostcust-grid", "cellClicked"),
    State("lostcust-pipeline", "value"),
    State("lostcust-stage", "value"),
)
def lostcust_drill(selected_rows, cell, pipeline_value, stage_value):
    return customer_month_drill(selected_rows, cell, pipeline_value, stage_value)


@app.callback(
    Output("convcust-grid", "rowData"),
    Output("convcust-grid", "columnDefs"),
    Input("convcust-pipeline", "value"),
    Input("hidezero-global", "value"),
)
def convcust_update(pipeline_value, hide_zero):
    dff = df.copy()
    if PIPELINE_COL in dff.columns and pipeline_value and pipeline_value != "__ALL__":
        dff = dff[dff[PIPELINE_COL].astype(str).str.strip() == str(pipeline_value).strip()]

    conv_df = build_customer_conversion_pivot(dff, date_col=UPDATED_COL)
    if hide_zero:
        conv_df = hide_zero_rows(conv_df)

    return conv_df.to_dict("records"), col_defs_for_percent_pivot(conv_df, CUSTOMER_COL)


@app.callback(
    Output("convcust-detail", "rowData"),
    Output("convcust-detail", "columnDefs"),
    Output("convcust-debug", "children"),
    Input("convcust-grid", "selectedRows"),
    Input("convcust-grid", "cellClicked"),
    State("convcust-pipeline", "value"),
)
def convcust_drill(selected_rows, cell, pipeline_value):
    if not selected_rows or not cell:
        return [], [], " "

    customer = str(selected_rows[0].get("__customer", "")).strip()

    col_id = str(cell.get("colId", "")).strip()
    val = cell.get("value", None)

    try:
        pd.to_datetime(col_id, format="%Y-%m")
        is_month_col = True
    except Exception:
        is_month_col = False

    if not is_month_col:
        return no_update, no_update, f"Clicked '{col_id}' (not a month column)."

    if is_zero(val):
        return [], [], f"{col_id}: 0% — no rows to show."

    dff = df.copy()
    if PIPELINE_COL in dff.columns and pipeline_value and pipeline_value != "__ALL__":
        dff = dff[dff[PIPELINE_COL].astype(str).str.strip() == str(pipeline_value).strip()]

    match = dff[dff[CUSTOMER_COL].astype(str).str.strip() == customer].copy()
    match = match[match[UPDATED_COL].notna()].copy()
    match["_month"] = match[UPDATED_COL].dt.to_period("M").astype(str)
    match = match[match["_month"] == col_id].drop(columns=["_month"], errors="ignore")

    match["_stage"] = match[STAGE_COL].astype(str).str.strip()
    match = match[match["_stage"].isin(["Won", "Lost"])].drop(columns=["_stage"], errors="ignore")

    match = nice_detail_columns(match)
    match = add_markdown_link_column(match, url_col="brevoDealLink", out_col="Link")
    pct = "" if val is None else f"{round(val * 100)}%"
    return match.to_dict("records"), col_defs_with_links(match), f"{customer} | {col_id}: conversion {pct} → {len(match)} deal(s)"


@app.callback(
    Output("viz-stage-bar", "figure"),
    Output("viz-trend-line", "figure"),
    Output("viz-user-bar", "figure"),
    Input("viz-pipeline", "value"),
    Input("viz-closed", "value"),
    Input("viz-date-mode", "value"),
)
def viz_update(pipeline_value, closed_mode, date_mode):
    dff = apply_common_filters(df.copy(), pipeline_value, closed_mode)
    dff[AMOUNT_COL] = pd.to_numeric(dff.get(AMOUNT_COL), errors="coerce").fillna(0)

    # ---- Chart 1: £ by Stage
    if STAGE_COL in dff.columns:
        stage_sum = (
            dff.assign(_stage=dff[STAGE_COL].astype(str).str.strip())
            .groupby("_stage", dropna=False)[AMOUNT_COL]
            .sum()
            .sort_values(ascending=False)
            .reset_index()
            .rename(columns={"_stage": STAGE_COL, AMOUNT_COL: "Amount"})
        )
    else:
        stage_sum = pd.DataFrame({STAGE_COL: [], "Amount": []})

    fig_stage = px.bar(stage_sum, x=STAGE_COL, y="Amount", custom_data=[STAGE_COL])

    # ---- Chart 2: Trend (Won vs Lost)
    trend = dff.copy()
    trend[UPDATED_COL] = pd.to_datetime(trend.get(UPDATED_COL), errors="coerce")
    trend = trend[trend[UPDATED_COL].notna()].copy()
    trend["_stage"] = trend.get(STAGE_COL, "").astype(str).str.strip()
    trend = trend[trend["_stage"].isin(["Won", "Lost"])].copy()

    if date_mode == "weeks":
        trend = add_weeks_bucket(trend, date_col=UPDATED_COL)
        trend["_x"] = pd.to_numeric(trend["bucket"], errors="coerce")
        x_title = "Week bucket (0 = this week)"
    else:
        trend["_x"] = trend[UPDATED_COL].dt.to_period("M").astype(str)
        x_title = "Year-Month"

    trend_sum = (
        trend.groupby(["_x", "_stage"], dropna=False)[AMOUNT_COL]
        .sum()
        .reset_index()
        .rename(columns={AMOUNT_COL: "Amount"})
        .sort_values("_x")
    )

    fig_trend = px.line(trend_sum, x="_x", y="Amount", color="_stage", markers=True, custom_data=["_stage", "_x"])
    if date_mode == "weeks":
        fig_trend.update_xaxes(type="linear")
    fig_trend.update_layout(xaxis_title=x_title, yaxis_title="£")

    # ---- Chart 3: Top Users by £
    if USER_COL in dff.columns:
        user_sum = (
            dff.assign(_user=dff[USER_COL].astype(str).str.strip())
            .groupby("_user", dropna=False)[AMOUNT_COL]
            .sum()
            .sort_values(ascending=False)
            .head(15)
            .reset_index()
            .rename(columns={"_user": USER_COL, AMOUNT_COL: "Amount"})
        )
    else:
        user_sum = pd.DataFrame({USER_COL: [], "Amount": []})

    fig_user = px.bar(user_sum, x=USER_COL, y="Amount", custom_data=[USER_COL])

    # Formatting
    for f in (fig_stage, fig_trend, fig_user):
        f.update_yaxes(tickprefix="£", separatethousands=True)
    fig_stage.update_traces(hovertemplate="%{x}<br>£%{y:,.0f}<extra></extra>")
    fig_user.update_traces(hovertemplate="%{x}<br>£%{y:,.0f}<extra></extra>")
    fig_trend.update_traces(hovertemplate="%{x}<br>£%{y:,.0f}<extra></extra>")

    fig_stage = style_fig(fig_stage, "£ by Stage")
    fig_trend = style_fig(fig_trend, "£ Trend (Won vs Lost)")
    fig_user = style_fig(fig_user, "Top Users by £")
    return fig_stage, fig_trend, fig_user


@app.callback(
    Output("viz-detail", "rowData"),
    Output("viz-detail", "columnDefs"),
    Output("viz-debug", "children"),
    Input("viz-stage-bar", "clickData"),
    Input("viz-trend-line", "clickData"),
    Input("viz-user-bar", "clickData"),
    State("viz-pipeline", "value"),
    State("viz-closed", "value"),
    State("viz-date-mode", "value"),
)
def viz_drill(stage_click, trend_click, user_click, pipeline_value, closed_mode, date_mode):
    import dash

    ctx = dash.callback_context
    if not ctx.triggered:
        return [], [], "Click a chart to drill down."

    trig = ctx.triggered[0]["prop_id"].split(".")[0]

    base = apply_common_filters(df.copy(), pipeline_value, closed_mode)
    base[AMOUNT_COL] = pd.to_numeric(base.get(AMOUNT_COL), errors="coerce").fillna(0)

    def finish(match: pd.DataFrame, msg: str):
        if match is None or match.empty:
            return [], [], msg
        match = nice_detail_columns(match)
        match = add_markdown_link_column(match, url_col="brevoDealLink", out_col="Link")
        return match.to_dict("records"), col_defs_with_links(match), msg

    # Stage bar click
    if trig == "viz-stage-bar" and stage_click:
        p = stage_click.get("points", [{}])[0]
        cd = p.get("customdata") or []
        stage = str(cd[0] if cd else p.get("x", "")).strip()
        if not stage:
            return [], [], "Couldn’t read stage from click."
        match = base[base[STAGE_COL].astype(str).str.strip() == stage].copy()
        match = match[match[AMOUNT_COL] != 0].copy()
        return finish(match, f"Stage='{stage}' → {len(match)} row(s)")

    # User bar click
    if trig == "viz-user-bar" and user_click:
        p = user_click.get("points", [{}])[0]
        cd = p.get("customdata") or []
        user = str(cd[0] if cd else p.get("x", "")).strip()
        if not user:
            return [], [], "Couldn’t read user from click."
        match = base[base[USER_COL].astype(str).str.strip() == user].copy()
        match = match[match[AMOUNT_COL] != 0].copy()
        return finish(match, f"User='{user}' → {len(match)} row(s)")

    # Trend point click (Won/Lost + bucket)
    if trig == "viz-trend-line" and trend_click:
        p = trend_click.get("points", [{}])[0]
        cd = p.get("customdata") or []
        stage = str(cd[0] if len(cd) > 0 else "").strip()
        xval = str(cd[1] if len(cd) > 1 else p.get("x", "")).strip()
        if not stage or not xval:
            return [], [], "Couldn’t read trend point from click."

        match = base[base[STAGE_COL].astype(str).str.strip() == stage].copy()
        match[UPDATED_COL] = pd.to_datetime(match.get(UPDATED_COL), errors="coerce")
        match = match[match[UPDATED_COL].notna()].copy()

        if date_mode == "weeks":
            match = add_weeks_bucket(match, date_col=UPDATED_COL)
            try:
                wk = int(xval)
            except Exception:
                return [], [], f"Couldn’t parse week from '{xval}'."
            match = match[match["bucket"] == wk].copy()
            msg = f"Trend click: Stage='{stage}', week={wk} → {len(match)} row(s)"
        else:
            match["_month"] = match[UPDATED_COL].dt.to_period("M").astype(str)
            match = match[match["_month"] == xval].drop(columns=["_month"], errors="ignore")
            msg = f"Trend click: Stage='{stage}', month='{xval}' → {len(match)} row(s)"

        match = match[match[AMOUNT_COL] != 0].copy()
        return finish(match, msg)

    return [], [], "Click a chart element to drill down."


@app.callback(
    Output("viz-download", "data"),
    Input("viz-export-filtered", "n_clicks"),
    Input("viz-export-detail", "n_clicks"),
    State("viz-detail", "rowData"),
    State("viz-pipeline", "value"),
    State("viz-closed", "value"),
    prevent_initial_call=True,
)
def export_viz(_n_filtered, _n_detail, detail_rows, pipeline_value, closed_mode):
    import dash

    ctx = dash.callback_context
    trig = ctx.triggered[0]["prop_id"].split(".")[0] if ctx.triggered else ""

    if trig == "viz-export-detail":
        dff = pd.DataFrame(detail_rows or [])
        return dcc.send_bytes(df_to_excel_bytes(dff, "Viz_DrillDown"), f"viz_drilldown_{stamp()}.xlsx")

    dff = apply_common_filters(df.copy(), pipeline_value, closed_mode)
    return dcc.send_bytes(df_to_excel_bytes(clean_export_df(dff), "Viz_Filtered"), f"viz_filtered_{stamp()}.xlsx")

def make_export_callback(prefix: str, pivot_grid_id: str, detail_grid_id: str, sheet_base: str):
    @app.callback(
        Output(f"{prefix}-download", "data"),
        Input(f"{prefix}-export-pivot", "n_clicks"),
        Input(f"{prefix}-export-detail", "n_clicks"),
        State(pivot_grid_id, "rowData"),
        State(detail_grid_id, "rowData"),
        prevent_initial_call=True,
    )
    def _export(_n_pivot, _n_detail, pivot_rows, detail_rows):
        import dash

        ctx = dash.callback_context
        trig = ctx.triggered[0]["prop_id"].split(".")[0] if ctx.triggered else ""

        if trig.endswith("export-detail"):
            dff = pd.DataFrame(detail_rows or [])
            return dcc.send_bytes(df_to_excel_bytes(dff, f"{sheet_base}_Detail"), f"{prefix}_detail_{stamp()}.xlsx")

        dff = pd.DataFrame(pivot_rows or [])
        return dcc.send_bytes(df_to_excel_bytes(dff, f"{sheet_base}_Pivot"), f"{prefix}_pivot_{stamp()}.xlsx")

    return _export


@app.callback(
    Output("raw-download", "data"),
    Input("raw-export-pivot", "n_clicks"),
    Input("raw-export-detail", "n_clicks"),
    State("raw-grid", "rowData"),
    prevent_initial_call=True,
)

def export_raw(_n1, _n2, rows):
    dff = pd.DataFrame(rows or [])
    return dcc.send_bytes(df_to_excel_bytes(dff, "RawData"), f"raw_{stamp()}.xlsx")



make_export_callback("open", "open-grid", "open-detail", "OpenWeeks")
make_export_callback("lost", "lost-grid", "lost-detail", "LostWeeks")
make_export_callback("wonid", "wonid-grid", "wonid-detail", "WonID")
make_export_callback("lostid", "lostid-grid", "lostid-detail", "LostID")
make_export_callback("convid", "convid-grid", "convid-detail", "ConvID")
make_export_callback("woncust", "woncust-grid", "woncust-detail", "WonCust")
make_export_callback("lostcust", "lostcust-grid", "lostcust-detail", "LostCust")
make_export_callback("convcust", "convcust-grid", "convcust-detail", "ConvCust")


#if __name__ == "__main__":
#    app.run(host="0.0.0.0", port=8050, debug=True)

if __name__ == "__main__":
    app.run(debug=True)
