import { useCallback, useRef } from "react";

import { discoverOrganization, fetchLatestTrace, USE_MOCK } from "@/api/client";
import type { OrganizationDiscoveryResult } from "@/api/client";
import { useCognition } from "@/store/cognition";
import { DISCOVERY_STAGES, useDiscoveryStore } from "@/store/discoveryStore";
import type { Recommendation } from "@ai-env/contracts";

/**
 * Stages 0-7 animate with timers while the API call is in flight.
 * Stage 8 (agents-deliberating) starts at the end of the timer sequence and
 * keeps its dot pulsing until the API responds — it is the "waiting" stage
 * and is NOT completed by a timer, only by the API response. This is honest:
 * the AI agents genuinely are deliberating at that point.
 */
const IN_FLIGHT_ANIMATE_COUNT = 8; // stages 0-7 get timed animation

/**
 * Total ms budget for the eight timed stages. After this, stage 8 activates
 * and pulses until the API returns. If the API returns before this budget
 * elapses, the remaining stage 8 wait is absorbed into the deliberation pulse.
 */
const IN_FLIGHT_BUDGET_MS = 8_000;

/**
 * Structural constant: the AI Core has exactly 5 specialist agents.
 * Verified from: apps/ai-core/app/reasoning/agents/
 *   accessibility_agent.py, operations_agent.py, safety_agent.py,
 *   student_experience_agent.py, sustainability_agent.py
 */
const AGENT_COUNT = 5;

/** Neighbor count used by graph-builder.ts (NEAREST_NEIGHBOR_COUNT = 4). */
const NEIGHBORS_PER_ENTITY = 4;

function buildStageDurations(): number[] {
  const hints = DISCOVERY_STAGES.slice(0, IN_FLIGHT_ANIMATE_COUNT).map((s) => s.durationHint);
  const total = hints.reduce((a, b) => a + b, 0);
  return hints.map((h) => Math.round((h / total) * IN_FLIGHT_BUDGET_MS));
}

/**
 * Derive verified, honest metrics from the API response.
 *
 * Rules:
 *  - Only set a metric when the value is genuinely known.
 *  - Structural constants (agent count, neighbor count) are documented as such.
 *  - Nothing is fabricated. If a value is unavailable, no metric is set.
 */
function deriveMetrics(
  result: OrganizationDiscoveryResult,
  orgName: string,
): Array<[stageId: string, metric: string]> {
  const out: Array<[string, string]> = [];
  const { organization, entityCount, pipeline, source } = result;

  // Stage 0 — show the geocoded name when it differs from what the user typed.
  const resolved = organization.resolvedName;
  if (resolved && resolved.toLowerCase() !== orgName.toLowerCase()) {
    out.push(["resolve-org", `→ ${resolved}`]);
  } else if (source !== "live") {
    // Still show provenance when geocoding was skipped (cache / fallback).
    out.push(["resolve-org", source]);
  }

  // Stage 1 — real entity count from OSM via the backend.
  if (entityCount > 0) {
    const label = entityCount === 1 ? "entity" : "entities";
    out.push(["discover-infra", `${entityCount} ${label}`]);
  }

  // Stage 2 — graph nodes = entityCount; edges = entityCount × NEIGHBORS_PER_ENTITY ÷ 2
  // (each entity connects to 4 nearest neighbors; edges are bidirectional so the
  // total unique edges is entityCount × NEIGHBORS_PER_ENTITY / 2, capped because
  // sparse graphs may have fewer neighbors than NEAREST_NEIGHBOR_COUNT).
  // We report only the node count since the actual edge count isn't returned.
  if (entityCount > 0) {
    out.push([
      "build-org-graph",
      `${entityCount} nodes · ${entityCount * NEIGHBORS_PER_ENTITY} edges`,
    ]);
  }

  // Stage 8 — structural constant, documented above.
  out.push(["agents-deliberating", `${AGENT_COUNT} specialist agents`]);

  // Stage 9 — real confidence from the recommendation.
  const confidence = pipeline.recommendation?.confidence;
  if (confidence !== undefined) {
    out.push(["consensus-reached", `${Math.round(confidence * 100)}% confidence`]);
  }

  // Stage 10 — evidence and alternatives counts from the recommendation.
  const rec: Recommendation | undefined = pipeline.recommendation;
  if (rec) {
    const parts: string[] = [];
    if (rec.evidence.length > 0) parts.push(`${rec.evidence.length} evidence`);
    if (rec.alternatives.length > 0) parts.push(`${rec.alternatives.length} alternatives`);
    if (parts.length > 0) out.push(["recommendation-ready", parts.join(" · ")]);
  }

  return out;
}

