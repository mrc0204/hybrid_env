import type { BaseEvent } from "./base";
import type { RiskState, Recommendation, WorldState } from "../domain";

/**
 * AI events notify that a domain model changed — they never redefine the
 * domain themselves. Each payload embeds the canonical model it announces.
 */

export interface WorldModelUpdatedEvent extends BaseEvent<"ai.world_model.updated"> {
  payload: {
    worldState: WorldState;
  };
}

export interface RiskDetectedEvent extends BaseEvent<"ai.risk.detected"> {
  payload: {
    riskState: RiskState;
  };
}

export interface RecommendationGeneratedEvent extends BaseEvent<"ai.recommendation.generated"> {
  payload: {
    recommendation: Recommendation;
  };
}

export type AIEvent = WorldModelUpdatedEvent | RiskDetectedEvent | RecommendationGeneratedEvent;

export type AIEventType = AIEvent["type"];
