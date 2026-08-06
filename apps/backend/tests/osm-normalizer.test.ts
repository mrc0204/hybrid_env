import { describe, expect, it } from "vitest";

import { normalizeOsmElements } from "../src/organization/osm-normalizer";
import type { OverpassElement } from "../src/organization/types";

function way(
  id: number,
  tags: Record<string, string>,
  center = { lat: 17.38, lon: 78.48 },
): OverpassElement {
  return { type: "way", id, tags, center };
}

function node(id: number, tags: Record<string, string>, lat = 17.38, lon = 78.48): OverpassElement {
  return { type: "node", id, tags, lat, lon };
}

describe("normalizeOsmElements", () => {
  it("classifies a building", () => {
    const [entity] = normalizeOsmElements([way(1, { building: "university", name: "Main Block" })]);
    expect(entity?.type).toBe("building");
    expect(entity?.label).toBe("Main Block");
  });

  it("falls back to a humanized value when a building has no name", () => {
    const [entity] = normalizeOsmElements([way(1, { building: "yes" })]);
    expect(entity?.type).toBe("building");
    expect(entity?.label).toBe("Yes");
  });

  it("distinguishes footpaths from roads", () => {
    const [footpath, road] = normalizeOsmElements([
      way(1, { highway: "footway" }),
      way(2, { highway: "primary" }),
    ]);
    expect(footpath?.type).toBe("footpath");
    expect(road?.type).toBe("road");
  });

  it("classifies parking, gates, and entrances", () => {
    const [parking, gate, entrance] = normalizeOsmElements([
      way(1, { amenity: "parking" }),
      node(2, { barrier: "gate" }),
      node(3, { entrance: "yes" }),
    ]);
    expect(parking?.type).toBe("parking");
    expect(gate?.type).toBe("gate");
    expect(entrance?.type).toBe("entrance");
  });

  it("classifies other amenities generically", () => {
    const [entity] = normalizeOsmElements([node(1, { amenity: "cafe" })]);
    expect(entity?.type).toBe("amenity");
    expect(entity?.label).toBe("Cafe");
  });

  it("skips elements with no tags", () => {
    const entities = normalizeOsmElements([{ type: "way", id: 1 }]);
    expect(entities).toEqual([]);
  });

  it("skips elements with tags that classify to nothing usable", () => {
    const entities = normalizeOsmElements([way(1, { surface: "asphalt" })]);
    expect(entities).toEqual([]);
  });

  it("skips elements with no resolvable location", () => {
    const entities = normalizeOsmElements([{ type: "way", id: 1, tags: { building: "yes" } }]);
    expect(entities).toEqual([]);
  });

  it("resolves node coordinates and way centroids differently", () => {
    const [fromNode] = normalizeOsmElements([node(1, { amenity: "parking" }, 10, 20)]);
    const [fromWay] = normalizeOsmElements([way(2, { amenity: "parking" }, { lat: 30, lon: 40 })]);
    expect(fromNode?.location).toEqual({ lat: 10, lng: 20 });
    expect(fromWay?.location).toEqual({ lat: 30, lng: 40 });
  });

  it("caps output at ORG_MAX_ENTITIES so an unexpectedly large area degrades gracefully", () => {
    const elements = Array.from({ length: 8 }, (_, i) => way(i, { building: "yes" }));
    const entities = normalizeOsmElements(elements);
    expect(entities).toHaveLength(5); // stubbed to 5 in vitest.config.ts
  });
});
