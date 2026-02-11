import { misQuery } from "../../connections/mis-mysql.js";

export async function getTransactions(
  accountNumber: string,
  startDate?: string,
  endDate?: string,
  limit: number = 500
) {
  const conditions = ["c.account_number = ?"];
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
    `SELECT t.magicNumber, t.invoice_number, t.transaction_date, t.transaction_period,
            t.transactionType, t.salesAmount, t.cogsAmount,
            p.product_code, t.quantity, t.order_number, t.order_category,
            c.name AS customer_name, c.account_number,
            b.name AS branchName
     FROM transactions t
     JOIN customer c ON t.customer = c.id
     LEFT JOIN pricebook p ON t.product = p.id
     LEFT JOIN branch b ON t.branch = b.id
     WHERE ${conditions.join(" AND ")}
       AND t.transactionType = 'SL'
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
  const conditions = ["p.product_code = ?"];
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
    `SELECT t.magicNumber, t.invoice_number, t.transaction_date,
            t.salesAmount, t.cogsAmount, t.quantity,
            p.product_code,
            c.name AS customer_name, c.account_number,
            b.name AS branchName
     FROM transactions t
     JOIN customer c ON t.customer = c.id
     LEFT JOIN pricebook p ON t.product = p.id
     LEFT JOIN branch b ON t.branch = b.id
     WHERE ${conditions.join(" AND ")}
       AND t.transactionType = 'SL'
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
    `SELECT t.magicNumber, t.invoice_number, t.transaction_date,
            t.salesAmount, t.cogsAmount, t.quantity,
            p.product_code,
            c.name AS customer_name, c.account_number
     FROM transactions t
     JOIN customer c ON t.customer = c.id
     JOIN branch b ON t.branch = b.id
     LEFT JOIN pricebook p ON t.product = p.id
     WHERE b.name = ?
       AND t.transaction_date >= ?
       AND t.transaction_date <= ?
       AND t.transactionType = 'SL'
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
    `SELECT t.magicNumber, t.invoice_number, t.transaction_date,
            t.salesAmount, t.cogsAmount, t.quantity,
            p.product_code,
            c.name AS customer_name, c.account_number
     FROM transactions t
     JOIN customer c ON t.customer = c.id
     LEFT JOIN pricebook p ON t.product = p.id
     WHERE c.rep = ?
       AND t.transaction_date >= ?
       AND t.transaction_date <= ?
       AND t.transactionType = 'SL'
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
            SUM(t.salesAmount) AS total_sales,
            SUM(t.cogsAmount) AS total_cogs,
            SUM(t.salesAmount) - SUM(t.cogsAmount) AS gross_margin,
            ROUND((SUM(t.salesAmount) - SUM(t.cogsAmount)) / NULLIF(SUM(t.salesAmount), 0) * 100, 2) AS margin_pct
     FROM transactions t
     JOIN customer c ON t.customer = c.id
     WHERE c.account_number = ?
       AND t.transaction_date >= ?
       AND t.transaction_date <= ?
       AND t.transactionType = 'SL'
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
      expr: "p.product_code",
      select: "p.product_code AS period",
    },
  };
  const group = groupBy ? groupByMap[groupBy] : undefined;

  if (group) {
    return misQuery(
      `SELECT ${group.select},
              COUNT(*) AS transaction_count,
              COUNT(DISTINCT c.id) AS customer_count,
              SUM(t.salesAmount) AS total_sales,
              SUM(t.cogsAmount) AS total_cogs,
              SUM(t.salesAmount) - SUM(t.cogsAmount) AS gross_margin
       FROM transactions t
       JOIN customer c ON t.customer = c.id
       JOIN branch b ON t.branch = b.id
       LEFT JOIN pricebook p ON t.product = p.id
       WHERE b.name = ?
         AND t.transaction_date >= ?
         AND t.transaction_date <= ?
         AND t.transactionType = 'SL'
       GROUP BY ${group.expr}
       ORDER BY period DESC`,
      [branchName, startDate, endDate]
    );
  }

  return misQuery(
    `SELECT COUNT(*) AS transaction_count,
            COUNT(DISTINCT c.id) AS customer_count,
            SUM(t.salesAmount) AS total_sales,
            SUM(t.cogsAmount) AS total_cogs,
            SUM(t.salesAmount) - SUM(t.cogsAmount) AS gross_margin,
            ROUND((SUM(t.salesAmount) - SUM(t.cogsAmount)) / NULLIF(SUM(t.salesAmount), 0) * 100, 2) AS margin_pct
     FROM transactions t
     JOIN customer c ON t.customer = c.id
     JOIN branch b ON t.branch = b.id
     WHERE b.name = ?
       AND t.transaction_date >= ?
       AND t.transaction_date <= ?
       AND t.transactionType = 'SL'`,
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
            SUM(t.salesAmount) AS total_sales,
            SUM(t.cogsAmount) AS total_cogs,
            SUM(t.salesAmount) - SUM(t.cogsAmount) AS gross_margin,
            ROUND(SUM(t.salesAmount) / NULLIF(COUNT(DISTINCT t.invoice_number), 0), 2) AS avg_order_value
     FROM transactions t
     JOIN customer c ON t.customer = c.id
     WHERE c.rep = ?
       AND t.transaction_date >= ?
       AND t.transaction_date <= ?
       AND t.transactionType = 'SL'`,
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
    `SELECT c.account_number, c.name AS customer_name,
            SUM(t.salesAmount) AS total_revenue,
            SUM(t.cogsAmount) AS total_cogs,
            SUM(t.salesAmount) - SUM(t.cogsAmount) AS gross_margin,
            COUNT(*) AS transaction_count,
            b.name AS branchName
     FROM transactions t
     JOIN customer c ON t.customer = c.id
     LEFT JOIN branch b ON t.branch = b.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY c.id, c.account_number, c.name, b.name
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
  ];
  const params: any[] = [startDate, endDate];

  if (accountNumber) {
    conditions.push("c.account_number = ?");
    params.push(accountNumber);
  }
  if (branchName) {
    conditions.push("b.name = ?");
    params.push(branchName);
  }
  params.push(limit);

  return misQuery(
    `SELECT p.product_code, p.description AS product_description,
            SUM(t.salesAmount) AS total_revenue,
            SUM(t.cogsAmount) AS total_cogs,
            SUM(t.salesAmount) - SUM(t.cogsAmount) AS gross_margin,
            SUM(CAST(t.quantity AS DECIMAL(10,2))) AS total_quantity,
            COUNT(DISTINCT c.id) AS customer_count
     FROM transactions t
     JOIN customer c ON t.customer = c.id
     LEFT JOIN branch b ON t.branch = b.id
     LEFT JOIN pricebook p ON t.product = p.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY p.product_code, p.description
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
  ];
  const params: any[] = [startDate, endDate];

  if (accountNumber) {
    conditions.push("c.account_number = ?");
    params.push(accountNumber);
  }
  if (branchName) {
    conditions.push("b.name = ?");
    params.push(branchName);
  }

  return misQuery(
    `SELECT ${dateExpr} AS period,
            SUM(t.salesAmount) AS revenue,
            SUM(CAST(t.quantity AS DECIMAL(10,2))) AS volume,
            COUNT(*) AS transaction_count,
            COUNT(DISTINCT c.id) AS customer_count
     FROM transactions t
     JOIN customer c ON t.customer = c.id
     LEFT JOIN branch b ON t.branch = b.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY period
     ORDER BY period ASC`,
    params
  );
}