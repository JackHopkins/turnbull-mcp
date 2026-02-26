import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock brevoGet so tools don't make real HTTP calls
vi.mock("../connections/brevo.js", () => ({
  brevoGet: vi.fn(),
}));

// Mock cache to always pass through to the real function
vi.mock("../connections/cache.js", () => ({
  withCache: vi.fn(
    (_name: string, _params: any, _ttl: number, fn: () => Promise<any>) => fn()
  ),
}));

// Mock config
vi.mock("../config.js", () => ({
  getConfig: () => ({ BREVO_API_KEY: "xkeysib-test" }),
}));

import { brevoTools } from "../tools/brevo.js";
import { brevoGet } from "../connections/brevo.js";

const mockedBrevoGet = vi.mocked(brevoGet);

function findTool(name: string) {
  const tool = brevoTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool '${name}' not found`);
  return tool;
}

describe("brevoTools", () => {
  beforeEach(() => {
    mockedBrevoGet.mockReset();
  });

  it("exports 27 tools", () => {
    expect(brevoTools).toHaveLength(27);
  });

  it("all tools have required fields", () => {
    for (const tool of brevoTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.name).toMatch(/^brevo_/);
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.handler).toBe("function");
    }
  });

  // ─── Contacts ──────────────────────────────────────────────────────────────

  describe("brevo_list_contacts", () => {
    it("calls contacts with default params", async () => {
      mockedBrevoGet.mockResolvedValue({ contacts: [], count: 0 });

      await findTool("brevo_list_contacts").handler({
        limit: 50, offset: 0, sort: "desc",
      });

      expect(mockedBrevoGet).toHaveBeenCalledWith("contacts", {
        limit: 50, offset: 0, sort: "desc",
        modifiedSince: undefined, createdSince: undefined,
      });
    });

    it("passes date filters", async () => {
      mockedBrevoGet.mockResolvedValue({ contacts: [], count: 0 });

      await findTool("brevo_list_contacts").handler({
        limit: 10, offset: 0, sort: "asc",
        modifiedSince: "2025-01-01T00:00:00.000Z",
      });

      const [, params] = mockedBrevoGet.mock.calls[0];
      expect(params!.modifiedSince).toBe("2025-01-01T00:00:00.000Z");
    });
  });

  describe("brevo_get_contact", () => {
    it("calls contacts/{identifier} with encoded email", async () => {
      mockedBrevoGet.mockResolvedValue({ id: 1, email: "test@example.com" });

      await findTool("brevo_get_contact").handler({
        identifier: "test@example.com",
      });

      expect(mockedBrevoGet).toHaveBeenCalledWith(
        "contacts/test%40example.com"
      );
    });
  });

  describe("brevo_list_contact_lists", () => {
    it("calls contacts/lists", async () => {
      mockedBrevoGet.mockResolvedValue({ lists: [], count: 0 });

      await findTool("brevo_list_contact_lists").handler({
        limit: 10, offset: 0, sort: "desc",
      });

      expect(mockedBrevoGet).toHaveBeenCalledWith("contacts/lists", {
        limit: 10, offset: 0, sort: "desc",
      });
    });
  });

  describe("brevo_get_contact_list", () => {
    it("calls contacts/lists/{listId}", async () => {
      mockedBrevoGet.mockResolvedValue({ id: 5, name: "Newsletter" });

      await findTool("brevo_get_contact_list").handler({ listId: 5 });

      expect(mockedBrevoGet).toHaveBeenCalledWith("contacts/lists/5");
    });
  });

  describe("brevo_get_contacts_in_list", () => {
    it("calls contacts/lists/{listId}/contacts", async () => {
      mockedBrevoGet.mockResolvedValue({ contacts: [] });

      await findTool("brevo_get_contacts_in_list").handler({
        listId: 3, limit: 50, offset: 0, sort: "desc",
      });

      expect(mockedBrevoGet).toHaveBeenCalledWith("contacts/lists/3/contacts", {
        limit: 50, offset: 0, sort: "desc", modifiedSince: undefined,
      });
    });
  });

  describe("brevo_get_contact_attributes", () => {
    it("calls contacts/attributes", async () => {
      mockedBrevoGet.mockResolvedValue({ attributes: [] });

      await findTool("brevo_get_contact_attributes").handler({});

      expect(mockedBrevoGet).toHaveBeenCalledWith("contacts/attributes");
    });
  });

  describe("brevo_list_folders", () => {
    it("calls contacts/folders", async () => {
      mockedBrevoGet.mockResolvedValue({ folders: [] });

      await findTool("brevo_list_folders").handler({
        limit: 10, offset: 0, sort: "desc",
      });

      expect(mockedBrevoGet).toHaveBeenCalledWith("contacts/folders", {
        limit: 10, offset: 0, sort: "desc",
      });
    });
  });

  describe("brevo_get_folder", () => {
    it("calls contacts/folders/{folderId}", async () => {
      mockedBrevoGet.mockResolvedValue({ id: 2, name: "Main" });

      await findTool("brevo_get_folder").handler({ folderId: 2 });

      expect(mockedBrevoGet).toHaveBeenCalledWith("contacts/folders/2");
    });
  });

  describe("brevo_get_folder_lists", () => {
    it("calls contacts/folders/{folderId}/lists", async () => {
      mockedBrevoGet.mockResolvedValue({ lists: [] });

      await findTool("brevo_get_folder_lists").handler({
        folderId: 2, limit: 10, offset: 0, sort: "desc",
      });

      expect(mockedBrevoGet).toHaveBeenCalledWith("contacts/folders/2/lists", {
        limit: 10, offset: 0, sort: "desc",
      });
    });
  });

  // ─── Email Campaigns ──────────────────────────────────────────────────────

  describe("brevo_list_email_campaigns", () => {
    it("calls emailCampaigns with excludeHtmlContent default true", async () => {
      mockedBrevoGet.mockResolvedValue({ campaigns: [] });

      await findTool("brevo_list_email_campaigns").handler({
        limit: 50, offset: 0, sort: "desc", excludeHtmlContent: true,
      });

      const [endpoint, params] = mockedBrevoGet.mock.calls[0];
      expect(endpoint).toBe("emailCampaigns");
      expect(params!.excludeHtmlContent).toBe(true);
    });

    it("passes type and status filters", async () => {
      mockedBrevoGet.mockResolvedValue({ campaigns: [] });

      await findTool("brevo_list_email_campaigns").handler({
        type: "classic", status: "sent",
        limit: 10, offset: 0, sort: "desc", excludeHtmlContent: true,
      });

      const [, params] = mockedBrevoGet.mock.calls[0];
      expect(params!.type).toBe("classic");
      expect(params!.status).toBe("sent");
    });
  });

  describe("brevo_get_email_campaign", () => {
    it("calls emailCampaigns/{campaignId}", async () => {
      mockedBrevoGet.mockResolvedValue({ id: 42, name: "Welcome" });

      await findTool("brevo_get_email_campaign").handler({ campaignId: 42 });

      expect(mockedBrevoGet).toHaveBeenCalledWith("emailCampaigns/42", {
        statistics: undefined,
      });
    });

    it("passes statistics param", async () => {
      mockedBrevoGet.mockResolvedValue({ id: 42 });

      await findTool("brevo_get_email_campaign").handler({
        campaignId: 42, statistics: "globalStats",
      });

      const [, params] = mockedBrevoGet.mock.calls[0];
      expect(params!.statistics).toBe("globalStats");
    });
  });

  // ─── SMTP / Transactional ─────────────────────────────────────────────────

  describe("brevo_get_smtp_report", () => {
    it("calls smtp/statistics/aggregatedReport", async () => {
      mockedBrevoGet.mockResolvedValue({ requests: 100 });

      await findTool("brevo_get_smtp_report").handler({ days: 7 });

      expect(mockedBrevoGet).toHaveBeenCalledWith(
        "smtp/statistics/aggregatedReport",
        { startDate: undefined, endDate: undefined, days: 7, tag: undefined }
      );
    });
  });

  describe("brevo_get_smtp_events", () => {
    it("calls smtp/statistics/events", async () => {
      mockedBrevoGet.mockResolvedValue({ events: [] });

      await findTool("brevo_get_smtp_events").handler({
        limit: 50, offset: 0, sort: "desc", event: "delivered",
      });

      const [endpoint, params] = mockedBrevoGet.mock.calls[0];
      expect(endpoint).toBe("smtp/statistics/events");
      expect(params!.event).toBe("delivered");
    });
  });

  describe("brevo_get_smtp_activity", () => {
    it("calls smtp/email", async () => {
      mockedBrevoGet.mockResolvedValue({ transactionalEmails: [] });

      await findTool("brevo_get_smtp_activity").handler({
        limit: 50, offset: 0, sort: "desc",
      });

      expect(mockedBrevoGet).toHaveBeenCalledWith("smtp/emails", {
        limit: 50, offset: 0, sort: "desc",
        startDate: undefined, endDate: undefined,
        email: undefined, templateId: undefined,
      });
    });
  });

  // ─── Templates ────────────────────────────────────────────────────────────

  describe("brevo_list_templates", () => {
    it("calls smtp/templates", async () => {
      mockedBrevoGet.mockResolvedValue({ templates: [] });

      await findTool("brevo_list_templates").handler({
        limit: 50, offset: 0, sort: "desc",
      });

      expect(mockedBrevoGet).toHaveBeenCalledWith("smtp/templates", {
        templateStatus: undefined, limit: 50, offset: 0, sort: "desc",
      });
    });
  });

  describe("brevo_get_template", () => {
    it("calls smtp/templates/{templateId}", async () => {
      mockedBrevoGet.mockResolvedValue({ id: 7, name: "Invoice" });

      await findTool("brevo_get_template").handler({ templateId: 7 });

      expect(mockedBrevoGet).toHaveBeenCalledWith("smtp/templates/7");
    });
  });

  // ─── CRM: Deals ──────────────────────────────────────────────────────────

  describe("brevo_list_deals", () => {
    it("calls crm/deals", async () => {
      mockedBrevoGet.mockResolvedValue({ items: [] });

      await findTool("brevo_list_deals").handler({
        limit: 50, offset: 0,
      });

      const [endpoint, params] = mockedBrevoGet.mock.calls[0];
      expect(endpoint).toBe("crm/deals");
      expect(params!.limit).toBe(50);
    });
  });

  describe("brevo_get_deal", () => {
    it("calls crm/deals/{id}", async () => {
      mockedBrevoGet.mockResolvedValue({ id: "abc-123" });

      await findTool("brevo_get_deal").handler({ dealId: "abc-123" });

      expect(mockedBrevoGet).toHaveBeenCalledWith("crm/deals/abc-123");
    });
  });

  describe("brevo_get_pipelines", () => {
    it("calls crm/pipeline/details/all", async () => {
      mockedBrevoGet.mockResolvedValue([]);

      await findTool("brevo_get_pipelines").handler({});

      expect(mockedBrevoGet).toHaveBeenCalledWith("crm/pipeline/details/all");
    });
  });

  describe("brevo_get_deal_attributes", () => {
    it("calls crm/attributes/deals", async () => {
      mockedBrevoGet.mockResolvedValue([]);

      await findTool("brevo_get_deal_attributes").handler({});

      expect(mockedBrevoGet).toHaveBeenCalledWith("crm/attributes/deals");
    });
  });

  // ─── CRM: Companies ──────────────────────────────────────────────────────

  describe("brevo_list_companies", () => {
    it("calls companies", async () => {
      mockedBrevoGet.mockResolvedValue({ items: [] });

      await findTool("brevo_list_companies").handler({ limit: 50 });

      const [endpoint] = mockedBrevoGet.mock.calls[0];
      expect(endpoint).toBe("companies");
    });
  });

  describe("brevo_get_company", () => {
    it("calls companies/{id}", async () => {
      mockedBrevoGet.mockResolvedValue({ id: "comp-1" });

      await findTool("brevo_get_company").handler({ companyId: "comp-1" });

      expect(mockedBrevoGet).toHaveBeenCalledWith("companies/comp-1");
    });
  });

  describe("brevo_get_company_attributes", () => {
    it("calls companies/attributes", async () => {
      mockedBrevoGet.mockResolvedValue([]);

      await findTool("brevo_get_company_attributes").handler({});

      expect(mockedBrevoGet).toHaveBeenCalledWith("companies/attributes");
    });
  });

  // ─── CRM: Tasks ───────────────────────────────────────────────────────────

  describe("brevo_list_tasks", () => {
    it("calls crm/tasks with filter params", async () => {
      mockedBrevoGet.mockResolvedValue({ items: [] });

      await findTool("brevo_list_tasks").handler({
        limit: 50, offset: 0, filterStatus: "undone",
      });

      const [endpoint, params] = mockedBrevoGet.mock.calls[0];
      expect(endpoint).toBe("crm/tasks");
      expect(params!["filter[status]"]).toBe("undone");
    });
  });

  describe("brevo_get_task_types", () => {
    it("calls crm/tasktypes", async () => {
      mockedBrevoGet.mockResolvedValue({ taskTypes: [] });

      await findTool("brevo_get_task_types").handler({});

      expect(mockedBrevoGet).toHaveBeenCalledWith("crm/tasktypes");
    });
  });

  // ─── Account ──────────────────────────────────────────────────────────────

  describe("brevo_get_account", () => {
    it("calls account", async () => {
      mockedBrevoGet.mockResolvedValue({ email: "admin@example.com" });

      await findTool("brevo_get_account").handler({});

      expect(mockedBrevoGet).toHaveBeenCalledWith("account");
    });
  });

  describe("brevo_list_senders", () => {
    it("calls senders with optional filters", async () => {
      mockedBrevoGet.mockResolvedValue({ senders: [] });

      await findTool("brevo_list_senders").handler({ domain: "example.com" });

      expect(mockedBrevoGet).toHaveBeenCalledWith("senders", {
        ip: undefined, domain: "example.com",
      });
    });
  });
});
