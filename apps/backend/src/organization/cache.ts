import { promises as fs } from "node:fs";
import path from "node:path";

import type { WorldEntity } from "@ai-env/contracts";

import { env } from "../config/env";
import { logger } from "../logging/logger";
import type { OrganizationProfile } from "./types";

export interface CachedOrganization {
  profile: OrganizationProfile;
  entities: WorldEntity[];
  cachedAt: string;
}

/**
 * Disk-backed, not in-memory: an in-memory cache resets on every restart,
 * which defeats the point during a hackathon where the plan is to discover
 * the demo organization once, well before judging, and never call Nominatim
 * or Overpass again for it.
 */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function cachePath(name: string): string {
  return path.join(env.ORG_CACHE_DIR, `${slugify(name)}.json`);
}

/** Returns null on any miss — no file, malformed JSON, or expired TTL are all just "go fetch". */
export async function readCache(name: string): Promise<CachedOrganization | null> {
  try {
    const raw = await fs.readFile(cachePath(name), "utf-8");
    const parsed = JSON.parse(raw) as CachedOrganization;
    const ageMs = Date.now() - new Date(parsed.cachedAt).getTime();
    if (ageMs > env.ORG_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Write failures are logged, not thrown — a read-only filesystem shouldn't break discovery. */
export async function writeCache(
  name: string,
  profile: OrganizationProfile,
  entities: WorldEntity[],
): Promise<void> {
  try {
    await fs.mkdir(env.ORG_CACHE_DIR, { recursive: true });
    const payload: CachedOrganization = { profile, entities, cachedAt: new Date().toISOString() };
    await fs.writeFile(cachePath(name), JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    logger.warn({ err, name }, "[organization] failed to write cache — continuing without it");
  }
}
