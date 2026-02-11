import { pgQuery } from "../../connections/postgres.js";

export async function lookupCustomer(query: string) {
  const result = await pgQuery(
    `SELECT id, "accountNumber", name, prospect, risk_rating
     FROM mv_customer_metrics
     WHERE ("name" ILIKE $1 OR "accountNumber" ILIKE $1)
       AND "name" IS NOT NULL AND "name" != ''
     ORDER BY name
     LIMIT 20`,
    [`%${query}%`]
  );
  return result.rows;
}

export async function getCustomerProfile(accountNumber: string) {
  const result = await pgQuery(
    `SELECT
       mv.id,
       mv."accountNumber",
       mv.name,
       mv.branch,
       mv."creditLimit",
       mv."creditTerms",
       mv.legal,
       mv.on_stop,
       mv."accountManagerId",
       mv."accountManagerName",
       mv.insurance_limit,
       mv.prospect,
       mv.ytd_transaction_volume,
       mv.transaction_volume,
       mv.running_balance,
       mv.credit_usage,
       mv.allocated_transaction_volume,
       mv.risk_score,
       mv.risk_rating,
       mv.days_beyond_terms,
       mv.weighted_days_beyond_terms,
       mv.remaining_invoice_balance,
       mv.on_stop_status,
       mv.experian_credit_limit,
       mv.experian_credit_score,
       mv.last_site_visit,
       mv.visits_ytd,
       cp.company_number,
       cp.sleep_until_date,
       cp.sleep_reason,
       cp."accountSince"
     FROM mv_customer_metrics mv
     LEFT JOIN customer_profile cp ON mv.id = cp.id
     WHERE mv."accountNumber" = $1
     LIMIT 1`,
    [accountNumber]
  );
  return result.rows[0] || null;
}

export async function listCustomers(options: {
  page?: number;
  limit?: number;
  branch?: string;
  repId?: string;
  riskRating?: number;
  onStop?: boolean;
  sortBy?: string;
  sortOrder?: string;
}) {
  const {
    page = 1,
    limit = 20,
    branch,
    repId,
    riskRating,
    onStop,
    sortBy = "name",
    sortOrder = "ASC",
  } = options;

  const conditions: string[] = [
    `"name" IS NOT NULL`,
    `"name" != ''`,
  ];
  const params: any[] = [];
  let paramIdx = 1;

  if (branch) {
    conditions.push(`branch = $${paramIdx++}`);
    params.push(branch);
  }
  if (repId) {
    conditions.push(`"accountManagerId" = $${paramIdx++}`);
    params.push(repId);
  }
  if (riskRating !== undefined) {
    conditions.push(`risk_rating = $${paramIdx++}`);
    params.push(riskRating);
  }
  if (onStop !== undefined) {
    conditions.push(`on_stop = $${paramIdx++}`);
    params.push(onStop);
  }

  const validSortFields = [
    "name", "risk_rating", "running_balance", "days_beyond_terms",
    "credit_usage", "transaction_volume", "risk_score",
  ];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "name";
  const safeSortOrder = sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";

  const offset = (page - 1) * limit;

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const [countResult, dataResult] = await Promise.all([
    pgQuery(
      `SELECT COUNT(*) as total FROM mv_customer_metrics ${whereClause}`,
      params
    ),
    pgQuery(
      `SELECT
         id, "accountNumber", name, branch, "creditLimit", "creditTerms",
         on_stop, "accountManagerName", insurance_limit, prospect,
         risk_rating, risk_score, running_balance, days_beyond_terms,
         credit_usage, transaction_volume, ytd_transaction_volume,
         remaining_invoice_balance, experian_credit_limit
       FROM mv_customer_metrics
       ${whereClause}
       ORDER BY "${safeSortBy}" ${safeSortOrder} NULLS LAST
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
  ]);

  return {
    customers: dataResult.rows,
    totalCount: parseInt(countResult.rows[0].total),
    page,
    pageSize: limit,
    totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
  };
}

export async function getCustomerIntelligence(
  accountNumber: string,
  limit: number = 20
) {
  const result = await pgQuery(
    `SELECT i.id, i.account_number, i.customer_name, i.intelligence_type,
            i.title, i.value, i.call_id, i.timestamp, i.rep_name, i.version
     FROM intelligence i
     JOIN customer_profile cp ON i.customer_id = cp.id
     WHERE cp."accountNumber" = $1
     ORDER BY i.timestamp DESC
     LIMIT $2`,
    [accountNumber, limit]
  );
  return result.rows;
}

export async function getCustomerAlertsHistory(
  accountNumber: string,
  limit: number = 20
) {
  const result = await pgQuery(
    `SELECT a.id, a.account_number, a.customer_name, a.score, a.timestamp,
            a.explanation, a.explanation_summary, a.feature_data,
            a.rating, a.action, a.reviewer_name
     FROM alerts a
     WHERE a.account_number = $1
     ORDER BY a.timestamp DESC
     LIMIT $2`,
    [accountNumber, limit]
  );
  return result.rows;
}

export async function getCustomerMetricHistory(
  accountNumber: string,
  metricType: string,
  days: number = 90
) {
  const result = await pgQuery(
    `SELECT cme.time_period, cme.value, cme.metric_type
     FROM customer_metric_events cme
     JOIN customer_profile cp ON cme.customer_id = cp.id
     WHERE cp."accountNumber" = $1
       AND cme.metric_type = $2
       AND cme.time_period >= NOW() - INTERVAL '${days} days'
     ORDER BY cme.time_period ASC`,
    [accountNumber, metricType]
  );
  return result.rows;
}
