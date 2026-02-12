import { z } from "zod";
import { withCache } from "../connections/cache.js";
import { misQuery } from "../connections/mis-mysql.js";
import type { ToolDefinition } from "./index.js";

const MIS_ANALYTICS_TTL = 600_000;

export const misAnalyticsTools: ToolDefinition[] = [
  {
    name: "mis_customer_lifetime_value",
    description:
      "Calculate customer lifetime value: total revenue, margin, transaction count, first/last transaction dates, and tenure in months.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
    }),
    handler: async (params) => {
      const { accountNumber } = params as { accountNumber: string };
      return withCache(
        "mis_customer_lifetime_value",
        { accountNumber },
        MIS_ANALYTICS_TTL,
        async () => {
          const results = await misQuery(
            `SELECT c.account_number, c.name AS customer_name,
                    COUNT(*) AS transaction_count,
                    SUM(t.salesAmount) AS total_revenue,
                    SUM(t.cogsAmount) AS total_cogs,
                    SUM(t.salesAmount) - SUM(t.cogsAmount) AS total_margin,
                    ROUND((SUM(t.salesAmount) - SUM(t.cogsAmount)) / NULLIF(SUM(t.salesAmount), 0) * 100, 2) AS margin_pct,
                    MIN(t.transaction_date) AS first_transaction,
                    MAX(t.transaction_date) AS last_transaction,
                    TIMESTAMPDIFF(MONTH, MIN(t.transaction_date), MAX(t.transaction_date)) AS tenure_months,
                    ROUND(SUM(t.salesAmount) / NULLIF(TIMESTAMPDIFF(MONTH, MIN(t.transaction_date), MAX(t.transaction_date)), 0), 2) AS monthly_avg_revenue
             FROM transactions t
             JOIN customer c ON t.customer = c.id
             WHERE c.account_number = ?
               AND t.transactionType = 'SL'
             GROUP BY c.account_number, c.name`,
            [accountNumber]
          );
          return results[0] || null;
        }
      );
    },
  },
  {
    name: "mis_customer_product_affinity",
    description:
      "Get most-purchased products and categories for a customer, ranked by revenue.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      limit: z
        .number()
        .optional()
        .default(50)
        .describe("Maximum products to return"),
    }),
    handler: async (params) => {
      const { accountNumber, limit } = params as {
        accountNumber: string;
        limit: number;
      };
      return withCache(
        "mis_customer_product_affinity",
        { accountNumber, limit },
        MIS_ANALYTICS_TTL,
        async () => {
          return misQuery(
            `SELECT p.product_code,
                    p.description AS product_description,
                    t.pac2, t.pac3,
                    COUNT(*) AS purchase_count,
                    SUM(t.salesAmount) AS total_revenue,
                    SUM(CAST(t.quantity AS DECIMAL(10,2))) AS total_quantity,
                    MAX(t.transaction_date) AS last_purchased
             FROM transactions t
             JOIN customer c ON t.customer = c.id
             LEFT JOIN pricebook p ON t.product = p.id
             WHERE c.account_number = ?
               AND t.transactionType = 'SL'
             GROUP BY p.product_code, p.description, t.pac2, t.pac3
             ORDER BY total_revenue DESC
             LIMIT ?`,
            [accountNumber, limit]
          );
        }
      );
    },
  },
  {
    name: "mis_branch_comparison",
    description:
      "Compare all branches on revenue, customer count, average order value, and growth metrics within a date range.",
    inputSchema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
    }),
    handler: async (params) => {
      const { startDate, endDate } = params as {
        startDate: string;
        endDate: string;
      };
      return withCache(
        "mis_branch_comparison",
        { startDate, endDate },
        MIS_ANALYTICS_TTL,
        async () => {
          return misQuery(
            `SELECT b.name AS branchName,
                    COUNT(*) AS transaction_count,
                    COUNT(DISTINCT c.id) AS customer_count,
                    SUM(t.salesAmount) AS total_revenue,
                    SUM(t.cogsAmount) AS total_cogs,
                    SUM(t.salesAmount) - SUM(t.cogsAmount) AS gross_margin,
                    ROUND((SUM(t.salesAmount) - SUM(t.cogsAmount)) / NULLIF(SUM(t.salesAmount), 0) * 100, 2) AS margin_pct,
                    ROUND(SUM(t.salesAmount) / NULLIF(COUNT(DISTINCT t.invoice_number), 0), 2) AS avg_order_value
             FROM transactions t
             JOIN customer c ON t.customer = c.id
             JOIN branch b ON t.branch = b.id
             WHERE t.transaction_date >= ?
               AND t.transaction_date <= ?
               AND t.transactionType = 'SL'
             GROUP BY b.name
             ORDER BY total_revenue DESC`,
            [startDate, endDate]
          );
        }
      );
    },
  },
  {
    name: "mis_rep_leaderboard",
    description:
      "Rank sales reps by revenue, customer count, and deal size within a date range. Optionally filter by branch.",
    inputSchema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      branchName: z.string().optional().describe("Filter by branch name"),
    }),
    handler: async (params) => {
      const { startDate, endDate, branchName } = params as {
        startDate: string;
        endDate: string;
        branchName?: string;
      };
      return withCache(
        "mis_rep_leaderboard",
        { startDate, endDate, branchName },
        MIS_ANALYTICS_TTL,
        async () => {
          const conditions = [
            "t.transaction_date >= ?",
            "t.transaction_date <= ?",
            "t.transactionType = 'SL'",
          ];
          const queryParams: any[] = [startDate, endDate];

          if (branchName) {
            conditions.push("b.name = ?");
            queryParams.push(branchName);
          }

          return misQuery(
            `SELECT r.id AS repId, r.fullname AS repName,
                    b.name AS branchName,
                    COUNT(*) AS transaction_count,
                    COUNT(DISTINCT c.id) AS customer_count,
                    SUM(t.salesAmount) AS total_revenue,
                    SUM(t.salesAmount) - SUM(t.cogsAmount) AS gross_margin,
                    ROUND(SUM(t.salesAmount) / NULLIF(COUNT(DISTINCT t.invoice_number), 0), 2) AS avg_order_value
             FROM transactions t
             JOIN customer c ON t.customer = c.id
             JOIN repDetails r ON c.rep = r.id
             LEFT JOIN branch b ON t.branch = b.id
             WHERE ${conditions.join(" AND ")}
             GROUP BY r.id, r.fullname, b.name
             ORDER BY total_revenue DESC`,
            queryParams
          );
        }
      );
    },
  },
  {
    name: "mis_margin_analysis",
    description:
      "Analyze gross margins by product, PAC2 category, PAC3 category, or supplier within a date range.",
    inputSchema: z.object({
      groupBy: z
        .string()
        .describe("Group by: product, pac2, pac3, or supplier"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      limit: z.number().optional().default(100).describe("Maximum results"),
    }),
    handler: async (params) => {
      const { groupBy, startDate, endDate, limit } = params as {
        groupBy: string;
        startDate: string;
        endDate: string;
        limit: number;
      };
      return withCache(
        "mis_margin_analysis",
        { groupBy, startDate, endDate, limit },
        MIS_ANALYTICS_TTL,
        async () => {
          const groupByMap: Record<string, { select: string; group: string }> =
            {
              product: {
                select:
                  "p.product_code, p.description AS product_description",
                group: "p.product_code, p.description",
              },
              pac2: {
                select: "t.pac2 AS category",
                group: "t.pac2",
              },
              pac3: {
                select: "t.pac3 AS category",
                group: "t.pac3",
              },
              supplier: {
                select: "s.name AS supplierName",
                group: "s.name",
              },
            };

          const g = groupByMap[groupBy] || groupByMap.product;

          return misQuery(
            `SELECT ${g.select},
                    COUNT(*) AS transaction_count,
                    SUM(t.salesAmount) AS total_revenue,
                    SUM(t.cogsAmount) AS total_cogs,
                    SUM(t.salesAmount) - SUM(t.cogsAmount) AS gross_margin,
                    ROUND((SUM(t.salesAmount) - SUM(t.cogsAmount)) / NULLIF(SUM(t.salesAmount), 0) * 100, 2) AS margin_pct
             FROM transactions t
             LEFT JOIN pricebook p ON t.product = p.id
             LEFT JOIN supplier s ON p.supplier = s.id
             WHERE t.transaction_date >= ?
               AND t.transaction_date <= ?
               AND t.transactionType = 'SL'
             GROUP BY ${g.group}
             ORDER BY gross_margin DESC
             LIMIT ?`,
            [startDate, endDate, limit]
          );
        }
      );
    },
  },
  {
    name: "mis_brevo_sync_status",
    description:
      "Check Brevo CRM sync health: which transactions and customers have been tracked in Brevo.",
    inputSchema: z.object({
      limit: z.number().optional().default(100).describe("Maximum results"),
    }),
    handler: async (params) => {
      const { limit } = params as { limit: number };
      return withCache(
        "mis_brevo_sync_status",
        { limit },
        MIS_ANALYTICS_TTL,
        async () => {
          const transactionTrack = await misQuery(
            `SELECT COUNT(*) AS tracked_transactions
             FROM brevoTransactionTrack`,
            []
          );
          const customerTrack = await misQuery(
            `SELECT COUNT(*) AS tracked_customers
             FROM brevoCustomerTrack`,
            []
          );
          const recentHistory = await misQuery(
            `SELECT bh.id, bh.webhookType, bh.sender, bh.recipient,
                    bh.message, bh.created,
                    c.account_number, c.name AS customer_name
             FROM brevoHistory bh
             LEFT JOIN customer c ON bh.customer = c.id
             ORDER BY bh.created DESC
             LIMIT ?`,
            [limit]
          );
          return {
            trackedTransactions: transactionTrack[0]?.tracked_transactions || 0,
            trackedCustomers: customerTrack[0]?.tracked_customers || 0,
            recentActivity: recentHistory,
          };
        }
      );
    },
  },
];