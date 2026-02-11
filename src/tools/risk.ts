import { z } from "zod";
import { withCache } from "../connections/cache.js";
import {
  getRiskDistribution,
  getCurrentAlerts,
  getRiskEventDetail,
  getOverviewMetrics,
} from "../queries/postgres/risk.js";
import type { ToolDefinition } from "./index.js";

const PG_TTL = 60_000;
const ALERTS_TTL = 30_000;

export const riskTools: ToolDefinition[] = [
  {
    name: "risk_distribution",
    description:
      "Get the distribution of risk ratings across the customer portfolio. Shows count, total balance, and average days beyond terms for each risk rating band (1/A through 6/F).",
    inputSchema: z.object({
      branch: z.string().optional().describe("Filter by branch name"),
    }),
    handler: async (params) => {
      const { branch } = params as { branch?: string };
      return withCache("risk_distribution", { branch }, PG_TTL, () =>
        getRiskDistribution(branch)
      );
    },
  },
  {
    name: "current_alerts",
    description:
      "Get unreviewed risk alerts sorted by severity (highest score first). These are alerts that have not yet been actioned by a reviewer.",
    inputSchema: z.object({
      limit: z.number().optional().default(50).describe("Max alerts to return"),
      minRating: z
        .string()
        .optional()
        .describe("Minimum rating letter (A-F) to include"),
    }),
    handler: async (params) => {
      const { limit, minRating } = params as {
        limit: number;
        minRating?: string;
      };
      return withCache("current_alerts", { limit, minRating }, ALERTS_TTL, () =>
        getCurrentAlerts(limit, minRating)
      );
    },
  },
  {
    name: "risk_event_detail",
    description:
      "Get detailed information about a specific risk alert/event, including the full explanation, feature data, classifier output, and reviewer actions.",
    inputSchema: z.object({
      alertId: z.string().describe("The alert UUID"),
    }),
    handler: async (params) => {
      const { alertId } = params as { alertId: string };
      return withCache("risk_event_detail", { alertId }, PG_TTL, () =>
        getRiskEventDetail(alertId)
      );
    },
  },
  {
    name: "overview_metrics",
    description:
      "Get aggregate portfolio metrics broken down by risk rating band (A-F). Includes credit balance, days beyond terms, transaction amounts, weighted averages, and open invoices for each band.",
    inputSchema: z.object({}),
    handler: async () => {
      return withCache("overview_metrics", {}, PG_TTL, () =>
        getOverviewMetrics()
      );
    },
  },
];
