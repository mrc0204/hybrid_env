import { logger } from "../logging/logger";
import { attachConnectivity } from "./graph-builder";
import { readCache, writeCache } from "./cache";
import { geocodeOrganization } from "./nominatim.client";
import { normalizeOsmElements } from "./osm-normalizer";
import { fetchOrganizationInfrastructure } from "./overpass.client";
import { loadFallbackGraph } from "./fallback-graph";
import type { OrganizationDiscoveryResult, BoundingBox } from "./types";
import { AppError } from "../errors/app-error";

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

  async discover(
    name: string,
    center?: { lat: number; lng: number },
    boundingBox?: BoundingBox,
  ): Promise<OrganizationDiscoveryResult> {
    const cached = await this.cacheReader(name);
    if (cached) {
      logger.info({ name }, "[organization] cache hit — no external requests made");
      return { profile: cached.profile, entities: cached.entities, source: "cache" };
    }

    try {
      let profile;
      if (center && boundingBox) {
        // Use coordinates passed directly from frontend geocoded suggestions
        profile = {
          queryName: name,
          resolvedName: name,
          center,
          boundingBox,
        };
      } else {
        profile = await this.geocode(name);
      }

      if (!profile) {
        // Only allow silent fallback to default demo data for default campus searches
        const isDefaultCampus =
          name.toLowerCase().includes("niat") ||
          name.toLowerCase().includes("kkh") ||
          name.toLowerCase().includes("south gate");

        if (isDefaultCampus) {
          logger.warn({ name }, "[organization] no geocoding match — using fallback graph");
          return this.fallback();
        }

        logger.warn({ name }, "[organization] no geocoding match");
        throw AppError.notFound(`Could not resolve location coordinates for "${name}". Please choose from the search suggestions.`);
      }

      const elements = await this.fetchInfrastructure(profile.boundingBox);
      const entities = attachConnectivity(normalizeOsmElements(elements));

      await this.cacheWriter(name, profile, entities);

      logger.info({ name, entityCount: entities.length }, "[organization] live discovery complete");
      return { profile, entities, source: "live" };
    } catch (err) {
      const isDefaultCampus =
        name.toLowerCase().includes("niat") ||
        name.toLowerCase().includes("kkh") ||
        name.toLowerCase().includes("south gate");

      if (isDefaultCampus) {
        logger.warn({ err, name }, "[organization] live discovery failed — using fallback graph");
        return this.fallback();
      }

      if (err instanceof AppError) {
        throw err;
      }
      logger.warn({ err, name }, "[organization] live discovery failed");
      throw new AppError(500, "DISCOVERY_FAILED", `Failed to complete discovery for "${name}".`);
    }
  }
}

export const organizationService = new OrganizationService();
