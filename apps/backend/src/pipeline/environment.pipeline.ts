import { randomUUID } from "node:crypto";

import type { InputEvent, OrganizationContextInputEvent, Recommendation } from "@ai-env/contracts";

import { aiCoreClient, type AiCoreClient } from "../clients/ai-core.client";
import { env } from "../config/env";
import { environmentService, type EnvironmentService } from "../environment/environment.service";
import { logger } from "../logging/logger";
import { broadcast, REALTIME_CHANNELS } from "../realtime/events";
import type { OrganizationDiscoveryResult } from "../organization/types";

export interface PipelineResult {
  status: "ok" | "degraded" | "failed";
  recommendation?: Recommendation;
  eventCount: number;
  failedSources: string[];
  error?: string;
}

/**
 * The core orchestration, shared by both entry points below:
 *
 *   normalize to InputEvents -> broadcast `environment.updated` -> call AI
 *   Core /reason -> broadcast `recommendation.generated`
 *
 * Never rejects. `run()` is invoked from a background interval where an
 * unhandled rejection would take the process down, so every failure is
 * converted into a PipelineResult and reported on `system.health` instead.
 */
export class EnvironmentPipeline {
  private running = false;

  constructor(
    private readonly environment: EnvironmentService = environmentService,
    private readonly aiCore: AiCoreClient = aiCoreClient,
  ) {}

  async run(trigger: "scheduled" | "manual"): Promise<PipelineResult> {
    return this.withMutex(trigger, async () => {
      const snapshot = await this.environment.collect();
      return this.executeCycle(trigger, snapshot.events, snapshot.failedSources);
    });
  }

  /**
   * Same cycle, seeded with a discovered organization: its infrastructure
   * becomes one InputEvent (see `toOrganizationEvent`), and weather/traffic
   * are collected at the organization's resolved coordinates instead of the
   * static deployment default. This is the integration point between the
   * Organization Understanding Engine and the existing reasoning pipeline —
   * everything from `executeCycle` down is completely unchanged.
   */
  async runForOrganization(discovery: OrganizationDiscoveryResult): Promise<PipelineResult> {
    return this.withMutex("manual", async () => {
      const organizationEvent = toOrganizationEvent(discovery);
      const snapshot = await this.environment.collect({
        lat: discovery.profile.center.lat,
        lng: discovery.profile.center.lng,
        label: discovery.profile.resolvedName,
      });
      const events: InputEvent[] = [organizationEvent, ...snapshot.events];
      return this.executeCycle("manual", events, snapshot.failedSources);
    });
  }

  private async withMutex(
    trigger: "scheduled" | "manual",
    fn: () => Promise<PipelineResult>,
  ): Promise<PipelineResult> {
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
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown pipeline error";
      logger.error({ err, trigger }, "[pipeline] cycle failed");
      this.reportHealth("degraded");
      return { status: "failed", eventCount: 0, failedSources: [], error: message };
    } finally {
      this.running = false;
    }
  }

  private async executeCycle(
    trigger: "scheduled" | "manual",
    events: InputEvent[],
    failedSources: string[],
  ): Promise<PipelineResult> {
    broadcast(REALTIME_CHANNELS.environmentUpdated, {
      events,
      collectedAt: new Date().toISOString(),
    });

    if (events.length === 0) {
      logger.error("[pipeline] no environment events collected — skipping AI Core call");
      this.reportHealth("degraded");
      return {
        status: "failed",
        eventCount: 0,
        failedSources,
        error: "all environment sources failed",
      };
    }

    const recommendation = await this.aiCore.reason(events);

    broadcast(REALTIME_CHANNELS.recommendationGenerated, { recommendation });

    const status = failedSources.length > 0 ? "degraded" : "ok";
    this.reportHealth(status);
    logger.info(
      { trigger, status, eventCount: events.length, recommendationId: recommendation.id },
      "[pipeline] cycle complete",
    );

    return { status, recommendation, eventCount: events.length, failedSources };
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

function toOrganizationEvent(
  discovery: OrganizationDiscoveryResult,
): OrganizationContextInputEvent {
  return {
    id: `organization-${randomUUID()}`,
    type: "input.organization.context_updated",
    timestamp: new Date().toISOString(),
    source: `organization-understanding-engine:${discovery.source}`,
    payload: {
      organizationName: discovery.profile.queryName,
      resolvedName: discovery.profile.resolvedName,
      center: discovery.profile.center,
      source: discovery.source,
      entities: discovery.entities,
    },
  };
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
