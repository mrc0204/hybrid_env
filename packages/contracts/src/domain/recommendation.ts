export interface EvidenceRef {
  type: "world_state" | "risk_state" | "input_event" | "note";
  /** id into the referenced model, when applicable. */
  refId?: string;
  description: string;
}

export interface RecommendationAlternative {
  option: string;
  reason: string;
}

/**
 * The personalized, explainable, user-facing artifact derived from a
 * Decision — the Action Engine's output after Decision Justification and
 * Personalization. Directly operationalizes the project rule that every
 * recommendation carries reasoning, evidence, a confidence score, and
 * alternatives considered; a bare conclusion is never emitted.
 *
 * `worldStateId` and `relatedRiskIds` are denormalized from the source
 * Decision so presentation-layer consumers (frontend cards, notifications)
 * don't need to join back through Decision/SimulationResult just to show
 * which risks motivated this recommendation.
 */
export interface Recommendation {
  id: string;
  /** The Decision this recommendation personalizes and explains. */
  decisionId: string;
  title: string;
  /** The concrete instruction, e.g. "Leave 20 minutes earlier via North Gate". */
  action: string;
  /** The "why". */
  reasoning: string;
  evidence: EvidenceRef[];
  /** 0..1 */
  confidence: number;
  alternatives: RecommendationAlternative[];
  relatedRiskIds: string[];
  worldStateId: string;
  /** Personalization target; omitted means broadcast. */
  targetUserIds?: string[];
  status: "proposed" | "delivered" | "accepted" | "dismissed" | "expired";
  createdAt: string;
  /** Recommendations are time-sensitive — meaningless past this point. */
  validUntil?: string;
}
