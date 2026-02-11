import { z } from "zod";

const envSchema = z.object({
  // PostgreSQL (Neon)
  DATABASE_URL: z.string().min(1),

  // Database proxy (replaces SSH tunnels)
  DB_PROXY_URL: z.string().url().optional(),
  DB_PROXY_API_KEY: z.string().min(1).optional(),

  // OpenRouter
  OPENROUTER_API_KEY: z.string().optional(),

  // Brevo
  BREVO_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = envSchema.parse(process.env);
  }
  return _config;
}

export function hasProxyConfig(): boolean {
  const cfg = getConfig();
  return !!(cfg.DB_PROXY_URL && cfg.DB_PROXY_API_KEY);
}

export function hasOpenRouterConfig(): boolean {
  return !!getConfig().OPENROUTER_API_KEY;
}

export function hasBrevoConfig(): boolean {
  return !!getConfig().BREVO_API_KEY;
}
