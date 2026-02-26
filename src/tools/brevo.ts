import { z } from "zod";
import { withCache } from "../connections/cache.js";
import { brevoGet } from "../connections/brevo.js";
import type { ToolDefinition } from "./index.js";

// Cache TTLs
const BREVO_ACCOUNT_TTL = 300_000; // 5 minutes
const BREVO_CONTACTS_TTL = 120_000; // 2 minutes
const BREVO_CAMPAIGNS_TTL = 120_000; // 2 minutes
const BREVO_SMTP_TTL = 60_000; // 1 minute
const BREVO_CRM_TTL = 120_000; // 2 minutes

// ─── Tools ───────────────────────────────────────────────────────────────────

export const brevoTools: ToolDefinition[] = [
  // ─── Contacts ────────────────────────────────────────────────────────────────

  {
    name: "brevo_list_contacts",
    description: "List Brevo contacts with pagination and optional date filters.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(1000).optional().default(50).describe("Number of contacts to return (max 1000)"),
      offset: z.number().int().min(0).optional().default(0).describe("Index of the first contact to return"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order by creation date"),
      modifiedSince: z.string().optional().describe("Filter contacts modified since this date (YYYY-MM-DDTHH:mm:ss.SSSZ)"),
      createdSince: z.string().optional().describe("Filter contacts created since this date (YYYY-MM-DDTHH:mm:ss.SSSZ)"),
    }),
    handler: async (params) => {
      const { limit, offset, sort, modifiedSince, createdSince } = params as any;
      return withCache("brevo_list_contacts", params, BREVO_CONTACTS_TTL, () =>
        brevoGet("contacts", { limit, offset, sort, modifiedSince, createdSince })
      );
    },
  },

  {
    name: "brevo_get_contact",
    description: "Get a specific Brevo contact by email address or numeric ID.",
    inputSchema: z.object({
      identifier: z.string().describe("Email address or numeric ID of the contact"),
    }),
    handler: async (params) => {
      const { identifier } = params as { identifier: string };
      return withCache("brevo_get_contact", params, BREVO_CONTACTS_TTL, () =>
        brevoGet(`contacts/${encodeURIComponent(identifier)}`)
      );
    },
  },

  {
    name: "brevo_list_contact_lists",
    description: "List all Brevo contact lists with pagination.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).optional().default(10).describe("Number of lists to return (max 50)"),
      offset: z.number().int().min(0).optional().default(0).describe("Index of the first list to return"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order"),
    }),
    handler: async (params) => {
      const { limit, offset, sort } = params as any;
      return withCache("brevo_list_contact_lists", params, BREVO_CONTACTS_TTL, () =>
        brevoGet("contacts/lists", { limit, offset, sort })
      );
    },
  },

  {
    name: "brevo_get_contact_list",
    description: "Get details of a specific Brevo contact list by ID.",
    inputSchema: z.object({
      listId: z.number().int().describe("ID of the contact list"),
    }),
    handler: async (params) => {
      const { listId } = params as { listId: number };
      return withCache("brevo_get_contact_list", params, BREVO_CONTACTS_TTL, () =>
        brevoGet(`contacts/lists/${listId}`)
      );
    },
  },

  {
    name: "brevo_get_contacts_in_list",
    description: "Get contacts belonging to a specific Brevo list.",
    inputSchema: z.object({
      listId: z.number().int().describe("ID of the contact list"),
      limit: z.number().int().min(1).max(500).optional().default(50).describe("Number of contacts to return (max 500)"),
      offset: z.number().int().min(0).optional().default(0).describe("Index of the first contact to return"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order"),
      modifiedSince: z.string().optional().describe("Filter contacts modified since this date (YYYY-MM-DDTHH:mm:ss.SSSZ)"),
    }),
    handler: async (params) => {
      const { listId, limit, offset, sort, modifiedSince } = params as any;
      return withCache("brevo_get_contacts_in_list", params, BREVO_CONTACTS_TTL, () =>
        brevoGet(`contacts/lists/${listId}/contacts`, { limit, offset, sort, modifiedSince })
      );
    },
  },

  {
    name: "brevo_get_contact_attributes",
    description: "Get all contact attribute definitions in Brevo.",
    inputSchema: z.object({}),
    handler: async (params) => {
      return withCache("brevo_get_contact_attributes", params, BREVO_CONTACTS_TTL, () =>
        brevoGet("contacts/attributes")
      );
    },
  },

  {
    name: "brevo_list_folders",
    description: "List Brevo contact folders with pagination.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).optional().default(10).describe("Number of folders to return (max 50)"),
      offset: z.number().int().min(0).optional().default(0).describe("Index of the first folder to return"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order"),
    }),
    handler: async (params) => {
      const { limit, offset, sort } = params as any;
      return withCache("brevo_list_folders", params, BREVO_CONTACTS_TTL, () =>
        brevoGet("contacts/folders", { limit, offset, sort })
      );
    },
  },

  {
    name: "brevo_get_folder",
    description: "Get details of a specific Brevo contact folder by ID.",
    inputSchema: z.object({
      folderId: z.number().int().describe("ID of the contact folder"),
    }),
    handler: async (params) => {
      const { folderId } = params as { folderId: number };
      return withCache("brevo_get_folder", params, BREVO_CONTACTS_TTL, () =>
        brevoGet(`contacts/folders/${folderId}`)
      );
    },
  },

  {
    name: "brevo_get_folder_lists",
    description: "Get contact lists within a specific Brevo folder.",
    inputSchema: z.object({
      folderId: z.number().int().describe("ID of the contact folder"),
      limit: z.number().int().min(1).max(50).optional().default(10).describe("Number of lists to return (max 50)"),
      offset: z.number().int().min(0).optional().default(0).describe("Index of the first list to return"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order"),
    }),
    handler: async (params) => {
      const { folderId, limit, offset, sort } = params as any;
      return withCache("brevo_get_folder_lists", params, BREVO_CONTACTS_TTL, () =>
        brevoGet(`contacts/folders/${folderId}/lists`, { limit, offset, sort })
      );
    },
  },

  // ─── Email Campaigns ─────────────────────────────────────────────────────────

  {
    name: "brevo_list_email_campaigns",
    description: "List Brevo email campaigns with optional filters. Excludes HTML content by default for smaller responses.",
    inputSchema: z.object({
      type: z.enum(["classic", "trigger"]).optional().describe("Filter by campaign type"),
      status: z.enum(["suspended", "archive", "sent", "queued", "draft", "inProcess"]).optional().describe("Filter by campaign status"),
      limit: z.number().int().min(1).max(1000).optional().default(50).describe("Number of campaigns to return (max 1000)"),
      offset: z.number().int().min(0).optional().default(0).describe("Index of the first campaign to return"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order by creation date"),
      startDate: z.string().optional().describe("Filter campaigns sent after this date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("Filter campaigns sent before this date (YYYY-MM-DD)"),
      excludeHtmlContent: z.boolean().optional().default(true).describe("Exclude HTML content from response (default true)"),
    }),
    handler: async (params) => {
      const { type, status, limit, offset, sort, startDate, endDate, excludeHtmlContent } = params as any;
      return withCache("brevo_list_email_campaigns", params, BREVO_CAMPAIGNS_TTL, () =>
        brevoGet("emailCampaigns", { type, status, limit, offset, sort, startDate, endDate, excludeHtmlContent })
      );
    },
  },

  {
    name: "brevo_get_email_campaign",
    description: "Get details of a specific Brevo email campaign by ID.",
    inputSchema: z.object({
      campaignId: z.number().int().describe("ID of the email campaign"),
      statistics: z.enum(["globalStats", "linksStats", "statsByDomain"]).optional().describe("Type of statistics to include"),
    }),
    handler: async (params) => {
      const { campaignId, statistics } = params as any;
      return withCache("brevo_get_email_campaign", params, BREVO_CAMPAIGNS_TTL, () =>
        brevoGet(`emailCampaigns/${campaignId}`, { statistics })
      );
    },
  },

  // ─── SMTP / Transactional Email ──────────────────────────────────────────────

  {
    name: "brevo_get_smtp_report",
    description: "Get aggregated SMTP/transactional email statistics from Brevo.",
    inputSchema: z.object({
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
      days: z.number().int().optional().describe("Number of days in the past (overrides startDate/endDate)"),
      tag: z.string().optional().describe("Filter by tag"),
    }),
    handler: async (params) => {
      const { startDate, endDate, days, tag } = params as any;
      return withCache("brevo_get_smtp_report", params, BREVO_SMTP_TTL, () =>
        brevoGet("smtp/statistics/aggregatedReport", { startDate, endDate, days, tag })
      );
    },
  },

  {
    name: "brevo_get_smtp_events",
    description: "Get SMTP/transactional email events from Brevo (deliveries, opens, clicks, bounces, etc.).",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(5000).optional().default(50).describe("Number of events to return (max 5000)"),
      offset: z.number().int().min(0).optional().default(0).describe("Index of the first event to return"),
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
      email: z.string().optional().describe("Filter by recipient email address"),
      event: z.enum(["bounces", "hardBounces", "softBounces", "delivered", "spam", "requests", "opened", "clicks", "invalid", "deferred", "blocked", "unsubscribed", "error", "loadedByProxy"]).optional().describe("Filter by event type"),
      tags: z.string().optional().describe("Filter by tag"),
      templateId: z.number().int().optional().describe("Filter by template ID"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order by date"),
    }),
    handler: async (params) => {
      const { limit, offset, startDate, endDate, email, event, tags, templateId, sort } = params as any;
      return withCache("brevo_get_smtp_events", params, BREVO_SMTP_TTL, () =>
        brevoGet("smtp/statistics/events", { limit, offset, startDate, endDate, email, event, tags, templateId, sort })
      );
    },
  },

  {
    name: "brevo_get_smtp_activity",
    description: "Get transactional email activity log from Brevo. Shows past 30 days by default. Requires at least one filter: email, messageId, or templateId.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(500).optional().default(50).describe("Number of records to return (max 500)"),
      offset: z.number().int().min(0).optional().default(0).describe("Index of the first record to return"),
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order by date"),
      email: z.string().optional().describe("Filter by recipient email address"),
      templateId: z.number().int().optional().describe("Filter by template ID"),
    }),
    handler: async (params) => {
      const { limit, offset, startDate, endDate, sort, email, templateId } = params as any;
      return withCache("brevo_get_smtp_activity", params, BREVO_SMTP_TTL, () =>
        brevoGet("smtp/emails", { limit, offset, startDate, endDate, sort, email, templateId })
      );
    },
  },

  // ─── Templates ────────────────────────────────────────────────────────────────

  {
    name: "brevo_list_templates",
    description: "List Brevo email templates.",
    inputSchema: z.object({
      templateStatus: z.boolean().optional().describe("Filter by active (true) or inactive (false) status"),
      limit: z.number().int().min(1).max(1000).optional().default(50).describe("Number of templates to return (max 1000)"),
      offset: z.number().int().min(0).optional().default(0).describe("Index of the first template to return"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order by creation date"),
    }),
    handler: async (params) => {
      const { templateStatus, limit, offset, sort } = params as any;
      return withCache("brevo_list_templates", params, BREVO_SMTP_TTL, () =>
        brevoGet("smtp/templates", { templateStatus, limit, offset, sort })
      );
    },
  },

  {
    name: "brevo_get_template",
    description: "Get details of a specific Brevo email template by ID.",
    inputSchema: z.object({
      templateId: z.number().int().describe("ID of the email template"),
    }),
    handler: async (params) => {
      const { templateId } = params as { templateId: number };
      return withCache("brevo_get_template", params, BREVO_SMTP_TTL, () =>
        brevoGet(`smtp/templates/${templateId}`)
      );
    },
  },

  // ─── CRM: Deals ──────────────────────────────────────────────────────────────

  {
    name: "brevo_list_deals",
    description: "List Brevo CRM deals with pagination and optional date filters.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(500).optional().default(50).describe("Number of deals to return (max 500)"),
      offset: z.number().int().min(0).optional().default(0).describe("Index of the first deal to return"),
      sort: z.enum(["asc", "desc"]).optional().describe("Sort order"),
      modifiedSince: z.string().optional().describe("Filter deals modified since this date (YYYY-MM-DDTHH:mm:ss.SSSZ)"),
      createdSince: z.string().optional().describe("Filter deals created since this date (YYYY-MM-DDTHH:mm:ss.SSSZ)"),
    }),
    handler: async (params) => {
      const { limit, offset, sort, modifiedSince, createdSince } = params as any;
      return withCache("brevo_list_deals", params, BREVO_CRM_TTL, () =>
        brevoGet("crm/deals", { limit, offset, sort, "filters[modifiedSince]": modifiedSince, "filters[createdSince]": createdSince })
      );
    },
  },

  {
    name: "brevo_get_deal",
    description: "Get details of a specific Brevo CRM deal by ID.",
    inputSchema: z.object({
      dealId: z.string().describe("ID of the deal"),
    }),
    handler: async (params) => {
      const { dealId } = params as { dealId: string };
      return withCache("brevo_get_deal", params, BREVO_CRM_TTL, () =>
        brevoGet(`crm/deals/${dealId}`)
      );
    },
  },

  {
    name: "brevo_get_pipelines",
    description: "Get all Brevo CRM pipeline definitions and their stages.",
    inputSchema: z.object({}),
    handler: async (params) => {
      return withCache("brevo_get_pipelines", params, BREVO_CRM_TTL, () =>
        brevoGet("crm/pipeline/details/all")
      );
    },
  },

  {
    name: "brevo_get_deal_attributes",
    description: "Get all Brevo CRM deal attribute definitions.",
    inputSchema: z.object({}),
    handler: async (params) => {
      return withCache("brevo_get_deal_attributes", params, BREVO_CRM_TTL, () =>
        brevoGet("crm/attributes/deals")
      );
    },
  },

  // ─── CRM: Companies ──────────────────────────────────────────────────────────

  {
    name: "brevo_list_companies",
    description: "List Brevo CRM companies with pagination and optional date filters.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(500).optional().default(50).describe("Number of companies to return (max 500)"),
      page: z.number().int().min(1).optional().describe("Page number (1-based)"),
      sort: z.enum(["asc", "desc"]).optional().describe("Sort order"),
      sortBy: z.string().optional().describe("Field to sort by (e.g. 'created_at', 'name')"),
      modifiedSince: z.string().optional().describe("Filter companies modified since this date (YYYY-MM-DDTHH:mm:ss.SSSZ)"),
      createdSince: z.string().optional().describe("Filter companies created since this date (YYYY-MM-DDTHH:mm:ss.SSSZ)"),
    }),
    handler: async (params) => {
      const { limit, page, sort, sortBy, modifiedSince, createdSince } = params as any;
      return withCache("brevo_list_companies", params, BREVO_CRM_TTL, () =>
        brevoGet("companies", { limit, page, sort, sortBy, "filters[modifiedSince]": modifiedSince, "filters[createdSince]": createdSince })
      );
    },
  },

  {
    name: "brevo_get_company",
    description: "Get details of a specific Brevo CRM company by ID.",
    inputSchema: z.object({
      companyId: z.string().describe("ID of the company"),
    }),
    handler: async (params) => {
      const { companyId } = params as { companyId: string };
      return withCache("brevo_get_company", params, BREVO_CRM_TTL, () =>
        brevoGet(`companies/${companyId}`)
      );
    },
  },

  {
    name: "brevo_get_company_attributes",
    description: "Get all Brevo CRM company attribute definitions.",
    inputSchema: z.object({}),
    handler: async (params) => {
      return withCache("brevo_get_company_attributes", params, BREVO_CRM_TTL, () =>
        brevoGet("companies/attributes")
      );
    },
  },

  // ─── CRM: Tasks ───────────────────────────────────────────────────────────────

  {
    name: "brevo_list_tasks",
    description: "List Brevo CRM tasks with optional filters.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(500).optional().default(50).describe("Number of tasks to return (max 500)"),
      offset: z.number().int().min(0).optional().default(0).describe("Index of the first task to return"),
      sort: z.enum(["asc", "desc"]).optional().describe("Sort order"),
      filterType: z.string().optional().describe("Filter by task type ID"),
      filterStatus: z.enum(["done", "undone"]).optional().describe("Filter by task status"),
      filterDate: z.enum(["overdue", "today", "tomorrow", "week", "range"]).optional().describe("Filter by date range"),
      filterAssignTo: z.string().optional().describe("Filter by assignee user ID"),
    }),
    handler: async (params) => {
      const { limit, offset, sort, filterType, filterStatus, filterDate, filterAssignTo } = params as any;
      return withCache("brevo_list_tasks", params, BREVO_CRM_TTL, () =>
        brevoGet("crm/tasks", {
          limit,
          offset,
          sort,
          "filter[type]": filterType,
          "filter[status]": filterStatus,
          "filter[date]": filterDate,
          "filter[assignTo]": filterAssignTo,
        })
      );
    },
  },

  {
    name: "brevo_get_task_types",
    description: "Get all Brevo CRM task type definitions.",
    inputSchema: z.object({}),
    handler: async (params) => {
      return withCache("brevo_get_task_types", params, BREVO_CRM_TTL, () =>
        brevoGet("crm/tasktypes")
      );
    },
  },

  // ─── Account ──────────────────────────────────────────────────────────────────

  {
    name: "brevo_get_account",
    description: "Get Brevo account information including plan details and usage.",
    inputSchema: z.object({}),
    handler: async (params) => {
      return withCache("brevo_get_account", params, BREVO_ACCOUNT_TTL, () =>
        brevoGet("account")
      );
    },
  },

  {
    name: "brevo_list_senders",
    description: "List validated sender addresses in Brevo.",
    inputSchema: z.object({
      ip: z.string().optional().describe("Filter by dedicated IP"),
      domain: z.string().optional().describe("Filter by sender domain"),
    }),
    handler: async (params) => {
      const { ip, domain } = params as any;
      return withCache("brevo_list_senders", params, BREVO_ACCOUNT_TTL, () =>
        brevoGet("senders", { ip, domain })
      );
    },
  },
];
