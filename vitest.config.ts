import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true,
    css: false,
    exclude: ["**/node_modules/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      // Measure critical business logic
      // - lib/import: Import processing logic
      // - lib/stripe-utils.ts: Pure Stripe utility functions
      // Note: convex/*.ts excluded (requires runtime mocking, tested via E2E)
      // Note: lib/stripe.ts excluded (lazy init, env-dependent)
      include: [
        "lib/import/**/*.{ts,tsx}",
        "lib/stripe-utils.ts",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/__tests__/**",
        "**/_generated/**",
        "**/node_modules/**",
        "**/*.config.{ts,js}",
        "**/types.ts",
        "**/constants.ts",
        "**/repository/interfaces.ts", // Interface-only file
        "**/repository/memory.ts", // In-memory test repository
      ],
      // Progressive enforcement: Start low, ratchet up to 75%
      // Phase 2: 75% across the board with per-file enforcement
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
        perFile: true,
      },
      clean: true,
      cleanOnRerun: true,
    },
  },
});
