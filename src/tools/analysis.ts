import { z } from "zod";
import { withCache } from "../connections/cache.js";
import { llmAnalyze } from "../llm/openrouter.js";
import { getCustomerProfile, listCustomers } from "../queries/postgres/customer.js";
import { getRiskDistribution, getOverviewMetrics } from "../queries/postgres/risk.js";
import type { ToolDefinition } from "./index.js";

const LLM_TTL = 3_600_000;

export const analysisTools: ToolDefinition[] = [
  {
    name: "analyze_customer_risk",
    description:
      "Generate an AI-powered risk analysis narrative for a customer using all available data. Provides a comprehensive assessment combining risk metrics, financial data, and historical patterns.",
    inputSchema: z.object({
      accountNumber: z.string().describe("Customer account number to analyze"),
    }),
    handler: async (params) => {
      const { accountNumber } = params as { accountNumber: string };
      return withCache(
        "analyze_customer_risk",
        { accountNumber },
        LLM_TTL,
        async () => {
          const profile = await getCustomerProfile(accountNumber);
          if (!profile) {
            return { error: "Customer not found" };
          }

          const prompt = `Analyze the risk profile for this customer and provide a concise risk assessment:

Customer: ${profile.name} (${profile.accountNumber})
Branch: ${profile.branch}
Account Manager: ${profile.accountManagerName || "N/A"}
Account Since: ${profile.accountSince || "N/A"}

Risk Metrics:
- Risk Rating: ${profile.risk_rating || "N/A"} (1=A lowest, 6=F highest)
- Risk Score: ${profile.risk_score || "N/A"} (0-1 ML score)
- Days Beyond Terms: ${profile.days_beyond_terms || 0}
- Weighted Days Beyond Terms: ${profile.weighted_days_beyond_terms || 0}

Financial:
- Credit Limit: £${profile.creditLimit || 0}
- Running Balance: £${profile.running_balance || 0}
- Credit Usage: ${profile.credit_usage || 0}%
- Insurance Limit: £${profile.insurance_limit || 0}
- Remaining Invoice Balance: £${profile.remaining_invoice_balance || 0}
- YTD Transaction Volume: £${profile.ytd_transaction_volume || 0}

Status:
- On Stop: ${profile.on_stop ? "YES" : "No"}
- Legal Status: ${profile.legal || "Ok"}
- Experian Credit Limit: £${profile.experian_credit_limit || 0}
- Experian Credit Score: ${profile.experian_credit_score || "N/A"}

Provide:
1. Risk summary (2-3 sentences)
2. Key concerns (bullet points)
3. Recommended actions`;

          const analysis = await llmAnalyze(prompt);
          return { customer: profile.name, accountNumber, analysis };
        }
      );
    },
  },
  {
    name: "compare_customers",
    description:
      "Compare risk profiles of multiple customers side by side. Useful for benchmarking or reviewing a group of related accounts.",
    inputSchema: z.object({
      accountNumbers: z
        .array(z.string())
        .min(2)
        .max(10)
        .describe("List of customer account numbers to compare"),
    }),
    handler: async (params) => {
      const { accountNumbers } = params as { accountNumbers: string[] };
      return withCache(
        "compare_customers",
        { accountNumbers: accountNumbers.sort() },
        LLM_TTL,
        async () => {
          const profiles = await Promise.all(
            accountNumbers.map((an) => getCustomerProfile(an))
          );
          const validProfiles = profiles.filter(Boolean);

          if (validProfiles.length < 2) {
            return {
              error: "Need at least 2 valid customers to compare",
            };
          }

          const profileSummaries = validProfiles
            .map(
              (p: any) =>
                `- ${p.name} (${p.accountNumber}): Risk ${p.risk_rating || "N/A"}, Balance £${p.running_balance || 0}, DBT ${p.days_beyond_terms || 0} days, Credit Usage ${p.credit_usage || 0}%`
            )
            .join("\n");

          const prompt = `Compare these customers and highlight key differences in their risk profiles:

${profileSummaries}

Provide a brief comparison highlighting:
1. Which customer poses the highest risk and why
2. Key differences in payment behavior
3. Any notable patterns`;

          const analysis = await llmAnalyze(prompt);
          return { customers: validProfiles.map((p: any) => p.name), analysis };
        }
      );
    },
  },
  {
    name: "portfolio_summary",
    description:
      "Generate an AI-powered summary of portfolio risk. Can be filtered by branch or account manager.",
    inputSchema: z.object({
      branch: z.string().optional().describe("Filter by branch name"),
      repId: z.string().optional().describe("Filter by account manager ID"),
    }),
    handler: async (params) => {
      const { branch, repId } = params as {
        branch?: string;
        repId?: string;
      };
      return withCache(
        "portfolio_summary",
        { branch, repId },
        LLM_TTL,
        async () => {
          const [distribution, overview, customerList] = await Promise.all([
            getRiskDistribution(branch),
            getOverviewMetrics(),
            listCustomers({
              branch,
              repId,
              limit: 10,
              sortBy: "risk_rating",
              sortOrder: "DESC",
            }),
          ]);

          const distSummary = distribution
            .map(
              (d: any) =>
                `Rating ${d.risk_rating}: ${d.count} customers, £${d.total_balance?.toFixed(0) || 0} balance, ${d.avg_days_beyond_terms?.toFixed(0) || 0} avg DBT`
            )
            .join("\n");

          const topRisk = customerList.customers
            .map(
              (c: any) =>
                `- ${c.name} (${c.accountNumber}): Rating ${c.risk_rating}, £${c.running_balance?.toFixed(0) || 0}`
            )
            .join("\n");

          const prompt = `Summarize this portfolio's risk health:

Risk Distribution:
${distSummary}

Total Customers: ${customerList.totalCount}
${branch ? `Branch: ${branch}` : ""}
${repId ? `Account Manager: ${repId}` : ""}

Top Risk Customers:
${topRisk}

${overview ? `Portfolio Overview Metrics:
- Total Credit Balance: £${overview.credit_balance?.toFixed(0) || 0}
- Total Days Beyond Terms: ${overview.days_beyond_terms || 0}
- Risky Credit Balance: £${overview.risky_credit_balance?.toFixed(0) || 0}
- Open Invoices: ${overview.open_invoices || 0}` : ""}

Provide:
1. Portfolio health summary (2-3 sentences)
2. Key risk concentrations
3. Recommended priority actions`;

          const analysis = await llmAnalyze(prompt);
          return {
            distribution,
            totalCustomers: customerList.totalCount,
            analysis,
          };
        }
      );
    },
  },
];
