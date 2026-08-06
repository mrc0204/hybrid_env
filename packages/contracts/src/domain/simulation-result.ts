/**
 * The predicted outcome of one candidate action, evaluated by the Reasoning
 * Engine's Simulation stage against a WorldState (and optionally a
 * GoalState). Multiple SimulationResults for the same WorldState are what
 * the Expert Council debates before a Decision is made.
 */
export interface SimulationResult {
  id: string;
  worldStateId: string;
  goalStateId?: string;
  candidateAction: string;
  predictedOutcome: string;
  /** RiskState ids this candidate is predicted to affect. */
  affectedRiskIds: string[];
  /** Likelihood this candidate achieves the associated goal, 0..1. */
  successProbability: number;
  /** Free-form cost estimate, e.g. "10 extra minutes walking" — kept as a string since units vary by domain. */
  estimatedCost?: string;
  /** Calculated Dijkstra node path if route optimization was run. */
  routePath?: string[];
  /** Calculated Dijkstra impedance cost units. */
  dijkstraCost?: number;
  generatedAt: string;
}
