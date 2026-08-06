import "dotenv/config";
import { z } from "zod";

/**
 * Single, validated, typed entry point for all environment configuration.
 * Parsed once at import time so a misconfigured deployment fails immediately
 * on boot with a clear error, rather than surfacing as a confusing failure
 * deep in a request handler later.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default("postgresql://aei:aei@localhost:5432/aei"),
  AI_CORE_URL: z.string().url().default("http://localhost:8000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGIN: z.string().default("*"),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("[config] invalid environment configuration:", parsed.error.flatten());
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = loadEnv();
