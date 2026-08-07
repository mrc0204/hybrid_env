import { requestJson } from "../clients/http";
import { env } from "../config/env";
import { logger } from "../logging/logger";
import type { BoundingBox, OverpassElement, OverpassResponse } from "./types";

/**
 * Overpass is a mirrored service: several independent public servers each
 * answer against the same live OpenStreetMap planet database. The main
 * instance (overpass-api.de) is the most heavily loaded and frequently
 * returns 504 "server too busy" — so when it does, the same query is retried
 * against the other official mirrors. This is not a fallback to stale or
 * synthesized data; every endpoint returns the same real, current OSM data.
 *
 * The configured OVERPASS_URL is always tried first (so an override still
 * wins); the rest are appended and de-duplicated.
 *
 * Public-instance courtesy still applies — these are queried at most a handful
 * of times per organization, ever (see cache.ts), and only in sequence on
 * failure, never fanned out in parallel.
 */
// Order matters: after the configured primary, the mirrors most consistently
// answering full-planet queries come first, so a busy primary costs only one
// extra hop before hitting a healthy server.
const OVERPASS_MIRRORS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function overpassEndpoints(): string[] {
  return [...new Set([env.OVERPASS_URL, ...OVERPASS_MIRRORS])];
}

/**
 * One combined query for every entity category the Organization Understanding
 * Engine cares about, scoped to the org's bounding box via the global `[bbox]`
 * setting. A single request keeps this within the "handful of calls per
 * organization, ever" budget public Overpass instances need to be treated
 * with — see `cache.ts` for why that budget matters.
 *
 * `out center tags` returns a centroid for ways (buildings, roads) instead of
 * full polygon geometry: WorldEntity.location wants one point, not a shape,
 * and skipping geometry keeps the response small and fast.
 */
function buildQuery(bbox: BoundingBox): string {
  return `[out:json][timeout:${env.OVERPASS_QUERY_TIMEOUT_S}][bbox:${bbox.south},${bbox.west},${bbox.north},${bbox.east}];
(
  way[building];
  way[highway];
  way[amenity=parking];
  node[amenity];
  node[barrier=gate];
  node[entrance];
);
out center tags;`;
}

export async function fetchOrganizationInfrastructure(
  bbox: BoundingBox,
): Promise<OverpassElement[]> {
  const query = buildQuery(bbox);
  const endpoints = overpassEndpoints();
  let lastError: unknown;

  for (const [index, url] of endpoints.entries()) {
    try {
      const response = await requestJson<OverpassResponse>(url, {
        method: "POST",
        body: query,
        // Overpass returns 406 for requests with no identifying User-Agent —
        // same reasoning as the Nominatim client.
        headers: { "content-type": "text/plain", "User-Agent": env.NOMINATIM_USER_AGENT },
        timeoutMs: env.OVERPASS_TIMEOUT_MS,
        // One retry against the primary absorbs a transient blip; the mirrors
        // are single-shot because moving on to the next server is itself the
        // retry, and cheaper than waiting out a backoff on a busy one.
        maxRetries: index === 0 ? 1 : 0,
        label: `Overpass infrastructure query (${new URL(url).host})`,
      });

      if (index > 0) {
        logger.info(
          { host: new URL(url).host },
          "[overpass] primary was unavailable — served by mirror",
        );
      }
      return response.elements;
    } catch (err) {
      lastError = err;
      logger.warn(
        { err, host: new URL(url).host, remaining: endpoints.length - index - 1 },
        "[overpass] endpoint failed — trying next mirror",
      );
    }
  }

  // Every live mirror was unreachable. Surface it so OrganizationService can
  // decide how to degrade (see its handling) rather than swallowing it here.
  throw lastError instanceof Error
    ? lastError
    : new Error("All Overpass endpoints failed");
}
