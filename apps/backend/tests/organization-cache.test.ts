import { promises as fs } from "node:fs";
import path from "node:path";

import type { WorldEntity } from "@ai-env/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { env } from "../src/config/env";
import { readCache, writeCache } from "../src/organization/cache";
import type { OrganizationProfile } from "../src/organization/types";

const PROFILE: OrganizationProfile = {
  queryName: "Cache Test Org",
  resolvedName: "Cache Test Org, Somewhere",
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

// vitest.config.ts points ORG_CACHE_DIR at a dedicated test directory so this
// never touches real discovery data.
afterEach(async () => {
  await fs.rm(env.ORG_CACHE_DIR, { recursive: true, force: true });
});

describe("organization cache", () => {
  it("returns null for an organization that was never cached", async () => {
    expect(await readCache("Never Cached Org")).toBeNull();
  });

  it("round-trips a write through a read", async () => {
    await writeCache(PROFILE.queryName, PROFILE, ENTITIES);

    const result = await readCache(PROFILE.queryName);

    expect(result?.profile).toEqual(PROFILE);
    expect(result?.entities).toEqual(ENTITIES);
  });

  it("is keyed independent of case and surrounding whitespace", async () => {
    await writeCache("  Some Org  ", PROFILE, ENTITIES);

    expect(await readCache("some org")).not.toBeNull();
  });

  it("treats an expired entry as a miss", async () => {
    const stalePath = path.join(env.ORG_CACHE_DIR, "stale-org.json");
    await fs.mkdir(env.ORG_CACHE_DIR, { recursive: true });
    await fs.writeFile(
      stalePath,
      JSON.stringify({
        profile: PROFILE,
        entities: ENTITIES,
        cachedAt: new Date(Date.now() - env.ORG_CACHE_TTL_MS - 1000).toISOString(),
      }),
      "utf-8",
    );

    expect(await readCache("stale org")).toBeNull();
  });

  it("treats malformed cache files as a miss rather than throwing", async () => {
    await fs.mkdir(env.ORG_CACHE_DIR, { recursive: true });
    await fs.writeFile(
      path.join(env.ORG_CACHE_DIR, "broken-org.json"),
      "{ not valid json",
      "utf-8",
    );

    await expect(readCache("broken org")).resolves.toBeNull();
  });
});

describe("organization cache write failure", () => {
  beforeEach(async () => {
    await fs.rm(env.ORG_CACHE_DIR, { recursive: true, force: true });
  });

  it("does not throw when the cache directory cannot be created", async () => {
    // Create a file where the cache dir needs to be a directory, so mkdir fails.
    await fs.mkdir(path.dirname(env.ORG_CACHE_DIR), { recursive: true });
    await fs.writeFile(env.ORG_CACHE_DIR, "not a directory", "utf-8");

    await expect(writeCache(PROFILE.queryName, PROFILE, ENTITIES)).resolves.toBeUndefined();

    await fs.rm(env.ORG_CACHE_DIR, { force: true });
  });
});
