import { z } from "zod";

const envSchema = z.object({
  // PostgreSQL (Neon)
  DATABASE_URL: z.string().min(1),

  // MySQL (TARMS) via SSH tunnel
  TARMS_SSH_HOST: z.string().default("tarms.turnbull.co.uk"),
  TARMS_SSH_KEY_PATH: z.string().optional(),
  TARMS_SSH_USERNAME: z.string().optional(),
  TARMS_DB_USERNAME: z.string().optional(),
  TARMS_DB_PASSWORD: z.string().optional(),
  TARMS_DB_NAME: z.string().default("tarms"),

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

export function hasTarmsConfig(): boolean {
  const cfg = getConfig();
  return !!(cfg.TARMS_SSH_USERNAME && cfg.TARMS_DB_USERNAME && cfg.TARMS_DB_PASSWORD);
}

export function hasOpenRouterConfig(): boolean {
  return !!getConfig().OPENROUTER_API_KEY;
}

export function hasBrevoConfig(): boolean {
  return !!getConfig().BREVO_API_KEY;
}
