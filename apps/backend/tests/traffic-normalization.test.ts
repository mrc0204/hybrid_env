import { describe, expect, it } from "vitest";

import { congestionFromSpeedRatio } from "../src/environment/providers/traffic.provider";

describe("congestionFromSpeedRatio", () => {
  it("reports low congestion at or near free-flow speed", () => {
    expect(congestionFromSpeedRatio(50, 50)).toBe("low");
    expect(congestionFromSpeedRatio(40, 50)).toBe("low");
  });

  it("reports medium congestion when speed is moderately reduced", () => {
    expect(congestionFromSpeedRatio(30, 50)).toBe("medium");
    expect(congestionFromSpeedRatio(25, 50)).toBe("medium");
  });

  it("reports high congestion when speed collapses", () => {
    expect(congestionFromSpeedRatio(10, 50)).toBe("high");
    expect(congestionFromSpeedRatio(0, 50)).toBe("high");
  });

  it("uses a ratio so thresholds hold across road types", () => {
    // Same 60% ratio on a slow campus lane and a fast arterial road.
    expect(congestionFromSpeedRatio(18, 30)).toBe("medium");
    expect(congestionFromSpeedRatio(60, 100)).toBe("medium");
  });

  it("does not divide by zero when free-flow speed is unknown", () => {
    expect(congestionFromSpeedRatio(20, 0)).toBe("low");
  });
});
