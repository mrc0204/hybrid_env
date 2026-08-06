import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // ai-core is Python (ruff/black own it). The frontend IS linted — it was
    // only excluded while it was an empty placeholder.
    ignores: ["**/dist/**", "**/node_modules/**", "apps/ai-core/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
