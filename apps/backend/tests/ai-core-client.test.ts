import { afterEach, describe, expect, it, vi } from "vitest";

import { AiCoreClient } from "../src/clients/ai-core.client";

/**
 * The Backend broadcasts whatever the AI Core returns straight to connected
 * clients, so a malformed response must be caught at this boundary rather
 * than surfacing later as a confusing frontend bug.
 */
function mockFetchOnce(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok,
        status,
        json: () => Promise.resolve(body),
      } as Response),
    ),
  );
}

const validRecommendation = {
  id: "rec-1",
  decisionId: "decision-1",
  title: "Adjust your route",
  action: "Leave earlier",
  reasoning: "Heavy rain plus congestion",
  evidence: [{ type: "world_state", refId: "ws-1", description: "heavy rain" }],
  confidence: 0.8,
  alternatives: [{ option: "Usual route", reason: "Higher exposure" }],
  relatedRiskIds: ["risk-1"],
  worldStateId: "ws-1",
  status: "proposed",
  createdAt: new Date().toISOString(),
};

describe("AiCoreClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the recommendation from a valid response", async () => {
    mockFetchOnce({ success: true, data: validRecommendation });

    const result = await new AiCoreClient("http://ai-core", 1000, 0).reason([]);

    expect(result.id).toBe("rec-1");
    expect(result.confidence).toBe(0.8);
  });

  it("rejects a response missing required contract fields", async () => {
    mockFetchOnce({ success: true, data: { id: "rec-1" } });

    await expect(new AiCoreClient("http://ai-core", 1000, 0).reason([])).rejects.toThrow(
      /does not match the Recommendation contract/,
    );
  });

  it("rejects a confidence outside the 0..1 range", async () => {
    mockFetchOnce({ success: true, data: { ...validRecommendation, confidence: 42 } });

    await expect(new AiCoreClient("http://ai-core", 1000, 0).reason([])).rejects.toThrow(
      /does not match the Recommendation contract/,
    );
  });

  it("reports the AI Core as down when health check fails, without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))),
    );

    const status = await new AiCoreClient("http://ai-core", 1000, 0).checkHealth();

    expect(status).toBe("down");
  });

  it("reports degraded when the health response does not match the contract", async () => {
    mockFetchOnce({ success: true, data: { unexpected: "shape" } });

    const status = await new AiCoreClient("http://ai-core", 1000, 0).checkHealth();

    expect(status).toBe("degraded");
  });
});
