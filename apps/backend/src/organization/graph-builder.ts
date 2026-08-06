import type { GeoLocation, WorldEntity } from "@ai-env/contracts";

const EARTH_RADIUS_M = 6_371_000;
const NEAREST_NEIGHBOR_COUNT = 4;

/**
 * The "Organization Knowledge Graph", scoped to V1: adjacency and distance
 * only. Deliberately not pathfinding, routing, or a real graph data structure
 * with its own domain type — each entity's nearest neighbors and their
 * distances are baked directly into its existing `attributes` bag under
 * `connectivity`, so no new domain model is introduced and nothing downstream
 * of WorldState needs to change to receive it. A future milestone that wants
 * real pathfinding builds it on top of this, not instead of it.
 */
export interface Connectivity {
  nearestEntityIds: string[];
  distancesMeters: Record<string, number>;
}

function isGeoLocation(location: WorldEntity["location"]): location is GeoLocation {
  return typeof location === "object" && location !== null && "lat" in location;
}

function haversineMeters(a: GeoLocation, b: GeoLocation): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * O(n^2) by design: organization-scale entity counts (capped at
 * ORG_MAX_ENTITIES, typically tens to low hundreds) make a spatial index
 * unnecessary complexity for the nearest-neighbor lookups this needs.
 */
export function attachConnectivity(entities: WorldEntity[]): WorldEntity[] {
  const located = entities
    .map((entity, index) => ({ entity, index, location: entity.location }))
    .filter((e): e is { entity: WorldEntity; index: number; location: GeoLocation } =>
      isGeoLocation(e.location),
    );

  return entities.map((entity, index) => {
    if (!isGeoLocation(entity.location)) return entity;
    const origin = entity.location;

    const neighbors = located
      .filter((other) => other.index !== index)
      .map((other) => ({
        id: other.entity.id,
        distanceMeters: Math.round(haversineMeters(origin, other.location)),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, NEAREST_NEIGHBOR_COUNT);

    const connectivity: Connectivity = {
      nearestEntityIds: neighbors.map((n) => n.id),
      distancesMeters: Object.fromEntries(neighbors.map((n) => [n.id, n.distanceMeters])),
    };

    return { ...entity, attributes: { ...entity.attributes, connectivity } };
  });
}
