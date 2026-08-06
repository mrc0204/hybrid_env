export interface ExpertVote {
  expertName: string;
  /** Short verdict — "Endorse <candidate>" or "Dissent" for minority opinions. */
  vote: string;
  rationale: string;
  /** This agent's own confidence in its vote, 0..1. */
  confidence?: number;
  evidence?: string[];
}

/**
 * The system's internal, consensus-backed, governance-validated choice among
 * debated SimulationResults — the output of Expert Debate -> Critique ->
 * Consensus -> Governance Validation. A Decision is not yet personalized or
 * user-facing; that is what a Recommendation is derived from it for.
 */
export interface Decision {
  id: string;
  worldStateId: string;
  goalStateId?: string;
  chosenSimulationResultId: string;
  consideredSimulationResultIds: string[];
  /** How strongly the expert council agreed, 0..1. */
  consensusScore: number;
  expertVotes?: ExpertVote[];
  governanceStatus: "approved" | "rejected" | "pending_human_approval";
  governanceNotes?: string;
  /** Internal justification — feeds a derived Recommendation's `reasoning`. */
  rationale: string;
  decidedAt: string;
}
