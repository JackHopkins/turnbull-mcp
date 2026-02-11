import { proxyQuery } from "../../connections/db-proxy.js";

export async function getKbbJobs(
  accountNumber?: string,
  branchName?: string,
  designerId?: number,
  status?: string,
  limit: number = 100
) {
  return proxyQuery("mis.kbb.jobs", { accountNumber, branchName, designerId, status, limit });
}

export async function getKbbJobDetail(orderNumber: string) {
  const results = await proxyQuery("mis.kbb.job_detail", { orderNumber });
  return results || null;
}

export async function getKbbPipeline(
  branchName?: string,
  startDate?: string,
  endDate?: string
) {
  return proxyQuery("mis.kbb.pipeline", { branchName, startDate, endDate });
}

export async function getKbbDesignerPerformance(
  designerId: number,
  startDate: string,
  endDate: string
) {
  const results = await proxyQuery("mis.kbb.designer_performance", { designerId, startDate, endDate });
  return results || null;
}

export async function getKbbDesignerTargets(
  designerId: number,
  period: string
) {
  const results = await proxyQuery("mis.kbb.designer_targets", { designerId, period });
  return results || null;
}

export async function getKbbLostAnalysis(
  startDate: string,
  endDate: string,
  branchName?: string,
  designerId?: number
) {
  return proxyQuery("mis.kbb.lost_analysis", { startDate, endDate, branchName, designerId });
}

export async function getKbbReferralSources(
  startDate: string,
  endDate: string,
  branchName?: string
) {
  return proxyQuery("mis.kbb.referral_sources", { startDate, endDate, branchName });
}
