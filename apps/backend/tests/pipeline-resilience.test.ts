import type { Recommendation } from "@ai-env/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiCoreClient } from "../src/clients/ai-core.client";
import type {
  EnvironmentService,
  EnvironmentSnapshot,
} from "../src/environment/environment.service";
import { EnvironmentPipeline } from "../src/pipeline/environment.pipeline";

/**
 * The pipeline runs from a background interval, where an unhandled rejection
 * would take the process down. These tests pin the contract that `run()`
 * never rejects, no matter which dependency fails.
 */

function snapshot(overrides: Partial<EnvironmentSnapshot> = {}): EnvironmentSnapshot {
  return {
    events: [
      {
        id: "weather-1",
        type: "input.weather.updated",
        timestamp: new Date().toISOString(),
        source: "test",
        payload: {
          location: "South Gate",
          condition: "heavy_rain",
          temperatureC: 24,
          precipitationMm: 18,
          windKph: 12,
        },
      },
    ],
    collectedAt: new Date().toISOString(),
    failedSources: [],
    ...overrides,
  };
}

const recommendation = { id: "rec-1", title: "Test" } as Recommendation;

function makeEnvironment(result: Promise<EnvironmentSnapshot>): EnvironmentService {
  return { collect: () => result } as unknown as EnvironmentService;
}

function makeAiCore(reason: () => Promise<Recommendation>): AiCoreClient {
  return { reason, checkHealth: async () => "ok" } as unknown as AiCoreClient;
}

describe("EnvironmentPipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok when every source and the AI Core succeed", async () => {
    const pipeline = new EnvironmentPipeline(
      makeEnvironment(Promise.resolve(snapshot())),
      makeAiCore(() => Promise.resolve(recommendation)),
    );

    const result = await pipeline.run("manual");

    expect(result.status).toBe("ok");
    expect(result.recommendation).toEqual(recommendation);
    expect(result.eventCount).toBe(1);
  });

  it("degrades rather than fails when one source is down but events remain", async () => {
    const pipeline = new EnvironmentPipeline(
      makeEnvironment(Promise.resolve(snapshot({ failedSources: ["tomtom"] }))),
      makeAiCore(() => Promise.resolve(recommendation)),
    );

    const result = await pipeline.run("manual");

    expect(result.status).toBe("degraded");
    expect(result.failedSources).toEqual(["tomtom"]);
    expect(result.recommendation).toEqual(recommendation);
  });

  it("does not call the AI Core when every source failed", async () => {
    const reason = vi.fn(() => Promise.resolve(recommendation));
    const pipeline = new EnvironmentPipeline(
      makeEnvironment(
        Promise.resolve(snapshot({ events: [], failedSources: ["open-meteo", "tomtom"] })),
      ),
      makeAiCore(reason),
    );

    const result = await pipeline.run("manual");

    expect(result.status).toBe("failed");
    expect(reason).not.toHaveBeenCalled();
  });

  it("resolves instead of rejecting when the AI Core is unavailable", async () => {
    const pipeline = new EnvironmentPipeline(
      makeEnvironment(Promise.resolve(snapshot())),
      makeAiCore(() => Promise.reject(new Error("AI Core unreachable"))),
    );

    const result = await pipeline.run("scheduled");

    expect(result.status).toBe("failed");
    expect(result.error).toContain("unreachable");
  });

  it("resolves instead of rejecting when collection itself throws", async () => {
    const pipeline = new EnvironmentPipeline(
      makeEnvironment(Promise.reject(new Error("collector exploded"))),
      makeAiCore(() => Promise.resolve(recommendation)),
    );

    const result = await pipeline.run("scheduled");

    expect(result.status).toBe("failed");
    expect(result.error).toContain("exploded");
  });
});
