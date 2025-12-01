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
