import type { WorldEntity } from "@ai-env/contracts";

import { attachConnectivity } from "./graph-builder";
import demoOrganization from "./fallback-data/demo-organization.json";
import type { OrganizationDiscoveryResult } from "./types";

/**
 * Guaranteed-available demo data. Used whenever Nominatim fails, Overpass
 * fails, the organization isn't found, and there's no cache hit — the
 * discovery flow must never be able to fail because of an external service,
 * so this is the floor everything else falls back to.
 *
 * Bundled JSON only has the raw entity fields; `updatedAt` and connectivity
 * are computed at load time so a bundled fixture never looks stale.
 */
export function loadFallbackGraph(): OrganizationDiscoveryResult {
  const now = new Date().toISOString();

  const entities: WorldEntity[] = demoOrganization.entities.map((entity) => ({
    ...entity,
    updatedAt: now,
  }));

  return {
    profile: {
      queryName: demoOrganization.queryName,
      resolvedName: demoOrganization.resolvedName,
      center: demoOrganization.center,
      boundingBox: demoOrganization.boundingBox,
    },
    entities: attachConnectivity(entities),
    source: "fallback",
  };
}
