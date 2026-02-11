import { z } from "zod";
import { withCache } from "../connections/cache.js";
import {
  getCompanyProfile,
  getCompanyFilings,
  getCompanyOfficers,
  getCCJRecords,
} from "../queries/postgres/companies-house.js";
import type { ToolDefinition } from "./index.js";

const CH_TTL = 3_600_000;

export const companiesHouseTools: ToolDefinition[] = [
  {
    name: "company_profile",
    description:
      "Get Companies House profile for a customer's registered company. Includes company status, type, incorporation date, SIC codes, insolvency history, charges, and registered address.",
    inputSchema: z.object({
      accountNumber: z
        .string()
        .optional()
        .describe("Customer account number (looks up linked company)"),
      companyNumber: z
        .string()
        .optional()
        .describe("Direct Companies House number"),
    }),
    handler: async (params) => {
      const { accountNumber, companyNumber } = params as {
        accountNumber?: string;
        companyNumber?: string;
      };
      if (!accountNumber && !companyNumber) {
        throw new Error(
          "Either accountNumber or companyNumber must be provided"
        );
      }
      const identifier = companyNumber || accountNumber!;
      const isCompanyNumber = !!companyNumber;
      return withCache(
        "company_profile",
        { identifier, isCompanyNumber },
        CH_TTL,
        () => getCompanyProfile(identifier, isCompanyNumber)
      );
    },
  },
  {
    name: "company_filings",
    description:
      "Get recent Companies House filings for a company. Shows filing dates, types, descriptions, and categories.",
    inputSchema: z.object({
      companyNumber: z.string().describe("Companies House company number"),
      limit: z.number().optional().default(20).describe("Max filings to return"),
    }),
    handler: async (params) => {
      const { companyNumber, limit } = params as {
        companyNumber: string;
        limit: number;
      };
      return withCache(
        "company_filings",
        { companyNumber, limit },
        CH_TTL,
        () => getCompanyFilings(companyNumber, limit)
      );
    },
  },
  {
    name: "company_officers",
    description:
      "Get directors and officers for a company from Companies House data. Shows names, roles, appointment dates, and resignation dates.",
    inputSchema: z.object({
      companyNumber: z.string().describe("Companies House company number"),
    }),
    handler: async (params) => {
      const { companyNumber } = params as { companyNumber: string };
      return withCache("company_officers", { companyNumber }, CH_TTL, () =>
        getCompanyOfficers(companyNumber)
      );
    },
  },
  {
    name: "ccj_records",
    description:
      "Get County Court Judgments (CCJs) for a company. Shows case numbers, amounts, judgement dates, court names, and satisfaction dates.",
    inputSchema: z.object({
      companyNumber: z.string().describe("Companies House company number"),
    }),
    handler: async (params) => {
      const { companyNumber } = params as { companyNumber: string };
      return withCache("ccj_records", { companyNumber }, CH_TTL, () =>
        getCCJRecords(companyNumber)
      );
    },
  },
];
