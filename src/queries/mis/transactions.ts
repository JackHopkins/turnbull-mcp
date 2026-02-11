import { proxyQuery } from "../../connections/db-proxy.js";

export async function getTransactions(
  accountNumber: string,
  startDate?: string,
  endDate?: string,
  limit: number = 500
) {
  return proxyQuery("mis.transactions.by_customer", { accountNumber, startDate, endDate, limit });
}

export async function getTransactionsByProduct(
  productCode: string,
  startDate?: string,
  endDate?: string,
  limit: number = 1000
) {
  return proxyQuery("mis.transactions.by_product", { productCode, startDate, endDate, limit });
}

export async function getTransactionsByBranch(
  branchName: string,
  startDate: string,
  endDate: string,
  limit: number = 5000
) {
  return proxyQuery("mis.transactions.by_branch", { branchName, startDate, endDate, limit });
}

export async function getTransactionsByRep(
  repId: number,
  startDate: string,
  endDate: string
) {
  return proxyQuery("mis.transactions.by_rep", { repId, startDate, endDate });
}

export async function getSalesSummary(
  accountNumber: string,
  period: string,
  startDate: string,
  endDate: string
) {
  return proxyQuery("mis.transactions.sales_summary", { accountNumber, period, startDate, endDate });
}

export async function getBranchSalesSummary(
  branchName: string,
  startDate: string,
  endDate: string,
  groupBy?: string
) {
  return proxyQuery("mis.transactions.branch_sales_summary", { branchName, startDate, endDate, groupBy });
}

export async function getRepSalesSummary(
  repId: number,
  startDate: string,
  endDate: string
) {
  return proxyQuery("mis.transactions.rep_sales_summary", { repId, startDate, endDate });
}

export async function getTopCustomers(
  startDate: string,
  endDate: string,
  limit: number = 50,
  branchName?: string,
  repId?: number
) {
  return proxyQuery("mis.transactions.top_customers", { startDate, endDate, limit, branchName, repId });
}

export async function getTopProducts(
  startDate: string,
  endDate: string,
  limit: number = 100,
  accountNumber?: string,
  branchName?: string
) {
  return proxyQuery("mis.transactions.top_products", { startDate, endDate, limit, accountNumber, branchName });
}

export async function getSalesTrends(
  startDate: string,
  endDate: string,
  granularity: string,
  accountNumber?: string,
  branchName?: string
) {
  return proxyQuery("mis.transactions.sales_trends", { startDate, endDate, granularity, accountNumber, branchName });
}
