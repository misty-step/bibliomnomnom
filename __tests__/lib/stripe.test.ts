import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { stripeTimestampToMs, getBaseUrl, TRIAL_DAYS, PRICES } from "../../lib/stripe";

describe("stripe utilities", () => {
  describe("stripeTimestampToMs", () => {
    it("converts Stripe timestamp (seconds) to JavaScript timestamp (milliseconds)", () => {
      const stripeTimestamp = 1704067200; // 2024-01-01 00:00:00 UTC
      expect(stripeTimestampToMs(stripeTimestamp)).toBe(1704067200000);
    });

    it("handles zero timestamp", () => {
      expect(stripeTimestampToMs(0)).toBe(0);
    });
  });

  describe("TRIAL_DAYS", () => {
    it("is set to 14 days", () => {
      expect(TRIAL_DAYS).toBe(14);
    });
  });

  describe("PRICES", () => {
    it("has monthly and annual price keys", () => {
      expect(PRICES).toHaveProperty("monthly");
      expect(PRICES).toHaveProperty("annual");
    });
  });

  describe("getBaseUrl", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("uses NEXT_PUBLIC_APP_URL if set", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://bibliomnomnom.com";
      // Need to re-import to pick up new env
      expect(getBaseUrl()).toBe("https://bibliomnomnom.com");
    });

    it("falls back to VERCEL_URL with https", () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      process.env.VERCEL_URL = "bibliomnomnom-abc123.vercel.app";
      expect(getBaseUrl()).toBe("https://bibliomnomnom-abc123.vercel.app");
    });

    it("falls back to localhost:3000 if no env vars set", () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.VERCEL_URL;
      expect(getBaseUrl()).toBe("http://localhost:3000");
    });
  });
});
