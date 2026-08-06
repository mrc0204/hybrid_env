import type { BaseEvent } from "./base";
import type { UserContext } from "../domain";

/**
 * Input events are raw signals entering the system from the outside world
 * (weather APIs, traffic feeds, campus announcements, user context changes).
 * They are what the AI Core's Environment Ingestion stage consumes.
 */

export interface WeatherInputEvent extends BaseEvent<"input.weather.updated"> {
  payload: {
    location: string;
    condition: string;
    temperatureC: number;
    precipitationMm: number;
    windKph: number;
  };
}

export interface TrafficInputEvent extends BaseEvent<"input.traffic.updated"> {
  payload: {
    location: string;
    congestionLevel: "low" | "medium" | "high";
    averageSpeedKph?: number;
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
