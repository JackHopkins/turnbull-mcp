import { z } from "zod";
import { withCache } from "../connections/cache.js";
import {
  getBranchList,
  getRepList,
  getStaffByBranch,
} from "../queries/mis/staff.js";
import type { ToolDefinition } from "./index.js";

const MIS_STAFF_TTL = 3_600_000;

export const misStaffTools: ToolDefinition[] = [
  {
    name: "mis_branch_list",
    description:
      "Get all Turnbull branches with names, Brevo user IDs, and customer counts.",
    inputSchema: z.object({}),
    handler: async () => {
      return withCache("mis_branch_list", {}, MIS_STAFF_TTL, () =>
        getBranchList()
      );
    },
  },
  {
    name: "mis_rep_list",
    description:
      "Get all sales reps with activity status, K8 user linkage, and customer counts. Filter by branch or active status.",
    inputSchema: z.object({
      branchName: z.string().optional().describe("Filter by branch name"),
      activeOnly: z
        .boolean()
        .optional()
        .default(true)
        .describe("Only show active reps"),
    }),
    handler: async (params) => {
      const { branchName, activeOnly } = params as {
        branchName?: string;
        activeOnly: boolean;
      };
      return withCache(
        "mis_rep_list",
        { branchName, activeOnly },
        MIS_STAFF_TTL,
        () => getRepList(branchName, activeOnly)
      );
    },
  },
  {
    name: "mis_staff_by_branch",
    description:
      "Get all staff assigned to a branch with their roles and K8 user IDs.",
    inputSchema: z.object({
      branchName: z.string().describe("Branch name"),
    }),
    handler: async (params) => {
      const { branchName } = params as { branchName: string };
      return withCache(
        "mis_staff_by_branch",
        { branchName },
        MIS_STAFF_TTL,
        () => getStaffByBranch(branchName)
      );
    },
  },
];
