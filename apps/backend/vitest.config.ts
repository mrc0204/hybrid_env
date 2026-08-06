import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Several tests deliberately exercise failure paths; their expected error
    // logs would otherwise bury a genuine failure in noise.
    // ORG_MAX_ENTITIES and ORG_CACHE_DIR are lowered/isolated for tests —
    // a small cap makes the truncation test tractable, and a dedicated
    // directory keeps cache tests from touching real discovery data.
    env: {
      LOG_LEVEL: "silent",
      ORG_MAX_ENTITIES: "5",
      ORG_CACHE_DIR: ".cache/test-organizations",
    },
  },
});
