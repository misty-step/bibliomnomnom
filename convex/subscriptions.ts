import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { requireAuth, getAuthOrNull } from "./auth";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Subscription status types for access control.
 *
 * - trialing: In free trial period
 * - active: Paid and active subscription
 * - canceled: Will expire at period end
 * - past_due: Payment failed, grace period
 * - expired: No longer has access
 */
type SubscriptionStatus = "trialing" | "active" | "canceled" | "past_due" | "expired";

/**
 * Check if a subscription grants access to the application.
 *
 * Access is granted for:
 * - Active subscriptions
 * - Trials that haven't expired
 * - Canceled subscriptions until their period ends
 */
export function hasAccess(subscription: Doc<"subscriptions"> | null): boolean {
  if (!subscription) return false;

  const now = Date.now();

  switch (subscription.status) {
    case "trialing":
      return subscription.trialEndsAt ? subscription.trialEndsAt > now : false;
    case "active":
      return true;
    case "canceled":
      // Still has access until period ends
      return subscription.currentPeriodEnd ? subscription.currentPeriodEnd > now : false;
    case "past_due":
      // Grace period - still allow access while payment is being retried
      return subscription.currentPeriodEnd ? subscription.currentPeriodEnd > now : false;
    case "expired":
      return false;
    default:
      return false;
  }
}

/**
 * Calculate days remaining in trial or subscription period.
 */
export function getDaysRemaining(subscription: Doc<"subscriptions"> | null): number | null {
  if (!subscription) return null;

  const now = Date.now();
  let endTime: number | undefined;

  if (subscription.status === "trialing") {
    endTime = subscription.trialEndsAt;
  } else if (subscription.currentPeriodEnd) {
    endTime = subscription.currentPeriodEnd;
  }

  if (!endTime) return null;

  const msRemaining = endTime - now;
  if (msRemaining <= 0) return 0;

  return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
}

// ============================================================================
// Public Queries
// ============================================================================

/**
 * Get the current user's subscription status.
 *
 * Returns subscription details for authenticated users, or null if:
 * - User is not authenticated
 * - User has no subscription record
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthOrNull(ctx);
    if (!userId) return null;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!subscription) return null;

    return {
      ...subscription,
      hasAccess: hasAccess(subscription),
      daysRemaining: getDaysRemaining(subscription),
    };
  },
});

/**
 * Check if the current user has active access (for quick access checks).
 */
export const checkAccess = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthOrNull(ctx);
    if (!userId) return { hasAccess: false, reason: "unauthenticated" as const };

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!subscription) {
      return { hasAccess: false, reason: "no_subscription" as const };
    }

    if (hasAccess(subscription)) {
      return {
        hasAccess: true,
        status: subscription.status,
        daysRemaining: getDaysRemaining(subscription),
      };
    }

    return {
      hasAccess: false,
      reason: subscription.status === "trialing" ? "trial_expired" : "subscription_expired",
      status: subscription.status,
    };
  },
});

// ============================================================================
// Webhook Mutations (called from Next.js after Stripe signature verification)
// ============================================================================

/**
 * Create or update subscription for a user.
 * Called when a Stripe checkout session completes.
 *
 * Note: This mutation doesn't require auth because it's called from the
 * webhook handler after Stripe signature verification.
 */
export const upsertFromWebhook = mutation({
  args: {
    clerkId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("expired"),
    ),
    priceId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Find user by Clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      console.error(`No user found for Clerk ID: ${args.clerkId}`);
      return null;
    }

    const now = Date.now();

    // Check for existing subscription
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      // Update existing subscription
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId ?? existing.stripeSubscriptionId,
        status: args.status,
        priceId: args.priceId ?? existing.priceId,
        currentPeriodEnd: args.currentPeriodEnd ?? existing.currentPeriodEnd,
        trialEndsAt: args.trialEndsAt ?? existing.trialEndsAt,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? existing.cancelAtPeriodEnd,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new subscription
    return await ctx.db.insert("subscriptions", {
      userId: user._id,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      status: args.status,
      priceId: args.priceId,
      currentPeriodEnd: args.currentPeriodEnd,
      trialEndsAt: args.trialEndsAt,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update subscription by Stripe customer ID.
 * Called when subscription is updated (e.g., renewal, cancellation).
 */
export const updateByStripeCustomer = mutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("expired"),
    ),
    priceId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .unique();

    if (!subscription) {
      console.error(`No subscription found for Stripe customer: ${args.stripeCustomerId}`);
      return null;
    }

    await ctx.db.patch(subscription._id, {
      stripeSubscriptionId: args.stripeSubscriptionId ?? subscription.stripeSubscriptionId,
      status: args.status,
      priceId: args.priceId ?? subscription.priceId,
      currentPeriodEnd: args.currentPeriodEnd ?? subscription.currentPeriodEnd,
      trialEndsAt: args.trialEndsAt ?? subscription.trialEndsAt,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd,
      updatedAt: Date.now(),
    });

    return subscription._id;
  },
});

// ============================================================================
// Internal Mutations (for internal use only)
// ============================================================================

/**
 * Create a new subscription record (called when Stripe customer is created).
 */
export const createSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    stripeCustomerId: v.string(),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("expired"),
    ),
    trialEndsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if subscription already exists
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      // Update existing subscription
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
        status: args.status,
        trialEndsAt: args.trialEndsAt,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new subscription
    return await ctx.db.insert("subscriptions", {
      userId: args.userId,
      stripeCustomerId: args.stripeCustomerId,
      status: args.status,
      trialEndsAt: args.trialEndsAt,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update subscription from Stripe webhook event.
 */
export const updateFromStripe = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("expired"),
    ),
    priceId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .unique();

    if (!subscription) {
      console.error(`No subscription found for Stripe customer: ${args.stripeCustomerId}`);
      return null;
    }

    await ctx.db.patch(subscription._id, {
      stripeSubscriptionId: args.stripeSubscriptionId ?? subscription.stripeSubscriptionId,
      status: args.status,
      priceId: args.priceId ?? subscription.priceId,
      currentPeriodEnd: args.currentPeriodEnd ?? subscription.currentPeriodEnd,
      trialEndsAt: args.trialEndsAt ?? subscription.trialEndsAt,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd,
      updatedAt: Date.now(),
    });

    return subscription._id;
  },
});

/**
 * Get subscription by Stripe customer ID (for webhook lookups).
 */
export const getByStripeCustomer = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .unique();
  },
});

/**
 * Get subscription by user ID (internal use).
 */
export const getByUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});
