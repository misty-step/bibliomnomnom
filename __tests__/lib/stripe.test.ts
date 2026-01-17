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
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("returns price IDs when env vars are set", () => {
      process.env.STRIPE_PRICE_MONTHLY = "price_monthly_test";
      process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";

      expect(PRICES.monthly).toBe("price_monthly_test");
      expect(PRICES.annual).toBe("price_annual_test");
    });

    it("throws when STRIPE_PRICE_MONTHLY is not set", () => {
      delete process.env.STRIPE_PRICE_MONTHLY;

      expect(() => PRICES.monthly).toThrow("STRIPE_PRICE_MONTHLY environment variable is not set");
    });

    it("throws when STRIPE_PRICE_ANNUAL is not set", () => {
      delete process.env.STRIPE_PRICE_ANNUAL;

      expect(() => PRICES.annual).toThrow("STRIPE_PRICE_ANNUAL environment variable is not set");
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
