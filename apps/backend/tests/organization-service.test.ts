import type { WorldEntity } from "@ai-env/contracts";
import { describe, expect, it, vi } from "vitest";

import { OrganizationService } from "../src/organization/organization.service";
import type { CachedOrganization } from "../src/organization/cache";
import type { OrganizationDiscoveryResult, OrganizationProfile } from "../src/organization/types";

/**
 * Every failure mode in this file mirrors a bullet in the V1 spec: unknown
 * organizations, Nominatim failure, Overpass failure, cache hits, and
 * fallback behavior. Each assertion also checks that no unnecessary network
 * call was made — the whole point of the cache/fallback design is staying
 * inside a very small live-request budget.
 */

const PROFILE: OrganizationProfile = {
  queryName: "Test Org",
  resolvedName: "Test Org, Somewhere",
  center: { lat: 1, lng: 2 },
  boundingBox: { south: 0, west: 0, north: 2, east: 2 },
};

const ENTITIES: WorldEntity[] = [
  {
    id: "e1",
    type: "building",
    label: "Block A",
    location: { lat: 1, lng: 2 },
    attributes: {},
    updatedAt: "now",
  },
];

const FALLBACK_RESULT: OrganizationDiscoveryResult = {
  profile: { ...PROFILE, queryName: "fallback", resolvedName: "Bundled Demo Org" },
  entities: [],
  source: "fallback",
};

function buildService(overrides: {
  geocode?: () => Promise<OrganizationProfile | null>;
  fetchInfrastructure?: () => Promise<unknown[]>;
  cacheReader?: () => Promise<CachedOrganization | null>;
  cacheWriter?: () => Promise<void>;
}) {
  const geocode = vi.fn(overrides.geocode ?? (() => Promise.resolve(PROFILE)));
  const fetchInfrastructure = vi.fn(overrides.fetchInfrastructure ?? (() => Promise.resolve([])));
  const cacheReader = vi.fn(overrides.cacheReader ?? (() => Promise.resolve(null)));
  const cacheWriter = vi.fn(overrides.cacheWriter ?? (() => Promise.resolve()));
  const fallback = vi.fn(() => FALLBACK_RESULT);

  const service = new OrganizationService(
    geocode as never,
    fetchInfrastructure as never,
    cacheReader as never,
    cacheWriter as never,
    fallback,
  );

  return { service, geocode, fetchInfrastructure, cacheReader, cacheWriter, fallback };
}

describe("OrganizationService.discover", () => {
  it("returns cached data and makes zero external calls on a cache hit", async () => {
    const cached: CachedOrganization = { profile: PROFILE, entities: ENTITIES, cachedAt: "now" };
    const { service, geocode, fetchInfrastructure, cacheWriter, fallback } = buildService({
      cacheReader: () => Promise.resolve(cached),
    });

    const result = await service.discover("Test Org");

    expect(result.source).toBe("cache");
    expect(result.entities).toEqual(ENTITIES);
    expect(geocode).not.toHaveBeenCalled();
    expect(fetchInfrastructure).not.toHaveBeenCalled();
    expect(cacheWriter).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });

  it("performs live discovery on a cache miss and writes the result back", async () => {
    const { service, cacheWriter, fallback } = buildService({
      fetchInfrastructure: () =>
        Promise.resolve([
          { type: "way", id: 1, tags: { building: "yes" }, center: { lat: 1, lon: 2 } },
        ]),
    });

    const result = await service.discover("Test Org");

    expect(result.source).toBe("live");
    expect(result.entities).toHaveLength(1);
    expect(cacheWriter).toHaveBeenCalledOnce();
    expect(fallback).not.toHaveBeenCalled();
  });

  it("throws rather than silently substituting demo data for an unknown organization", async () => {
    const { service, fetchInfrastructure, cacheWriter, fallback } = buildService({
      geocode: () => Promise.resolve(null),
    });

    // Deliberately not a silent fallback: answering a search for one place
    // with the bundled campus graph would present demo data as if it were
    // that place. The user is told to pick a suggestion instead.
    await expect(service.discover("Not A Real Place")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    expect(fetchInfrastructure).not.toHaveBeenCalled();
    expect(cacheWriter).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });

  it("still serves the bundled graph for the default campus when geocoding finds nothing", async () => {
    const { service, fallback } = buildService({
      geocode: () => Promise.resolve(null),
    });

    // The one case where substituting bundled data is honest — it *is* the
    // demo campus, so the demo keeps working with no network at all.
    const result = await service.discover("NIAT KKH Campus");

    expect(result.source).toBe("fallback");
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("throws when Nominatim fails for a non-default organization", async () => {
    const { service, fallback } = buildService({
      geocode: () => Promise.reject(new Error("Nominatim unreachable")),
    });

    await expect(service.discover("Test Org")).rejects.toMatchObject({
      code: "DISCOVERY_FAILED",
    });
    expect(fallback).not.toHaveBeenCalled();
  });

  it("degrades to zero entities when Overpass fails, rather than failing the request", async () => {
    const { service, cacheWriter, fallback } = buildService({
      fetchInfrastructure: () => Promise.reject(new Error("Overpass timed out")),
    });

    // Infrastructure enriches the world model but isn't required for it:
    // live weather + traffic still yield a complete recommendation. Overpass
    // is a free, frequently-overloaded public API, so this path is common.
    const result = await service.discover("Test Org");

    expect(result.source).toBe("live");
    expect(result.entities).toHaveLength(0);
    // Not cached — a later request should retry Overpass rather than pin
    // the degraded result for the whole cache TTL.
    expect(cacheWriter).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });

  it("treats a live result with zero matched entities as sparse, not a failure", async () => {
    const { service, fallback } = buildService({
      fetchInfrastructure: () => Promise.resolve([]),
    });

    const result = await service.discover("Test Org");

    expect(result.source).toBe("live");
    expect(result.entities).toEqual([]);
    expect(fallback).not.toHaveBeenCalled();
  });
});
