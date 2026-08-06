import pino from "pino";

import { env } from "../config/env";

/**
 * Single structured logger for the whole service. Pretty-printed in
 * development, plain JSON in production (so it's ingestible by a log
 * collector without a transform step).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
});
