import { z } from "zod";

/**
 * Runtime counterparts to the compile-time types in `@ai-env/contracts`.
 *
 * TypeScript types vanish at runtime, so a malformed AI Core response would
 * otherwise flow silently into the Socket.IO broadcast and only fail much
 * later, in the frontend. These schemas make the service boundary fail fast
 * and loudly instead. They intentionally validate the fields the Backend
 * actually depends on and stay permissive elsewhere, so additive contract
 * changes on the AI Core side don't break the Backend.
 */

const EvidenceRefSchema = z.object({
  type: z.enum(["world_state", "risk_state", "input_event", "note"]),
  refId: z.string().optional(),
  description: z.string(),
});

const RecommendationAlternativeSchema = z.object({
  option: z.string(),
  reason: z.string(),
});

export const RecommendationSchema = z.object({
  id: z.string(),
  decisionId: z.string(),
  title: z.string(),
  action: z.string(),
  reasoning: z.string(),
  evidence: z.array(EvidenceRefSchema),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(RecommendationAlternativeSchema),
  relatedRiskIds: z.array(z.string()),
  worldStateId: z.string(),
  targetUserIds: z.array(z.string()).optional().nullable(),
  status: z.enum(["proposed", "delivered", "accepted", "dismissed", "expired"]),
  createdAt: z.string(),
  validUntil: z.string().optional().nullable(),
});

export const ReasonResponseSchema = z.object({
  success: z.literal(true),
  data: RecommendationSchema,
});

const ExpertVoteSchema = z.object({
  expertName: z.string(),
  vote: z.string(),
  rationale: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(z.string()).optional(),
});

const DecisionSchema = z.object({
  id: z.string(),
  worldStateId: z.string(),
  goalStateId: z.string().optional().nullable(),
  chosenSimulationResultId: z.string(),
  consideredSimulationResultIds: z.array(z.string()),
  consensusScore: z.number().min(0).max(1),
  expertVotes: z.array(ExpertVoteSchema).optional().nullable(),
  governanceStatus: z.enum(["approved", "rejected", "pending_human_approval"]),
  governanceNotes: z.string().optional().nullable(),
  rationale: z.string(),
  decidedAt: z.string(),
});

const SimulationResultSchema = z.object({
  id: z.string(),
  worldStateId: z.string(),
  goalStateId: z.string().optional().nullable(),
  candidateAction: z.string(),
  predictedOutcome: z.string(),
  affectedRiskIds: z.array(z.string()),
  successProbability: z.number().min(0).max(1),
  estimatedCost: z.string().optional().nullable(),
  generatedAt: z.string(),
});

const RiskStateSchema = z.object({
  id: z.string(),
  riskType: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["active", "monitoring", "resolved"]),
  description: z.string(),
  location: z.unknown().optional().nullable(),
  affectedEntityIds: z.array(z.string()),
  worldStateId: z.string(),
  detectedAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().optional().nullable(),
});

const WorldEntitySchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  location: z.unknown().optional().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  updatedAt: z.string(),
});

const WorldStateSchema = z.object({
  id: z.string(),
  scope: z.string(),
  version: z.number(),
  generatedAt: z.string(),
  summary: z.string(),
  entities: z.array(WorldEntitySchema),
  sourceEventIds: z.array(z.string()),
});

// InputEvent is a wire-validated discriminated union on the AI Core side
// already; the Backend just needs to know it's an array of objects to pass
// through to the frontend, not re-validate every variant.
export const ReasonTraceSchema = z.object({
  inputEvents: z.array(z.record(z.string(), z.unknown())),
  worldState: WorldStateSchema,
  risks: z.array(RiskStateSchema),
  simulations: z.array(SimulationResultSchema),
  decision: DecisionSchema,
  recommendation: RecommendationSchema,
});

export const TraceResponseSchema = z.object({
  success: z.literal(true),
  data: ReasonTraceSchema,
});

export const HealthResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.enum(["ok", "degraded", "down"]),
    service: z.string(),
    version: z.string(),
    timestamp: z.string(),
  }),
});
