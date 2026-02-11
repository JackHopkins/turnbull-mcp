import { pgQuery } from "../../connections/postgres.js";

export async function getCompanyProfile(
  identifier: string,
  isCompanyNumber: boolean = false
) {
  let companyNumber = identifier;

  if (!isCompanyNumber) {
    // Look up company_number from customer_profile by accountNumber
    const cpResult = await pgQuery(
      `SELECT company_number FROM customer_profile WHERE "accountNumber" = $1 LIMIT 1`,
      [identifier]
    );
    if (!cpResult.rows[0]?.company_number) {
      return null;
    }
    companyNumber = cpResult.rows[0].company_number;
  }

  const result = await pgQuery(
    `SELECT cp.id, cp.company_number, cp.company_name, cp.company_status,
            cp.company_type, cp.incorporation_date, cp.dissolution_date,
            cp.sic_codes, cp.jurisdiction, cp.has_insolvency_history,
            cp.has_charges,
            a.address_line_1, a.address_line_2, a.locality,
            a.postal_code, a.region, a.country
     FROM company_profile cp
     LEFT JOIN address a ON cp.registered_office_address_id = a.id
     WHERE cp.company_number = $1
     LIMIT 1`,
    [companyNumber]
  );
  return result.rows[0] || null;
}

export async function getCompanyFilings(
  companyNumber: string,
  limit: number = 20
) {
  const result = await pgQuery(
    `SELECT id, company_number, filing_date, filing_type, description,
            category, transaction_id, link, retrieved_document
     FROM company_filing
     WHERE company_number = $1
     ORDER BY filing_date DESC
     LIMIT $2`,
    [companyNumber, limit]
  );
  return result.rows;
}

export async function getCompanyOfficers(companyNumber: string) {
  const result = await pgQuery(
    `SELECT pp.id, pp.company_number, pp.is_director, pp.name,
            pp.role, pp.date_of_birth, pp.appointed_on, pp.resigned_on,
            a.address_line_1, a.locality, a.postal_code, a.country
     FROM person_profile pp
     LEFT JOIN address a ON pp.address_id = a.id
     WHERE pp.company_number = $1
     ORDER BY pp.is_director DESC, pp.appointed_on DESC`,
    [companyNumber]
  );
  return result.rows;
}

export async function getCCJRecords(companyNumber: string) {
  const result = await pgQuery(
    `SELECT id, jurisdiction, case_num, category, transaction_type,
            company_name, trading_name, defendant_postcode, currency,
            amount, judgement_date, court_name,
            satisfaction_cancellation_date
     FROM ccj_records
     WHERE company_number = $1
     ORDER BY judgement_date DESC`,
    [companyNumber]
  );
  return result.rows;
}
