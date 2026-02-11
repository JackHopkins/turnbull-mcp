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
    conditions.push("c.account_number = ?");
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
    conditions.push("kp.status = ?");
    params.push(status);
  }

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  params.push(limit);

  return misQuery(
    `SELECT k.id, k.orderNumber, k.drawingNumber,
            kp.status, kp.probability, k.productName AS jobType,
            k.price, k.referral,
            k.jobCreateDate, k.jobUpdateDate, k.statusUpdateDate,
            k.lostReason, k.customerNote, k.customerReference,
            c.name AS customer_name, c.account_number,
            b.name AS branchName,
            d.designerName
     FROM kbbJobDetail k
     LEFT JOIN kbbJobProbability kp ON k.statusProbability = kp.id
     LEFT JOIN customer c ON c.kbbClientId = k.clientId
     LEFT JOIN branch b ON k.branch = b.id
     LEFT JOIN kbbDesigner d ON k.designer = d.id
     ${whereClause}
     ORDER BY k.jobCreateDate DESC
     LIMIT ?`,
    params
  );
}

export async function getKbbJobDetail(orderNumber: string) {
  const results = await misQuery(
    `SELECT k.*,
            kp.status, kp.probability,
            c.name AS customer_name, c.account_number,
            b.name AS branchName,
            d.designerName
     FROM kbbJobDetail k
     LEFT JOIN kbbJobProbability kp ON k.statusProbability = kp.id
     LEFT JOIN customer c ON c.kbbClientId = k.clientId
     LEFT JOIN branch b ON k.branch = b.id
     LEFT JOIN kbbDesigner d ON k.designer = d.id
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
    conditions.push("k.jobCreateDate >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("k.jobCreateDate <= ?");
    params.push(endDate);
  }

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  return misQuery(
    `SELECT kp.status,
            COUNT(*) AS job_count,
            SUM(k.price) AS total_value,
            SUM(k.price * kp.probability / 100) AS weighted_value,
            AVG(k.price) AS avg_value
     FROM kbbJobDetail k
     JOIN kbbJobProbability kp ON k.statusProbability = kp.id
     LEFT JOIN branch b ON k.branch = b.id
     ${whereClause}
     GROUP BY kp.status
     ORDER BY kp.status`,
    params
  );
}

export async function getKbbDesignerPerformance(
  designerId: number,
  startDate: string,
  endDate: string
) {
  const results = await misQuery(
    `SELECT d.id, d.designerName,
            COUNT(*) AS total_jobs,
            SUM(CASE WHEN kp.status = 'Won' THEN 1 ELSE 0 END) AS won_jobs,
            SUM(CASE WHEN kp.status = 'Lost' THEN 1 ELSE 0 END) AS lost_jobs,
            SUM(CASE WHEN kp.status IN ('Quoted', 'Re-Quoted', 'Quoted [customer]', 'Re-Quoted [customer]') THEN 1 ELSE 0 END) AS open_quotes,
            SUM(CASE WHEN kp.status IN ('Won', 'Fulfilled') THEN k.price ELSE 0 END) AS total_revenue,
            ROUND(SUM(CASE WHEN kp.status IN ('Won', 'Fulfilled') THEN 1 ELSE 0 END) / NULLIF(
              SUM(CASE WHEN kp.status IN ('Won', 'Fulfilled', 'Lost') THEN 1 ELSE 0 END), 0) * 100, 1
            ) AS conversion_rate,
            AVG(CASE WHEN kp.status IN ('Won', 'Fulfilled') THEN k.price ELSE NULL END) AS avg_sale_value
     FROM kbbDesigner d
     LEFT JOIN kbbJobDetail k ON k.designer = d.id
       AND k.jobCreateDate >= ? AND k.jobCreateDate <= ?
     LEFT JOIN kbbJobProbability kp ON k.statusProbability = kp.id
     WHERE d.id = ?
     GROUP BY d.id, d.designerName`,
    [startDate, endDate, designerId]
  );
  return results[0] || null;
}

export async function getKbbDesignerTargets(
  designerId: number,
  period: string
) {
  const results = await misQuery(
    `SELECT dt.id, dt.designer, dt.period, dt.target,
            d.designerName,
            (SELECT COUNT(*) FROM kbbJobDetail k
              JOIN kbbJobProbability kp ON k.statusProbability = kp.id
              WHERE k.designer = dt.designer
              AND DATE_FORMAT(k.jobCreateDate, '%Y-%m') = dt.period
              AND kp.status IN ('Quoted', 'Re-Quoted', 'Quoted [customer]', 'Re-Quoted [customer]')) AS actual_quotes,
            (SELECT SUM(k.price) FROM kbbJobDetail k
              JOIN kbbJobProbability kp ON k.statusProbability = kp.id
              WHERE k.designer = dt.designer
              AND DATE_FORMAT(k.jobCreateDate, '%Y-%m') = dt.period
              AND kp.status IN ('Won', 'Fulfilled')) AS actual_sales
     FROM kbbDesignerTarget dt
     JOIN kbbDesigner d ON dt.designer = d.id
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
    "kp.status = 'Lost'",
    "k.statusUpdateDate >= ?",
    "k.statusUpdateDate <= ?",
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
            SUM(k.price) AS total_value,
            AVG(k.price) AS avg_value
     FROM kbbJobDetail k
     JOIN kbbJobProbability kp ON k.statusProbability = kp.id
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
  const conditions = ["k.jobCreateDate >= ?", "k.jobCreateDate <= ?"];
  const params: any[] = [startDate, endDate];

  if (branchName) {
    conditions.push("b.name = ?");
    params.push(branchName);
  }

  return misQuery(
    `SELECT k.referral AS referralSource,
            COUNT(*) AS lead_count,
            SUM(CASE WHEN kp.status IN ('Won', 'Fulfilled') THEN 1 ELSE 0 END) AS won_count,
            SUM(k.price) AS total_quote_value,
            SUM(CASE WHEN kp.status IN ('Won', 'Fulfilled') THEN k.price ELSE 0 END) AS won_revenue,
            ROUND(SUM(CASE WHEN kp.status IN ('Won', 'Fulfilled') THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100, 1) AS conversion_rate
     FROM kbbJobDetail k
     JOIN kbbJobProbability kp ON k.statusProbability = kp.id
     LEFT JOIN branch b ON k.branch = b.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY k.referral
     ORDER BY lead_count DESC`,
    params
  );
}