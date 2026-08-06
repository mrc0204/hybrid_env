import type { RiskState } from "@ai-env/contracts";

export type Severity = RiskState["severity"];

export const SEVERITY_RANK: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const SEVERITY_HEX: Record<Severity, string> = {
  low: "#5BBFA0",
  medium: "#E0A458",
  high: "#E07B54",
  critical: "#E05563",
};

export const SEVERITY_TEXT: Record<Severity, string> = {
  low: "text-severity-low",
  medium: "text-severity-medium",
  high: "text-severity-high",
  critical: "text-severity-critical",
};

/**
 * The single most severe active risk drives ambient system state. Peripheral
 * cues should reflect the worst thing happening, not an average that would
 * dilute a critical signal into calm.
 */
export function peakSeverity(risks: RiskState[]): Severity | null {
  const active = risks.filter((r) => r.status !== "resolved");
  if (active.length === 0) return null;
  return active.reduce<Severity>(
    (worst, r) => (SEVERITY_RANK[r.severity] > SEVERITY_RANK[worst] ? r.severity : worst),
    "low",
  );
}
