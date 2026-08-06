import type { WorldEntity } from "@ai-env/contracts";

import { env } from "../config/env";
import type { OverpassElement } from "./types";

/**
 * OpenStreetMap tags -> our normalized entity vocabulary. This is the one
 * place OSM-specific knowledge exists; everything downstream (including the
 * AI Core) only ever sees `WorldEntity`.
 *
 * OSM tags are reused directly as `attributes` rather than remapped into a
 * bespoke shape — WorldEntity.attributes is documented as a free-form,
 * type-specific bag for exactly this reason, and re-keying every OSM tag
 * would add a translation layer with no informational benefit.
 */
function classify(tags: Record<string, string>): { type: string; label: string } | null {
  if (tags.building) return { type: "building", label: tags.name ?? humanize(tags.building) };
  if (tags.amenity === "parking") return { type: "parking", label: tags.name ?? "Parking" };
  if (tags.barrier === "gate") return { type: "gate", label: tags.name ?? "Gate" };
  if (tags.entrance) return { type: "entrance", label: tags.name ?? "Entrance" };
  if (["footway", "path", "pedestrian"].includes(tags.highway ?? "")) {
    return { type: "footpath", label: tags.name ?? "Footpath" };
  }
  if (tags.highway) return { type: "road", label: tags.name ?? humanize(tags.highway) };
  if (tags.amenity) return { type: "amenity", label: tags.name ?? humanize(tags.amenity) };
  return null;
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveLocation(el: OverpassElement): { lat: number; lng: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

/**
 * Converts raw Overpass elements into WorldEntity objects. Elements with no
 * usable tags or no resolvable location are skipped, not errored — partial
 * or messy OSM data is the normal case, not an exception.
 */
/**
 * Entity types the Dijkstra router builds its graph from. They are kept ahead
 * of everything else when the cap bites: a truncation that happens to drop
 * every road leaves the router with nothing to route over, and it correctly
 * refuses to invent a path — so the whole spatial reasoning step silently
 * disappears. Amenities are the most numerous thing OSM returns and would
 * otherwise crowd the network out entirely.
 */
const ROUTABLE_TYPES = new Set(["road", "footpath", "gate", "entrance"]);

export function normalizeOsmElements(elements: OverpassElement[]): WorldEntity[] {
  const now = new Date().toISOString();
  const routable: WorldEntity[] = [];
  const rest: WorldEntity[] = [];

  for (const el of elements) {
    if (!el.tags) continue;

    const classified = classify(el.tags);
    if (!classified) continue;

    const location = resolveLocation(el);
    if (!location) continue;

    const entity: WorldEntity = {
      id: `osm-${el.type}-${el.id}`,
      type: classified.type,
      label: classified.label,
      location,
      attributes: { ...el.tags },
      updatedAt: now,
    };

    (ROUTABLE_TYPES.has(classified.type) ? routable : rest).push(entity);

    // Nothing more can change the outcome once both buckets together can
    // fill the cap with routable entities already prioritised.
    if (routable.length >= env.ORG_MAX_ENTITIES) break;
  }

  return [...routable, ...rest].slice(0, env.ORG_MAX_ENTITIES);
}
