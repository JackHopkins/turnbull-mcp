import { misQuery } from "../../connections/mis-mysql.js";

export async function searchCustomers(query: string, limit: number = 20) {
  return misQuery(
    `SELECT c.id, c.account_number, c.name, c.line1, c.line2,
            c.line3, c.line4, c.line5, c.postcode, c.phone, c.email,
            c.creditTerms, c.credit_limit,
            b.name AS branchName,
            r.fullname AS repName
     FROM customer c
     LEFT JOIN branch b ON c.branch = b.id
     LEFT JOIN repDetails r ON c.rep = r.id
     WHERE c.account_number LIKE ? OR c.name LIKE ? OR c.email LIKE ? OR c.postcode LIKE ?
     ORDER BY c.name
     LIMIT ?`,
    [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit]
  );
}

export async function getCustomerDetail(accountNumber: string) {
  const results = await misQuery(
    `SELECT c.*,
            b.name AS branchName,
            r.fullname AS repName
     FROM customer c
     LEFT JOIN branch b ON c.branch = b.id
     LEFT JOIN repDetails r ON c.rep = r.id
     WHERE c.account_number = ?`,
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
    `SELECT co.id, co.contact_number, co.firstName, co.lastName, co.fullName,
            co.email, co.phone, co.mobile, co.contact_type,
            co.interestBuilding, co.interestTimber, co.interestLandscaping,
            co.interestPlumbing, co.interestKB, co.interestFibo,
            co.brevoContactId, co.businessType,
            co.active, co.gdpr, co.created, co.updated
     FROM contactDetails co
     JOIN customer c ON co.customer = c.id
     WHERE c.account_number = ? ${activeClause}
     ORDER BY co.lastName, co.firstName`,
    [accountNumber]
  );
}

export async function getCustomerNotes(
  accountNumber: string,
  limit: number = 50
) {
  return misQuery(
    `SELECT n.id, n.messageType, n.message, n.payload, n.noteDate, n.created
     FROM customerNotes n
     JOIN customer c ON n.customer = c.id
     WHERE c.account_number = ?
     ORDER BY n.noteDate DESC
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
    accountNumber: "c.account_number",
    creditLimit: "c.credit_limit",
  };
  const sortField = allowedSorts[sortBy] || "c.name";

  return misQuery(
    `SELECT c.id, c.account_number, c.name, c.creditTerms, c.credit_limit,
            c.email, c.phone,
            r.fullname AS repName
     FROM customer c
     JOIN branch b ON c.branch = b.id
     LEFT JOIN repDetails r ON c.rep = r.id
     WHERE b.name = ?
     ORDER BY ${sortField}
     LIMIT ? OFFSET ?`,
    [branchName, limit, offset]
  );
}

export async function getCustomersByRep(repId: number, limit: number = 100) {
  return misQuery(
    `SELECT c.id, c.account_number, c.name, c.creditTerms, c.credit_limit,
            c.email, c.phone,
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
    `SELECT c.account_number, c.name,
            ob.onboardingState, ob.email AS onboardingEmail,
            ob.webbuilderId, ob.lastLoggedInTimestamp,
            ob.dateInvitedTimestamp
     FROM customer c
     LEFT JOIN customeronboarding ob ON ob.customer = c.id
     WHERE c.account_number = ?`,
    [accountNumber]
  );
  return results[0] || null;
}

export async function getBrevoCommsHistory(
  accountNumber: string,
  limit: number = 50
) {
  return misQuery(
    `SELECT bh.id, bh.contact, bh.sender, bh.recipient,
            bh.webhookType, bh.message, bh.created
     FROM brevoHistory bh
     JOIN customer c ON bh.customer = c.id
     WHERE c.account_number = ?
     ORDER BY bh.created DESC
     LIMIT ?`,
    [accountNumber, limit]
  );
}