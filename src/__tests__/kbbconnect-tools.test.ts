import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock kbbGet so tools don't make real HTTP calls
vi.mock("../connections/kbbconnect.js", () => ({
  kbbGet: vi.fn(),
}));

// Mock cache to always pass through to the real function
vi.mock("../connections/cache.js", () => ({
  withCache: vi.fn(
    (_name: string, _params: any, _ttl: number, fn: () => Promise<any>) => fn()
  ),
}));

// Mock config
vi.mock("../config.js", () => ({
  getConfig: () => ({ KBBCONNECT_API_TOKEN: "test-token" }),
}));

import { kbbConnectTools } from "../tools/kbbconnect.js";
import { kbbGet } from "../connections/kbbconnect.js";

const mockedKbbGet = vi.mocked(kbbGet);

function findTool(name: string) {
  const tool = kbbConnectTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool '${name}' not found`);
  return tool;
}

describe("kbbConnectTools", () => {
  beforeEach(() => {
    mockedKbbGet.mockReset();
  });

  it("exports 13 tools", () => {
    expect(kbbConnectTools).toHaveLength(13);
  });

  it("all tools have required fields", () => {
    for (const tool of kbbConnectTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.name).toMatch(/^kbb_/);
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.handler).toBe("function");
    }
  });

  describe("kbb_search_jobs", () => {
    it("calls ProjectPaged with default params", async () => {
      mockedKbbGet.mockResolvedValue({ Results: [], TotalCount: 0 });

      const tool = findTool("kbb_search_jobs");
      await tool.handler({ orderby: "ORDERNO DESC", skip: 0, top: 20, ticks: 0 });

      expect(mockedKbbGet).toHaveBeenCalledWith("ProjectPaged", {
        $ticks: 0,
        $orderby: "ORDERNO DESC",
        $skip: 0,
        $top: 20,
      });
    });

    it("builds OData filter from field params", async () => {
      mockedKbbGet.mockResolvedValue({ Results: [] });

      const tool = findTool("kbb_search_jobs");
      await tool.handler({
        dwgno: "63890",
        ccrdate_from: "01/01/2025",
        orderby: "ORDERNO DESC",
        skip: 0,
        top: 20,
        ticks: 0,
      });

      const [, params] = mockedKbbGet.mock.calls[0];
      expect(params!.$filter).toContain("(DWGNO containing '63890')");
      expect(params!.$filter).toContain("CCRDATE>'01/01/2025'");
    });

    it("includes salesid in filter", async () => {
      mockedKbbGet.mockResolvedValue({ Results: [] });

      const tool = findTool("kbb_search_jobs");
      await tool.handler({
        salesid: "90",
        orderby: "ORDERNO DESC",
        skip: 0,
        top: 20,
        ticks: 0,
      });

      const [, params] = mockedKbbGet.mock.calls[0];
      expect(params!.$filter).toContain("(SALESID containing '90')");
    });
  });

  describe("kbb_get_project_by_dwgno", () => {
    it("filters by DWGNO", async () => {
      mockedKbbGet.mockResolvedValue({ Results: [{ DWGNO: "63890" }] });

      const tool = findTool("kbb_get_project_by_dwgno");
      const result = await tool.handler({ dwgno: "63890" });

      expect(mockedKbbGet).toHaveBeenCalledWith("ProjectPaged", {
        $ticks: 0,
        $orderby: "ORDERNO DESC",
        $skip: 0,
        $top: 10,
        $filter: "(DWGNO containing '63890')",
      });
      expect(result.Results).toHaveLength(1);
    });
  });

  describe("kbb_get_project_by_orderno", () => {
    it("filters by ORDERNO", async () => {
      mockedKbbGet.mockResolvedValue({ Results: [{ ORDERNO: "45293" }] });

      const tool = findTool("kbb_get_project_by_orderno");
      await tool.handler({ orderno: "45293" });

      const [, params] = mockedKbbGet.mock.calls[0];
      expect(params!.$filter).toBe("(ORDERNO containing '45293')");
    });
  });

  describe("kbb_get_recent_projects", () => {
    it("requests top N with no filter", async () => {
      mockedKbbGet.mockResolvedValue({ Results: [] });

      const tool = findTool("kbb_get_recent_projects");
      await tool.handler({ top: 5 });

      expect(mockedKbbGet).toHaveBeenCalledWith("ProjectPaged", {
        $ticks: 0,
        $orderby: "ORDERNO DESC",
        $skip: 0,
        $top: 5,
      });
    });
  });

  describe("kbb_get_project", () => {
    it("calls Project/{orderno}", async () => {
      mockedKbbGet.mockResolvedValue({ ORDERNO: "45293", STATUS: "LIVE" });

      const tool = findTool("kbb_get_project");
      await tool.handler({ orderno: "45293" });

      expect(mockedKbbGet).toHaveBeenCalledWith("Project/45293");
    });
  });

  describe("kbb_get_order_items", () => {
    it("calls OItems/{orderno}/0", async () => {
      mockedKbbGet.mockResolvedValue([{ ITEM: 1 }]);

      const tool = findTool("kbb_get_order_items");
      await tool.handler({ orderno: "41059" });

      expect(mockedKbbGet).toHaveBeenCalledWith("OItems/41059/0");
    });
  });

  describe("kbb_get_suppliers", () => {
    it("passes name filter when provided", async () => {
      mockedKbbGet.mockResolvedValue({ Results: [] });

      const tool = findTool("kbb_get_suppliers");
      await tool.handler({ name: "Howdens", skip: 0, top: 50 });

      const [endpoint, params] = mockedKbbGet.mock.calls[0];
      expect(endpoint).toBe("supplierPaged");
      expect(params!.$filter).toBe("(NAME containing 'Howdens')");
    });

    it("omits filter when name not provided", async () => {
      mockedKbbGet.mockResolvedValue({ Results: [] });

      const tool = findTool("kbb_get_suppliers");
      await tool.handler({ skip: 0, top: 50 });

      const [, params] = mockedKbbGet.mock.calls[0];
      expect(params!.$filter).toBeUndefined();
    });
  });

  describe("kbb_get_supplier", () => {
    it("calls supplier/{id}", async () => {
      mockedKbbGet.mockResolvedValue({ ID: "40126" });

      const tool = findTool("kbb_get_supplier");
      await tool.handler({ id: "40126" });

      expect(mockedKbbGet).toHaveBeenCalledWith("supplier/40126");
    });
  });

  describe("kbb_get_customers", () => {
    it("calls clientPaged with name filter", async () => {
      mockedKbbGet.mockResolvedValue({ Results: [] });

      const tool = findTool("kbb_get_customers");
      await tool.handler({ name: "Jones", skip: 0, top: 50 });

      const [endpoint, params] = mockedKbbGet.mock.calls[0];
      expect(endpoint).toBe("clientPaged");
      expect(params!.$filter).toBe("(NAME containing 'Jones')");
    });
  });

  describe("kbb_get_customer", () => {
    it("calls Client/{id}", async () => {
      mockedKbbGet.mockResolvedValue({ ID: "8075" });

      const tool = findTool("kbb_get_customer");
      await tool.handler({ id: "8075" });

      expect(mockedKbbGet).toHaveBeenCalledWith("Client/8075");
    });
  });

  describe("kbb_get_users", () => {
    it("calls UserPaged ordered by NAME", async () => {
      mockedKbbGet.mockResolvedValue({ Results: [] });

      const tool = findTool("kbb_get_users");
      await tool.handler({ skip: 0, top: 1000 });

      expect(mockedKbbGet).toHaveBeenCalledWith("UserPaged", {
        $ticks: 0,
        $orderby: "NAME",
        $skip: 0,
        $top: 1000,
      });
    });
  });

  describe("kbb_get_customer_discounts", () => {
    it("calls CDiscounts/ByClient/{id}", async () => {
      mockedKbbGet.mockResolvedValue({ Results: [] });

      const tool = findTool("kbb_get_customer_discounts");
      await tool.handler({ id: "20152", skip: 0, top: 50 });

      expect(mockedKbbGet).toHaveBeenCalledWith("CDiscounts/ByClient/20152", {
        $ticks: 0,
        $orderby: "desc",
        $skip: 0,
        $top: 50,
      });
    });
  });

  describe("kbb_get_jobs_by_salesid", () => {
    it("builds correct filter with salesid and date", async () => {
      mockedKbbGet.mockResolvedValue({ Results: [] });

      const tool = findTool("kbb_get_jobs_by_salesid");
      await tool.handler({ salesid: "90", from_date: "01/01/2026", skip: 0, top: 500 });

      const [, params] = mockedKbbGet.mock.calls[0];
      expect(params!.$filter).toBe("CCRDATE>='01/01/2026' AND SALESID = 90");
      expect(params!.$top).toBe(500);
    });
  });
});
