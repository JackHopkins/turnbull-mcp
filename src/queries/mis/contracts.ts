import { proxyQuery } from "../../connections/db-proxy.js";

export async function getCustomerContracts(
  accountNumber: string,
  includeExpired: boolean = false
) {
  return proxyQuery("mis.contracts.by_customer", { accountNumber, includeExpired });
}

export async function getContractProducts(
  contractId: number,
  limit: number = 1000
) {
  return proxyQuery("mis.contracts.products", { contractId, limit });
}

export async function getCustomerDeals(
  accountNumber: string,
  includeExpired: boolean = false
) {
  return proxyQuery("mis.contracts.deals", { accountNumber, includeExpired });
}

export async function getDiscountGroups(groupId?: number, productCode?: string) {
  return proxyQuery("mis.contracts.discount_groups", { groupId, productCode });
}

export async function getEffectivePrice(
  accountNumber: string,
  productCode: string
) {
  const results = await proxyQuery("mis.contracts.effective_price", { accountNumber, productCode });
  return results;
}

export async function getContractsExpiring(
  daysAhead: number = 30,
  branchName?: string
) {
  return proxyQuery("mis.contracts.expiring", { daysAhead, branchName });
}
