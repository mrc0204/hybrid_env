import { randomUUID } from "node:crypto";

import type { InputEvent, TrafficInputEvent, WeatherInputEvent } from "@ai-env/contracts";

import { logger } from "../logging/logger";
import type { LocationOverride } from "./location-override";
import {
  OpenMeteoWeatherProvider,
  type WeatherProvider,
  type WeatherReading,
} from "./providers/weather.provider";
import {
  createTrafficProvider,
  type TrafficProvider,
  type TrafficReading,
} from "./providers/traffic.provider";

export interface EnvironmentSnapshot {
  events: InputEvent[];
  collectedAt: string;
  /** Providers that failed this cycle — surfaced so health can report partial data. */
  failedSources: string[];
}

/**
 * Collects live external signals and converts them into canonical InputEvents.
 *
 * This is the system's anti-corruption layer: provider-specific response
 * shapes stop here and never reach the AI Core. It performs no reasoning —
 * it collects, normalizes, and validates only.
 *
 * Sources are fetched independently and a failing source degrades the
 * snapshot rather than failing it, so one flaky API can't blind the whole
 * pipeline.
 */
export class EnvironmentService {
  constructor(
    private readonly weatherProvider: WeatherProvider = new OpenMeteoWeatherProvider(),
    private readonly trafficProvider: TrafficProvider = createTrafficProvider(),
  ) {}

  /**
   * @param location Overrides the configured default coordinates — used when
   * collecting for a dynamically discovered organization rather than the
   * static deployment location.
   */
  async collect(location?: LocationOverride): Promise<EnvironmentSnapshot> {
    const collectedAt = new Date().toISOString();
    const events: InputEvent[] = [];
    const failedSources: string[] = [];

    const [weather, traffic] = await Promise.allSettled([
      this.weatherProvider.fetchCurrent(location),
      this.trafficProvider.fetchCurrent(location),
    ]);

    if (weather.status === "fulfilled") {
      events.push(toWeatherEvent(weather.value, collectedAt, this.weatherProvider.name));
    } else {
      failedSources.push(this.weatherProvider.name);
      logger.warn({ err: weather.reason }, "[environment] weather source failed");
    }

    if (traffic.status === "fulfilled") {
      events.push(toTrafficEvent(traffic.value, collectedAt, this.trafficProvider.name));
    } else {
      failedSources.push(this.trafficProvider.name);
      logger.warn({ err: traffic.reason }, "[environment] traffic source failed");
    }

    return { events, collectedAt, failedSources };
  }
}

function toWeatherEvent(
  reading: WeatherReading,
  timestamp: string,
  source: string,
): WeatherInputEvent {
  return {
    id: `weather-${randomUUID()}`,
    type: "input.weather.updated",
    timestamp,
    source,
    payload: {
      location: reading.location,
      condition: reading.condition,
      temperatureC: reading.temperatureC,
      precipitationMm: reading.precipitationMm,
      windKph: reading.windKph,
      humidityPercent: reading.humidityPercent,
      forecast: reading.forecast,
    },
  };
}

function toTrafficEvent(
  reading: TrafficReading,
  timestamp: string,
  source: string,
): TrafficInputEvent {
  return {
    id: `traffic-${randomUUID()}`,
    type: "input.traffic.updated",
    timestamp,
    source,
    payload: {
      location: reading.location,
      congestionLevel: reading.congestionLevel,
      averageSpeedKph: reading.averageSpeedKph,
      travelTimeMinutes: reading.travelTimeMinutes,
      delaySeconds: reading.delaySeconds,
      routeStatus: reading.routeStatus,
    },
  };
}

export const environmentService = new EnvironmentService();
