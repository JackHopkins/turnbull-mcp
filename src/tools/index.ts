import { z } from "zod";
import { customerTools } from "./customer.js";
import { riskTools } from "./risk.js";
import { financialTools } from "./financial.js";
import { companiesHouseTools } from "./companies-house.js";
import { analysisTools } from "./analysis.js";
import { notificationTools } from "./notifications.js";

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
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return allTools.find((t) => t.name === name);
}
