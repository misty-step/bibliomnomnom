import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, getAuthOrNull } from "./auth";
import { TRIAL_DAYS, TRIAL_DURATION_MS } from "@/lib/constants";
import { validateWebhookToken } from "@/lib/security/webhookToken";
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

// Grace period for past_due status (7 days)
const PAST_DUE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Compute trialEndsAt for subscription update.
 * Clears trial when status becomes "active" to prevent zombie trial access.
 */
function computeTrialEndsAt(
  newStatus: SubscriptionStatus,
  incomingTrialEndsAt: number | undefined,
  existingTrialEndsAt: number | undefined,
): number | undefined {
  if (newStatus === "active") return undefined;
  return incomingTrialEndsAt ?? existingTrialEndsAt;
}

/**
 * Compute pastDueSince for subscription update.
 * Sets only on transition TO past_due, clears on any other status.
 */
function computePastDueSince(
  newStatus: SubscriptionStatus,
  existingStatus: SubscriptionStatus,
  existingPastDueSince: number | undefined,
  now: number,
): number | undefined {
  if (newStatus !== "past_due") return undefined;
  if (existingStatus !== "past_due") return now; // Transition to past_due
  return existingPastDueSince; // Already past_due, preserve original timestamp
}

/**
 * Check if a subscription grants access to the application.
 *
 * Access is granted for:
 * - Active subscriptions
 * - Trials that haven't expired
 * - Canceled subscriptions until their period ends
 * - Past due subscriptions within grace period (7 days)
 */
