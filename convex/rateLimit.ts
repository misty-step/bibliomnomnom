import { v } from "convex/values";
import { mutation, internalMutation, internalQuery } from "./_generated/server";

/**
 * Distributed rate limiter using Convex as the backing store.
 * Works correctly across serverless instances (unlike in-memory Maps).
 *
 * Uses sliding window approach: stores array of timestamps within window.
 */

/**
 * Check and record a rate limit hit (public, for API routes).
 * Returns success status and remaining requests.
 *
 * Security: Uses key prefix to namespace, no sensitive data exposed.
 * Called from Next.js API routes before processing requests.
 */
export const check = mutation({
  args: {
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const { key, limit, windowMs } = args;
    const now = Date.now();
    const cutoff = now - windowMs;

    // Get existing rate limit record
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    // Filter timestamps to only those within the window
    const validTimestamps = existing ? existing.timestamps.filter((ts) => ts > cutoff) : [];

    // Check if limit exceeded
    if (validTimestamps.length >= limit) {
      const oldestInWindow = Math.min(...validTimestamps);
      const resetMs = oldestInWindow + windowMs - now;
      return {
        success: false,
        remaining: 0,
        resetMs: Math.max(0, resetMs),
      };
    }

    // Add current timestamp
    const newTimestamps = [...validTimestamps, now];

    // Update or create record
    if (existing) {
      await ctx.db.patch(existing._id, {
        timestamps: newTimestamps,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("rateLimits", {
        key,
        timestamps: newTimestamps,
        updatedAt: now,
      });
    }

    return {
      success: true,
      remaining: limit - newTimestamps.length,
      resetMs: windowMs,
    };
  },
});

/**
 * Check and record a rate limit hit (internal use).
 * Returns success status and remaining requests.
 */
export const checkAndRecord = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const { key, limit, windowMs } = args;
    const now = Date.now();
    const cutoff = now - windowMs;

    // Get existing rate limit record
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    // Filter timestamps to only those within the window
    const validTimestamps = existing ? existing.timestamps.filter((ts) => ts > cutoff) : [];

    // Check if limit exceeded
    if (validTimestamps.length >= limit) {
      const oldestInWindow = Math.min(...validTimestamps);
      const resetMs = oldestInWindow + windowMs - now;
      return {
        success: false,
        remaining: 0,
        resetMs: Math.max(0, resetMs),
      };
    }

    // Add current timestamp
    const newTimestamps = [...validTimestamps, now];

    // Update or create record
    if (existing) {
      await ctx.db.patch(existing._id, {
        timestamps: newTimestamps,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("rateLimits", {
        key,
        timestamps: newTimestamps,
        updatedAt: now,
      });
    }

    return {
      success: true,
      remaining: limit - newTimestamps.length,
      resetMs: windowMs,
    };
  },
});

/**
 * Query current rate limit status without recording a hit.
 * Useful for displaying remaining requests to users.
 */
export const getStatus = internalQuery({
  args: {
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const { key, limit, windowMs } = args;
    const now = Date.now();
    const cutoff = now - windowMs;

    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    const validTimestamps = existing ? existing.timestamps.filter((ts) => ts > cutoff) : [];

    return {
      remaining: Math.max(0, limit - validTimestamps.length),
      used: validTimestamps.length,
      resetMs:
        validTimestamps.length > 0 ? Math.min(...validTimestamps) + windowMs - now : windowMs,
    };
  },
});

/**
 * Cleanup old rate limit entries.
 * Call periodically via cron to prevent table bloat.
 */
export const cleanup = internalMutation({
  args: {
    maxAgeMs: v.optional(v.number()), // Default: 24 hours
  },
  handler: async (ctx, args) => {
    const maxAge = args.maxAgeMs ?? 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    // Find entries not updated recently
    const staleEntries = await ctx.db
      .query("rateLimits")
      .filter((q) => q.lt(q.field("updatedAt"), cutoff))
      .collect();

    let deleted = 0;
    for (const entry of staleEntries) {
      await ctx.db.delete(entry._id);
      deleted++;
    }

    return { deleted };
  },
});
