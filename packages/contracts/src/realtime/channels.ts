import type { HealthStatus } from "../api/common";
import type { Recommendation } from "../domain";
import type { InputEvent } from "../events";

/**
 * Socket.IO channel names. The Backend owns all realtime communication; the
 * AI Core never pushes to clients directly. Declared here so the Frontend
 * subscribes to exactly the names the Backend emits — a typo in a channel
 * string is otherwise a silent, runtime-only failure.
 */
export const REALTIME_CHANNELS = {
  environmentUpdated: "environment.updated",
  recommendationGenerated: "recommendation.generated",
  systemHealth: "system.health",
} as const;

export type RealtimeChannel = (typeof REALTIME_CHANNELS)[keyof typeof REALTIME_CHANNELS];

export interface EnvironmentUpdatedPayload {
  events: InputEvent[];
  collectedAt: string;
}

export interface RecommendationGeneratedPayload {
  recommendation: Recommendation;
}

export type SystemHealthPayload = HealthStatus;

/** Maps each channel to the payload it carries. */
export interface RealtimeEventMap {
  [REALTIME_CHANNELS.environmentUpdated]: EnvironmentUpdatedPayload;
  [REALTIME_CHANNELS.recommendationGenerated]: RecommendationGeneratedPayload;
  [REALTIME_CHANNELS.systemHealth]: SystemHealthPayload;
}
