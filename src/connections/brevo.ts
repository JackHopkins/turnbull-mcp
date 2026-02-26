import { getConfig } from "../config.js";

const API_BASE = "https://api.brevo.com/v3";

export async function brevoGet(endpoint: string, params: Record<string, string | number> = {}): Promise<any> {
  const apiKey = getConfig().BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      "api-key": apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Brevo API error ${response.status}: ${text}`);
  }

  return response.json();
}
