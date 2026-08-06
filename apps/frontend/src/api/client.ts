import type { ApiResponse, HealthStatus, ReasonTrace, Recommendation } from "@ai-env/contracts";
import { REALTIME_CHANNELS } from "@ai-env/contracts";

/**
 * The seam to the real Backend.
 *
 * The frontend currently renders a local cognitive simulation so the interface
 * can be demonstrated without the full stack running. These functions are the
 * complete, typed path to the live system: flip `USE_MOCK` to false (or set
 * `VITE_USE_MOCK=false`) and the same components render live data, because
 * every component is typed against `@ai-env/contracts` rather than against
 * mock shapes.
 *
 * Endpoints match the Backend built in Milestone 4 exactly.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch("/health");
  const body = (await res.json()) as ApiResponse<HealthStatus>;
  if (!body.success) throw new Error(body.error.message);
  return body.data;
}

interface PipelineResult {
  status: "ok" | "degraded" | "failed";
  recommendation?: Recommendation;
  eventCount: number;
  failedSources: string[];
  error?: string;
}

/** Triggers one Backend pipeline cycle: collect -> normalize -> AI Core -> broadcast. */
export async function triggerEnvironmentRefresh(): Promise<PipelineResult> {
  const res = await fetch("/api/v1/environment/refresh", { method: "POST" });
  const body = (await res.json()) as ApiResponse<PipelineResult>;
  if (!body.success) throw new Error(body.error.message);
  return body.data;
}

/**
 * The full multi-agent cognitive trace behind the most recent recommendation
 * — every Expert Agent's vote, not just the final answer. Powers the live
 * branch of `useCognitiveCycle` (see that file for how USE_MOCK gates it).
 */
export async function fetchLatestTrace(): Promise<ReasonTrace> {
  const res = await fetch("/api/v1/trace/latest");
  const body = (await res.json()) as ApiResponse<ReasonTrace>;
  if (!body.success) throw new Error(body.error.message);
  return body.data;
}

/**
 * Realtime channel names, re-exported from the shared contracts so the
 * subscription layer cannot drift from what the Backend actually emits.
 *
 * Socket.IO's client is intentionally not a dependency of this milestone —
 * the approved stack for the frontend does not include it. Wiring it up is a
 * single `io()` call subscribing to these three channels and pushing the
 * payloads into the same Zustand store the mock engine writes to.
 */
export const CHANNELS = REALTIME_CHANNELS;
