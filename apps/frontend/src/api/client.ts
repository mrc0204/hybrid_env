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
  { displayName: "Taj Mahal, Agra, Uttar Pradesh, India", lat: 27.1751, lng: 78.0421 },
  { displayName: "India Gate, Rajpath, New Delhi, Delhi, India", lat: 28.6129, lng: 77.2295 },
  { displayName: "Charminar, Hyderabad, Telangana, India", lat: 17.3616, lng: 78.4747 },
  { displayName: "Gateway of India, Mumbai, Maharashtra, India", lat: 18.922, lng: 72.8347 },
  { displayName: "IIT Hyderabad, Kandi, Sangareddy, Telangana, India", lat: 17.5947, lng: 78.1228 },
  { displayName: "Hawa Mahal, Jaipur, Rajasthan, India", lat: 26.9239, lng: 75.8267 },
  { displayName: "Red Fort, Netaji Subhash Marg, Delhi, India", lat: 28.6562, lng: 77.241 },
  { displayName: "Qutub Minar, New Delhi, Delhi, India", lat: 28.5245, lng: 77.1855 },
];

/**
 * Autocomplete place suggestions fetched from the OpenStreetMap Nominatim search API.
 * Debounced in the UI layer to prevent hitting OSM API limits.
 * Bound strictly to countrycodes=in (India).
 */
export async function fetchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5&countrycodes=in&addressdetails=1`;
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
