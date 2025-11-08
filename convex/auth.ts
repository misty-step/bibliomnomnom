import { QueryCtx, MutationCtx } from "./_generated/server";

async function getUserByClerkId(
  ctx: QueryCtx | MutationCtx,
  clerkId: string
): Promise<string | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();

  return user?._id ?? null;
}

// Returns authenticated user ID or throws
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated: User must be signed in");
  }

  const userId = await getUserByClerkId(ctx, identity.subject);
  if (!userId) {
    throw new Error("User not found in database");
  }

  return userId;
}

// Returns authenticated user ID or null
export async function getAuthOrNull(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return getUserByClerkId(ctx, identity.subject);
}
