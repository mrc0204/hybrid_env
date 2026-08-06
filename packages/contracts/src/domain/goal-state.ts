/**
 * An active objective the system reasons against — either a specific user's
 * goal ("arrive at the 3 PM class on time") or a system-level operational
 * goal ("minimize gate congestion during peak hours"). This is what the
 * Reasoning Engine optimizes for when it produces SimulationResults.
 */
export interface GoalState {
  id: string;
  scope: string;
  ownerType: "user" | "system";
  /** Present when ownerType is "user". */
  ownerId?: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  status: "active" | "achieved" | "abandoned" | "expired";
  /** Deadline the goal is bound to, when applicable (e.g. a class start time). */
  targetTime?: string;
  createdAt: string;
  updatedAt: string;
}
