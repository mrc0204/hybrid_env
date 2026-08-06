import type { BaseEvent } from "./base";
import type { UserContext } from "../domain";

/**
 * Input events are raw signals entering the system from the outside world
 * (weather APIs, traffic feeds, campus announcements, user context changes).
 * They are what the AI Core's Environment Ingestion stage consumes.
 */

/**
 * Short-horizon forecast point. Kept minimal — the Risk Engine only needs to
 * know whether conditions are about to worsen, not a full meteorological model.
 */
export interface WeatherForecastPoint {
  time: string;
  temperatureC: number;
  precipitationProbability: number;
}

export interface WeatherInputEvent extends BaseEvent<"input.weather.updated"> {
  payload: {
    location: string;
    /**
     * Normalized condition vocabulary the AI Core's Risk Engine keys off:
     * "clear" | "cloudy" | "fog" | "light_rain" | "moderate_rain" |
     * "heavy_rain" | "snow" | "thunderstorm". Providers must map their own
     * codes into these values during normalization.
     */
    condition: string;
    temperatureC: number;
    precipitationMm: number;
    windKph: number;
    humidityPercent?: number;
    forecast?: WeatherForecastPoint[];
  };
}

export interface TrafficInputEvent extends BaseEvent<"input.traffic.updated"> {
  payload: {
    location: string;
    congestionLevel: "low" | "medium" | "high";
    averageSpeedKph?: number;
    travelTimeMinutes?: number;
    /** Delay versus free-flow conditions, in seconds. */
    delaySeconds?: number;
    routeStatus?: "open" | "closed";
  };
}

export interface AnnouncementInputEvent extends BaseEvent<"input.announcement.created"> {
  payload: {
    title: string;
    body: string;
    category: string;
  };
}

export interface UserContextInputEvent extends BaseEvent<"input.user.context_changed"> {
  payload: {
    userContext: UserContext;
  };
}

export type InputEvent =
  WeatherInputEvent | TrafficInputEvent | AnnouncementInputEvent | UserContextInputEvent;

export type InputEventType = InputEvent["type"];
