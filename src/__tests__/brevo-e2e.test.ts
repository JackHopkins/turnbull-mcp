/**
 * E2E tests — hit the real Brevo API.
 * Requires BREVO_API_KEY in .env or environment.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env from the project root so tests pick up the real key
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

import { brevoGet } from "../connections/brevo.js";
import { brevoTools } from "../tools/brevo.js";

function findTool(name: string) {
  const tool = brevoTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool '${name}' not found`);
  return tool;
}

const hasKey = !!process.env.BREVO_API_KEY;

describe.skipIf(!hasKey)("Brevo E2E", () => {
  describe("brevoGet raw client", () => {
    it("can fetch account info (may fail if key lacks permission)", async () => {
      try {
        const data = await brevoGet("account");
        expect(data).toHaveProperty("email");
      } catch (e: any) {
        // Some API keys don't have account-info permission — that's OK
        expect(e.message).toMatch(/Brevo API error/);
      }
    }, 15000);

    it("can fetch contacts", async () => {
      const data = await brevoGet("contacts", { limit: 3, offset: 0 });
      expect(data).toHaveProperty("contacts");
      expect(Array.isArray(data.contacts)).toBe(true);
    }, 15000);
  });

  describe("tool handlers — Contacts", () => {
    it("brevo_list_contacts returns contacts", async () => {
      const result = await findTool("brevo_list_contacts").handler({
        limit: 3, offset: 0, sort: "desc",
      });
      expect(result).toHaveProperty("contacts");
      expect(Array.isArray(result.contacts)).toBe(true);
    }, 15000);

    it("brevo_get_contact fetches a specific contact", async () => {
      // Get a contact email first
      const list = await findTool("brevo_list_contacts").handler({
        limit: 1, offset: 0, sort: "desc",
      });
      if (list.contacts.length === 0) return; // skip if no contacts

      const email = list.contacts[0].email;
      const result = await findTool("brevo_get_contact").handler({
        identifier: email,
      });
      expect(result).toHaveProperty("email");
      expect(result.email).toBe(email);
    }, 15000);

    it("brevo_list_contact_lists returns lists", async () => {
      const result = await findTool("brevo_list_contact_lists").handler({
        limit: 5, offset: 0, sort: "desc",
      });
      expect(result).toHaveProperty("lists");
      expect(Array.isArray(result.lists)).toBe(true);
    }, 15000);

    it("brevo_get_contact_attributes returns attributes", async () => {
      const result = await findTool("brevo_get_contact_attributes").handler({});
      expect(result).toHaveProperty("attributes");
    }, 15000);
  });

  describe("tool handlers — Campaigns", () => {
    it("brevo_list_email_campaigns returns campaigns", async () => {
      const result = await findTool("brevo_list_email_campaigns").handler({
        limit: 3, offset: 0, sort: "desc", excludeHtmlContent: true,
      });
      expect(result).toHaveProperty("campaigns");
      expect(Array.isArray(result.campaigns)).toBe(true);
    }, 15000);

    it("brevo_get_email_campaign fetches a specific campaign", async () => {
      const list = await findTool("brevo_list_email_campaigns").handler({
        limit: 1, offset: 0, sort: "desc", excludeHtmlContent: true,
      });
      if (list.campaigns.length === 0) return;

      const campaignId = list.campaigns[0].id;
      const result = await findTool("brevo_get_email_campaign").handler({
        campaignId,
      });
      expect(result).toHaveProperty("id");
      expect(result.id).toBe(campaignId);
    }, 15000);
  });

  describe("tool handlers — SMTP", () => {
    it("brevo_get_smtp_report returns aggregated stats", async () => {
      const result = await findTool("brevo_get_smtp_report").handler({
        days: 30,
      });
      expect(result).toBeDefined();
      // Response shape varies; just check it doesn't throw
    }, 15000);

    it("brevo_get_smtp_events returns events", async () => {
      const result = await findTool("brevo_get_smtp_events").handler({
        limit: 5, offset: 0, sort: "desc",
      });
      expect(result).toHaveProperty("events");
    }, 15000);

    it("brevo_get_smtp_activity returns activity (requires filter)", async () => {
      // This endpoint requires at least one of: email, messageId, templateId
      // Use a known template ID from the templates list
      const templates = await findTool("brevo_list_templates").handler({
        limit: 1, offset: 0, sort: "desc",
      });
      if (templates.templates.length === 0) return;
      const templateId = templates.templates[0].id;

      const result = await findTool("brevo_get_smtp_activity").handler({
        limit: 5, offset: 0, sort: "desc", templateId,
      });
      expect(result).toBeDefined();
    }, 15000);
  });

  describe("tool handlers — Templates", () => {
    it("brevo_list_templates returns templates", async () => {
      const result = await findTool("brevo_list_templates").handler({
        limit: 5, offset: 0, sort: "desc",
      });
      expect(result).toHaveProperty("templates");
      expect(Array.isArray(result.templates)).toBe(true);
    }, 15000);
  });

  describe("tool handlers — CRM", () => {
    it("brevo_list_deals returns deals", async () => {
      const result = await findTool("brevo_list_deals").handler({
        limit: 3, offset: 0,
      });
      expect(result).toHaveProperty("items");
    }, 15000);

    it("brevo_get_pipelines returns pipeline definitions", async () => {
      const result = await findTool("brevo_get_pipelines").handler({});
      expect(result).toBeDefined();
      // May be an array of pipelines
      expect(Array.isArray(result) || typeof result === "object").toBe(true);
    }, 15000);

    it("brevo_list_companies returns companies", async () => {
      const result = await findTool("brevo_list_companies").handler({
        limit: 3,
      });
      expect(result).toHaveProperty("items");
    }, 15000);

    it("brevo_list_tasks returns tasks", async () => {
      const result = await findTool("brevo_list_tasks").handler({
        limit: 3, offset: 0,
      });
      expect(result).toHaveProperty("items");
    }, 15000);

    it("brevo_get_task_types returns task types", async () => {
      const result = await findTool("brevo_get_task_types").handler({});
      expect(result).toBeDefined();
    }, 15000);
  });

  describe("tool handlers — Account", () => {
    it("brevo_get_account returns account info (may fail if key lacks permission)", async () => {
      try {
        const result = await findTool("brevo_get_account").handler({});
        expect(result).toHaveProperty("email");
      } catch (e: any) {
        // Some API keys don't have account-info permission — that's OK
        expect(e.message).toMatch(/Brevo API error/);
      }
    }, 15000);

    it("brevo_list_senders returns senders", async () => {
      const result = await findTool("brevo_list_senders").handler({});
      expect(result).toHaveProperty("senders");
      expect(Array.isArray(result.senders)).toBe(true);
    }, 15000);
  });
});
