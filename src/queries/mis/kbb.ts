import { misQuery } from "../../connections/mis-mysql.js";

export async function getKbbJobs(
  accountNumber?: string,
  branchName?: string,
  designerId?: number,
  status?: string,
  limit: number = 100
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (accountNumber) {
    conditions.push("c.accountNumber = ?");
    params.push(accountNumber);
  }
  if (branchName) {
    conditions.push("b.name = ?");
    params.push(branchName);
  }
  if (designerId) {
    conditions.push("k.designer = ?");
    params.push(designerId);
  }
  if (status) {
    conditions.push("k.status = ?");
    params.push(status);
  }

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  params.push(limit);

  return misQuery(
    `SELECT k.id, k.orderNumber, k.status, k.jobType,
            k.quoteValue, k.saleValue, k.costValue,
            k.probability, k.createdAt, k.updatedAt,
            k.lostReason, k.lostDate, k.referralSource,
            c.name AS customer_name, c.accountNumber,
            b.name AS branchName,
            d.name AS designerName
     FROM kbb_job k
     LEFT JOIN customer c ON k.customer = c.id
     LEFT JOIN branch b ON k.branch = b.id
     LEFT JOIN kbb_designer d ON k.designer = d.id
     ${whereClause}
     ORDER BY k.createdAt DESC
     LIMIT ?`,
    params
  );
}

export async function getKbbJobDetail(orderNumber: string) {
  const results = await misQuery(
    `SELECT k.*,
            c.name AS customer_name, c.accountNumber,
            b.name AS branchName,
            d.name AS designerName
     FROM kbb_job k
     LEFT JOIN customer c ON k.customer = c.id
     LEFT JOIN branch b ON k.branch = b.id
     LEFT JOIN kbb_designer d ON k.designer = d.id
     WHERE k.orderNumber = ?`,
    [orderNumber]
  );
  return results[0] || null;
}

export async function getKbbPipeline(
  branchName?: string,
  startDate?: string,
  endDate?: string
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (branchName) {
    conditions.push("b.name = ?");
    params.push(branchName);
  }
  if (startDate) {
    conditions.push("k.createdAt >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("k.createdAt <= ?");
    params.push(endDate);
  }

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  return misQuery(
    `SELECT k.status,
            COUNT(*) AS job_count,
            SUM(k.quoteValue) AS total_quote_value,
            SUM(k.saleValue) AS total_sale_value,
            SUM(k.quoteValue * COALESCE(k.probability, 0) / 100) AS weighted_value,
            AVG(k.quoteValue) AS avg_quote_value
     FROM kbb_job k
     LEFT JOIN branch b ON k.branch = b.id
     ${whereClause}
     GROUP BY k.status
     ORDER BY k.status`,
    params
  );
}

export async function getKbbDesignerPerformance(
  designerId: number,
  startDate: string,
  endDate: string
) {
  const results = await misQuery(
    `SELECT d.id, d.name AS designerName,
            COUNT(*) AS total_jobs,
            SUM(CASE WHEN k.status = 'won' THEN 1 ELSE 0 END) AS won_jobs,
            SUM(CASE WHEN k.status = 'lost' THEN 1 ELSE 0 END) AS lost_jobs,
            SUM(CASE WHEN k.status = 'quote' THEN 1 ELSE 0 END) AS open_quotes,
            SUM(CASE WHEN k.status = 'won' THEN k.saleValue ELSE 0 END) AS total_revenue,
            SUM(CASE WHEN k.status = 'won' THEN k.saleValue - k.costValue ELSE 0 END) AS total_margin,
            ROUND(SUM(CASE WHEN k.status = 'won' THEN 1 ELSE 0 END) / NULLIF(
              SUM(CASE WHEN k.status IN ('won', 'lost') THEN 1 ELSE 0 END), 0) * 100, 1
            ) AS conversion_rate,
            AVG(CASE WHEN k.status = 'won' THEN k.saleValue ELSE NULL END) AS avg_sale_value
     FROM kbb_designer d
     LEFT JOIN kbb_job k ON k.designer = d.id
       AND k.createdAt >= ? AND k.createdAt <= ?
     WHERE d.id = ?
     GROUP BY d.id, d.name`,
    [startDate, endDate, designerId]
  );
  return results[0] || null;
}

export async function getKbbDesignerTargets(
  designerId: number,
  period: string
) {
  const results = await misQuery(
    `SELECT dt.id, dt.designer, dt.period,
            dt.quoteTarget, dt.saleTarget, dt.marginTarget,
            d.name AS designerName,
            (SELECT COUNT(*) FROM kbb_job k WHERE k.designer = dt.designer
              AND DATE_FORMAT(k.createdAt, '%Y-%m') = dt.period AND k.status = 'quote') AS actual_quotes,
            (SELECT SUM(k.saleValue) FROM kbb_job k WHERE k.designer = dt.designer
              AND DATE_FORMAT(k.createdAt, '%Y-%m') = dt.period AND k.status = 'won') AS actual_sales,
            (SELECT SUM(k.saleValue - k.costValue) FROM kbb_job k WHERE k.designer = dt.designer
              AND DATE_FORMAT(k.createdAt, '%Y-%m') = dt.period AND k.status = 'won') AS actual_margin
     FROM kbb_designer_target dt
     JOIN kbb_designer d ON dt.designer = d.id
     WHERE dt.designer = ? AND dt.period = ?`,
    [designerId, period]
  );
  return results[0] || null;
}

export async function getKbbLostAnalysis(
  startDate: string,
  endDate: string,
  branchName?: string,
  designerId?: number
) {
  const conditions = [
    "k.status = 'lost'",
    "k.lostDate >= ?",
    "k.lostDate <= ?",
  ];
  const params: any[] = [startDate, endDate];

  if (branchName) {
    conditions.push("b.name = ?");
    params.push(branchName);
  }
  if (designerId) {
    conditions.push("k.designer = ?");
    params.push(designerId);
  }

  return misQuery(
    `SELECT k.lostReason,
            COUNT(*) AS job_count,
            SUM(k.quoteValue) AS total_value,
            AVG(k.quoteValue) AS avg_value
     FROM kbb_job k
     LEFT JOIN branch b ON k.branch = b.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY k.lostReason
     ORDER BY total_value DESC`,
    params
  );
}

export async function getKbbReferralSources(
  startDate: string,
  endDate: string,
  branchName?: string
) {
  const conditions = ["k.createdAt >= ?", "k.createdAt <= ?"];
  const params: any[] = [startDate, endDate];

  if (branchName) {
    conditions.push("b.name = ?");
    params.push(branchName);
  }

  return misQuery(
    `SELECT k.referralSource,
            COUNT(*) AS lead_count,
            SUM(CASE WHEN k.status = 'won' THEN 1 ELSE 0 END) AS won_count,
            SUM(k.quoteValue) AS total_quote_value,
            SUM(CASE WHEN k.status = 'won' THEN k.saleValue ELSE 0 END) AS won_revenue,
            ROUND(SUM(CASE WHEN k.status = 'won' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100, 1) AS conversion_rate
     FROM kbb_job k
     LEFT JOIN branch b ON k.branch = b.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY k.referralSource
     ORDER BY lead_count DESC`,
    params
  );
}
