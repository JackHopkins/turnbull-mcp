import { z } from "zod";
import { customerTools } from "./customer.js";
import { riskTools } from "./risk.js";
import { financialTools } from "./financial.js";
import { companiesHouseTools } from "./companies-house.js";
import { analysisTools } from "./analysis.js";
import { notificationTools } from "./notifications.js";
import { misCustomerTools } from "./mis-customer.js";
import { misSalesTools } from "./mis-sales.js";
import { misProductTools } from "./mis-products.js";
import { misContractTools } from "./mis-contracts.js";
import { misKbbTools } from "./mis-kbb.js";
import { misEventsTools } from "./mis-events.js";
import { misAnalyticsTools } from "./mis-analytics.js";
import { misStaffTools } from "./mis-staff.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  handler: (params: Record<string, any>) => Promise<any>;
}

export const allTools: ToolDefinition[] = [
  ...customerTools,
  ...riskTools,
  ...financialTools,
  ...companiesHouseTools,
  ...analysisTools,
  ...notificationTools,
  ...misCustomerTools,
  ...misSalesTools,
  ...misProductTools,
  ...misContractTools,
  ...misKbbTools,
  ...misEventsTools,
  ...misAnalyticsTools,
  ...misStaffTools,
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return allTools.find((t) => t.name === name);
}
