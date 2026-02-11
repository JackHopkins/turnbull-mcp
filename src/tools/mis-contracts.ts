import { z } from "zod";
import { withCache } from "../connections/cache.js";
import {
  getCustomerContracts,
  getContractProducts,
  getCustomerDeals,
  getDiscountGroups,
  getEffectivePrice,
  getContractsExpiring,
} from "../queries/mis/contracts.js";
import type { ToolDefinition } from "./index.js";

const MIS_CONTRACT_TTL = 300_000;

export const misContractTools: ToolDefinition[] = [
  {
    name: "mis_customer_contracts",
    description:
      "Get active contracts for a customer with start/end dates, approval status, and contract numbers.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      includeExpired: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include expired contracts"),
    }),
    handler: async (params) => {
      const { accountNumber, includeExpired } = params as {
        accountNumber: string;
        includeExpired: boolean;
      };
      return withCache(
        "mis_customer_contracts",
        { accountNumber, includeExpired },
        MIS_CONTRACT_TTL,
        () => getCustomerContracts(accountNumber, includeExpired)
      );
    },
  },
  {
    name: "mis_contract_products",
    description:
      "Get products within a contract with contracted prices, list prices, and discount percentages.",
    inputSchema: z.object({
      contractId: z.number().describe("Contract ID"),
      limit: z.number().optional().default(1000).describe("Maximum results"),
    }),
    handler: async (params) => {
      const { contractId, limit } = params as {
        contractId: number;
        limit: number;
      };
      return withCache(
        "mis_contract_products",
        { contractId, limit },
        MIS_CONTRACT_TTL,
        () => getContractProducts(contractId, limit)
      );
    },
  },
  {
    name: "mis_customer_deals",
    description:
      "Get special pricing deals for a customer with deal prices and date ranges.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      includeExpired: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include expired deals"),
    }),
    handler: async (params) => {
      const { accountNumber, includeExpired } = params as {
        accountNumber: string;
        includeExpired: boolean;
      };
      return withCache(
        "mis_customer_deals",
        { accountNumber, includeExpired },
        MIS_CONTRACT_TTL,
        () => getCustomerDeals(accountNumber, includeExpired)
      );
    },
  },
  {
    name: "mis_discount_groups",
    description:
      "Get discount group details and product memberships. Can filter by group ID or product code, or list all groups.",
    inputSchema: z.object({
      groupId: z.number().optional().describe("Specific discount group ID"),
      productCode: z
        .string()
        .optional()
        .describe("Find groups containing this product"),
    }),
    handler: async (params) => {
      const { groupId, productCode } = params as {
        groupId?: number;
        productCode?: string;
      };
      return withCache(
        "mis_discount_groups",
        { groupId, productCode },
        MIS_CONTRACT_TTL,
        () => getDiscountGroups(groupId, productCode)
      );
    },
  },
  {
    name: "mis_effective_price",
    description:
      "Calculate the best available price for a product and customer combination. Checks deals, contracts, sale prices, and list prices, returning the lowest with its source.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number"),
      productCode: z.string().describe("Product code"),
    }),
    handler: async (params) => {
      const { accountNumber, productCode } = params as {
        accountNumber: string;
        productCode: string;
      };
      return withCache(
        "mis_effective_price",
        { accountNumber, productCode },
        MIS_CONTRACT_TTL,
        () => getEffectivePrice(accountNumber, productCode)
      );
    },
  },
  {
    name: "mis_contracts_expiring",
    description:
      "Get contracts expiring within N days for renewal pipeline management. Optionally filter by branch.",
    inputSchema: z.object({
      daysAhead: z
        .number()
        .optional()
        .default(30)
        .describe("Number of days ahead to look for expiring contracts"),
      branchName: z.string().optional().describe("Filter by branch name"),
    }),
    handler: async (params) => {
      const { daysAhead, branchName } = params as {
        daysAhead: number;
        branchName?: string;
      };
      return withCache(
        "mis_contracts_expiring",
        { daysAhead, branchName },
        MIS_CONTRACT_TTL,
        () => getContractsExpiring(daysAhead, branchName)
      );
    },
  },
];
