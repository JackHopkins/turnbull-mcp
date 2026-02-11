import { z } from "zod";
import { withCache } from "../connections/cache.js";
import { proxyQuery } from "../connections/db-proxy.js";
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
          const results = await proxyQuery("mis.analytics.customer_lifetime_value", { accountNumber });
          return results;
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
          return proxyQuery("mis.analytics.customer_product_affinity", { accountNumber, limit });
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
          return proxyQuery("mis.analytics.branch_comparison", { startDate, endDate });
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
          return proxyQuery("mis.analytics.rep_leaderboard", { startDate, endDate, branchName });
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
          return proxyQuery("mis.analytics.margin_analysis", { groupBy, startDate, endDate, limit });
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
          const results = await proxyQuery("mis.analytics.brevo_sync_status", { limit });
          return results;
        }
      );
    },
  },
];
