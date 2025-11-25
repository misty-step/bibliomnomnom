import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
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
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      // Phase 1: Only measure critical business logic in lib/import
      // Exclude Convex backend (integration-tested, not unit-tested)
      include: ["lib/import/**/*.{ts,tsx}"],
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
      // Phase 1 baseline: 88% statements, 75% branches, 86% functions, 89% lines
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 30, // Lower due to rateLimit.ts (30%), will ratchet to 50%+ in Phase 2
        statements: 50,
        // Per-file thresholds ensure new files start with good coverage
        perFile: true,
      },
      clean: true,
      cleanOnRerun: true,
    },
  },
});
