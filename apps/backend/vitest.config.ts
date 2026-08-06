import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Several tests deliberately exercise failure paths; their expected error
    // logs would otherwise bury a genuine failure in noise.
    env: { LOG_LEVEL: "silent" },
  },
});
