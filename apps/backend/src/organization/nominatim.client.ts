import { requestJson } from "../clients/http";
import { env } from "../config/env";
import type { BoundingBox, OrganizationProfile } from "./types";

interface NominatimResult {
  display_name: string;
  osm_id: number;
  osm_type: string;
  lat: string;
  lon: string;
  /** [south, north, west, east] as strings, Nominatim's own peculiar order. */
  boundingbox: [string, string, string, string];
}

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1000;

/**
 * Nominatim's usage policy caps public requests at 1/second and blocks
 * clients that don't self-throttle. This is a single backend process, so an
 * in-memory timestamp is a sufficient rate limiter — no external queue needed.
 */
async function throttle(): Promise<void> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

/**
 * Resolves an organization name to coordinates and a bounding box.
 * Returns null (not a throw) when nothing matches — an unrecognized
 * organization name is an expected outcome, not an error.
 */
export async function geocodeOrganization(name: string): Promise<OrganizationProfile | null> {
  await throttle();

  const url = `${env.NOMINATIM_URL}?q=${encodeURIComponent(name)}&format=json&limit=1&addressdetails=0`;

  const results = await requestJson<NominatimResult[]>(url, {
    headers: { "User-Agent": env.NOMINATIM_USER_AGENT },
    timeoutMs: env.NOMINATIM_TIMEOUT_MS,
    maxRetries: 1,
    label: "Nominatim geocode",
  });

  const match = results[0];
  if (!match) return null;

  const [south, north, west, east] = match.boundingbox.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const boundingBox: BoundingBox = { south, west, north, east };

  return {
    queryName: name,
    resolvedName: match.display_name,
    osmId: `${match.osm_type}/${match.osm_id}`,
    center: { lat: Number(match.lat), lng: Number(match.lon) },
    boundingBox,
  };
}
