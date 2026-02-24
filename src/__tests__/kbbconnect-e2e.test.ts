/**
 * E2E tests — hit the real KBBConnect SmartApi.
 * Requires KBBCONNECT_API_TOKEN in .env or environment.
 *
 * API response shape: { count: number, value: object[] }
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env from the project root so tests pick up the real token
function loadEnv() {
  const envPath = resolve(import.meta.dirname, "../../.env");
  let content: string;
  try {
    content = readFileSync(envPath, "utf-8");
  } catch {
    return;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)='(.*)'$/);
    if (match) {
      process.env[match[1]] = match[2];
    } else {
      const match2 = trimmed.match(/^([^=]+)=(.*)$/);
      if (match2) process.env[match2[1]] = match2[2];
    }
  }
}

loadEnv();

import { kbbGet } from "../connections/kbbconnect.js";
import { kbbConnectTools } from "../tools/kbbconnect.js";

function findTool(name: string) {
  const tool = kbbConnectTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool '${name}' not found`);
  return tool;
}

const hasToken = !!process.env.KBBCONNECT_API_TOKEN;

describe.skipIf(!hasToken)("KBBConnect E2E", () => {
  describe("kbbGet raw client", () => {
    it("can fetch recent projects", async () => {
      const data = await kbbGet("ProjectPaged", {
        $ticks: 0,
        $orderby: "ORDERNO DESC",
        $skip: 0,
        $top: 3,
      });
      expect(data).toHaveProperty("count");
      expect(data).toHaveProperty("value");
      expect(Array.isArray(data.value)).toBe(true);
      expect(data.value.length).toBeGreaterThan(0);
      expect(data.value.length).toBeLessThanOrEqual(3);

      const project = data.value[0];
      expect(project).toHaveProperty("ORDERNO");
      expect(project).toHaveProperty("DWGNO");
    }, 15000);

    it("can fetch users", async () => {
      const data = await kbbGet("UserPaged", {
        $ticks: 0,
        $orderby: "NAME",
        $skip: 0,
        $top: 5,
      });
      expect(data).toHaveProperty("count");
      expect(data).toHaveProperty("value");
      expect(data.value.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe("tool handlers", () => {
    it("kbb_get_recent_projects returns results", async () => {
      const result = await findTool("kbb_get_recent_projects").handler({ top: 3 });
      expect(result).toHaveProperty("value");
      expect(result.value.length).toBeGreaterThan(0);
      expect(result.count).toBeGreaterThan(0);
    }, 15000);

    it("kbb_search_jobs with date filter returns results", async () => {
      const result = await findTool("kbb_search_jobs").handler({
        ccrdate_from: "01/01/2025",
        orderby: "ORDERNO DESC",
        skip: 0,
        top: 5,
        ticks: 0,
      });
      expect(result).toHaveProperty("value");
      expect(result.value.length).toBeGreaterThan(0);
    }, 15000);

    it("kbb_get_project fetches a specific project by orderno", async () => {
      // Get a valid ORDERNO first
      const recent = await findTool("kbb_get_recent_projects").handler({ top: 1 });
      const orderno = String(recent.value[0].ORDERNO);

      const result = await findTool("kbb_get_project").handler({ orderno });
      expect(result).toBeDefined();
      // API returns an array for Project/{orderno}
      const project = Array.isArray(result) ? result[0] : result;
      expect(project).toHaveProperty("ORDERNO");
    }, 15000);

    it("kbb_get_order_items fetches line items for an order", async () => {
      const recent = await findTool("kbb_get_recent_projects").handler({ top: 1 });
      const orderno = String(recent.value[0].ORDERNO);

      const result = await findTool("kbb_get_order_items").handler({ orderno });
      expect(result).toBeDefined();
    }, 15000);

    it("kbb_get_suppliers returns supplier list", async () => {
      const result = await findTool("kbb_get_suppliers").handler({ skip: 0, top: 5 });
      expect(result).toHaveProperty("value");
      expect(result.value.length).toBeGreaterThan(0);
    }, 15000);

    it("kbb_get_customers returns customer list", async () => {
      const result = await findTool("kbb_get_customers").handler({ skip: 0, top: 5 });
      expect(result).toHaveProperty("value");
      expect(result.value.length).toBeGreaterThan(0);
    }, 15000);

    it("kbb_get_users returns user list", async () => {
      const result = await findTool("kbb_get_users").handler({ skip: 0, top: 5 });
      expect(result).toHaveProperty("value");
      expect(result.value.length).toBeGreaterThan(0);
    }, 15000);

    it("kbb_get_project_by_dwgno finds a project", async () => {
      const recent = await findTool("kbb_get_recent_projects").handler({ top: 1 });
      const dwgno = String(recent.value[0].DWGNO);

      const result = await findTool("kbb_get_project_by_dwgno").handler({ dwgno });
      expect(result).toHaveProperty("value");
      expect(result.value.length).toBeGreaterThan(0);
    }, 15000);

    it("kbb_get_customer fetches a specific customer", async () => {
      // Get a customer ID from a recent project
      const recent = await findTool("kbb_get_recent_projects").handler({ top: 1 });
      const clientId = String(recent.value[0].CLIENTID);

      const result = await findTool("kbb_get_customer").handler({ id: clientId });
      expect(result).toBeDefined();
      // API may return a JSON string, array, or object
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      const customer = Array.isArray(parsed) ? parsed[0] : parsed;
      expect(customer).toHaveProperty("ID");
    }, 15000);
  });
});
