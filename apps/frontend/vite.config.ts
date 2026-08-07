import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
      // The contracts package ships TypeScript source (no build step), so it is
      // aliased straight to source rather than resolved from node_modules.
      "@ai-env/contracts": path.resolve(dirname, "../../packages/contracts/src"),
    },
  },
  server: {
    port: 5173,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      // Lets the frontend call the Backend on :4000 without CORS during dev.
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/health": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
  optimizeDeps: {
    exclude: ["@xenova/transformers", "kokoro-js", "onnxruntime-web"],
  },
});
