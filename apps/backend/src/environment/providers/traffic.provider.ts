import { requestJson } from "../../clients/http";
import { env } from "../../config/env";
import { logger } from "../../logging/logger";
import type { LocationOverride } from "../location-override";

export type CongestionLevel = "low" | "medium" | "high";

export interface TrafficReading {
  location: string;
  congestionLevel: CongestionLevel;
  averageSpeedKph: number;
  travelTimeMinutes: number;
  delaySeconds: number;
  routeStatus: "open" | "closed";
}

export interface TrafficProvider {
  readonly name: string;
  fetchCurrent(location?: LocationOverride): Promise<TrafficReading>;
}

/**
 * Congestion derived from how far current speed has fallen below free-flow.
 * A ratio is used rather than an absolute speed so the thresholds hold for
 * both a 30km/h campus lane and a 100km/h arterial road.
 */
export function congestionFromSpeedRatio(
  currentSpeed: number,
  freeFlowSpeed: number,
): CongestionLevel {
  if (freeFlowSpeed <= 0) return "low";
  const ratio = currentSpeed / freeFlowSpeed;
  if (ratio >= 0.8) return "low";
  if (ratio >= 0.5) return "medium";
  return "high";
}

interface TomTomResponse {
  flowSegmentData?: {
    currentSpeed?: number;
    freeFlowSpeed?: number;
    currentTravelTime?: number;
    freeFlowTravelTime?: number;
    roadClosure?: boolean;
  };
}

export class TomTomTrafficProvider implements TrafficProvider {
  readonly name = "tomtom";

  constructor(private readonly apiKey: string) {}

  async fetchCurrent(location?: LocationOverride): Promise<TrafficReading> {
    const lat = location?.lat ?? env.ENVIRONMENT_LATITUDE;
    const lng = location?.lng ?? env.ENVIRONMENT_LONGITUDE;
    const url = `${env.TRAFFIC_API_URL}?point=${lat},${lng}&key=${this.apiKey}`;

    const raw = await requestJson<TomTomResponse>(url, {
      timeoutMs: env.EXTERNAL_API_TIMEOUT_MS,
      maxRetries: 1,
      label: "TomTom traffic",
    });

    const flow = raw.flowSegmentData ?? {};
    const currentSpeed = flow.currentSpeed ?? 0;
    const freeFlowSpeed = flow.freeFlowSpeed ?? 0;
    const currentTravelTime = flow.currentTravelTime ?? 0;
    const freeFlowTravelTime = flow.freeFlowTravelTime ?? 0;

    return {
      location: location?.label ?? env.ENVIRONMENT_LOCATION_NAME,
      congestionLevel: congestionFromSpeedRatio(currentSpeed, freeFlowSpeed),
      averageSpeedKph: currentSpeed,
      travelTimeMinutes: Number((currentTravelTime / 60).toFixed(1)),
      delaySeconds: Math.max(0, currentTravelTime - freeFlowTravelTime),
      routeStatus: flow.roadClosure ? "closed" : "open",
    };
  }
}

/**
 * Used when no TomTom key is configured. Deterministic (no randomness) so
 * demos and tests are reproducible, and clearly labelled so its output is
 * never mistaken for live data.
 */
export class FallbackTrafficProvider implements TrafficProvider {
  readonly name = "fallback-simulated";

  fetchCurrent(location?: LocationOverride): Promise<TrafficReading> {
    return Promise.resolve({
      location: location?.label ?? env.ENVIRONMENT_LOCATION_NAME,
      congestionLevel: "medium",
      averageSpeedKph: 15,
      travelTimeMinutes: 12,
      delaySeconds: 240,
      routeStatus: "open",
    });
  }
}

export function createTrafficProvider(): TrafficProvider {
  if (env.TOMTOM_API_KEY) return new TomTomTrafficProvider(env.TOMTOM_API_KEY);

  logger.warn(
    "[traffic] TOMTOM_API_KEY not set — using deterministic fallback provider (not live data)",
  );
  return new FallbackTrafficProvider();
}
