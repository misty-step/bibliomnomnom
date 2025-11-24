import { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Internal helper: Looks up Convex user ID from Clerk user ID.
 *
 * @internal - Do not call directly. Use requireAuth() or getAuthOrNull() instead.
 */
async function getUserByClerkId(
  ctx: QueryCtx | MutationCtx,
  clerkId: string
): Promise<Id<"users"> | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();

  return user?._id ?? null;
}

/**
 * Validates authentication and returns the authenticated user's Convex ID.
 *
 * **Required for all mutations** - Call at the start of every mutation handler
 * to ensure only authenticated users can modify data.
 *
 * Uses lazy user creation: If authenticated user doesn't exist in database,
 * automatically creates them. No webhook required.
 *
 * @throws {Error} "Unauthenticated" if no Clerk session present
 *
 * @example
 * ```typescript
 * export const create = mutation({
 *   handler: async (ctx, args) => {
 *     const userId = await requireAuth(ctx); // Throws if unauthenticated
 *     await ctx.db.insert("books", { userId, ...args });
 *   },
 * });
 * ```
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated: User must be signed in");
  }

  let userId = await getUserByClerkId(ctx, identity.subject);

  // Lazy user creation: Only possible in mutation contexts (queries are read-only)
  if (!userId && "insert" in ctx.db) {
    // Type-safe: We know this is a MutationCtx since insert exists
    userId = await (ctx as MutationCtx).db.insert("users", {
      clerkId: identity.subject,
      email: identity.email ?? identity.emailVerified ?? "unknown@example.com",
      name: identity.name,
      imageUrl: identity.pictureUrl ?? identity.picture,
    });
  }

  if (!userId) {
    throw new Error("User not found in database");
  }

  return userId;
}

/**
 * Returns authenticated user ID or null (non-throwing variant of requireAuth).
 *
 * **Use for optional auth queries** - Returns null if no session instead of throwing.
 * Prefer requireAuth() for mutations (which should always require auth).
 *
 * Uses lazy user creation: If authenticated user doesn't exist in database,
 * automatically creates them. No webhook required.
 *
 * @returns User ID if authenticated, null otherwise
 *
 * @example
 * ```typescript
 * export const getPublicOrPrivate = query({
 *   handler: async (ctx, args) => {
 *     const userId = await getAuthOrNull(ctx);
 *     // If logged in, return private data; otherwise public only
 *     return userId ? getPrivateView(userId) : getPublicView();
 *   },
 * });
 * ```
 */
export async function getAuthOrNull(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  let userId = await getUserByClerkId(ctx, identity.subject);

  // Lazy user creation: Only possible in mutation contexts (queries are read-only)
  if (!userId && "insert" in ctx.db) {
    // Type-safe: We know this is a MutationCtx since insert exists
    userId = await (ctx as MutationCtx).db.insert("users", {
      clerkId: identity.subject,
      email: identity.email ?? identity.emailVerified ?? "unknown@example.com",
      name: identity.name,
      imageUrl: identity.pictureUrl ?? identity.picture,
    });
  }

  return userId;
}
