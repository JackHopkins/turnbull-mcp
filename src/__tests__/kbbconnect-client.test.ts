import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock config — use a mutable ref so individual tests can override the token
let mockToken: string | undefined = "test-token-123";

vi.mock("../config.js", () => ({
  getConfig: () => ({ KBBCONNECT_API_TOKEN: mockToken }),
}));

import { kbbGet } from "../connections/kbbconnect.js";

describe("kbbGet (HTTP client)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockToken = "test-token-123";
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls the correct URL with Bearer auth", async () => {
    const mockResponse = { Results: [], TotalCount: 0 };
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await kbbGet("ProjectPaged", { $top: 10, $skip: 0 });

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://www.kbbconnect.eu.com/SmartApi/api/ProjectPaged"
    );
    expect(parsed.searchParams.get("$top")).toBe("10");
    expect(parsed.searchParams.get("$skip")).toBe("0");
    expect(opts.headers.Authorization).toBe("Bearer test-token-123");
    expect(opts.headers.Accept).toBe("application/json");
    expect(result).toEqual(mockResponse);
  });

  it("omits empty/null/undefined params from URL", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await kbbGet("ProjectPaged", { $top: 5, $filter: "", $skip: 0 });

    const [url] = (globalThis.fetch as any).mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.has("$filter")).toBe(false);
    expect(parsed.searchParams.get("$top")).toBe("5");
  });

  it("throws on non-OK response", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(kbbGet("Project/999")).rejects.toThrow(
      "KBBConnect API error 401: Unauthorized"
    );
  });

  it("throws when API token is missing", async () => {
    mockToken = undefined;

    await expect(kbbGet("ProjectPaged")).rejects.toThrow(
      "KBBCONNECT_API_TOKEN is not configured"
    );
  });

  it("encodes query params correctly", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await kbbGet("ProjectPaged", {
      $filter: "CCRDATE>'01/01/2026' AND SALESID = 90",
    });

    const [url] = (globalThis.fetch as any).mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("$filter")).toBe(
      "CCRDATE>'01/01/2026' AND SALESID = 90"
    );
  });
});
