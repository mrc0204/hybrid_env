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

export const HealthResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.enum(["ok", "degraded", "down"]),
    service: z.string(),
    version: z.string(),
    timestamp: z.string(),
  }),
});
