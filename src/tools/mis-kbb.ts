import { z } from "zod";
import { withCache } from "../connections/cache.js";
import {
  getKbbJobs,
  getKbbJobDetail,
  getKbbPipeline,
  getKbbDesignerPerformance,
  getKbbDesignerTargets,
  getKbbLostAnalysis,
  getKbbReferralSources,
} from "../queries/mis/kbb.js";
import type { ToolDefinition } from "./index.js";

const MIS_KBB_TTL = 300_000;

export const misKbbTools: ToolDefinition[] = [
  {
    name: "mis_kbb_jobs",
    description:
      "Get KBB (Kitchen & Bathroom) jobs/quotes with status, designer, price, and probability. Filter by customer, branch, designer, or status.",
    inputSchema: z.object({
      accountNumber: z.string().optional().describe("Filter by customer account"),
      branchName: z.string().optional().describe("Filter by branch name"),
      designerId: z.number().optional().describe("Filter by designer ID"),
      status: z
        .string()
        .optional()
        .describe("Filter by status: quote, won, lost, ordered, etc."),
      limit: z.number().optional().default(100).describe("Maximum results"),
    }),
    handler: async (params) => {
      const { accountNumber, branchName, designerId, status, limit } =
        params as {
          accountNumber?: string;
          branchName?: string;
          designerId?: number;
          status?: string;
          limit: number;
        };
      return withCache(
        "mis_kbb_jobs",
        { accountNumber, branchName, designerId, status, limit },
        MIS_KBB_TTL,
        () => getKbbJobs(accountNumber, branchName, designerId, status, limit)
      );
    },
  },
  {
    name: "mis_kbb_job_detail",
    description:
      "Get full KBB job details including design specification (jobJson), pricing breakdown, and status history.",
    inputSchema: z.object({
      orderNumber: z.string().describe("KBB order/job number"),
    }),
    handler: async (params) => {
      const { orderNumber } = params as { orderNumber: string };
      return withCache(
        "mis_kbb_job_detail",
        { orderNumber },
        MIS_KBB_TTL,
        () => getKbbJobDetail(orderNumber)
      );
    },
  },
  {
    name: "mis_kbb_pipeline",
    description:
      "KBB pipeline summary by stage showing job count, total quote value, sale value, and probability-weighted value.",
    inputSchema: z.object({
      branchName: z.string().optional().describe("Filter by branch name"),
      startDate: z.string().optional().describe("Filter from date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("Filter to date (YYYY-MM-DD)"),
    }),
    handler: async (params) => {
      const { branchName, startDate, endDate } = params as {
        branchName?: string;
        startDate?: string;
        endDate?: string;
      };
      return withCache(
        "mis_kbb_pipeline",
        { branchName, startDate, endDate },
        MIS_KBB_TTL,
        () => getKbbPipeline(branchName, startDate, endDate)
      );
    },
  },
  {
    name: "mis_kbb_designer_performance",
    description:
      "Designer performance metrics: total quotes, wins, losses, revenue, margin, conversion rate, and average sale value.",
    inputSchema: z.object({
      designerId: z.number().describe("Designer ID"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
    }),
    handler: async (params) => {
      const { designerId, startDate, endDate } = params as {
        designerId: number;
        startDate: string;
        endDate: string;
      };
      return withCache(
        "mis_kbb_designer_performance",
        { designerId, startDate, endDate },
        MIS_KBB_TTL,
        () => getKbbDesignerPerformance(designerId, startDate, endDate)
      );
    },
  },
  {
    name: "mis_kbb_designer_targets",
    description:
      "Designer targets vs actuals for a specific month. Shows quote, sale, and margin targets alongside actual performance.",
    inputSchema: z.object({
      designerId: z.number().describe("Designer ID"),
      period: z.string().describe("Period in YYYY-MM format"),
    }),
    handler: async (params) => {
      const { designerId, period } = params as {
        designerId: number;
        period: string;
      };
      return withCache(
        "mis_kbb_designer_targets",
        { designerId, period },
        MIS_KBB_TTL,
        () => getKbbDesignerTargets(designerId, period)
      );
    },
  },
  {
    name: "mis_kbb_lost_analysis",
    description:
      "Analyze lost KBB jobs grouped by reason with total and average values. Identify top reasons for lost business.",
    inputSchema: z.object({
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      branchName: z.string().optional().describe("Filter by branch name"),
      designerId: z.number().optional().describe("Filter by designer ID"),
    }),
    handler: async (params) => {
      const { startDate, endDate, branchName, designerId } = params as {
        startDate: string;
        endDate: string;
        branchName?: string;
        designerId?: number;
      };
      return withCache(
        "mis_kbb_lost_analysis",
        { startDate, endDate, branchName, designerId },
        MIS_KBB_TTL,
        () => getKbbLostAnalysis(startDate, endDate, branchName, designerId)
      );
    },
  },
  {
    name: "mis_kbb_referral_sources",
    description:
      "Analyze KBB lead sources (Walk In, referral, website, etc.) with conversion rates and revenue attribution.",
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
        "mis_kbb_referral_sources",
        { startDate, endDate, branchName },
        MIS_KBB_TTL,
        () => getKbbReferralSources(startDate, endDate, branchName)
      );
    },
  },
];
