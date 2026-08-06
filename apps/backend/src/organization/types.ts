import type { GeoLocation, Recommendation, WorldEntity } from "@ai-env/contracts";

/**
 * Internal types for the Organization Understanding Engine.
 *
 * None of these are shared contracts — they exist only to move data between
 * this module's own stages. The only thing that crosses the boundary into the
 * rest of the system is `WorldEntity[]`, via `OrganizationContextInputEvent`.
 * This keeps every other module provider-agnostic: nothing outside this
 * folder knows these shapes came from OpenStreetMap.
 */

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface OrganizationProfile {
  /** What the user typed. */
  queryName: string;
  /** Nominatim's resolved display name. */
  resolvedName: string;
  osmId?: string;
  center: GeoLocation;
  boundingBox: BoundingBox;
}

export type DiscoverySource = "live" | "cache" | "fallback";

export interface OrganizationDiscoveryResult {
  profile: OrganizationProfile;
  entities: WorldEntity[];
  source: DiscoverySource;
}

/** Discovery metadata plus the recommendation the pipeline produced from it. */
export interface OrganizationDiscoveryResponse {
  organization: OrganizationProfile;
  source: DiscoverySource;
  entityCount: number;
  pipeline: {
    status: "ok" | "degraded" | "failed";
    recommendation?: Recommendation;
    error?: string;
  };
}

/** Raw shape of one Overpass `out center tags` element — a way or a node. */
export interface OverpassElement {
  type: "way" | "node" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  elements: OverpassElement[];
}
