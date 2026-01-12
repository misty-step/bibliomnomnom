import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hasAccess, getDaysRemaining } from "../../convex/subscriptions";
import { TRIAL_DAYS, TRIAL_DURATION_MS } from "../../lib/constants";
import type { Doc } from "../../convex/_generated/dataModel";

// Helper to create subscription documents for testing
const makeSubscription = (overrides: Partial<Doc<"subscriptions">> = {}): Doc<"subscriptions"> =>
  ({
    _id: "sub_1" as any,
    _creationTime: Date.now(),
    userId: "user_1" as any,
    stripeCustomerId: "cus_test123",
    stripeSubscriptionId: "sub_test123",
    status: "active" as const,
    priceId: "price_monthly",
    currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    trialEndsAt: undefined,
    cancelAtPeriodEnd: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }) as Doc<"subscriptions">;

describe("hasAccess", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for null subscription", () => {
    expect(hasAccess(null)).toBe(false);
  });

  describe("trialing status", () => {
    it("returns true when trial has not expired", () => {
      const sub = makeSubscription({
        status: "trialing",
        trialEndsAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
      });
      expect(hasAccess(sub)).toBe(true);
    });

    it("returns false when trial has expired", () => {
      const sub = makeSubscription({
        status: "trialing",
        trialEndsAt: Date.now() - 1000, // 1 second ago
      });
      expect(hasAccess(sub)).toBe(false);
    });

    it("returns false when trialEndsAt is undefined", () => {
      const sub = makeSubscription({
        status: "trialing",
        trialEndsAt: undefined,
      });
      expect(hasAccess(sub)).toBe(false);
    });

    it("returns true when trial ends exactly now (edge case)", () => {
      const sub = makeSubscription({
        status: "trialing",
        trialEndsAt: Date.now() + 1, // 1ms from now
      });
      expect(hasAccess(sub)).toBe(true);
    });
  });

  describe("active status", () => {
    it("returns true for active subscription", () => {
      const sub = makeSubscription({ status: "active" });
      expect(hasAccess(sub)).toBe(true);
    });

    it("returns true even if currentPeriodEnd is in the past", () => {
      // Active status always grants access regardless of period end
      const sub = makeSubscription({
        status: "active",
        currentPeriodEnd: Date.now() - 1000,
      });
      expect(hasAccess(sub)).toBe(true);
    });
  });

  describe("canceled status", () => {
    it("returns true when period has not ended", () => {
      const sub = makeSubscription({
        status: "canceled",
        currentPeriodEnd: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
        cancelAtPeriodEnd: true,
      });
      expect(hasAccess(sub)).toBe(true);
    });

    it("returns false when period has ended", () => {
      const sub = makeSubscription({
        status: "canceled",
        currentPeriodEnd: Date.now() - 1000, // 1 second ago
        cancelAtPeriodEnd: true,
      });
      expect(hasAccess(sub)).toBe(false);
    });

    it("returns false when currentPeriodEnd is undefined", () => {
      const sub = makeSubscription({
        status: "canceled",
        currentPeriodEnd: undefined,
      });
      expect(hasAccess(sub)).toBe(false);
    });
  });

  describe("past_due status", () => {
    it("returns true when in grace period (period not ended)", () => {
      const sub = makeSubscription({
        status: "past_due",
        currentPeriodEnd: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days grace
      });
      expect(hasAccess(sub)).toBe(true);
    });

    it("returns false when grace period has ended", () => {
      const sub = makeSubscription({
        status: "past_due",
        currentPeriodEnd: Date.now() - 1000,
      });
      expect(hasAccess(sub)).toBe(false);
    });
  });

  describe("expired status", () => {
    it("returns false for expired subscription", () => {
      const sub = makeSubscription({ status: "expired" });
      expect(hasAccess(sub)).toBe(false);
    });

    it("returns false even with future period end", () => {
      const sub = makeSubscription({
        status: "expired",
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      expect(hasAccess(sub)).toBe(false);
    });
  });
});

