import { misQuery } from "../../connections/mis-mysql.js";

export async function getEventsList(
  includeArchived: boolean = false,
  limit: number = 100
) {
  const archivedClause = includeArchived ? "" : "WHERE e.archived = 0";

  return misQuery(
    `SELECT e.id, e.title, e.notes AS description, e.eventLevel,
            e.EventDate, e.promoStartDate, e.promoEndDate,
            e.deposit, e.defaultTarget, e.maximumGuests,
            e.tracking, e.rewardsEvent, e.rewardRate,
            e.archived, e.costPerHead,
            COUNT(DISTINCT ec.id) AS registration_count
     FROM events e
     LEFT JOIN eventContacts ec ON ec.event = e.id
     ${archivedClause}
     GROUP BY e.id
     ORDER BY e.EventDate DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getEventRegistrations(
  eventId: number,
  includeTargets: boolean = true
) {
  return misQuery(
    `SELECT ec.id, ec.attending, ec.target, ec.kickstart,
            ec.depositPaid, ec.attendanceState,
            ec.promoStartDate, ec.promoEndDate,
            ec.notes, ec.created,
            co.firstName, co.lastName, co.fullName, co.email, co.phone,
            c.account_number, c.name AS customer_name
     FROM eventContacts ec
     LEFT JOIN contactDetails co ON ec.contact = co.id
     LEFT JOIN eventContactCustomers ecc ON ecc.eventContact = ec.id
     LEFT JOIN customer c ON ecc.customer = c.id
     WHERE ec.event = ?
     ORDER BY ec.created DESC`,
    [eventId]
  );
}

export async function getCustomerEvents(accountNumber: string) {
  return misQuery(
    `SELECT e.id, e.title, e.eventLevel, e.EventDate,
            e.promoStartDate, e.promoEndDate,
            ec.attending, ec.depositPaid, ec.attendanceState, ec.created AS registeredAt
     FROM eventContacts ec
     JOIN events e ON ec.event = e.id
     JOIN eventContactCustomers ecc ON ecc.eventContact = ec.id
     JOIN customer c ON ecc.customer = c.id
     WHERE c.account_number = ?
     ORDER BY e.EventDate DESC`,
    [accountNumber]
  );
}

export async function getEventRewards(eventId: number, status: string = "all") {
  // rewardDetail links via eventContact FK
  // status filter maps to: redemption state on eventContactRedemption if needed
  return misQuery(
    `SELECT rd.id, rd.rewardTotal, rd.dealTotal, rd.clearedRewardTotal,
            rd.rewardDate,
            ec.id AS eventContactId, ec.attending, ec.target,
            co.firstName, co.lastName, co.fullName,
            c.account_number, c.name AS customer_name
     FROM rewardDetail rd
     JOIN eventContacts ec ON rd.eventContact = ec.id
     LEFT JOIN contactDetails co ON ec.contact = co.id
     LEFT JOIN eventContactCustomers ecc ON ecc.eventContact = ec.id
     LEFT JOIN customer c ON ecc.customer = c.id
     WHERE ec.event = ?
     ORDER BY rd.rewardTotal DESC`,
    [eventId]
  );
}

export async function getEventRedemptions(
  eventId?: number,
  contactId?: number,
  startDate?: string,
  endDate?: string
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (eventId) {
    conditions.push("ec.event = ?");
    params.push(eventId);
  }
  if (contactId) {
    conditions.push("ec.contact = ?");
    params.push(contactId);
  }
  if (startDate) {
    conditions.push("ecr.requested >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("ecr.requested <= ?");
    params.push(endDate);
  }

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  return misQuery(
    `SELECT ecr.id, ecr.amount, ecr.redemptionState, ecr.redemptionType,
            ecr.requested, ecr.processed,
            e.title AS eventTitle,
            co.firstName, co.lastName, co.fullName,
            c.account_number, c.name AS customer_name
     FROM eventContactRedemption ecr
     JOIN eventContacts ec ON ecr.eventContact = ec.id
     LEFT JOIN events e ON ec.event = e.id
     LEFT JOIN contactDetails co ON ec.contact = co.id
     LEFT JOIN eventContactCustomers ecc ON ecc.eventContact = ec.id
     LEFT JOIN customer c ON ecc.customer = c.id
     ${whereClause}
     ORDER BY ecr.requested DESC`,
    params
  );
}