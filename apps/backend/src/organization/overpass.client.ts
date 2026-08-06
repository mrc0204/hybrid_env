import { requestJson } from "../clients/http";
import { env } from "../config/env";
import type { BoundingBox, OverpassElement, OverpassResponse } from "./types";

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
  const response = await requestJson<OverpassResponse>(env.OVERPASS_URL, {
    method: "POST",
    body: buildQuery(bbox),
    // Overpass returns 406 for requests with no identifying User-Agent —
    // same reasoning as the Nominatim client.
    headers: { "content-type": "text/plain", "User-Agent": env.NOMINATIM_USER_AGENT },
    timeoutMs: env.OVERPASS_TIMEOUT_MS,
    maxRetries: 1,
    label: "Overpass infrastructure query",
  });

  return response.elements;
}
