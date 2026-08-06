import type { Recommendation } from "@ai-env/contracts";

import { aiCoreClient, type AiCoreClient } from "../clients/ai-core.client";
import { env } from "../config/env";
import { environmentService, type EnvironmentService } from "../environment/environment.service";
import { logger } from "../logging/logger";
import { broadcast, REALTIME_CHANNELS } from "../realtime/events";

export interface PipelineResult {
  status: "ok" | "degraded" | "failed";
  recommendation?: Recommendation;
  eventCount: number;
  failedSources: string[];
  error?: string;
}

/**
 * The Milestone 4 orchestration:
 *
 *   collect external signals -> normalize to InputEvents -> broadcast
 *   `environment.updated` -> call AI Core /reason -> broadcast
 *   `recommendation.generated`
 *
 * `run()` never rejects. It is invoked from a background interval where an
 * unhandled rejection would take the process down, so every failure is
 * converted into a PipelineResult and reported on the `system.health`
 * channel instead.
 */
export class EnvironmentPipeline {
  private running = false;

  constructor(
    private readonly environment: EnvironmentService = environmentService,
    private readonly aiCore: AiCoreClient = aiCoreClient,
  ) {}

  async run(trigger: "scheduled" | "manual"): Promise<PipelineResult> {
    // Skip rather than queue: a slow AI Core shouldn't cause overlapping runs
    // to pile up behind each other on a fixed interval.
    if (this.running) {
      logger.warn({ trigger }, "[pipeline] previous run still in progress, skipping");
      return {
        status: "degraded",
        eventCount: 0,
        failedSources: [],
        error: "run already in progress",
      };
    }
    this.running = true;

    try {
      const snapshot = await this.environment.collect();

      broadcast(REALTIME_CHANNELS.environmentUpdated, {
        events: snapshot.events,
        collectedAt: snapshot.collectedAt,
      });

      if (snapshot.events.length === 0) {
        logger.error("[pipeline] no environment events collected — skipping AI Core call");
        this.reportHealth("degraded");
        return {
          status: "failed",
          eventCount: 0,
          failedSources: snapshot.failedSources,
          error: "all environment sources failed",
        };
      }

      const recommendation = await this.aiCore.reason(snapshot.events);

      broadcast(REALTIME_CHANNELS.recommendationGenerated, { recommendation });

      const status = snapshot.failedSources.length > 0 ? "degraded" : "ok";
      this.reportHealth(status);
      logger.info(
        {
          trigger,
          status,
          eventCount: snapshot.events.length,
          recommendationId: recommendation.id,
        },
        "[pipeline] cycle complete",
      );

      return {
        status,
        recommendation,
        eventCount: snapshot.events.length,
        failedSources: snapshot.failedSources,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown pipeline error";
      logger.error({ err, trigger }, "[pipeline] cycle failed");
      this.reportHealth("degraded");
      return { status: "failed", eventCount: 0, failedSources: [], error: message };
    } finally {
      this.running = false;
    }
  }

  private reportHealth(status: "ok" | "degraded"): void {
    broadcast(REALTIME_CHANNELS.systemHealth, {
      status,
      service: "backend",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    });
  }
}

export const environmentPipeline = new EnvironmentPipeline();

/**
 * Starts the background polling loop. Returns a stop function so the server
 * can clear it during graceful shutdown.
 */
export function startEnvironmentScheduler(): () => void {
  const interval = env.ENVIRONMENT_POLL_INTERVAL_MS;
  if (interval === 0) {
    logger.info("[pipeline] scheduler disabled (ENVIRONMENT_POLL_INTERVAL_MS=0)");
    return () => {};
  }

  logger.info({ intervalMs: interval }, "[pipeline] scheduler started");
  const timer = setInterval(() => {
    void environmentPipeline.run("scheduled");
  }, interval);

  return () => clearInterval(timer);
}
