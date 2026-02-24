import { getConfig } from "../config.js";

const API_BASE = "https://www.kbbconnect.eu.com/SmartApi/api";

export async function kbbGet(endpoint: string, params: Record<string, string | number> = {}): Promise<any> {
  const token = getConfig().KBBCONNECT_API_TOKEN;
  if (!token) {
    throw new Error("KBBCONNECT_API_TOKEN is not configured");
  }

  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`KBBConnect API error ${response.status}: ${text}`);
  }

  return response.json();
}
