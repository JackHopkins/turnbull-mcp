import { z } from "zod";
import { withCache } from "../connections/cache.js";
import {
  lookupCustomer,
  getCustomerProfile,
  listCustomers,
  getCustomerIntelligence,
  getCustomerAlertsHistory,
  getCustomerMetricHistory,
} from "../queries/postgres/customer.js";
import type { ToolDefinition } from "./index.js";

const PG_TTL = 60_000;

export const customerTools: ToolDefinition[] = [
  {
    name: "customer_lookup",
    description:
      "Search for customers by name or account number. Returns matching customers with basic info and risk rating.",
    inputSchema: z.object({
      query: z.string().describe("Customer name or account number to search for"),
    }),
    handler: async (params) => {
      const { query } = params as { query: string };
      return withCache("customer_lookup", { query }, PG_TTL, () =>
        lookupCustomer(query)
      );
    },
  },
  {
    name: "customer_profile",
    description:
      "Get the full customer profile including all metrics from the materialized view: risk rating, running balance, days beyond terms, credit usage, transaction volumes, insurance limit, Experian scores, and more.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
    }),
    handler: async (params) => {
      const { accountNumber } = params as { accountNumber: string };
      return withCache("customer_profile", { accountNumber }, PG_TTL, () =>
        getCustomerProfile(accountNumber)
      );
    },
  },
  {
    name: "customer_list",
    description:
      "Get a paginated list of customers with optional filters for branch, rep, risk rating, and on-stop status.",
    inputSchema: z.object({
      page: z.number().optional().default(1).describe("Page number (1-based)"),
      limit: z.number().optional().default(20).describe("Results per page"),
      branch: z.string().optional().describe("Filter by branch name"),
      repId: z.string().optional().describe("Filter by account manager ID"),
      riskRating: z.number().optional().describe("Filter by risk rating (1-6)"),
      onStop: z.boolean().optional().describe("Filter by on-stop status"),
      sortBy: z.string().optional().default("name").describe("Sort field"),
      sortOrder: z.string().optional().default("ASC").describe("Sort order: ASC or DESC"),
    }),
    handler: async (params) => {
      return withCache("customer_list", params as Record<string, any>, PG_TTL, () =>
        listCustomers(params as any)
      );
    },
  },
  {
    name: "customer_intelligence",
    description:
      "Get intelligence notes submitted by reps about a customer, including site visit notes, call summaries, and other field intelligence.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      limit: z.number().optional().default(20).describe("Max results to return"),
    }),
    handler: async (params) => {
      const { accountNumber, limit } = params as {
        accountNumber: string;
        limit: number;
      };
      return withCache(
        "customer_intelligence",
        { accountNumber, limit },
        PG_TTL,
        () => getCustomerIntelligence(accountNumber, limit)
      );
    },
  },
  {
    name: "customer_alerts_history",
    description:
      "Get the history of risk alerts for a customer, including scores, explanations, ratings, and reviewer actions.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      limit: z.number().optional().default(20).describe("Max results to return"),
    }),
    handler: async (params) => {
      const { accountNumber, limit } = params as {
        accountNumber: string;
        limit: number;
      };
      return withCache(
        "customer_alerts_history",
        { accountNumber, limit },
        PG_TTL,
        () => getCustomerAlertsHistory(accountNumber, limit)
      );
    },
  },
  {
    name: "customer_metric_history",
    description:
      "Get time-series data for a specific customer metric. Available metric types: risk_rating, risk_score, transaction_volume, running_balance, credit_usage, days_beyond_terms, weighted_days_beyond_terms, remaining_invoice_balance, ytd_transaction_volume, allocated_transaction_volume, on_stop_status, experian_credit_limit, experian_credit_score.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      metricType: z.string().describe("Metric type to retrieve"),
      days: z.number().optional().default(90).describe("Number of days of history"),
    }),
    handler: async (params) => {
      const { accountNumber, metricType, days } = params as {
        accountNumber: string;
        metricType: string;
        days: number;
      };
      return withCache(
        "customer_metric_history",
        { accountNumber, metricType, days },
        PG_TTL,
        () => getCustomerMetricHistory(accountNumber, metricType, days)
      );
    },
  },
];
