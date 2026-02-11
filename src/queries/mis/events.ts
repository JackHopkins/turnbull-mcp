import { misQuery } from "../../connections/mis-mysql.js";

export async function getEventsList(
  includeArchived: boolean = false,
  limit: number = 100
) {
  const archivedClause = includeArchived ? "" : "WHERE e.archived = 0";

  return misQuery(
    `SELECT e.id, e.name, e.description, e.eventType,
            e.startDate, e.endDate, e.archived,
            COUNT(DISTINCT er.id) AS registration_count
     FROM event e
     LEFT JOIN event_registration er ON er.event = e.id
     ${archivedClause}
     GROUP BY e.id, e.name, e.description, e.eventType, e.startDate, e.endDate, e.archived
     ORDER BY e.startDate DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getEventRegistrations(
  eventId: number,
  includeTargets: boolean = true
) {
  const targetClause = includeTargets ? "" : "AND er.registrationType != 'target'";

  return misQuery(
    `SELECT er.id, er.registrationType, er.registeredAt, er.status,
            co.firstName, co.lastName, co.email, co.telephone,
            c.accountNumber, c.name AS customer_name
     FROM event_registration er
     LEFT JOIN contact co ON er.contact = co.id
     LEFT JOIN customer c ON er.customer = c.id
     WHERE er.event = ?
       ${targetClause}
     ORDER BY er.registeredAt DESC`,
    [eventId]
  );
}

export async function getCustomerEvents(accountNumber: string) {
  return misQuery(
    `SELECT e.id, e.name, e.eventType, e.startDate, e.endDate,
            er.registrationType, er.registeredAt, er.status
     FROM event_registration er
     JOIN event e ON er.event = e.id
     JOIN customer c ON er.customer = c.id
     WHERE c.accountNumber = ?
     ORDER BY e.startDate DESC`,
    [accountNumber]
  );
}

export async function getEventRewards(eventId: number, status: string = "all") {
  const statusClause =
    status === "all" ? "" : "AND rw.status = ?";
  const params: any[] = [eventId];
  if (status !== "all") params.push(status);

  return misQuery(
    `SELECT rw.id, rw.rewardAmount, rw.calculatedAmount, rw.status,
            rw.paidDate, rw.calculatedAt,
            c.accountNumber, c.name AS customer_name,
            co.firstName, co.lastName
     FROM event_reward rw
     LEFT JOIN customer c ON rw.customer = c.id
     LEFT JOIN contact co ON rw.contact = co.id
     WHERE rw.event = ?
       ${statusClause}
     ORDER BY rw.calculatedAmount DESC`,
    params
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
    conditions.push("rd.event = ?");
    params.push(eventId);
  }
  if (contactId) {
    conditions.push("rd.contact = ?");
    params.push(contactId);
  }
  if (startDate) {
    conditions.push("rd.redeemedAt >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("rd.redeemedAt <= ?");
    params.push(endDate);
  }

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  return misQuery(
    `SELECT rd.id, rd.amount, rd.redeemedAt, rd.method,
            rd.reference, rd.status,
            e.name AS eventName,
            co.firstName, co.lastName,
            c.accountNumber, c.name AS customer_name
     FROM event_redemption rd
     LEFT JOIN event e ON rd.event = e.id
     LEFT JOIN contact co ON rd.contact = co.id
     LEFT JOIN customer c ON rd.customer = c.id
     ${whereClause}
     ORDER BY rd.redeemedAt DESC`,
    params
  );
}
