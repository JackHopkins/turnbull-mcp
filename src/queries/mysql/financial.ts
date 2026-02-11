import { mysqlQuery } from "../../connections/mysql.js";

export async function getTransactionHistory(
  accountNumber: string,
  days: number = 365
) {
  const results = await mysqlQuery(
    `SELECT t.id, t.customer, t.invoice_number, t.transaction_date,
            t.transactionType, t.sales_amount, t.cogs_amount,
            t.magic_no, t.product_code,
            c.name AS customer_name, c.accountNumber
     FROM transaction t
     JOIN customer c ON t.customer = c.id
     WHERE c.accountNumber = ?
       AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       AND t.transactionType = 'SL'
       AND t.ignoreTransaction = FALSE
     ORDER BY t.transaction_date DESC`,
    [accountNumber, days]
  );
  return results;
}

export async function getDebtorDays(accountNumber: string) {
  const results = await mysqlQuery(
    `SELECT dd.id, dd.customer, dd.month, dd.year, dd.running_balance,
            dd.days_beyond_terms, dd.insurance_limit, dd.credit_limit,
            dd.statement_balance,
            c.name AS customer_name, c.accountNumber
     FROM debtordays dd
     JOIN customer c ON dd.customer = c.id
     WHERE c.accountNumber = ?
     ORDER BY dd.year DESC, dd.month DESC
     LIMIT 24`,
    [accountNumber]
  );
  return results;
}

export async function getOutstandingInvoices(accountNumber: string) {
  const results = await mysqlQuery(
    `SELECT d.id, d.customer, d.document_number, d.document_type,
            d.document_date, d.remaining_balance, d.paid_balance,
            d.original_balance, d.due_date,
            c.name AS customer_name, c.accountNumber
     FROM documents d
     JOIN customer c ON d.customer = c.id
     WHERE c.accountNumber = ?
       AND d.remaining_balance > 0
     ORDER BY d.document_date DESC`,
    [accountNumber]
  );
  return results;
}

export async function getPaymentHistory(
  accountNumber: string,
  days: number = 365
) {
  const results = await mysqlQuery(
    `SELECT p.id, p.customer, p.documentNumber, p.amount,
            p.allocationDate, p.cashType,
            c.name AS customer_name, c.accountNumber
     FROM payments p
     JOIN customer c ON p.customer = c.id
     WHERE c.accountNumber = ?
       AND STR_TO_DATE(p.allocationDate, '%d/%m/%Y') >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     ORDER BY STR_TO_DATE(p.allocationDate, '%d/%m/%Y') DESC`,
    [accountNumber, days]
  );
  return results;
}

export async function getCreditStatusHistory(accountNumber: string) {
  const results = await mysqlQuery(
    `SELECT cs.id, cs.customer, cs.prior_status, cs.new_status,
            cs.action_id, cs.timestamp,
            c.name AS customer_name, c.accountNumber
     FROM creditstatus cs
     JOIN customer c ON cs.customer = c.id
     WHERE c.accountNumber = ?
     ORDER BY cs.timestamp DESC`,
    [accountNumber]
  );
  return results;
}

export async function getOutstandingOrders(accountNumber: string) {
  const results = await mysqlQuery(
    `SELECT oo.id, oo.customer, oo.order_number, oo.order_date,
            oo.delivery_date, oo.order_value, oo.product_code,
            oo.quantity,
            c.name AS customer_name, c.accountNumber
     FROM outstandingorders oo
     JOIN customer c ON oo.customer = c.id
     WHERE c.accountNumber = ?
     ORDER BY oo.order_date DESC`,
    [accountNumber]
  );
  return results;
}

export async function getPaymentPlans(accountNumber: string) {
  const results = await mysqlQuery(
    `SELECT pp.id, pp.customer, pp.plan_date, pp.amount,
            pp.frequency, pp.status,
            c.name AS customer_name, c.accountNumber
     FROM paymentplan pp
     JOIN customer c ON pp.customer = c.id
     WHERE c.accountNumber = ?
     ORDER BY pp.plan_date DESC`,
    [accountNumber]
  );
  return results;
}
