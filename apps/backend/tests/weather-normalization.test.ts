import { describe, expect, it } from "vitest";

import { mapWmoCodeToCondition } from "../src/environment/providers/weather.provider";

/**
 * This mapping is load-bearing: the AI Core's Risk Engine matches on
 * `condition === "heavy_rain"`. If heavy rain normalized to anything else the
 * pipeline would still run end to end but silently never raise a risk.
 */
describe("mapWmoCodeToCondition", () => {
  it("maps clear and cloudy codes", () => {
    expect(mapWmoCodeToCondition(0)).toBe("clear");
    expect(mapWmoCodeToCondition(2)).toBe("cloudy");
  });

  it("maps fog codes", () => {
    expect(mapWmoCodeToCondition(45)).toBe("fog");
    expect(mapWmoCodeToCondition(48)).toBe("fog");
  });

  it("maps heavy rain to the exact value the Risk Engine keys off", () => {
    expect(mapWmoCodeToCondition(65)).toBe("heavy_rain");
    expect(mapWmoCodeToCondition(82)).toBe("heavy_rain");
  });

  it("distinguishes rain intensities", () => {
    expect(mapWmoCodeToCondition(61)).toBe("light_rain");
    expect(mapWmoCodeToCondition(63)).toBe("moderate_rain");
    expect(mapWmoCodeToCondition(65)).toBe("heavy_rain");
  });

  it("maps drizzle to light rain", () => {
    expect(mapWmoCodeToCondition(51)).toBe("light_rain");
    expect(mapWmoCodeToCondition(57)).toBe("light_rain");
  });

  it("maps snow and thunderstorm codes", () => {
    expect(mapWmoCodeToCondition(73)).toBe("snow");
    expect(mapWmoCodeToCondition(86)).toBe("snow");
    expect(mapWmoCodeToCondition(95)).toBe("thunderstorm");
    expect(mapWmoCodeToCondition(99)).toBe("thunderstorm");
  });

  it("falls back to cloudy for unrecognized codes", () => {
    expect(mapWmoCodeToCondition(4)).toBe("cloudy");
  });
});
