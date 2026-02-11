import { misQuery } from "../../connections/mis-mysql.js";

export async function getTransactions(
  accountNumber: string,
  startDate?: string,
  endDate?: string,
  limit: number = 500
) {
  const conditions = ["c.accountNumber = ?"];
  const params: any[] = [accountNumber];

  if (startDate) {
    conditions.push("t.transaction_date >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("t.transaction_date <= ?");
    params.push(endDate);
  }

  params.push(limit);

  return misQuery(
    `SELECT t.id, t.invoice_number, t.transaction_date, t.transaction_period,
            t.transactionType, t.sales_amount, t.cogs_amount,
            t.product_code, t.quantity, t.branch,
            c.name AS customer_name, c.accountNumber
     FROM transaction t
     JOIN customer c ON t.customer = c.id
     WHERE ${conditions.join(" AND ")}
       AND t.transactionType = 'SL'
       AND t.ignoreTransaction = FALSE
     ORDER BY t.transaction_date DESC
     LIMIT ?`,
    params
  );
}

export async function getTransactionsByProduct(
  productCode: string,
  startDate?: string,
  endDate?: string,
  limit: number = 1000
) {
  const conditions = ["t.product_code = ?"];
  const params: any[] = [productCode];

  if (startDate) {
    conditions.push("t.transaction_date >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("t.transaction_date <= ?");
    params.push(endDate);
  }

  params.push(limit);

  return misQuery(
    `SELECT t.id, t.invoice_number, t.transaction_date,
            t.sales_amount, t.cogs_amount, t.quantity, t.branch,
            c.name AS customer_name, c.accountNumber
     FROM transaction t
     JOIN customer c ON t.customer = c.id
     WHERE ${conditions.join(" AND ")}
       AND t.transactionType = 'SL'
       AND t.ignoreTransaction = FALSE
     ORDER BY t.transaction_date DESC
     LIMIT ?`,
    params
  );
}

export async function getTransactionsByBranch(
  branchName: string,
  startDate: string,
  endDate: string,
  limit: number = 5000
) {
  return misQuery(
    `SELECT t.id, t.invoice_number, t.transaction_date,
            t.sales_amount, t.cogs_amount, t.product_code, t.quantity,
            c.name AS customer_name, c.accountNumber
     FROM transaction t
     JOIN customer c ON t.customer = c.id
     JOIN branch b ON c.branch = b.id
     WHERE b.name = ?
       AND t.transaction_date >= ?
       AND t.transaction_date <= ?
       AND t.transactionType = 'SL'
       AND t.ignoreTransaction = FALSE
     ORDER BY t.transaction_date DESC
     LIMIT ?`,
    [branchName, startDate, endDate, limit]
  );
}

export async function getTransactionsByRep(
  repId: number,
  startDate: string,
  endDate: string
) {
  return misQuery(
    `SELECT t.id, t.invoice_number, t.transaction_date,
            t.sales_amount, t.cogs_amount, t.product_code, t.quantity,
            c.name AS customer_name, c.accountNumber
     FROM transaction t
     JOIN customer c ON t.customer = c.id
     WHERE c.rep = ?
       AND t.transaction_date >= ?
       AND t.transaction_date <= ?
       AND t.transactionType = 'SL'
       AND t.ignoreTransaction = FALSE
     ORDER BY t.transaction_date DESC`,
    [repId, startDate, endDate]
  );
}

export async function getSalesSummary(
  accountNumber: string,
  period: string,
  startDate: string,
  endDate: string
) {
  const groupByMap: Record<string, string> = {
    month: "DATE_FORMAT(t.transaction_date, '%Y-%m')",
    quarter: "CONCAT(YEAR(t.transaction_date), '-Q', QUARTER(t.transaction_date))",
    year: "YEAR(t.transaction_date)",
  };
  const groupExpr = groupByMap[period] || groupByMap.month;

  return misQuery(
    `SELECT ${groupExpr} AS period,
            COUNT(*) AS transaction_count,
            SUM(t.sales_amount) AS total_sales,
            SUM(t.cogs_amount) AS total_cogs,
            SUM(t.sales_amount) - SUM(t.cogs_amount) AS gross_margin,
            ROUND((SUM(t.sales_amount) - SUM(t.cogs_amount)) / NULLIF(SUM(t.sales_amount), 0) * 100, 2) AS margin_pct
     FROM transaction t
     JOIN customer c ON t.customer = c.id
     WHERE c.accountNumber = ?
       AND t.transaction_date >= ?
       AND t.transaction_date <= ?
       AND t.transactionType = 'SL'
       AND t.ignoreTransaction = FALSE
     GROUP BY period
     ORDER BY period DESC`,
    [accountNumber, startDate, endDate]
  );
}

export async function getBranchSalesSummary(
  branchName: string,
  startDate: string,
  endDate: string,
  groupBy?: string
) {
  const groupByMap: Record<string, { expr: string; select: string }> = {
    day: {
      expr: "DATE(t.transaction_date)",
      select: "DATE(t.transaction_date) AS period",
    },
    month: {
      expr: "DATE_FORMAT(t.transaction_date, '%Y-%m')",
      select: "DATE_FORMAT(t.transaction_date, '%Y-%m') AS period",
    },
    product: {
      expr: "t.product_code",
      select: "t.product_code AS period",
    },
  };
  const group = groupBy ? groupByMap[groupBy] : undefined;

  if (group) {
    return misQuery(
      `SELECT ${group.select},
              COUNT(*) AS transaction_count,
              COUNT(DISTINCT c.id) AS customer_count,
              SUM(t.sales_amount) AS total_sales,
              SUM(t.cogs_amount) AS total_cogs,
              SUM(t.sales_amount) - SUM(t.cogs_amount) AS gross_margin
       FROM transaction t
       JOIN customer c ON t.customer = c.id
       JOIN branch b ON c.branch = b.id
       WHERE b.name = ?
         AND t.transaction_date >= ?
         AND t.transaction_date <= ?
         AND t.transactionType = 'SL'
         AND t.ignoreTransaction = FALSE
       GROUP BY ${group.expr}
       ORDER BY period DESC`,
      [branchName, startDate, endDate]
    );
  }

  return misQuery(
    `SELECT COUNT(*) AS transaction_count,
            COUNT(DISTINCT c.id) AS customer_count,
            SUM(t.sales_amount) AS total_sales,
            SUM(t.cogs_amount) AS total_cogs,
            SUM(t.sales_amount) - SUM(t.cogs_amount) AS gross_margin,
            ROUND((SUM(t.sales_amount) - SUM(t.cogs_amount)) / NULLIF(SUM(t.sales_amount), 0) * 100, 2) AS margin_pct
     FROM transaction t
     JOIN customer c ON t.customer = c.id
     JOIN branch b ON c.branch = b.id
     WHERE b.name = ?
       AND t.transaction_date >= ?
       AND t.transaction_date <= ?
       AND t.transactionType = 'SL'
       AND t.ignoreTransaction = FALSE`,
    [branchName, startDate, endDate]
  );
}

export async function getRepSalesSummary(
  repId: number,
  startDate: string,
  endDate: string
) {
  return misQuery(
    `SELECT COUNT(*) AS transaction_count,
            COUNT(DISTINCT c.id) AS customer_count,
            SUM(t.sales_amount) AS total_sales,
            SUM(t.cogs_amount) AS total_cogs,
            SUM(t.sales_amount) - SUM(t.cogs_amount) AS gross_margin,
            ROUND(SUM(t.sales_amount) / NULLIF(COUNT(DISTINCT t.invoice_number), 0), 2) AS avg_order_value
     FROM transaction t
     JOIN customer c ON t.customer = c.id
     WHERE c.rep = ?
       AND t.transaction_date >= ?
       AND t.transaction_date <= ?
       AND t.transactionType = 'SL'
       AND t.ignoreTransaction = FALSE`,
    [repId, startDate, endDate]
  );
}

export async function getTopCustomers(
  startDate: string,
  endDate: string,
  limit: number = 50,
  branchName?: string,
  repId?: number
) {
  const conditions = [
    "t.transaction_date >= ?",
    "t.transaction_date <= ?",
    "t.transactionType = 'SL'",
    "t.ignoreTransaction = FALSE",
  ];
  const params: any[] = [startDate, endDate];

  if (branchName) {
    conditions.push("b.name = ?");
    params.push(branchName);
  }
  if (repId) {
    conditions.push("c.rep = ?");
    params.push(repId);
  }
  params.push(limit);

  return misQuery(
    `SELECT c.accountNumber, c.name AS customer_name,
            SUM(t.sales_amount) AS total_revenue,
            SUM(t.cogs_amount) AS total_cogs,
            SUM(t.sales_amount) - SUM(t.cogs_amount) AS gross_margin,
            COUNT(*) AS transaction_count,
            b.name AS branchName
     FROM transaction t
     JOIN customer c ON t.customer = c.id
     LEFT JOIN branch b ON c.branch = b.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY c.id, c.accountNumber, c.name, b.name
     ORDER BY total_revenue DESC
     LIMIT ?`,
    params
  );
}

export async function getTopProducts(
  startDate: string,
  endDate: string,
  limit: number = 100,
  accountNumber?: string,
  branchName?: string
) {
  const conditions = [
    "t.transaction_date >= ?",
    "t.transaction_date <= ?",
    "t.transactionType = 'SL'",
    "t.ignoreTransaction = FALSE",
  ];
  const params: any[] = [startDate, endDate];

  if (accountNumber) {
    conditions.push("c.accountNumber = ?");
    params.push(accountNumber);
  }
  if (branchName) {
    conditions.push("b.name = ?");
    params.push(branchName);
  }
  params.push(limit);

  return misQuery(
    `SELECT t.product_code,
            SUM(t.sales_amount) AS total_revenue,
            SUM(t.cogs_amount) AS total_cogs,
            SUM(t.sales_amount) - SUM(t.cogs_amount) AS gross_margin,
            SUM(t.quantity) AS total_quantity,
            COUNT(DISTINCT c.id) AS customer_count
     FROM transaction t
     JOIN customer c ON t.customer = c.id
     LEFT JOIN branch b ON c.branch = b.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY t.product_code
     ORDER BY total_revenue DESC
     LIMIT ?`,
    params
  );
}

export async function getSalesTrends(
  startDate: string,
  endDate: string,
  granularity: string,
  accountNumber?: string,
  branchName?: string
) {
  const granMap: Record<string, string> = {
    day: "DATE(t.transaction_date)",
    week: "DATE(DATE_SUB(t.transaction_date, INTERVAL WEEKDAY(t.transaction_date) DAY))",
    month: "DATE_FORMAT(t.transaction_date, '%Y-%m-01')",
  };
  const dateExpr = granMap[granularity] || granMap.month;

  const conditions = [
    "t.transaction_date >= ?",
    "t.transaction_date <= ?",
    "t.transactionType = 'SL'",
    "t.ignoreTransaction = FALSE",
  ];
  const params: any[] = [startDate, endDate];

  if (accountNumber) {
    conditions.push("c.accountNumber = ?");
    params.push(accountNumber);
  }
  if (branchName) {
    conditions.push("b.name = ?");
    params.push(branchName);
  }

  return misQuery(
    `SELECT ${dateExpr} AS period,
            SUM(t.sales_amount) AS revenue,
            SUM(t.quantity) AS volume,
            COUNT(*) AS transaction_count,
            COUNT(DISTINCT c.id) AS customer_count
     FROM transaction t
     JOIN customer c ON t.customer = c.id
     LEFT JOIN branch b ON c.branch = b.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY period
     ORDER BY period ASC`,
    params
  );
}
