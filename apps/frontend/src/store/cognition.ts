import { create } from "zustand";

import { buildTraces, type CognitiveTrace } from "@/mock/scenarios";

/**
 * The six stages mirror the AI Core's real pipeline (Perception -> Cognitive ->
 * Reasoning -> Action engines) and the domain models each produces. The
 * interface is organised around this progression rather than around data
 * widgets, because the progression is what demonstrates reasoning.
 */
export const STAGES = [
  {
    id: "perceive",
    index: 0,
    name: "Perceive",
    produces: "InputEvent[]",
    note: "Raw signals arriving from the environment",
    durationMs: 1500,
  },
  {
    id: "model",
    index: 1,
    name: "Model",
    produces: "WorldState",
    note: "Signals resolved into a coherent picture",
    durationMs: 1700,
  },
  {
    id: "assess",
    index: 2,
    name: "Assess",
    produces: "RiskState[]",
    note: "What could go wrong, and how badly",
    durationMs: 1600,
  },
  {
    id: "simulate",
    index: 3,
    name: "Simulate",
    produces: "SimulationResult[]",
    note: "Candidate actions played forward",
    durationMs: 1800,
  },
  {
    id: "deliberate",
    index: 4,
    name: "Deliberate",
    produces: "Decision",
    note: "Expert council debates and converges",
    durationMs: 2100,
  },
  {
    id: "recommend",
    index: 5,
    name: "Recommend",
    produces: "Recommendation",
    note: "Explained, personalised, actionable",
    durationMs: 1300,
  },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

interface CognitionState {
  trace: CognitiveTrace;
  traces: CognitiveTrace[];
  traceIndex: number;
  assessedOrganization: string | null;
  mapCenter: { lat: number; lng: number } | null;

  /** How far the current cycle has progressed. -1 = idle, 5 = complete. */
  activeStage: number;
  isRunning: boolean;
  cycleCount: number;

  /** Stage the user has opened for inspection; null = follow the live cycle. */
  inspectedStage: StageId | null;
  /** Cross-highlight target — set by hovering evidence, read by map + spine. */
  highlightedRefId: string | null;

  startCycle: () => void;
  advanceStage: () => void;
  completeCycle: () => void;
  nextScenario: () => void;
  /** Live-data counterpart to nextScenario: sets a fetched trace directly, no mock rotation. */
  setTrace: (trace: CognitiveTrace) => void;
  inspectStage: (stage: StageId | null) => void;
  highlight: (refId: string | null) => void;
  setAssessedOrganization: (name: string | null) => void;
  setMapCenter: (center: { lat: number; lng: number } | null) => void;
}

const initialTraces = buildTraces();

export const useCognition = create<CognitionState>((set, get) => ({
  traces: initialTraces,
  trace: initialTraces[0]!,
  traceIndex: 0,
  assessedOrganization: null,
  mapCenter: null,

  activeStage: -1,
  isRunning: false,
  cycleCount: 0,

  inspectedStage: null,
  highlightedRefId: null,

  startCycle: () => set({ isRunning: true, activeStage: 0, inspectedStage: null }),

  advanceStage: () => {
    const { activeStage } = get();
    if (activeStage < STAGES.length - 1) set({ activeStage: activeStage + 1 });
  },

  completeCycle: () =>
    set((s) => ({
      isRunning: false,
      activeStage: STAGES.length - 1,
      cycleCount: s.cycleCount + 1,
    })),

  nextScenario: () => {
    const { traceIndex } = get();
    // Rebuilt each time so timestamps read as current rather than stale.
    const traces = buildTraces();
    const nextIndex = (traceIndex + 1) % traces.length;
    set({
      traces,
      traceIndex: nextIndex,
      trace: traces[nextIndex]!,
      activeStage: -1,
      inspectedStage: null,
      highlightedRefId: null,
    });
  },

  setTrace: (trace) =>
    set({ trace, activeStage: -1, inspectedStage: null, highlightedRefId: null }),

  inspectStage: (stage) => set({ inspectedStage: stage }),
  highlight: (refId) => set({ highlightedRefId: refId }),
  setAssessedOrganization: (name) => set({ assessedOrganization: name }),
  setMapCenter: (center) => set({ mapCenter: center }),
}));

/** Stage currently shown in the detail pane: user selection wins over the cycle. */
export function useVisibleStage(): StageId {
  const inspected = useCognition((s) => s.inspectedStage);
  const active = useCognition((s) => s.activeStage);
  if (inspected) return inspected;
  return STAGES[Math.max(0, active)]!.id;
}