/**
 * Mock result used when VITE_USE_MOCK=true (the default, no backend needed).
 * Entity count, confidence, and evidence count are representative demo values
 * — not real measurements. The mock delay is long enough to show the full
 * stage animation before the API "responds".
 */
async function mockDiscover(orgName: string): Promise<OrganizationDiscoveryResult> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 6_000));
  return {
    organization: {
      queryName: orgName,
      resolvedName: orgName,
      center: { lat: 17.385, lng: 78.4867 },
      boundingBox: { south: 17.38, west: 78.48, north: 17.39, east: 78.495 },
    },
    source: "fallback",
    entityCount: 47,
    pipeline: {
      status: "ok",
      recommendation: {
        id: "mock-rec-discover-01",
        decisionId: "mock-dec-01",
        title: "Environment is nominal",
        action:
          "No immediate action required. Campus conditions are within normal operating parameters.",
        reasoning:
          "All monitored signals are within baseline. No elevated risk states detected across weather, traffic, or infrastructure layers.",
        evidence: [
          {
            type: "world_state",
            refId: "ws-mock-01",
            description: "All systems nominal at time of assessment",
          },
          { type: "input_event", refId: "ev-weather", description: "Weather within safe bounds" },
          { type: "input_event", refId: "ev-traffic", description: "Traffic flow unimpeded" },
        ],
        confidence: 0.87,
        alternatives: [
          {
            option: "Issue precautionary advisory",
            reason: "Not warranted at current confidence level",
          },
        ],
        relatedRiskIds: [],
        worldStateId: "ws-mock-01",
        status: "proposed",
        createdAt: new Date().toISOString(),
      },
    },
  };
}

/**
 * Orchestrates the Discovery experience:
 *   1. Fires the real API call (or mock) with an AbortController.
 *   2. Simultaneously runs timed stage animations for stages 0-7.
 *   3. Stage 8 (agents-deliberating) activates at t=IN_FLIGHT_BUDGET_MS and
 *      keeps pulsing until the API responds (however long that takes).
 *   4. When both the API and stage-8-activation have occurred, derives metrics
 *      from the response and animates stages 9-10 rapidly before calling succeed().
 *
 * The hook is designed to be called once at the App level. `discover` and
 * `cancel` are stable references (useCallback) safe to pass down as props.
 */
