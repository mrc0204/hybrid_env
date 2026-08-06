import { create } from "zustand";

import type { Recommendation } from "@ai-env/contracts";

/**
 * The eleven stages mirror the real backend pipeline in execution order:
 *
 *   Organization Understanding Engine  (org)   → stages 0-2
 *   Environment collection             (env)   → stages 3-6
 *   AI Core reasoning                  (ai)    → stages 7-10
 *
 * durationHint is a relative weight: (hint / totalHint) * budget gives each
 * stage its share of the in-flight animation time. Longer hints produce more
 * screen-time so the animation reads as "real work" rather than a metronome.
 */
export interface DiscoveryStageDefinition {
  id: string;
  label: string;
  durationHint: number;
  phase: "org" | "env" | "ai";
}

export const DISCOVERY_STAGES: DiscoveryStageDefinition[] = [
  { id: "resolve-org", label: "Resolving organization…", durationHint: 10, phase: "org" },
  { id: "discover-infra", label: "Discovering infrastructure…", durationHint: 18, phase: "org" },
  {
    id: "build-org-graph",
    label: "Building Organization Knowledge Graph…",
    durationHint: 14,
    phase: "org",
  },
  {
    id: "build-env-graph",
    label: "Building Environment Intelligence Graph…",
    durationHint: 12,
    phase: "env",
  },
  { id: "update-world-model", label: "Updating World Model…", durationHint: 8, phase: "env" },
  { id: "collect-weather", label: "Collecting Weather…", durationHint: 9, phase: "env" },
  { id: "collect-traffic", label: "Collecting Traffic…", durationHint: 9, phase: "env" },
  { id: "run-simulations", label: "Running Simulations…", durationHint: 12, phase: "ai" },
  {
    id: "agents-deliberating",
    label: "Expert Agents Deliberating…",
    durationHint: 16,
    phase: "ai",
  },
  { id: "consensus-reached", label: "Consensus Reached…", durationHint: 6, phase: "ai" },
  { id: "recommendation-ready", label: "Recommendation Ready.", durationHint: 4, phase: "ai" },
];

export type DiscoveryPhase = "idle" | "running" | "success" | "failed" | "cancelled";

/**
 * Per-stage metric strings derived from the real API response and structural
 * constants verified in the codebase. Keys are stage IDs. Only populated when
 * a value is verified — never fabricated.
 */
export type StageMetrics = Partial<Record<string, string>>;

interface DiscoveryState {
  phase: DiscoveryPhase;
  orgName: string;
  /** Index of the stage currently being processed (-1 = not started). */
  currentStage: number;
  /** Indices of stages that have fully completed (connector filled, dot solid). */
  completedStages: number[];
  /**
   * Live metrics keyed by stage id. Each value is a short string derived from
   * real API response data and shown below the stage label when the stage
   * completes.
   */
  metrics: StageMetrics;
  recommendation: Recommendation | null;
  error: string | null;
  startedAt: number | null;

  // ── Actions ──────────────────────────────────────────────────────────────
  start: (orgName: string) => void;
  advanceStage: () => void;
  completeStage: (index: number) => void;
  /**
   * Jumps currentStage to an explicit index — used after the API responds to
   * move from stage 8 to stages 9-10 without depending on advanceStage's
   * +1 increment.
   */
  setCurrentStage: (index: number) => void;
  /**
   * Attaches a metric string to a stage. Ignored when value is undefined so
   * callers can pass optional derived values without branching.
   */
  setMetric: (stageId: string, value: string | undefined) => void;
  succeed: (recommendation: Recommendation | undefined) => void;
  fail: (error: string) => void;
  cancel: () => void;
  reset: () => void;
}

const EMPTY: Pick<
  DiscoveryState,
  | "phase"
  | "orgName"
  | "currentStage"
  | "completedStages"
  | "metrics"
  | "recommendation"
  | "error"
  | "startedAt"
> = {
  phase: "idle",
  orgName: "",
  currentStage: -1,
  completedStages: [],
  metrics: {},
  recommendation: null,
  error: null,
  startedAt: null,
};

export const useDiscoveryStore = create<DiscoveryState>((set, get) => ({
  ...EMPTY,

  start: (orgName) =>
    set({ ...EMPTY, phase: "running", orgName, currentStage: 0, startedAt: Date.now() }),

  advanceStage: () => {
    const { currentStage } = get();
    const next = currentStage + 1;
    if (next < DISCOVERY_STAGES.length) {
      set({ currentStage: next });
    }
  },

  completeStage: (index) =>
    set((s) => ({
      completedStages: s.completedStages.includes(index)
        ? s.completedStages
        : [...s.completedStages, index],
    })),

  setCurrentStage: (index) => set({ currentStage: index }),

  setMetric: (stageId, value) => {
    if (value === undefined) return;
    set((s) => ({ metrics: { ...s.metrics, [stageId]: value } }));
  },

  succeed: (recommendation) =>
    set({
      phase: "success",
      recommendation: recommendation ?? null,
      currentStage: DISCOVERY_STAGES.length - 1,
      completedStages: DISCOVERY_STAGES.map((_, i) => i),
    }),

  fail: (error) => set({ phase: "failed", error }),

  cancel: () => set({ phase: "cancelled" }),

  reset: () => set({ ...EMPTY }),
}));
