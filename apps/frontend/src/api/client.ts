import type { ApiResponse, HealthStatus, ReasonTrace, Recommendation } from "@ai-env/contracts";
import { REALTIME_CHANNELS } from "@ai-env/contracts";

/**
 * The seam to the real Backend.
 *
 * The frontend currently renders a local cognitive simulation so the interface
 * can be demonstrated without the full stack running. These functions are the
 * complete, typed path to the live system: flip `USE_MOCK` to false (or set
 * `VITE_USE_MOCK=false`) and the same components render live data, because
 * every component is typed against `@ai-env/contracts` rather than against
 * mock shapes.
 *
 * Endpoints match the Backend built in Milestone 4 exactly.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export interface PlaceSuggestion {
  displayName: string;
  lat: number;
  lng: number;
  boundingBox?: { south: number; west: number; north: number; east: number };
}

interface OsmSearchItem {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
}

export const FAMOUS_LANDMARKS: PlaceSuggestion[] = [
  { displayName: "Times Square, New York, NY, USA", lat: 40.758, lng: -73.9855 },
  { displayName: "Eiffel Tower, Champ de Mars, Paris, France", lat: 48.8584, lng: 2.2945 },
  { displayName: "Tokyo Station, Chiyoda City, Tokyo, Japan", lat: 35.6812, lng: 139.7671 },
  { displayName: "Central Park, New York, NY, USA", lat: 40.7829, lng: -73.9654 },
  { displayName: "Sydney Opera House, Sydney, NSW, Australia", lat: -33.8568, lng: 151.2153 },
  { displayName: "IIT Hyderabad, Kandi, Sangareddy, Telangana, India", lat: 17.5947, lng: 78.1228 },
  { displayName: "Taj Mahal, Agra, Uttar Pradesh, India", lat: 27.1751, lng: 78.0421 },
  { displayName: "Hyderabad, Telangana, India", lat: 17.385, lng: 78.4867 },
  { displayName: "Bengaluru, Karnataka, India", lat: 12.9716, lng: 77.5946 },
  { displayName: "Mumbai, Maharashtra, India", lat: 19.076, lng: 72.8777 },
  { displayName: "New Delhi, Delhi, India", lat: 28.6139, lng: 77.209 },
  { displayName: "Jaipur, Rajasthan, India", lat: 26.9124, lng: 75.7873 },
  { displayName: "Chennai, Tamil Nadu, India", lat: 13.0827, lng: 80.2707 },
  { displayName: "Kolkata, West Bengal, India", lat: 22.5726, lng: 88.3639 },
];

/**
 * Reverse geocodes latitude/longitude coordinates to a human-readable place suggestion.
 */
