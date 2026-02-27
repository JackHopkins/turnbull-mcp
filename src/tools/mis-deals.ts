import { z } from "zod";
import { withCache } from "../connections/cache.js";
import {
  getBrevoDealData,
  getBrevoDealPipelineSummary,
  getBrevoDealsByUser,
  getBrevoDealsByCustomer,
  getBrevoDealPipelines,
} from "../queries/mis/deals.js";
import type { ToolDefinition } from "./index.js";

const BREVO_DEALS_TTL = 300_000;

export const misBrevoDealsTools: ToolDefinition[] = [
  {
    name: "mis_brevo_deal_data",
    description:
      "Get Brevo CRM deal data from the MIS database. Returns deal details including stage, amount, pipeline, Kerridge user/quote info, customer details, and dates. Supports filtering by pipeline, stage, user, and creation date.",
    inputSchema: z.object({
      pipeline: z
        .string()
        .optional()
        .describe("Filter by pipeline name (e.g. 'Spalding Heavyside', 'Lincoln Lightside')"),
      stage: z
        .string()
        .optional()
        .describe("Filter by deal stage (e.g. 'Won', 'Lost', 'Followed Up', 'New', 'Qualifying')"),
      kerridgeUserId: z
        .string()
        .optional()
        .describe("Filter by Kerridge user ID (e.g. 'birg-132')"),
      createdSince: z
        .string()
        .optional()
        .describe("Only deals created on or after this date (YYYY-MM-DD)"),
      limit: z
        .number()
        .optional()
        .default(1000)
        .describe("Maximum rows to return"),
    }),
    handler: async (params) => {
      const { pipeline, stage, kerridgeUserId, createdSince, limit } =
        params as {
          pipeline?: string;
          stage?: string;
          kerridgeUserId?: string;
          createdSince?: string;
          limit: number;
        };
      return withCache(
        "mis_brevo_deal_data",
        { pipeline, stage, kerridgeUserId, createdSince, limit },
        BREVO_DEALS_TTL,
        () =>
          getBrevoDealData(pipeline, stage, kerridgeUserId, createdSince, limit)
      );
    },
  },
  {
    name: "mis_brevo_deal_pipeline_summary",
    description:
      "Get Brevo deal pipeline summary showing deal count and total amount by stage and pipeline. Useful for understanding pipeline health and stage distribution.",
    inputSchema: z.object({
      pipeline: z
        .string()
        .optional()
        .describe("Filter by pipeline name"),
    }),
    handler: async (params) => {
      const { pipeline } = params as { pipeline?: string };
      return withCache(
        "mis_brevo_deal_pipeline_summary",
        { pipeline },
        BREVO_DEALS_TTL,
        () => getBrevoDealPipelineSummary(pipeline)
      );
    },
  },
  {
    name: "mis_brevo_deals_by_user",
    description:
      "Get Brevo deal performance by Kerridge user ID. Shows deal count and total amount grouped by user and stage (Won/Lost/etc). Useful for sales rep performance analysis.",
    inputSchema: z.object({
      pipeline: z
        .string()
        .optional()
        .describe("Filter by pipeline name"),
      createdSince: z
        .string()
        .optional()
        .describe("Only deals created on or after this date (YYYY-MM-DD)"),
    }),
    handler: async (params) => {
      const { pipeline, createdSince } = params as {
        pipeline?: string;
        createdSince?: string;
      };
      return withCache(
        "mis_brevo_deals_by_user",
        { pipeline, createdSince },
        BREVO_DEALS_TTL,
        () => getBrevoDealsByUser(pipeline, createdSince)
      );
    },
  },
  {
    name: "mis_brevo_deals_by_customer",
    description:
      "Get Brevo deal performance by customer. Shows deal count and total amount grouped by customer name, account number, and branch. Useful for customer pipeline analysis.",
    inputSchema: z.object({
      pipeline: z
        .string()
        .optional()
        .describe("Filter by pipeline name"),
      stage: z
        .string()
        .optional()
        .describe("Filter by deal stage (e.g. 'Won', 'Lost')"),
      createdSince: z
        .string()
        .optional()
        .describe("Only deals created on or after this date (YYYY-MM-DD)"),
      limit: z
        .number()
        .optional()
        .default(100)
        .describe("Maximum results"),
    }),
    handler: async (params) => {
      const { pipeline, stage, createdSince, limit } = params as {
        pipeline?: string;
        stage?: string;
        createdSince?: string;
        limit: number;
      };
      return withCache(
        "mis_brevo_deals_by_customer",
        { pipeline, stage, createdSince, limit },
        BREVO_DEALS_TTL,
        () => getBrevoDealsByCustomer(pipeline, stage, createdSince, limit)
      );
    },
  },
  {
    name: "mis_brevo_deal_pipelines",
    description:
      "Get list of distinct Brevo deal pipelines with deal counts. Useful for discovering available pipeline names before filtering.",
    inputSchema: z.object({}),
    handler: async () => {
      return withCache(
        "mis_brevo_deal_pipelines",
        {},
        BREVO_DEALS_TTL,
        () => getBrevoDealPipelines()
      );
    },
  },
];
