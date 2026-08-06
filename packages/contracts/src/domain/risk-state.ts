import type { GeoLocation } from "./shared";

/**
 * A detected hazard or risk, derived from a WorldState by the Reasoning
 * Engine's risk assessment step. Has its own lifecycle independent of any
 * single notification about it — a risk can be detected, keep being
 * monitored across multiple WorldState updates, and eventually resolve.
 */
export interface RiskState {
  id: string;
  /** Open string, same rationale as WorldEntity.type — e.g. "weather-hazard", "congestion", "safety". */
  riskType: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "active" | "monitoring" | "resolved";
  description: string;
  location?: GeoLocation | string;
  /** WorldEntity ids this risk concerns. */
  affectedEntityIds: string[];
  /** WorldState snapshot this risk was derived from. */
  worldStateId: string;
  detectedAt: string;
  updatedAt: string;
  resolvedAt?: string;
}
