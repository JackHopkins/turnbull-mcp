import { misQuery } from "../../connections/mis-mysql.js";

/**
 * Get all Brevo deal data, optionally filtered by pipeline, stage, user, or date range.
 */
export async function getBrevoDealData(
  pipeline?: string,
  stage?: string,
  kerridgeUserId?: string,
  createdSince?: string,
  limit: number = 1000
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (pipeline) {
    conditions.push("d.brevoPipeline = ?");
    params.push(pipeline);
  }
  if (stage) {
    conditions.push("d.brevoDealStage = ?");
    params.push(stage);
  }
  if (kerridgeUserId) {
    conditions.push("d.kerridgeUserId = ?");
    params.push(kerridgeUserId);
  }
  if (createdSince) {
    conditions.push("d.brevoDealCreatedDate >= ?");
    params.push(createdSince);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);

  return misQuery(
    `SELECT d.id, d.branchId, d.branchName,
            d.customerName, d.customerAccountNumber, d.customerEmail,
            d.contactNumber, d.contactName, d.contactEmail,
            d.kerridgeQuoteNumber, d.kerridgeDescription, d.kerridgeUserId,
            d.brevoDealName, d.brevoDealId, d.brevoDealLink,
            d.brevoDealStage, d.brevoDealAmount, d.brevoPipeline,
            d.brevoDealCloseDate, d.brevoDealCreatedDate,
            d.brevoDealLastStateUpdateDate, d.brevoDealLastUpdateDate,
            d.brevoActualCloseDate,
            d.brevoCloseLostReason, d.brevoLostReason, d.brevoWonReason,
            d.created, d.updated
     FROM brevoDealData d
     ${where}
     ORDER BY d.brevoDealLastUpdateDate DESC
     LIMIT ?`,
    params
  );
}

/**
 * Get deal pipeline summary: count and total amount by stage, optionally filtered by pipeline.
 */
export async function getBrevoDealPipelineSummary(pipeline?: string) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (pipeline) {
    conditions.push("d.brevoPipeline = ?");
    params.push(pipeline);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return misQuery(
    `SELECT d.brevoDealStage AS stage,
            d.brevoPipeline AS pipeline,
            COUNT(*) AS deal_count,
            SUM(CAST(d.brevoDealAmount AS DECIMAL(12,2))) AS total_amount,
            AVG(CAST(d.brevoDealAmount AS DECIMAL(12,2))) AS avg_amount
     FROM brevoDealData d
     ${where}
     GROUP BY d.brevoDealStage, d.brevoPipeline
     ORDER BY total_amount DESC`,
    params
  );
}

/**
 * Get deal performance by Kerridge user: won/lost counts and amounts.
 */
export async function getBrevoDealsByUser(
  pipeline?: string,
  createdSince?: string
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (pipeline) {
    conditions.push("d.brevoPipeline = ?");
    params.push(pipeline);
  }
  if (createdSince) {
    conditions.push("d.brevoDealCreatedDate >= ?");
    params.push(createdSince);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return misQuery(
    `SELECT d.kerridgeUserId,
            d.brevoDealStage AS stage,
            COUNT(*) AS deal_count,
            SUM(CAST(d.brevoDealAmount AS DECIMAL(12,2))) AS total_amount
     FROM brevoDealData d
     ${where}
     GROUP BY d.kerridgeUserId, d.brevoDealStage
     ORDER BY d.kerridgeUserId, total_amount DESC`,
    params
  );
}

/**
 * Get deal performance by customer: won/lost counts and amounts.
 */
export async function getBrevoDealsByCustomer(
  pipeline?: string,
  stage?: string,
  createdSince?: string,
  limit: number = 100
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (pipeline) {
    conditions.push("d.brevoPipeline = ?");
    params.push(pipeline);
  }
  if (stage) {
    conditions.push("d.brevoDealStage = ?");
    params.push(stage);
  }
  if (createdSince) {
    conditions.push("d.brevoDealCreatedDate >= ?");
    params.push(createdSince);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);

  return misQuery(
    `SELECT d.customerName, d.customerAccountNumber, d.branchName,
            COUNT(*) AS deal_count,
            SUM(CAST(d.brevoDealAmount AS DECIMAL(12,2))) AS total_amount,
            AVG(CAST(d.brevoDealAmount AS DECIMAL(12,2))) AS avg_amount
     FROM brevoDealData d
     ${where}
     GROUP BY d.customerName, d.customerAccountNumber, d.branchName
     ORDER BY total_amount DESC
     LIMIT ?`,
    params
  );
}

/**
 * Get distinct pipelines available in the deal data.
 */
export async function getBrevoDealPipelines() {
  return misQuery(
    `SELECT DISTINCT d.brevoPipeline AS pipeline,
            COUNT(*) AS deal_count
     FROM brevoDealData d
     WHERE d.brevoPipeline IS NOT NULL AND d.brevoPipeline != ''
     GROUP BY d.brevoPipeline
     ORDER BY deal_count DESC`,
    []
  );
}
