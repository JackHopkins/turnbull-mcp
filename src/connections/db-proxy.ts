import { getConfig } from "../config.js";

export async function proxyQuery<T = any>(
  operation: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const config = getConfig();
  const response = await fetch(`${config.DB_PROXY_URL}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.DB_PROXY_API_KEY}`,
    },
    body: JSON.stringify({ operation, params }),
  });
  if (!response.ok) {
    throw new Error(
      `Proxy error ${response.status}: ${await response.text()}`
    );
  }
  const json = (await response.json()) as { data: T[] };
  return json.data as T[];
}