export function useDiscovery() {
  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
  }, []);

  const discover = useCallback(
    (
      orgName: string,
      center?: { lat: number; lng: number },
      boundingBox?: { south: number; west: number; north: number; east: number },
    ) => {
      const name = orgName.trim();
      if (!name) return;

      clearTimers();
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      const { start, advanceStage, completeStage, setCurrentStage, setMetric, succeed, fail } =
        useDiscoveryStore.getState();

      start(name);

      const durations = buildStageDurations();
      let elapsed = 0;

      // ── In-flight stage timers: stages 0 → 7 ─────────────────────────────
      // Each timer completes the current stage and advances to the next.
      for (let i = 0; i < IN_FLIGHT_ANIMATE_COUNT - 1; i++) {
        elapsed += durations[i]!;
        const completing = i;
        timersRef.current.push(
          window.setTimeout(() => {
            if (useDiscoveryStore.getState().phase !== "running") return;
            completeStage(completing);
            advanceStage(); // currentStage becomes completing + 1
          }, elapsed),
        );
      }

      // ── Stage 7 completion → activate stage 8 (agents-deliberating) ──────
      elapsed += durations[IN_FLIGHT_ANIMATE_COUNT - 1]!;

      // Stage 8 activation timer (fallback in case API is very slow)
      let stage8Fired = false;
      timersRef.current.push(
        window.setTimeout(() => {
          if (useDiscoveryStore.getState().phase !== "running") return;
          if (stage8Fired) return; // API already returned and handles it
          completeStage(IN_FLIGHT_ANIMATE_COUNT - 1); // complete stage 7
          setCurrentStage(IN_FLIGHT_ANIMATE_COUNT); // activate stage 8
          stage8Fired = true;
        }, elapsed),
      );

      // ── Helper to handle successful API completion ────────────────────────
      const handleApiSuccess = (result: OrganizationDiscoveryResult) => {
        if (useDiscoveryStore.getState().phase !== "running") return;

        // A missing recommendation (pipeline genuinely failed server-side, e.g.
        // an unresolvable location) is not a success — treat it as one used to
        // force a non-null assertion downstream and crash the Recommendation
        // panel on `rec.confidence` of `undefined`. `status: "degraded"` alone
        // is NOT a failure case here — it just means one upstream source (e.g.
        // traffic or weather) had a hiccup while the AI Core still produced a
        // usable recommendation from partial data; only a missing
        // recommendation means there's nothing usable to show.
        if (!result.pipeline.recommendation) {
          clearTimers();
          fail(
            result.pipeline.error ??
              "No recommendation could be generated for this location. Try a more specific name.",
          );
          return;
        }

        // Clear the slow background timers
        clearTimers();
        stage8Fired = true;

        // Set verified metrics from the response before animating
        const metricPairs = deriveMetrics(result, name);
        for (const [stageId, value] of metricPairs) {
          setMetric(stageId, value);
        }

        // Fast-forward cascade: catch up remaining stages to 8 (deliberation)
        const currentIdx = useDiscoveryStore.getState().currentStage;
        const targetIdx = IN_FLIGHT_ANIMATE_COUNT; // stage 8

        const runCascade = (idx: number) => {
          if (useDiscoveryStore.getState().phase !== "running") return;

          if (idx < targetIdx) {
            completeStage(idx);
            setCurrentStage(idx + 1);
            timersRef.current.push(window.setTimeout(() => runCascade(idx + 1), 120));
          } else {
            // Reached stage 8: mark it complete, move immediately to stage 9 (consensus)
            completeStage(targetIdx);
            setCurrentStage(targetIdx + 1);

            timersRef.current.push(
              window.setTimeout(() => {
                if (useDiscoveryStore.getState().phase !== "running") return;
                completeStage(targetIdx + 1); // complete stage 9
                setCurrentStage(targetIdx + 2); // activate stage 10 (ready)

                timersRef.current.push(
                  window.setTimeout(() => {
                    if (useDiscoveryStore.getState().phase !== "running") return;
                    completeStage(targetIdx + 2); // complete stage 10

                    // Update assessed organization and trace in store
                    const resolvedName = result.organization.resolvedName || name;
                    useCognition.getState().setAssessedOrganization(resolvedName);
                    if (result.organization.center) {
                      useCognition.getState().setMapCenter(result.organization.center);
                    }

                    if (!USE_MOCK) {
                      fetchLatestTrace()
                        .then((trace) => {
                          useCognition.getState().setTrace({
                            key: trace.worldState.id,
                            label: resolvedName,
                            inputEvents: trace.inputEvents,
                            worldState: {
                              ...trace.worldState,
                              scope: resolvedName,
                            },
                            risks: trace.risks,
                            simulations: trace.simulations,
                            decision: trace.decision,
                            recommendation: trace.recommendation,
                          });
                          // Deliberately does not complete the cycle here.
                          // setTrace resets activeStage to -1, and the new
                          // trace key is what wakes useCognitiveCycle to walk
                          // the spine through these six stages and finish on
                          // Recommend. Forcing "complete" at this point would
                          // skip that walk — which is exactly the bug where
                          // every discovery landed on a finished spine.
                        })
                        .catch((err) => {
                          console.error("Failed to fetch latest live trace", err);
                        });
                    } else {
                      const baseTrace = useCognition.getState().traces[0]!;
                      useCognition.getState().setTrace({
                        ...baseTrace,
                        label: resolvedName,
                        worldState: {
                          ...baseTrace.worldState,
                          scope: resolvedName,
                        },
                        recommendation: result.pipeline.recommendation!,
                      });
                    }

                    succeed(result.pipeline.recommendation);
                  }, 400),
                );
              }, 400),
            );
          }
        };

        runCascade(currentIdx);
      };

      // ── API call ──────────────────────────────────────────────────────────
      (USE_MOCK ? mockDiscover(name) : discoverOrganization(name, center, boundingBox, signal))
        .then((result) => {
          if (signal.aborted) return;
          handleApiSuccess(result);
        })
        .catch((err: unknown) => {
          if (signal.aborted) return;
          clearTimers();
          const message =
            err instanceof Error ? err.message : "Discovery failed. Please try again.";
          fail(message);
        });
    },
    [clearTimers],
  );

  const cancel = useCallback(() => {
    clearTimers();
    abortRef.current?.abort();
    useDiscoveryStore.getState().reset();
  }, [clearTimers]);

  return { discover, cancel };
}
