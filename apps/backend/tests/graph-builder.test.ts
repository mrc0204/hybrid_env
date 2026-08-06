import type { WorldEntity } from "@ai-env/contracts";
import { describe, expect, it } from "vitest";

import { attachConnectivity, type Connectivity } from "../src/organization/graph-builder";

function entity(id: string, lat: number, lng: number): WorldEntity {
  return {
    id,
    type: "building",
    label: id,
    location: { lat, lng },
    attributes: {},
    updatedAt: "now",
  };
}

describe("attachConnectivity", () => {
  it("returns an empty array for no entities", () => {
    expect(attachConnectivity([])).toEqual([]);
  });

  it("gives a single entity no neighbors, without crashing", () => {
    const [result] = attachConnectivity([entity("a", 17.38, 78.48)]);
    const connectivity = result?.attributes.connectivity as Connectivity;
    expect(connectivity.nearestEntityIds).toEqual([]);
  });

  it("orders neighbors by distance, nearest first", () => {
    // Roughly 111m per 0.001 degree of latitude — spaced so ordering is unambiguous.
    const entities = [
      entity("origin", 17.38, 78.48),
      entity("near", 17.3805, 78.48), // ~55m away
      entity("far", 17.39, 78.48), // ~1.1km away
    ];

    const [origin] = attachConnectivity(entities);
    const connectivity = origin?.attributes.connectivity as Connectivity;

    expect(connectivity.nearestEntityIds).toEqual(["near", "far"]);
    expect(connectivity.distancesMeters.near!).toBeLessThan(connectivity.distancesMeters.far!);
  });

  it("caps neighbors at 4 even when more entities exist", () => {
    const entities = Array.from({ length: 6 }, (_, i) => entity(`e${i}`, 17.38 + i * 0.001, 78.48));

    const [first] = attachConnectivity(entities);
    const connectivity = first?.attributes.connectivity as Connectivity;

    expect(connectivity.nearestEntityIds).toHaveLength(4);
  });

  it("leaves entities without a resolvable location untouched", () => {
    const withStringLocation: WorldEntity = {
      id: "b",
      type: "campus-event",
      label: "Event",
      location: "Somewhere",
      attributes: { foo: "bar" },
      updatedAt: "now",
    };

    const [result] = attachConnectivity([withStringLocation]);
    expect(result).toEqual(withStringLocation);
  });
});
