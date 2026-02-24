import { z } from "zod";
import { withCache } from "../connections/cache.js";
import { kbbGet } from "../connections/kbbconnect.js";
import type { ToolDefinition } from "./index.js";

const KBB_TTL = 120_000; // 2 minutes

// ─── Helper: build OData filter from date-range and field params ─────────────

function buildFilter(parts: string[]): string | undefined {
  return parts.length > 0 ? parts.join(" AND ") : undefined;
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export const kbbConnectTools: ToolDefinition[] = [
  {
    name: "kbb_search_jobs",
    description:
      "Search KBBConnect jobs. Filter by drawing number, order number, customer, salesperson, date ranges, or raw OData filter. All date params use MM/DD/YYYY format. Returns paged results.",
    inputSchema: z.object({
      dwgno: z.string().optional().describe("Drawing number to search for (partial match)"),
      orderno: z.string().optional().describe("Order number to search for (partial match)"),
      customer: z.string().optional().describe("Customer name to search for (partial match)"),
      salesid: z.string().optional().describe("Filter by user/salesperson ID (SALESID, partial match) e.g. '90'"),
      filter: z.string().optional().describe("Raw OData filter expression e.g. \"STATUS eq 'LIVE'\""),
      ccrdate_from: z.string().optional().describe("Jobs created after this date, MM/DD/YYYY"),
      ccrdate_to: z.string().optional().describe("Jobs created before this date, MM/DD/YYYY"),
      deldate_from: z.string().optional().describe("Delivery date after, MM/DD/YYYY"),
      deldate_to: z.string().optional().describe("Delivery date before, MM/DD/YYYY"),
      surdate_from: z.string().optional().describe("Survey date after, MM/DD/YYYY"),
      surdate_to: z.string().optional().describe("Survey date before, MM/DD/YYYY"),
      insdate_from: z.string().optional().describe("Install date after, MM/DD/YYYY"),
      insdate_to: z.string().optional().describe("Install date before, MM/DD/YYYY"),
      estsolddate_from: z.string().optional().describe("Estimated sold date after, MM/DD/YYYY"),
      estsolddate_to: z.string().optional().describe("Estimated sold date before, MM/DD/YYYY"),
      orderby: z.string().optional().default("ORDERNO DESC").describe("OData $orderby, e.g. 'ORDERNO DESC'"),
      skip: z.number().int().min(0).optional().default(0).describe("Records to skip (paging)"),
      top: z.number().int().min(1).max(500).optional().default(20).describe("Records to return (max 500)"),
      ticks: z.number().optional().default(0).describe("Ticks value for incremental sync (0 = all)"),
    }),
    handler: async (params) => {
      const {
        dwgno, orderno, customer, salesid, filter,
        ccrdate_from, ccrdate_to, deldate_from, deldate_to,
        surdate_from, surdate_to, insdate_from, insdate_to,
        estsolddate_from, estsolddate_to,
        orderby, skip, top, ticks,
      } = params as Record<string, any>;

      const parts: string[] = [];
      if (dwgno) parts.push(`(DWGNO containing '${dwgno}')`);
      if (orderno) parts.push(`(ORDERNO containing '${orderno}')`);
      if (customer) parts.push(`(CUSTOMER containing '${customer}')`);
      if (salesid) parts.push(`(SALESID containing '${salesid}')`);
      if (filter) parts.push(`(${filter})`);
      if (ccrdate_from) parts.push(`CCRDATE>'${ccrdate_from}'`);
      if (ccrdate_to) parts.push(`CCRDATE<'${ccrdate_to}'`);
      if (deldate_from) parts.push(`DELDATE>'${deldate_from}'`);
      if (deldate_to) parts.push(`DELDATE<'${deldate_to}'`);
      if (surdate_from) parts.push(`SURDATE>'${surdate_from}'`);
      if (surdate_to) parts.push(`SURDATE<'${surdate_to}'`);
      if (insdate_from) parts.push(`INSDATE>'${insdate_from}'`);
      if (insdate_to) parts.push(`INSDATE<'${insdate_to}'`);
      if (estsolddate_from) parts.push(`CUST_ESTSOLDDATE>'${estsolddate_from}'`);
      if (estsolddate_to) parts.push(`CUST_ESTSOLDDATE<'${estsolddate_to}'`);

      const apiParams: Record<string, string | number> = {
        $ticks: ticks ?? 0,
        $orderby: orderby ?? "ORDERNO DESC",
        $skip: skip ?? 0,
        $top: top ?? 20,
      };
      const f = buildFilter(parts);
      if (f) apiParams.$filter = f;

      return withCache("kbb_search_jobs", params, KBB_TTL, () =>
        kbbGet("ProjectPaged", apiParams)
      );
    },
  },

  {
    name: "kbb_get_project_by_dwgno",
    description: "Get KBBConnect project(s) by drawing number (DWGNO). Returns all matching projects.",
    inputSchema: z.object({
      dwgno: z.string().describe("Drawing number, e.g. '63890'"),
    }),
    handler: async (params) => {
      const { dwgno } = params as { dwgno: string };
      return withCache("kbb_get_project_by_dwgno", { dwgno }, KBB_TTL, () =>
        kbbGet("ProjectPaged", {
          $ticks: 0,
          $orderby: "ORDERNO DESC",
          $skip: 0,
          $top: 10,
          $filter: `(DWGNO containing '${dwgno}')`,
        })
      );
    },
  },

  {
    name: "kbb_get_project_by_orderno",
    description: "Get KBBConnect project(s) by order number (ORDERNO).",
    inputSchema: z.object({
      orderno: z.string().describe("Order number to look up"),
    }),
    handler: async (params) => {
      const { orderno } = params as { orderno: string };
      return withCache("kbb_get_project_by_orderno", { orderno }, KBB_TTL, () =>
        kbbGet("ProjectPaged", {
          $ticks: 0,
          $orderby: "ORDERNO DESC",
          $skip: 0,
          $top: 10,
          $filter: `(ORDERNO containing '${orderno}')`,
        })
      );
    },
  },

  {
    name: "kbb_get_recent_projects",
    description: "Get the most recent KBBConnect projects ordered by order number descending.",
    inputSchema: z.object({
      top: z.number().int().min(1).max(100).optional().default(20).describe("Number of records to return"),
    }),
    handler: async (params) => {
      const { top } = params as { top: number };
      return withCache("kbb_get_recent_projects", { top }, KBB_TTL, () =>
        kbbGet("ProjectPaged", {
          $ticks: 0,
          $orderby: "ORDERNO DESC",
          $skip: 0,
          $top: top ?? 20,
        })
      );
    },
  },

  {
    name: "kbb_get_project",
    description: "Get full details of a KBBConnect project by its exact order number.",
    inputSchema: z.object({
      orderno: z.string().describe("Exact order number, e.g. '45293'"),
    }),
    handler: async (params) => {
      const { orderno } = params as { orderno: string };
      return withCache("kbb_get_project", { orderno }, KBB_TTL, () =>
        kbbGet(`Project/${orderno}`)
      );
    },
  },

  {
    name: "kbb_get_order_items",
    description: "Get line items/details for a KBBConnect order by order number.",
    inputSchema: z.object({
      orderno: z.string().describe("Exact order number, e.g. '41059'"),
    }),
    handler: async (params) => {
      const { orderno } = params as { orderno: string };
      return withCache("kbb_get_order_items", { orderno }, KBB_TTL, () =>
        kbbGet(`OItems/${orderno}/0`)
      );
    },
  },

  {
    name: "kbb_get_suppliers",
    description: "Get KBBConnect suppliers, optionally filtered by name.",
    inputSchema: z.object({
      name: z.string().optional().describe("Supplier name to search (partial match)"),
      skip: z.number().int().min(0).optional().default(0).describe("Records to skip (paging)"),
      top: z.number().int().min(1).max(100).optional().default(50).describe("Records to return"),
    }),
    handler: async (params) => {
      const { name, skip, top } = params as { name?: string; skip: number; top: number };
      const apiParams: Record<string, string | number> = {
        $skip: skip ?? 0,
        $top: top ?? 50,
      };
      if (name) apiParams.$filter = `(NAME containing '${name}')`;
      return withCache("kbb_get_suppliers", params, KBB_TTL, () =>
        kbbGet("supplierPaged", apiParams)
      );
    },
  },

  {
    name: "kbb_get_supplier",
    description: "Get full details of a KBBConnect supplier by ID.",
    inputSchema: z.object({
      id: z.string().describe("Supplier ID, e.g. '40126'"),
    }),
    handler: async (params) => {
      const { id } = params as { id: string };
      return withCache("kbb_get_supplier", { id }, KBB_TTL, () =>
        kbbGet(`supplier/${id}`)
      );
    },
  },

  {
    name: "kbb_get_customers",
    description: "Get KBBConnect customers, optionally filtered by name.",
    inputSchema: z.object({
      name: z.string().optional().describe("Customer name to search (partial match)"),
      skip: z.number().int().min(0).optional().default(0).describe("Records to skip (paging)"),
      top: z.number().int().min(1).max(100).optional().default(50).describe("Records to return"),
    }),
    handler: async (params) => {
      const { name, skip, top } = params as { name?: string; skip: number; top: number };
      const apiParams: Record<string, string | number> = {
        $skip: skip ?? 0,
        $top: top ?? 50,
      };
      if (name) apiParams.$filter = `(NAME containing '${name}')`;
      return withCache("kbb_get_customers", params, KBB_TTL, () =>
        kbbGet("clientPaged", apiParams)
      );
    },
  },

  {
    name: "kbb_get_customer",
    description: "Get full details of a KBBConnect customer by client ID.",
    inputSchema: z.object({
      id: z.string().describe("Client ID, e.g. '8075'"),
    }),
    handler: async (params) => {
      const { id } = params as { id: string };
      return withCache("kbb_get_customer", { id }, KBB_TTL, () =>
        kbbGet(`Client/${id}`)
      );
    },
  },

  {
    name: "kbb_get_users",
    description: "Get KBBConnect users (staff/designers). Optionally filter by name.",
    inputSchema: z.object({
      name: z.string().optional().describe("User name to search (partial match)"),
      skip: z.number().int().min(0).optional().default(0).describe("Records to skip (paging)"),
      top: z.number().int().min(1).max(1000).optional().default(1000).describe("Records to return"),
    }),
    handler: async (params) => {
      const { name, skip, top } = params as { name?: string; skip: number; top: number };
      const apiParams: Record<string, string | number> = {
        $ticks: 0,
        $orderby: "NAME",
        $skip: skip ?? 0,
        $top: top ?? 1000,
      };
      if (name) apiParams.$filter = `(NAME containing '${name}')`;
      return withCache("kbb_get_users", params, KBB_TTL, () =>
        kbbGet("UserPaged", apiParams)
      );
    },
  },

  {
    name: "kbb_get_customer_discounts",
    description: "Get discounts assigned to a KBBConnect customer by client ID.",
    inputSchema: z.object({
      id: z.string().describe("Client ID, e.g. '20152'"),
      skip: z.number().int().min(0).optional().default(0).describe("Records to skip (paging)"),
      top: z.number().int().min(1).max(100).optional().default(50).describe("Records to return"),
    }),
    handler: async (params) => {
      const { id, skip, top } = params as { id: string; skip: number; top: number };
      return withCache("kbb_get_customer_discounts", params, KBB_TTL, () =>
        kbbGet(`CDiscounts/ByClient/${id}`, {
          $ticks: 0,
          $orderby: "desc",
          $skip: skip ?? 0,
          $top: top ?? 50,
        })
      );
    },
  },

  {
    name: "kbb_get_jobs_by_salesid",
    description:
      "Get KBBConnect jobs for a specific salesperson (SALESID) on or after a given date. Returns up to 500 jobs ordered by order number descending.",
    inputSchema: z.object({
      salesid: z.string().describe("Salesperson ID, e.g. '90'"),
      from_date: z.string().optional().default("01/01/2026").describe("Jobs created on or after this date, MM/DD/YYYY"),
      skip: z.number().int().min(0).optional().default(0).describe("Records to skip (paging)"),
      top: z.number().int().min(1).max(500).optional().default(500).describe("Records to return (max 500)"),
    }),
    handler: async (params) => {
      const { salesid, from_date, skip, top } = params as {
        salesid: string; from_date: string; skip: number; top: number;
      };
      return withCache("kbb_get_jobs_by_salesid", params, KBB_TTL, () =>
        kbbGet("ProjectPaged", {
          $ticks: 0,
          $orderby: "ORDERNO DESC",
          $skip: skip ?? 0,
          $top: top ?? 500,
          $filter: `CCRDATE>='${from_date ?? "01/01/2026"}' AND SALESID = ${salesid}`,
        })
      );
    },
  },
];
