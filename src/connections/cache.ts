import { LRUCache } from "lru-cache";
import { createHash } from "crypto";

const cache = new LRUCache<string, any>({
  max: 1000,
  ttl: 60_000, // default 60s, overridden per-call
});

function makeKey(toolName: string, params: Record<string, any>): string {
  const sorted = JSON.stringify(params, Object.keys(params).sort());
  const hash = createHash("sha256").update(sorted).digest("hex").slice(0, 16);
  return `${toolName}:${hash}`;
}

export function getCached<T>(
  toolName: string,
  params: Record<string, any>
): T | undefined {
  const key = makeKey(toolName, params);
  return cache.get(key) as T | undefined;
}

export function setCache(
  toolName: string,
  params: Record<string, any>,
  value: any,
  ttlMs: number
): void {
  const key = makeKey(toolName, params);
  cache.set(key, value, { ttl: ttlMs });
}

export async function withCache<T>(
  toolName: string,
  params: Record<string, any>,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = getCached<T>(toolName, params);
  if (cached !== undefined) {
    return cached;
  }
  const result = await fn();
  setCache(toolName, params, result, ttlMs);
  return result;
}
