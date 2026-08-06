import type { GeoLocation } from "./shared";

/**
 * One tracked thing in the environment (a weather reading, a traffic segment,
 * a gate, a zone, ...). `type` is intentionally an open string rather than a
 * union: the system must generalize past the campus demo to airports,
 * hospitals, industrial parks, etc., and a hackathon timeline doesn't afford
 * enumerating every entity type up front. Type-specific fields live in
 * `attributes`; `type`/`label`/`location` stay strongly typed since every
 * consumer needs those regardless of entity kind.
 */
export interface WorldEntity {
  id: string;
  type: string;
  label: string;
  location?: GeoLocation | string;
  attributes: Record<string, unknown>;
  updatedAt: string;
}

/**
 * The AI Core's live, continuously-updated understanding of the environment —
 * produced by the Perception Engine, held and evolved by the Cognitive
 * Engine. Everything downstream (RiskState, SimulationResult, Decision,
 * Recommendation) traces back to a WorldState snapshot.
 */
export interface WorldState {
  id: string;
  /** Deployment scope, e.g. "niat-kkh-campus" — the domain-agnostic hook for other sites. */
  scope: string;
  /** Monotonic per scope so consumers can order/detect staleness without comparing timestamps. */
  version: number;
  generatedAt: string;
  summary: string;
  entities: WorldEntity[];
  /** InputEvent ids that produced this snapshot — traceability back to raw signals. */
  sourceEventIds: string[];
}
