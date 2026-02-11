import { pgQuery } from "../../connections/postgres.js";

export async function getRiskDistribution(branch?: string) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (branch) {
    conditions.push(`branch = $1`);
    params.push(branch);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await pgQuery(
    `SELECT
       COALESCE(CAST(risk_rating AS INTEGER), -1) as risk_rating,
       COUNT(*) as count,
       SUM(running_balance) as total_balance,
       AVG(days_beyond_terms) as avg_days_beyond_terms,
       SUM("creditLimit") as total_credit_limit
     FROM mv_customer_metrics
     ${whereClause}
     GROUP BY COALESCE(CAST(risk_rating AS INTEGER), -1)
     ORDER BY risk_rating ASC`,
    params
  );
  return result.rows;
}

export async function getCurrentAlerts(
  limit: number = 50,
  minRating?: string
) {
  const conditions: string[] = [`a.action IS NULL`];
  const params: any[] = [];
  let paramIdx = 1;

  if (minRating) {
    conditions.push(`a.rating >= $${paramIdx++}`);
    params.push(minRating);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await pgQuery(
    `SELECT a.id, a.account_number, a.customer_name, a.score,
            a.timestamp, a.explanation_summary, a.feature_data,
            a.rating, a.should_notify
     FROM alerts a
     ${whereClause}
     ORDER BY a.score DESC, a.timestamp DESC
     LIMIT $${paramIdx}`,
    [...params, limit]
  );
  return result.rows;
}

export async function getRiskEventDetail(alertId: string) {
  const result = await pgQuery(
    `SELECT a.id, a.account_number, a.customer_id, a.customer_name,
            a.score, a.timestamp, a.explanation, a.explanation_summary,
            a.feature_data, a.rating, a.action, a.reviewer_name,
            a.reviewer_id, a.should_notify, a.version,
            re.risk_rating, re.classifier_output, re.score as risk_score
     FROM alerts a
     LEFT JOIN risk_events re ON re.customer_id = a.customer_id
       AND DATE(re.time_period) = DATE(a.timestamp)
     WHERE a.id = $1
     LIMIT 1`,
    [alertId]
  );
  return result.rows[0] || null;
}

export async function getOverviewMetrics() {
  const result = await pgQuery(
    `SELECT *
     FROM overview_metrics
     WHERE time_period_type = 'DAILY'
     ORDER BY time_period DESC
     LIMIT 1`
  );
  return result.rows[0] || null;
}
