import { proxyQuery } from "../../connections/db-proxy.js";

export async function getEventsList(
  includeArchived: boolean = false,
  limit: number = 100
) {
  return proxyQuery("mis.events.list", { includeArchived, limit });
}

export async function getEventRegistrations(
  eventId: number,
  includeTargets: boolean = true
) {
  return proxyQuery("mis.events.registrations", { eventId, includeTargets });
}

export async function getCustomerEvents(accountNumber: string) {
  return proxyQuery("mis.events.by_customer", { accountNumber });
}

export async function getEventRewards(eventId: number, status: string = "all") {
  return proxyQuery("mis.events.rewards", { eventId, status });
}

export async function getEventRedemptions(
  eventId?: number,
  contactId?: number,
  startDate?: string,
  endDate?: string
) {
  return proxyQuery("mis.events.redemptions", { eventId, contactId, startDate, endDate });
}