export async function reverseGeocodeLocation(lat: number, lng: number): Promise<PlaceSuggestion> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "agentic-environment-intelligence/1.0 (hackathon-demo-reverse)",
      },
    });
    const data = await res.json();
    if (data && data.display_name) {
      return {
        displayName: data.display_name,
        lat,
        lng,
        boundingBox: data.boundingbox
          ? {
              south: parseFloat(data.boundingbox[0]),
              north: parseFloat(data.boundingbox[1]),
              west: parseFloat(data.boundingbox[2]),
              east: parseFloat(data.boundingbox[3]),
            }
          : undefined,
      };
    }
  } catch (err) {
    console.warn("Reverse geocoding failed", err);
  }
  return {
    displayName: `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    lat,
    lng,
  };
}

/**
 * Autocomplete place suggestions fetched dynamically from OpenStreetMap Nominatim search API worldwide.
 * Debounced in the UI layer to prevent hitting OSM API limits.
 */
export async function fetchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "agentic-environment-intelligence/1.0 (hackathon-demo-autocomplete)",
      },
    });
    const data = (await res.json()) as OsmSearchItem[];
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      boundingBox: item.boundingbox
        ? {
            south: parseFloat(item.boundingbox[0]),
            north: parseFloat(item.boundingbox[1]),
            west: parseFloat(item.boundingbox[2]),
            east: parseFloat(item.boundingbox[3]),
          }
        : undefined,
    }));
  } catch (err) {
    console.error("Failed to fetch autocomplete suggestions", err);
    return [];
  }
}

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Default request budget for live-mode calls — the live cognitive cycle
 * loops on this, so an unbounded `fetch()` (no timeout by default) would
 * hang the whole spine forever the moment the Backend or AI Core stalls. */
const DEFAULT_TIMEOUT_MS = 8000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetchWithTimeout(`${API_BASE}/health`);
  const body = (await res.json()) as ApiResponse<HealthStatus>;
  if (!body.success) throw new Error(body.error.message);
  return body.data;
}

interface PipelineResult {
  status: "ok" | "degraded" | "failed";
  recommendation?: Recommendation;
  eventCount: number;
  failedSources: string[];
  error?: string;
}

/** Triggers one Backend pipeline cycle: collect -> normalize -> AI Core -> broadcast. */
export async function triggerEnvironmentRefresh(): Promise<PipelineResult> {
  const res = await fetchWithTimeout(`${API_BASE}/api/v1/environment/refresh`, {
    method: "POST",
  });
  const body = (await res.json()) as ApiResponse<PipelineResult>;
  if (!body.success) throw new Error(body.error.message);
  return body.data;
}

/**
 * The full multi-agent cognitive trace behind the most recent recommendation
 * — every Expert Agent's vote, not just the final answer. Powers the live
 * branch of `useCognitiveCycle` (see that file for how USE_MOCK gates it).
 */
export async function fetchLatestTrace(): Promise<ReasonTrace> {
  const res = await fetchWithTimeout(`${API_BASE}/api/v1/trace/latest`);
  const body = (await res.json()) as ApiResponse<ReasonTrace>;
  if (!body.success) throw new Error(body.error.message);
  return body.data;
}

export interface OrganizationDiscoveryResult {
  organization: {
    queryName: string;
    resolvedName: string;
    osmId?: string;
    center: { lat: number; lng: number };
    boundingBox: { south: number; west: number; north: number; east: number };
  };
  source: "live" | "cache" | "fallback";
  entityCount: number;
  pipeline: {
    status: "ok" | "degraded" | "failed";
    recommendation?: Recommendation;
    error?: string;
  };
}

/**
 * Discover an organization by name: resolves its physical footprint via OSM,
 * combines that with live weather and traffic at its location, runs the full
 * AI Core reasoning pipeline, and returns the resulting recommendation.
 *
 * Pass an AbortSignal to support cancellation — the hook wires this to an
 * AbortController so the user can cancel mid-flight without memory leaks.
 */
export async function discoverOrganization(
  name: string,
  center?: { lat: number; lng: number },
  boundingBox?: { south: number; west: number; north: number; east: number },
  signal?: AbortSignal,
): Promise<OrganizationDiscoveryResult> {
  const res = await fetch(`${API_BASE}/api/v1/organization/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, center, boundingBox }),
    signal,
  });
  const body = (await res.json()) as ApiResponse<OrganizationDiscoveryResult>;
  if (!body.success) throw new Error(body.error.message);
  return body.data;
}

/**
 * Fallback path when `discoverOrganization` can't resolve a name via OSM
 * geocoding: extracts a lat/lng pin from a pasted Google Maps link instead.
 * The caller retries `discoverOrganization` with the returned point as
 * `center`, bypassing name-based geocoding entirely — see useDiscovery.ts.
 */
export async function resolveMapsLink(url: string): Promise<{ lat: number; lng: number }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/v1/organization/resolve-maps-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const body = (await res.json()) as ApiResponse<{ center: { lat: number; lng: number } }>;
  if (!body.success) throw new Error(body.error.message);
  return body.data.center;
}

/**
 * Realtime channel names, re-exported from the shared contracts so the
 * subscription layer cannot drift from what the Backend actually emits.
 *
 * Socket.IO's client is intentionally not a dependency of this milestone —
 * the approved stack for the frontend does not include it. Wiring it up is a
 * single `io()` call subscribing to these three channels and pushing the
 * payloads into the same Zustand store the mock engine writes to.
 */
export const CHANNELS = REALTIME_CHANNELS;
