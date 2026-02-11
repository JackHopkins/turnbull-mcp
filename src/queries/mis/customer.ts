import { misQuery } from "../../connections/mis-mysql.js";

export async function searchCustomers(query: string, limit: number = 20) {
  return misQuery(
    `SELECT c.id, c.accountNumber, c.name, c.address1, c.address2,
            c.town, c.county, c.postcode, c.telephone, c.email,
            c.creditTerms, c.creditLimit, c.onStop,
            b.name AS branchName,
            r.name AS repName
     FROM customer c
     LEFT JOIN branch b ON c.branch = b.id
     LEFT JOIN rep r ON c.rep = r.id
     WHERE c.accountNumber LIKE ? OR c.name LIKE ? OR c.email LIKE ? OR c.postcode LIKE ?
     ORDER BY c.name
     LIMIT ?`,
    [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit]
  );
}

export async function getCustomerDetail(accountNumber: string) {
  const results = await misQuery(
    `SELECT c.*,
            b.name AS branchName,
            r.name AS repName
     FROM customer c
     LEFT JOIN branch b ON c.branch = b.id
     LEFT JOIN rep r ON c.rep = r.id
     WHERE c.accountNumber = ?`,
    [accountNumber]
  );
  return results[0] || null;
}

export async function getCustomerContacts(
  accountNumber: string,
  includeInactive: boolean = false
) {
  const activeClause = includeInactive ? "" : "AND co.active = 1";
  return misQuery(
    `SELECT co.id, co.firstName, co.lastName, co.email, co.telephone,
            co.mobile, co.jobTitle, co.interests, co.brevoId,
            co.active, co.createdAt, co.updatedAt
     FROM contact co
     JOIN customer c ON co.customer = c.id
     WHERE c.accountNumber = ? ${activeClause}
     ORDER BY co.lastName, co.firstName`,
    [accountNumber]
  );
}

export async function getCustomerNotes(
  accountNumber: string,
  limit: number = 50
) {
  return misQuery(
    `SELECT n.id, n.message, n.createdAt, n.createdBy, n.type
     FROM note n
     JOIN customer c ON n.customer = c.id
     WHERE c.accountNumber = ?
     ORDER BY n.createdAt DESC
     LIMIT ?`,
    [accountNumber, limit]
  );
}

export async function getCustomersByBranch(
  branchName: string,
  page: number = 1,
  limit: number = 50,
  sortBy: string = "name"
) {
  const offset = (page - 1) * limit;
  const allowedSorts: Record<string, string> = {
    name: "c.name",
    accountNumber: "c.accountNumber",
    creditLimit: "c.creditLimit",
  };
  const sortField = allowedSorts[sortBy] || "c.name";

  return misQuery(
    `SELECT c.id, c.accountNumber, c.name, c.creditTerms, c.creditLimit,
            c.onStop, c.email, c.telephone,
            r.name AS repName
     FROM customer c
     JOIN branch b ON c.branch = b.id
     LEFT JOIN rep r ON c.rep = r.id
     WHERE b.name = ?
     ORDER BY ${sortField}
     LIMIT ? OFFSET ?`,
    [branchName, limit, offset]
  );
}

export async function getCustomersByRep(repId: number, limit: number = 100) {
  return misQuery(
    `SELECT c.id, c.accountNumber, c.name, c.creditTerms, c.creditLimit,
            c.onStop, c.email, c.telephone,
            b.name AS branchName
     FROM customer c
     LEFT JOIN branch b ON c.branch = b.id
     WHERE c.rep = ?
     ORDER BY c.name
     LIMIT ?`,
    [repId, limit]
  );
}

export async function getCustomerOnboardingStatus(accountNumber: string) {
  const results = await misQuery(
    `SELECT c.accountNumber, c.name,
            c.onlineRegistered, c.onlineRegisteredDate,
            c.onlineLastLogin, c.onlineEmail
     FROM customer c
     WHERE c.accountNumber = ?`,
    [accountNumber]
  );
  return results[0] || null;
}

export async function getBrevoCommsHistory(
  accountNumber: string,
  limit: number = 50
) {
  return misQuery(
    `SELECT bc.id, bc.contactId, bc.eventType, bc.eventDate,
            bc.subject, bc.campaignName, bc.status
     FROM brevo_comms bc
     JOIN customer c ON bc.customer = c.id
     WHERE c.accountNumber = ?
     ORDER BY bc.eventDate DESC
     LIMIT ?`,
    [accountNumber, limit]
  );
}
