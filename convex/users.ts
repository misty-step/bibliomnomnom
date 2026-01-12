import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { TRIAL_DURATION_MS } from "@/lib/constants";

// Query current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db.get(userId);
  },
});

// Ensure user exists (triggers lazy creation on login)
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    // Simply calling requireAuth will create user if needed (in mutation context)
    const userId = await requireAuth(ctx);
    return await ctx.db.get(userId);
  },
});

// Create or update user from Clerk webhook
export const createOrUpdateUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    const userData = {
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
    };

    if (existingUser) {
      await ctx.db.patch(existingUser._id, userData);
      return existingUser._id;
    }

    // Create new user
    const newUserId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      ...userData,
    });

    // Auto-create trial subscription for new users
    const now = Date.now();
    const trialEnd = now + TRIAL_DURATION_MS;
    await ctx.db.insert("subscriptions", {
      userId: newUserId,
      status: "trialing",
      currentPeriodEnd: trialEnd,
      trialEndsAt: trialEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    return newUserId;
  },
});

// Delete user from Clerk webhook (idempotent)
export const deleteUser = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) return;

    await ctx.db.delete(user._id);
  },
});