describe("getDaysRemaining", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for null subscription", () => {
    expect(getDaysRemaining(null)).toBe(null);
  });

  describe("trialing status", () => {
    it("returns correct days for 14-day trial", () => {
      const sub = makeSubscription({
        status: "trialing",
        trialEndsAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      });
      expect(getDaysRemaining(sub)).toBe(14);
    });

    it("returns 1 for last day of trial", () => {
      const sub = makeSubscription({
        status: "trialing",
        trialEndsAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours from now
      });
      expect(getDaysRemaining(sub)).toBe(1);
    });

    it("returns 0 for expired trial", () => {
      const sub = makeSubscription({
        status: "trialing",
        trialEndsAt: Date.now() - 1000,
      });
      expect(getDaysRemaining(sub)).toBe(0);
    });

    it("returns null when trialEndsAt is undefined", () => {
      const sub = makeSubscription({
        status: "trialing",
        trialEndsAt: undefined,
      });
      expect(getDaysRemaining(sub)).toBe(null);
    });

    it("rounds up partial days", () => {
      const sub = makeSubscription({
        status: "trialing",
        trialEndsAt: Date.now() + 1.5 * 24 * 60 * 60 * 1000, // 1.5 days
      });
      expect(getDaysRemaining(sub)).toBe(2);
    });
  });

  describe("active/canceled status", () => {
    it("uses currentPeriodEnd for non-trialing subscriptions", () => {
      const sub = makeSubscription({
        status: "active",
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      expect(getDaysRemaining(sub)).toBe(30);
    });

    it("returns null when currentPeriodEnd is undefined", () => {
      const sub = makeSubscription({
        status: "active",
        currentPeriodEnd: undefined,
      });
      expect(getDaysRemaining(sub)).toBe(null);
    });

    it("returns 0 for past period end", () => {
      const sub = makeSubscription({
        status: "canceled",
        currentPeriodEnd: Date.now() - 1000,
      });
      expect(getDaysRemaining(sub)).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("handles exactly 0 milliseconds remaining", () => {
      const sub = makeSubscription({
        status: "trialing",
        trialEndsAt: Date.now(),
      });
      expect(getDaysRemaining(sub)).toBe(0);
    });

    it("handles very large remaining time", () => {
      const sub = makeSubscription({
        status: "active",
        currentPeriodEnd: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      });
      expect(getDaysRemaining(sub)).toBe(365);
    });
  });
});

describe("Trial Subscription Creation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * These tests verify the expected shape of trial subscriptions.
   * The actual mutations (ensureTrialExists, createOrUpdateUser) are tested
   * via integration tests, but we can verify the business logic here.
   */
  describe("trial subscription shape", () => {
    it("new trial has correct status", () => {
      const trialSub = makeSubscription({
        status: "trialing",
        trialEndsAt: Date.now() + TRIAL_DURATION_MS,
        currentPeriodEnd: Date.now() + TRIAL_DURATION_MS,
        stripeCustomerId: undefined, // Internal trials have no Stripe customer
        stripeSubscriptionId: undefined,
      });

      expect(trialSub.status).toBe("trialing");
      expect(hasAccess(trialSub)).toBe(true);
      expect(getDaysRemaining(trialSub)).toBe(TRIAL_DAYS);
    });

    it("trial without stripeCustomerId is valid (internal trial)", () => {
      const internalTrial = makeSubscription({
        status: "trialing",
        stripeCustomerId: undefined as any, // Schema allows optional
        stripeSubscriptionId: undefined,
        trialEndsAt: Date.now() + TRIAL_DURATION_MS,
      });

      // Internal trials should grant access
      expect(hasAccess(internalTrial)).toBe(true);
    });

    it("trial grants access for exactly TRIAL_DAYS", () => {
      const now = Date.now();
      const trialEnd = now + TRIAL_DURATION_MS;

      const trialSub = makeSubscription({
        status: "trialing",
        trialEndsAt: trialEnd,
      });

      expect(hasAccess(trialSub)).toBe(true);
      expect(getDaysRemaining(trialSub)).toBe(TRIAL_DAYS);
    });

    it("expired trial denies access", () => {
      const expiredTrial = makeSubscription({
        status: "trialing",
        trialEndsAt: Date.now() - 1, // Just expired
      });

      expect(hasAccess(expiredTrial)).toBe(false);
      expect(getDaysRemaining(expiredTrial)).toBe(0);
    });
  });

  describe("trial to paid conversion", () => {
    it("active subscription after trial has stripeCustomerId", () => {
      const paidSub = makeSubscription({
        status: "active",
        stripeCustomerId: "cus_converted123",
        stripeSubscriptionId: "sub_paid123",
        trialEndsAt: Date.now() - TRIAL_DURATION_MS, // Trial ended
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      expect(hasAccess(paidSub)).toBe(true);
      expect(paidSub.stripeCustomerId).toBeDefined();
    });
  });
});

/**
 * Integration Test Requirements for ensureTrialExists mutation:
 *
 * 1. When user has no subscription:
 *    - Creates new subscription with status "trialing"
 *    - Sets trialEndsAt to now + TRIAL_DURATION_MS
 *    - Sets currentPeriodEnd to now + TRIAL_DURATION_MS
 *    - Does NOT set stripeCustomerId (internal trial)
 *    - Returns hasAccess: true, daysRemaining: TRIAL_DAYS
 *
 * 2. When user has existing subscription:
 *    - Returns existing subscription unchanged
 *    - Does NOT create duplicate subscription
 *
 * 3. Authentication:
 *    - Requires authenticated user (calls requireAuth)
 *    - Throws ConvexError if not authenticated
 *
 * Integration Test Requirements for createOrUpdateUser mutation:
 *
 * 1. When creating new user:
 *    - Creates user record
 *    - Auto-creates trial subscription with TRIAL_DURATION_MS duration
 *
 * 2. When updating existing user:
 *    - Updates user record
 *    - Does NOT create subscription (user already has one or will use ensureTrialExists)
 */
