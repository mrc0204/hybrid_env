import { logger } from "../logging/logger";
import { attachConnectivity } from "./graph-builder";
import { readCache, writeCache } from "./cache";
import { geocodeOrganization } from "./nominatim.client";
import { normalizeOsmElements } from "./osm-normalizer";
import { fetchOrganizationInfrastructure } from "./overpass.client";
import { loadFallbackGraph } from "./fallback-graph";
import type { OrganizationDiscoveryResult } from "./types";

type GeocodeFn = typeof geocodeOrganization;
type FetchInfrastructureFn = typeof fetchOrganizationInfrastructure;
type ReadCacheFn = typeof readCache;
type WriteCacheFn = typeof writeCache;
type LoadFallbackFn = typeof loadFallbackGraph;

/**
 * Orchestrates the Organization Understanding Engine: cache -> live discovery
 * -> fallback. This is the one place that decides which of those three paths
 * ran, and every path returns the same shape with an honest `source` tag —
 * nothing downstream has to guess where the data came from.
 *
 * Never throws. A hackathon demo cannot be allowed to fail because a public
 * geocoding or OSM API had a bad moment; every failure mode collapses to the
 * bundled fallback graph instead of an error response.
 */
export class OrganizationService {
  constructor(
    private readonly geocode: GeocodeFn = geocodeOrganization,
    private readonly fetchInfrastructure: FetchInfrastructureFn = fetchOrganizationInfrastructure,
    private readonly cacheReader: ReadCacheFn = readCache,
    private readonly cacheWriter: WriteCacheFn = writeCache,
    private readonly fallback: LoadFallbackFn = loadFallbackGraph,
  ) {}

  async discover(name: string): Promise<OrganizationDiscoveryResult> {
    const cached = await this.cacheReader(name);
    if (cached) {
      logger.info({ name }, "[organization] cache hit — no external requests made");
      return { profile: cached.profile, entities: cached.entities, source: "cache" };
    }

    try {
      const profile = await this.geocode(name);
      if (!profile) {
        logger.warn({ name }, "[organization] no geocoding match — using fallback graph");
        return this.fallback();
      }

      const elements = await this.fetchInfrastructure(profile.boundingBox);
      // A sparse or empty result is still a legitimate live discovery — the
      // organization resolved and OSM was queried, it just has little mapped
      // infrastructure. That is different from a failure and should not fall
      // back to a whole different (and misleadingly-named) demo campus.
      const entities = attachConnectivity(normalizeOsmElements(elements));

      await this.cacheWriter(name, profile, entities);

      logger.info({ name, entityCount: entities.length }, "[organization] live discovery complete");
      return { profile, entities, source: "live" };
    } catch (err) {
      logger.warn({ err, name }, "[organization] live discovery failed — using fallback graph");
      return this.fallback();
    }
  }
}

export const organizationService = new OrganizationService();
