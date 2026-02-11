import { proxyQuery } from "../../connections/db-proxy.js";

export async function getTransactionHistory(
  accountNumber: string,
  days: number = 365
) {
  return proxyQuery("tarms.financial.transaction_history", { accountNumber, days });
}

export async function getDebtorDays(accountNumber: string) {
  return proxyQuery("tarms.financial.debtor_days", { accountNumber });
}

export async function getOutstandingInvoices(accountNumber: string) {
  return proxyQuery("tarms.financial.outstanding_invoices", { accountNumber });
}

export async function getPaymentHistory(
  accountNumber: string,
  days: number = 365
) {
  return proxyQuery("tarms.financial.payment_history", { accountNumber, days });
}

export async function getCreditStatusHistory(accountNumber: string) {
  return proxyQuery("tarms.financial.credit_status_history", { accountNumber });
}

export async function getOutstandingOrders(accountNumber: string) {
  return proxyQuery("tarms.financial.outstanding_orders", { accountNumber });
}

export async function getPaymentPlans(accountNumber: string) {
  return proxyQuery("tarms.financial.payment_plans", { accountNumber });
}
