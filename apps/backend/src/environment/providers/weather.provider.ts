import { requestJson } from "../../clients/http";
import { env } from "../../config/env";

/**
 * Normalized weather reading — provider-agnostic. Adding a second weather
 * source means writing another WeatherProvider, not touching anything
 * downstream.
 */
export interface WeatherReading {
  location: string;
  condition: WeatherCondition;
  temperatureC: number;
  precipitationMm: number;
  windKph: number;
  humidityPercent: number;
  forecast: { time: string; temperatureC: number; precipitationProbability: number }[];
}

export interface WeatherProvider {
  readonly name: string;
  fetchCurrent(): Promise<WeatherReading>;
}

/**
 * The exact vocabulary the AI Core's Risk Engine matches on. Normalizing into
 * these strings is what lets rain actually trigger a risk — a provider-native
 * code like WMO 65 would silently match nothing.
 */
export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "fog"
  | "light_rain"
  | "moderate_rain"
  | "heavy_rain"
  | "snow"
  | "thunderstorm";

/**
 * WMO weather interpretation codes -> our condition vocabulary.
 * Reference groupings: 0 clear; 1-3 cloud cover; 45/48 fog; 51-57 drizzle;
 * 61/63/65 rain (light/moderate/heavy); 66-67 freezing rain; 71-77 snow;
 * 80-82 rain showers (violent at 82); 85-86 snow showers; 95-99 thunderstorm.
 */
export function mapWmoCodeToCondition(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "light_rain";
  if (code === 61 || code === 80) return "light_rain";
  if (code === 63 || code === 81) return "moderate_rain";
  if (code === 65 || code === 82) return "heavy_rain";
  if (code === 66 || code === 67) return "moderate_rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunderstorm";
  return "cloudy";
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
  };
}

/**
 * Open-Meteo needs no API key, which is why it's the default: the pipeline
 * works on a fresh clone with no credentials configured.
 */
export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly name = "open-meteo";

  async fetchCurrent(): Promise<WeatherReading> {
    const url =
      `${env.WEATHER_API_URL}?latitude=${env.ENVIRONMENT_LATITUDE}` +
      `&longitude=${env.ENVIRONMENT_LONGITUDE}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code` +
      `&hourly=temperature_2m,precipitation_probability&forecast_days=1`;

    const raw = await requestJson<OpenMeteoResponse>(url, {
      timeoutMs: env.EXTERNAL_API_TIMEOUT_MS,
      maxRetries: 1,
      label: "Open-Meteo weather",
    });

    const current = raw.current ?? {};
    return {
      location: env.ENVIRONMENT_LOCATION_NAME,
      condition: mapWmoCodeToCondition(current.weather_code ?? 0),
      temperatureC: current.temperature_2m ?? 0,
      precipitationMm: current.precipitation ?? 0,
      windKph: current.wind_speed_10m ?? 0,
      humidityPercent: current.relative_humidity_2m ?? 0,
      forecast: buildForecast(raw),
    };
  }
}

function buildForecast(raw: OpenMeteoResponse): WeatherReading["forecast"] {
  const times = raw.hourly?.time ?? [];
  const temps = raw.hourly?.temperature_2m ?? [];
  const probabilities = raw.hourly?.precipitation_probability ?? [];

  // Next 6 hours is enough for "should I leave earlier?" decisions.
  return times.slice(0, 6).map((time, index) => ({
    time,
    temperatureC: temps[index] ?? 0,
    precipitationProbability: probabilities[index] ?? 0,
  }));
}
