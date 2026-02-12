import { z } from "zod";
import { withCache } from "../connections/cache.js";
import {
  searchCustomers,
  getCustomerDetail,
  getCustomerContacts,
  getCustomerNotes,
  getCustomersByBranch,
  getCustomersByRep,
  getCustomerOnboardingStatus,
  getBrevoCommsHistory,
} from "../queries/mis/customer.js";
import type { ToolDefinition } from "./index.js";

const MIS_CUSTOMER_TTL = 60_000;

export const misCustomerTools: ToolDefinition[] = [
  {
    name: "mis_customer_search",
    description:
      "Search MIS customers by name, account number, email, or postcode. Returns matching customers with branch and rep details.",
    inputSchema: z.object({
      query: z.string().describe("Search term: name, account number, email, or postcode"),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum results to return"),
    }),
    handler: async (params) => {
      const { query, limit } = params as { query: string; limit: number };
      return withCache("mis_customer_search", { query, limit }, MIS_CUSTOMER_TTL, () =>
        searchCustomers(query, limit)
      );
    },
  },
  {
    name: "mis_customer_detail",
    description:
      "Get full MIS customer record including rep name, branch name, credit terms, credit limit, contact details, and all customer fields.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
    }),
    handler: async (params) => {
      const { accountNumber } = params as { accountNumber: string };
      return withCache("mis_customer_detail", { accountNumber }, MIS_CUSTOMER_TTL, () =>
        getCustomerDetail(accountNumber)
      );
    },
  },
  {
    name: "mis_customer_contacts",
    description:
      "Get all contacts for a customer including email, phone, interests, and Brevo CRM IDs.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      includeInactive: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include inactive contacts"),
    }),
    handler: async (params) => {
      const { accountNumber, includeInactive } = params as {
        accountNumber: string;
        includeInactive: boolean;
      };
      return withCache(
        "mis_customer_contacts",
        { accountNumber, includeInactive },
        MIS_CUSTOMER_TTL,
        () => getCustomerContacts(accountNumber, includeInactive)
      );
    },
  },
  {
    name: "mis_customer_notes",
    description:
      "Get notes and message history for a customer with timestamps and authors.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      limit: z
        .number()
        .optional()
        .default(50)
        .describe("Maximum notes to return"),
    }),
    handler: async (params) => {
      const { accountNumber, limit } = params as {
        accountNumber: string;
        limit: number;
      };
      return withCache(
        "mis_customer_notes",
        { accountNumber, limit },
        MIS_CUSTOMER_TTL,
        () => getCustomerNotes(accountNumber, limit)
      );
    },
  },
  {
    name: "mis_customers_by_branch",
    description:
      "Get paginated customer list for a branch with rep assignments and credit status.",
    inputSchema: z.object({
      branchName: z.string().describe("Branch name"),
      page: z.number().optional().default(1).describe("Page number"),
      limit: z
        .number()
        .optional()
        .default(50)
        .describe("Results per page"),
      sortBy: z
        .string()
        .optional()
        .default("name")
        .describe("Sort field: name, accountNumber, or creditLimit"),
    }),
    handler: async (params) => {
      const { branchName, page, limit, sortBy } = params as {
        branchName: string;
        page: number;
        limit: number;
        sortBy: string;
      };
      return withCache(
        "mis_customers_by_branch",
        { branchName, page, limit, sortBy },
        MIS_CUSTOMER_TTL,
        () => getCustomersByBranch(branchName, page, limit, sortBy)
      );
    },
  },
  {
    name: "mis_customers_by_rep",
    description:
      "Get customers assigned to a sales rep with credit status and branch info.",
    inputSchema: z.object({
      repId: z.number().describe("Rep ID"),
      limit: z
        .number()
        .optional()
        .default(100)
        .describe("Maximum results to return"),
    }),
    handler: async (params) => {
      const { repId, limit } = params as { repId: number; limit: number };
      return withCache(
        "mis_customers_by_rep",
        { repId, limit },
        MIS_CUSTOMER_TTL,
        () => getCustomersByRep(repId, limit)
      );
    },
  },
  {
    name: "mis_customer_onboarding_status",
    description:
      "Check whether a customer has registered for the online portal, their registration date, and last login.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
    }),
    handler: async (params) => {
      const { accountNumber } = params as { accountNumber: string };
      return withCache(
        "mis_customer_onboarding_status",
        { accountNumber },
        MIS_CUSTOMER_TTL,
        () => getCustomerOnboardingStatus(accountNumber)
      );
    },
  },
  {
    name: "mis_brevo_comms_history",
    description:
      "Get Brevo email communication history for a customer including campaign sends, opens, and click events.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      limit: z
        .number()
        .optional()
        .default(50)
        .describe("Maximum records to return"),
    }),
    handler: async (params) => {
      const { accountNumber, limit } = params as {
        accountNumber: string;
        limit: number;
      };
      return withCache(
        "mis_brevo_comms_history",
        { accountNumber, limit },
        MIS_CUSTOMER_TTL,
        () => getBrevoCommsHistory(accountNumber, limit)
      );
    },
  },
];
