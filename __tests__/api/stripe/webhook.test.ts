import { describe, expect, it } from "vitest";

import { mapStripeStatus } from "../../../lib/stripe-utils";
import { stripeTimestampToMs } from "../../../lib/stripe";
import type Stripe from "stripe";

describe("mapStripeStatus", () => {
  it("maps trialing to trialing", () => {
    expect(mapStripeStatus("trialing")).toBe("trialing");
  });

  it("maps active to active", () => {
    expect(mapStripeStatus("active")).toBe("active");
  });

  it("maps canceled to canceled", () => {
    expect(mapStripeStatus("canceled")).toBe("canceled");
  });

  it("maps past_due to past_due", () => {
    expect(mapStripeStatus("past_due")).toBe("past_due");
  });

  it("maps unpaid to expired", () => {
    expect(mapStripeStatus("unpaid")).toBe("expired");
  });

  it("maps incomplete to expired", () => {
    expect(mapStripeStatus("incomplete")).toBe("expired");
  });

  it("maps incomplete_expired to expired", () => {
    expect(mapStripeStatus("incomplete_expired")).toBe("expired");
  });

  it("maps paused to canceled", () => {
    expect(mapStripeStatus("paused")).toBe("canceled");
  });

  it("maps unknown status to expired (default case)", () => {
    // Cast to bypass TypeScript for testing default case
    expect(mapStripeStatus("unknown_status" as Stripe.Subscription.Status)).toBe("expired");
  });
});

describe("stripeTimestampToMs", () => {
  it("converts Stripe timestamp (seconds) to JavaScript timestamp (milliseconds)", () => {
    const stripeTimestamp = 1704067200; // 2024-01-01 00:00:00 UTC
    const expectedMs = 1704067200000;
    expect(stripeTimestampToMs(stripeTimestamp)).toBe(expectedMs);
  });

  it("handles zero timestamp", () => {
    expect(stripeTimestampToMs(0)).toBe(0);
  });

  it("handles current-ish timestamps", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = stripeTimestampToMs(nowSeconds);
    expect(result).toBeGreaterThan(Date.now() - 1000);
    expect(result).toBeLessThanOrEqual(Date.now());
  });
});
