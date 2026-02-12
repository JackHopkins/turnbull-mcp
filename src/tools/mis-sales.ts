import { z } from "zod";
import { withCache } from "../connections/cache.js";
import {
  getTransactions,
  getTransactionsByProduct,
  getTransactionsByBranch,
  getTransactionsByRep,
  getSalesSummary,
  getBranchSalesSummary,
  getRepSalesSummary,
  getTopCustomers,
  getTopProducts,
  getSalesTrends,
} from "../queries/mis/transactions.js";
import type { ToolDefinition } from "./index.js";

const MIS_SALES_TTL = 300_000;

export const misSalesTools: ToolDefinition[] = [
  {
    name: "mis_transactions",
    description:
      "Get MIS transaction history for a customer with sales amounts, COGS, product codes, and invoice numbers. Date range filters recommended for performance.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      startDate: z
        .string()
        .optional()
        .describe("Start date (YYYY-MM-DD)"),
      endDate: z
        .string()
        .optional()
        .describe("End date (YYYY-MM-DD)"),
      limit: z
        .number()
        .optional()
        .default(500)
        .describe("Maximum transactions to return"),
    }),
    handler: async (params) => {
      const { accountNumber, startDate, endDate, limit } = params as {
        accountNumber: string;
        startDate?: string;
        endDate?: string;
        limit: number;
      };
      return withCache(
        "mis_transactions",
        { accountNumber, startDate, endDate, limit },
        MIS_SALES_TTL,
        () => getTransactions(accountNumber, startDate, endDate, limit)
      );
    },
  },
  {
    name: "mis_transactions_by_product",
    description:
      "Get all sales of a specific product across all customers. Useful for product performance analysis.",
    inputSchema: z.object({
      productCode: z.string().describe("Product code"),
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
      limit: z.number().optional().default(1000).describe("Maximum results"),
    }),
    handler: async (params) => {
      const { productCode, startDate, endDate, limit } = params as {
        productCode: string;
        startDate?: string;
        endDate?: string;
        limit: number;
      };
      return withCache(
        "mis_transactions_by_product",
        { productCode, startDate, endDate, limit },
        MIS_SALES_TTL,
        () => getTransactionsByProduct(productCode, startDate, endDate, limit)
      );
    },
  },
  {
    name: "mis_transactions_by_branch",
    description:
      "Get all transactions for a branch in a date range. Requires start and end date for performance.",
    inputSchema: z.object({
      branchName: z.string().describe("Branch name"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      limit: z.number().optional().default(5000).describe("Maximum results"),
    }),
    handler: async (params) => {
      const { branchName, startDate, endDate, limit } = params as {
        branchName: string;
        startDate: string;
        endDate: string;
        limit: number;
      };
      return withCache(
        "mis_transactions_by_branch",
        { branchName, startDate, endDate, limit },
        MIS_SALES_TTL,
        () => getTransactionsByBranch(branchName, startDate, endDate, limit)
      );
    },
  },
  {
    name: "mis_transactions_by_rep",
    description:
      "Get transactions attributed to a sales rep within a date range.",
    inputSchema: z.object({
      repId: z.number().describe("Rep ID"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
    }),
    handler: async (params) => {
      const { repId, startDate, endDate } = params as {
        repId: number;
        startDate: string;
        endDate: string;
      };
      return withCache(
        "mis_transactions_by_rep",
        { repId, startDate, endDate },
        MIS_SALES_TTL,
        () => getTransactionsByRep(repId, startDate, endDate)
      );
    },
  },
  {
    name: "mis_sales_summary",
    description:
      "Aggregated sales by period (month/quarter/year) for a customer. Shows transaction count, total sales, COGS, gross margin, and margin percentage.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      period: z
        .string()
        .describe("Aggregation period: month, quarter, or year"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
    }),
    handler: async (params) => {
      const { accountNumber, period, startDate, endDate } = params as {
        accountNumber: string;
        period: string;
        startDate: string;
        endDate: string;
      };
      return withCache(
        "mis_sales_summary",
        { accountNumber, period, startDate, endDate },
        MIS_SALES_TTL,
        () => getSalesSummary(accountNumber, period, startDate, endDate)
      );
    },
  },
  {
    name: "mis_branch_sales_summary",
    description:
      "Branch-level sales summary: revenue, COGS, margin, customer count. Optionally group by day, month, or product.",
    inputSchema: z.object({
      branchName: z.string().describe("Branch name"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      groupBy: z
        .string()
        .optional()
        .describe("Group results by: day, month, or product"),
    }),
    handler: async (params) => {
      const { branchName, startDate, endDate, groupBy } = params as {
        branchName: string;
        startDate: string;
        endDate: string;
        groupBy?: string;
      };
      return withCache(
        "mis_branch_sales_summary",
        { branchName, startDate, endDate, groupBy },
        MIS_SALES_TTL,
        () => getBranchSalesSummary(branchName, startDate, endDate, groupBy)
      );
    },
  },
  {
    name: "mis_rep_sales_summary",
    description:
      "Sales rep performance summary: total sales, customer count, average order value, margin.",
    inputSchema: z.object({
      repId: z.number().describe("Rep ID"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
    }),
    handler: async (params) => {
      const { repId, startDate, endDate } = params as {
        repId: number;
        startDate: string;
        endDate: string;
      };
      return withCache(
        "mis_rep_sales_summary",
        { repId, startDate, endDate },
        MIS_SALES_TTL,
        () => getRepSalesSummary(repId, startDate, endDate)
      );
    },
  },
  {
    name: "mis_top_customers",
    description:
      "Rank customers by revenue within a date range. Optionally filter by branch or rep.",
    inputSchema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      limit: z.number().optional().default(50).describe("Number of top customers"),
      branchName: z.string().optional().describe("Filter by branch name"),
      repId: z.number().optional().describe("Filter by rep ID"),
    }),
    handler: async (params) => {
      const { startDate, endDate, limit, branchName, repId } = params as {
        startDate: string;
        endDate: string;
        limit: number;
        branchName?: string;
        repId?: number;
      };
      return withCache(
        "mis_top_customers",
        { startDate, endDate, limit, branchName, repId },
        MIS_SALES_TTL,
        () => getTopCustomers(startDate, endDate, limit, branchName, repId)
      );
    },
  },
  {
    name: "mis_top_products",
    description:
      "Rank products by revenue within a date range. Optionally filter by customer or branch.",
    inputSchema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      limit: z.number().optional().default(100).describe("Number of top products"),
      accountNumber: z.string().optional().describe("Filter by customer account"),
      branchName: z.string().optional().describe("Filter by branch name"),
    }),
    handler: async (params) => {
      const { startDate, endDate, limit, accountNumber, branchName } =
        params as {
          startDate: string;
          endDate: string;
          limit: number;
          accountNumber?: string;
          branchName?: string;
        };
      return withCache(
        "mis_top_products",
        { startDate, endDate, limit, accountNumber, branchName },
        MIS_SALES_TTL,
        () =>
          getTopProducts(startDate, endDate, limit, accountNumber, branchName)
      );
    },
  },
  {
    name: "mis_sales_trends",
    description:
      "Time-series revenue and volume data for trend analysis. Choose day, week, or month granularity.",
    inputSchema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      granularity: z
        .string()
        .describe("Time granularity: day, week, or month"),
      accountNumber: z
        .string()
        .optional()
        .describe("Filter by customer account"),
      branchName: z
        .string()
        .optional()
        .describe("Filter by branch name"),
    }),
    handler: async (params) => {
      const { startDate, endDate, granularity, accountNumber, branchName } =
        params as {
          startDate: string;
          endDate: string;
          granularity: string;
          accountNumber?: string;
          branchName?: string;
        };
      return withCache(
        "mis_sales_trends",
        { startDate, endDate, granularity, accountNumber, branchName },
        MIS_SALES_TTL,
        () =>
          getSalesTrends(
            startDate,
            endDate,
            granularity,
            accountNumber,
            branchName
          )
      );
    },
  },
];
