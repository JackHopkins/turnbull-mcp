import { z } from "zod";
import { withCache } from "../connections/cache.js";
import {
  getTransactionHistory,
  getDebtorDays,
  getOutstandingInvoices,
  getPaymentHistory,
  getCreditStatusHistory,
  getOutstandingOrders,
  getPaymentPlans,
} from "../queries/mysql/financial.js";
import type { ToolDefinition } from "./index.js";

const MYSQL_TTL = 300_000;

export const financialTools: ToolDefinition[] = [
  {
    name: "transaction_history",
    description:
      "Get customer transaction history from TARMS (Kerridge ERP). Shows sales transactions with amounts, invoice numbers, and product codes.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      days: z
        .number()
        .optional()
        .default(365)
        .describe("Number of days of history to retrieve"),
    }),
    handler: async (params) => {
      const { accountNumber, days } = params as {
        accountNumber: string;
        days: number;
      };
      return withCache(
        "transaction_history",
        { accountNumber, days },
        MYSQL_TTL,
        () => getTransactionHistory(accountNumber, days)
      );
    },
  },
  {
    name: "debtor_days",
    description:
      "Get aged debtor analysis for a customer. Shows monthly running balance, days beyond terms, insurance limit, and credit limit history.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
    }),
    handler: async (params) => {
      const { accountNumber } = params as { accountNumber: string };
      return withCache("debtor_days", { accountNumber }, MYSQL_TTL, () =>
        getDebtorDays(accountNumber)
      );
    },
  },
  {
    name: "outstanding_invoices",
    description:
      "Get outstanding (unpaid) invoices for a customer. Shows document numbers, dates, remaining balances, and due dates.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
    }),
    handler: async (params) => {
      const { accountNumber } = params as { accountNumber: string };
      return withCache(
        "outstanding_invoices",
        { accountNumber },
        MYSQL_TTL,
        () => getOutstandingInvoices(accountNumber)
      );
    },
  },
  {
    name: "payment_history",
    description:
      "Get payment records for a customer from TARMS. Shows payment amounts, allocation dates, and payment types.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      days: z
        .number()
        .optional()
        .default(365)
        .describe("Number of days of history to retrieve"),
    }),
    handler: async (params) => {
      const { accountNumber, days } = params as {
        accountNumber: string;
        days: number;
      };
      return withCache(
        "payment_history",
        { accountNumber, days },
        MYSQL_TTL,
        () => getPaymentHistory(accountNumber, days)
      );
    },
  },
  {
    name: "credit_status_history",
    description:
      "Get the history of credit status changes for a customer. Shows prior status, new status, and action IDs for each change event.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
    }),
    handler: async (params) => {
      const { accountNumber } = params as { accountNumber: string };
      return withCache(
        "credit_status_history",
        { accountNumber },
        MYSQL_TTL,
        () => getCreditStatusHistory(accountNumber)
      );
    },
  },
  {
    name: "outstanding_orders",
    description:
      "Get unfulfilled orders for a customer. Shows order numbers, dates, delivery dates, values, and product codes.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
    }),
    handler: async (params) => {
      const { accountNumber } = params as { accountNumber: string };
      return withCache(
        "outstanding_orders",
        { accountNumber },
        MYSQL_TTL,
        () => getOutstandingOrders(accountNumber)
      );
    },
  },
  {
    name: "payment_plans",
    description:
      "Get active payment plans for a customer. Shows plan dates, amounts, frequency, and status.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
    }),
    handler: async (params) => {
      const { accountNumber } = params as { accountNumber: string };
      return withCache("payment_plans", { accountNumber }, MYSQL_TTL, () =>
        getPaymentPlans(accountNumber)
      );
    },
  },
];
