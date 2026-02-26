import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock config — use a mutable ref so individual tests can override the key
let mockApiKey: string | undefined = "xkeysib-test-123";

vi.mock("../config.js", () => ({
  getConfig: () => ({ BREVO_API_KEY: mockApiKey }),
}));

import { brevoGet } from "../connections/brevo.js";

describe("brevoGet (HTTP client)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockApiKey = "xkeysib-test-123";
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls the correct URL with api-key header", async () => {
    const mockResponse = { contacts: [], count: 0 };
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await brevoGet("contacts", { limit: 10, offset: 0 });

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url, opts] = (globalThis.fetch as any).mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://api.brevo.com/v3/contacts"
    );
    expect(parsed.searchParams.get("limit")).toBe("10");
    expect(parsed.searchParams.get("offset")).toBe("0");
    expect(opts.headers["api-key"]).toBe("xkeysib-test-123");
    expect(opts.headers.Accept).toBe("application/json");
    expect(result).toEqual(mockResponse);
  });

  it("omits empty/null/undefined params from URL", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await brevoGet("contacts", { limit: 5, modifiedSince: "", offset: 0 });

    const [url] = (globalThis.fetch as any).mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.has("modifiedSince")).toBe(false);
    expect(parsed.searchParams.get("limit")).toBe("5");
  });

  it("throws on non-OK response", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(brevoGet("account")).rejects.toThrow(
      "Brevo API error 401: Unauthorized"
    );
  });

  it("throws when API key is missing", async () => {
    mockApiKey = undefined;

    await expect(brevoGet("contacts")).rejects.toThrow(
      "BREVO_API_KEY is not configured"
    );
  });

  it("encodes query params correctly", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await brevoGet("smtp/statistics/events", {
      email: "user@example.com",
      event: "delivered",
    });

    const [url] = (globalThis.fetch as any).mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("email")).toBe("user@example.com");
    expect(parsed.searchParams.get("event")).toBe("delivered");
  });
});
