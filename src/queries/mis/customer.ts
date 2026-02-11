import { proxyQuery } from "../../connections/db-proxy.js";

export async function searchCustomers(query: string, limit: number = 20) {
  return proxyQuery("mis.customer.search", { query, limit });
}

export async function getCustomerDetail(accountNumber: string) {
  const results = await proxyQuery("mis.customer.detail", { accountNumber });
  return results || null;
}

export async function getCustomerContacts(
  accountNumber: string,
  includeInactive: boolean = false
) {
  return proxyQuery("mis.customer.contacts", { accountNumber, includeInactive });
}

export async function getCustomerNotes(
  accountNumber: string,
  limit: number = 50
) {
  return proxyQuery("mis.customer.notes", { accountNumber, limit });
}

export async function getCustomersByBranch(
  branchName: string,
  page: number = 1,
  limit: number = 50,
  sortBy: string = "name"
) {
  return proxyQuery("mis.customer.by_branch", { branchName, page, limit, sortBy });
}

export async function getCustomersByRep(repId: number, limit: number = 100) {
  return proxyQuery("mis.customer.by_rep", { repId, limit });
}

export async function getCustomerOnboardingStatus(accountNumber: string) {
  const results = await proxyQuery("mis.customer.onboarding_status", { accountNumber });
  return results || null;
}

export async function getBrevoCommsHistory(
  accountNumber: string,
  limit: number = 50
) {
  return proxyQuery("mis.customer.brevo_comms_history", { accountNumber, limit });
}
