import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

/**
 * Webhook event tracking for idempotency.
 * Prevents duplicate processing when Stripe retries events.
 */

/**
 * Check if an event has already been processed (public, for API routes).
 */
export const isProcessed = query({
  args: {
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    return existing !== null;
  },
});

/**
 * Mark an event as processed (public, for API routes).
 * Should be called after successful processing.
 */
export const markProcessed = mutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if already exists (idempotent)
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("webhookEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      processedAt: Date.now(),
    });
  },
});

/**
 * Cleanup old webhook events.
 * Keep events for 7 days to handle late retries.
 */
export const cleanup = internalMutation({
  args: {
    maxAgeMs: v.optional(v.number()), // Default: 7 days
  },
  handler: async (ctx, args) => {
    const maxAge = args.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    const staleEntries = await ctx.db
      .query("webhookEvents")
      .filter((q) => q.lt(q.field("processedAt"), cutoff))
      .collect();

    let deleted = 0;
    for (const entry of staleEntries) {
      await ctx.db.delete(entry._id);
      deleted++;
    }

    return { deleted };
  },
});