export function hasAccess(subscription: Doc<"subscriptions"> | null): boolean {
  if (!subscription) return false;

  const now = Date.now();

  switch (subscription.status) {
    case "trialing":
      return subscription.trialEndsAt ? subscription.trialEndsAt >= now : false;
    case "active":
      return true;
    case "canceled":
      // Still has access until period ends
      return subscription.currentPeriodEnd ? subscription.currentPeriodEnd >= now : false;
    case "past_due": {
      // Limited grace period for payment retry (7 days max)
      // Don't grant indefinite access until period end (could be a year for annual plans)
      // Uses pastDueSince (set on transition TO past_due) to prevent reset on every webhook update
      if (!subscription.currentPeriodEnd) return false;
      const pastDueStart = subscription.pastDueSince ?? subscription.updatedAt;
      const gracePeriodEnd = pastDueStart + PAST_DUE_GRACE_PERIOD_MS;
      return now < gracePeriodEnd && subscription.currentPeriodEnd >= now;
    }
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

    // Use .first() to be resilient to potential duplicates from race conditions
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

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

    // Use .first() to be resilient to potential duplicates from race conditions
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

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

    // Check for existing subscription using .first() to handle potential duplicates
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Proactive de-duplication: clean up any duplicates from race conditions
      const allMatches = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      if (allMatches.length > 1) {
        // Keep earliest by _creationTime, delete others
        const sorted = allMatches.sort((a, b) => a._creationTime - b._creationTime);
        const keeper = sorted[0]!;
        for (const dupe of sorted.slice(1)) {
          await ctx.db.delete(dupe._id);
        }
        // Return the keeper (not `existing`, which might have been deleted if it wasn't earliest)
        return {
          ...keeper,
          hasAccess: hasAccess(keeper),
          daysRemaining: getDaysRemaining(keeper),
        };
      }

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

/**
 * Secure action: Validate webhook token wiring before checkout.
 * Called from Next.js checkout route to fail fast when Vercel/Convex token parity is broken.
 */
export const assertWebhookConfiguration = action({
  args: {
    webhookToken: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: User must be signed in");
    }

    validateWebhookToken(args.webhookToken);
    return { ok: true };
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
      // Log internally, throw generic error to trigger Stripe webhook retry.
      // This handles the race condition where Stripe checkout completes before Clerk user sync finishes.
      console.error("Webhook retry: user not found for Clerk ID", {
        clerkIdPrefix: args.clerkId.slice(0, 8),
      });
      throw new Error("User not found, will retry");
    }

    const now = Date.now();

    // Check for existing subscription (by userId, not stripeCustomerId)
    // This ensures we update the internal trial subscription when user converts to paid
    // Use .first() to be resilient to potential duplicates from race conditions
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      // Update existing subscription (including internal trial → paid conversion)
      const trialEndsAt = computeTrialEndsAt(args.status, args.trialEndsAt, existing.trialEndsAt);
      const pastDueSince = computePastDueSince(
        args.status,
        existing.status as SubscriptionStatus,
        existing.pastDueSince,
        now,
      );

      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId ?? existing.stripeSubscriptionId,
        status: args.status,
        priceId: args.priceId ?? existing.priceId,
        currentPeriodEnd: args.currentPeriodEnd ?? existing.currentPeriodEnd,
        trialEndsAt,
        pastDueSince,
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
    // Use .first() to be resilient to potential duplicates from race conditions
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();

    if (!subscription) {
      console.error("Subscription lookup failed for Stripe customer");
      return null;
    }

    const now = Date.now();
    const trialEndsAt = computeTrialEndsAt(args.status, args.trialEndsAt, subscription.trialEndsAt);
    const pastDueSince = computePastDueSince(
      args.status,
      subscription.status as SubscriptionStatus,
      subscription.pastDueSince,
      now,
    );

    await ctx.db.patch(subscription._id, {
      stripeSubscriptionId: args.stripeSubscriptionId ?? subscription.stripeSubscriptionId,
      status: args.status,
      priceId: args.priceId ?? subscription.priceId,
      currentPeriodEnd: args.currentPeriodEnd ?? subscription.currentPeriodEnd,
      trialEndsAt,
      pastDueSince,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd,
      updatedAt: now,
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
    // Use .first() to be resilient to potential duplicates from race conditions
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

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
    // Use .first() to be resilient to potential duplicates from race conditions
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();

    if (!subscription) {
      console.error("Subscription lookup failed for Stripe customer");
      return null;
    }

    const now = Date.now();
    const trialEndsAt = computeTrialEndsAt(args.status, args.trialEndsAt, subscription.trialEndsAt);
    const pastDueSince = computePastDueSince(
      args.status,
      subscription.status as SubscriptionStatus,
      subscription.pastDueSince,
      now,
    );

    await ctx.db.patch(subscription._id, {
      stripeSubscriptionId: args.stripeSubscriptionId ?? subscription.stripeSubscriptionId,
      status: args.status,
      priceId: args.priceId ?? subscription.priceId,
      currentPeriodEnd: args.currentPeriodEnd ?? subscription.currentPeriodEnd,
      trialEndsAt,
      pastDueSince,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd,
      updatedAt: now,
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
    // Use .first() to be resilient to potential duplicates from race conditions
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();
  },
});

/**
 * Get subscription by user ID (internal use).
 */
export const getByUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Use .first() to be resilient to potential duplicates from race conditions
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/**
 * DEV ONLY: Clear stale Stripe customer data from all subscriptions.
 * Use when database has stripeCustomerIds from a different Stripe account.
 *
 * Run with: npx convex run subscriptions:devClearStripeData
 *
 * Safety:
 * - Internal mutation only (not callable from client)
 * - Refuses to run if production Stripe key detected (checked BEFORE any mutations)
 */
export const devClearStripeData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // CRITICAL: Check for production key BEFORE any mutations to avoid partial updates
    const stripeKey = process.env.STRIPE_SECRET_KEY || "";
    if (stripeKey.startsWith("sk_live_")) {
      throw new Error("Refusing to clear data: production Stripe key detected");
    }

    const subscriptions = await ctx.db.query("subscriptions").collect();

    let cleared = 0;
    const details: string[] = [];
    const now = Date.now();
    const trialEnd = now + TRIAL_DURATION_MS;

    for (const sub of subscriptions) {
      if (sub.stripeCustomerId || sub.stripeSubscriptionId) {
        details.push(`Subscription ${sub._id}: cleared ${sub.stripeCustomerId || "no customer"}`);
        await ctx.db.patch(sub._id, {
          stripeCustomerId: undefined,
          stripeSubscriptionId: undefined,
          status: "trialing",
          priceId: undefined,
          cancelAtPeriodEnd: false,
          // Restore valid trial window to prevent immediate access revocation
          trialEndsAt: trialEnd,
          currentPeriodEnd: trialEnd,
          pastDueSince: undefined,
          updatedAt: now,
        });
        cleared++;
      }
    }

    return {
      success: true,
      message: `Cleared Stripe data from ${cleared} subscription(s). All reset to trial state with ${TRIAL_DAYS}-day trial.`,
      cleared,
      details,
    };
  },
});
