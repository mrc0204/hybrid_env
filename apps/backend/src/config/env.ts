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
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGIN: z.string().default("*"),

  // --- AI Core ---
  AI_CORE_URL: z.string().url().default("http://localhost:8000"),
  AI_CORE_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  AI_CORE_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),

  // --- Environment scope ---
  // Coordinates the weather/traffic providers are queried for. Defaults to the
  // NIAT KKH campus demo site; changing these is all it takes to point the
  // system at a different deployment.
  ENVIRONMENT_SCOPE: z.string().default("niat-kkh-campus"),
  ENVIRONMENT_LOCATION_NAME: z.string().default("South Gate"),
  ENVIRONMENT_LATITUDE: z.coerce.number().min(-90).max(90).default(17.385),
  ENVIRONMENT_LONGITUDE: z.coerce.number().min(-180).max(180).default(78.4867),

  // --- External providers ---
  WEATHER_API_URL: z.string().url().default("https://api.open-meteo.com/v1/forecast"),
  TRAFFIC_API_URL: z
    .string()
    .url()
    .default("https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"),
  // Optional by design: with no key the traffic provider falls back to a
  // deterministic local source so the pipeline still runs end to end.
  TOMTOM_API_KEY: z.string().optional(),
  EXTERNAL_API_TIMEOUT_MS: z.coerce.number().int().positive().default(6000),

  // --- Pipeline ---
  // 0 disables the background scheduler; the pipeline can still be triggered
  // manually via POST /api/v1/environment/refresh.
  ENVIRONMENT_POLL_INTERVAL_MS: z.coerce.number().int().min(0).default(60_000),
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
