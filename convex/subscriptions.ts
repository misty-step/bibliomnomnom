import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, getAuthOrNull } from "./auth";
import { TRIAL_DAYS, TRIAL_DURATION_MS } from "@/lib/constants";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Compares all characters even if mismatch is found early.
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validates webhook token from environment variable.
 * This prevents unauthorized calls to webhook handlers.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @throws Error if token is missing or invalid
 */
function validateWebhookToken(providedToken: string): void {
  const expectedToken = process.env.CONVEX_WEBHOOK_TOKEN;
  if (!expectedToken) {
    throw new Error("CONVEX_WEBHOOK_TOKEN not configured");
  }

  if (!timingSafeCompare(providedToken, expectedToken)) {
    throw new Error("Invalid webhook token");
  }
}

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
// User-Facing Mutations
// ============================================================================

/**
 * Ensure trial exists for authenticated user.
 * Called from dashboard to auto-enroll existing users without subscriptions.
 *
 * Returns the subscription (existing or newly created trial).
 *
 * Race condition handling: If two requests arrive simultaneously, both might
 * pass the existence check. We handle this by:
 * 1. Attempting insert (may succeed or fail due to race)
 * 2. On any error, re-query to find existing subscription
 * 3. If duplicates exist, keep earliest and delete rest (de-duplication)
 */
export const ensureTrialExists = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    // Check for existing subscription
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      return {
        ...existing,
        hasAccess: hasAccess(existing),
        daysRemaining: getDaysRemaining(existing),
      };
    }

    // Attempt to create new trial
    const now = Date.now();
    const trialEnd = now + TRIAL_DURATION_MS;

    let insertError: unknown;
    try {
      const subscriptionId = await ctx.db.insert("subscriptions", {
        userId,
        status: "trialing",
        currentPeriodEnd: trialEnd,
        trialEndsAt: trialEnd,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });

      const subscription = await ctx.db.get(subscriptionId);
      return {
        ...subscription!,
        hasAccess: true,
        daysRemaining: TRIAL_DAYS,
      };
    } catch (err) {
      insertError = err;
      // Fall through to de-duplication logic
    }

    // Race condition: another request may have inserted. Find and de-duplicate.
    const matches = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (matches.length > 0) {
      // Keep earliest subscription, delete duplicates
      const sorted = matches.sort((a, b) => a._creationTime - b._creationTime);
      const keeper = sorted[0]!;
      const duplicates = sorted.slice(1);

      for (const dupe of duplicates) {
        await ctx.db.delete(dupe._id);
      }

      return {
        ...keeper,
        hasAccess: hasAccess(keeper),
        daysRemaining: getDaysRemaining(keeper),
      };
    }

    // No subscription found and insert failed - bubble error
    if (insertError) {
      throw insertError;
    }

    // Should not reach here, but TypeScript needs a return
    throw new Error("Failed to ensure trial exists");
  },
});

// ============================================================================
// Webhook Actions (secure entry points called from Next.js API routes)
// ============================================================================

/** Subscription data args shared by webhook handlers */
const subscriptionDataArgs = {
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
};

/**
 * Secure action: Create or update subscription for a user.
 * Called from Next.js API route after Stripe signature verification.
 *
 * Security: Validates webhook token before processing. Token must match
 * CONVEX_WEBHOOK_TOKEN environment variable.
 */
export const upsertFromWebhook = action({
  args: {
    webhookToken: v.string(),
    clerkId: v.string(),
    ...subscriptionDataArgs,
  },
  handler: async (ctx, args): Promise<Id<"subscriptions"> | null> => {
    validateWebhookToken(args.webhookToken);

    const { webhookToken: _, ...mutationArgs } = args;
    return await ctx.runMutation(internal.subscriptions.upsertFromWebhookInternal, mutationArgs);
  },
});

/**
 * Secure action: Update subscription by Stripe customer ID.
 * Called from Next.js API route after Stripe signature verification.
 *
 * Security: Validates webhook token before processing.
 */
export const updateByStripeCustomer = action({
  args: {
    webhookToken: v.string(),
    ...subscriptionDataArgs,
  },
  handler: async (ctx, args): Promise<Id<"subscriptions"> | null> => {
    validateWebhookToken(args.webhookToken);

    const { webhookToken: _, ...mutationArgs } = args;
    return await ctx.runMutation(
      internal.subscriptions.updateByStripeCustomerInternal,
      mutationArgs,
    );
  },
});

// ============================================================================
// Internal Webhook Mutations (only callable from Convex actions)
// ============================================================================

/**
 * Internal: Create or update subscription for a user.
 * Only callable from upsertFromWebhook action after token validation.
 */
export const upsertFromWebhookInternal = internalMutation({
  args: {
    clerkId: v.string(),
    ...subscriptionDataArgs,
  },
  handler: async (ctx, args) => {
    // Find user by Clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      // Throw error to trigger Stripe webhook retry. This handles the race condition
      // where Stripe checkout completes before Clerk user sync finishes.
      throw new Error(`User not found for Clerk ID: ${args.clerkId}, will retry`);
    }

    const now = Date.now();

    // Check for existing subscription (by userId, not stripeCustomerId)
    // This ensures we update the internal trial subscription when user converts to paid
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      // Update existing subscription (including internal trial → paid conversion)
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
 * Internal: Update subscription by Stripe customer ID.
 * Only callable from updateByStripeCustomer action after token validation.
 */
export const updateByStripeCustomerInternal = internalMutation({
  args: subscriptionDataArgs,
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
