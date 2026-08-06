import type { InputEvent, Recommendation } from "@ai-env/contracts";

import { env } from "../config/env";
import { AppError } from "../errors/app-error";
import { logger } from "../logging/logger";
import { HealthResponseSchema, ReasonResponseSchema } from "./ai-core.schemas";
import { requestJson } from "./http";

/**
 * The Backend's only channel to the AI Core.
 *
 * All reasoning stays behind this HTTP boundary — this client transports and
 * validates, it never interprets. Failures surface as typed AppErrors so the
 * pipeline can degrade gracefully rather than propagate a crash.
 */
export class AiCoreClient {
  constructor(
    private readonly baseUrl: string = env.AI_CORE_URL,
    private readonly timeoutMs: number = env.AI_CORE_TIMEOUT_MS,
    private readonly maxRetries: number = env.AI_CORE_MAX_RETRIES,
  ) {}

  async reason(events: InputEvent[]): Promise<Recommendation> {
    const raw = await requestJson<unknown>(`${this.baseUrl}/reason`, {
      method: "POST",
      body: { events },
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      label: "AI Core /reason",
    });

    const parsed = ReasonResponseSchema.safeParse(raw);
    if (!parsed.success) {
      logger.error({ issues: parsed.error.issues }, "[ai-core] invalid /reason response");
      throw new AppError(
        502,
        "AI_CORE_INVALID_RESPONSE",
        "AI Core returned a response that does not match the Recommendation contract",
        parsed.error.issues,
      );
    }

    return parsed.data.data as Recommendation;
  }

  /**
   * Health probe for the Backend's own /health endpoint. Returns a status
   * rather than throwing: an unreachable AI Core makes the Backend degraded,
   * not broken, so this must not raise.
   */
  async checkHealth(): Promise<"ok" | "degraded" | "down"> {
    try {
      const raw = await requestJson<unknown>(`${this.baseUrl}/health`, {
        timeoutMs: this.timeoutMs,
        maxRetries: 0,
        label: "AI Core /health",
      });

      const parsed = HealthResponseSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn("[ai-core] health response did not match contract");
        return "degraded";
      }
      return parsed.data.data.status;
    } catch (err) {
      logger.warn({ err }, "[ai-core] health check failed");
      return "down";
    }
  }
}

export const aiCoreClient = new AiCoreClient();
