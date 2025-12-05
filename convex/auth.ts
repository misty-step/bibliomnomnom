import { QueryCtx, MutationCtx, ActionCtx, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Internal helper: Looks up Convex user ID from Clerk user ID.
 *
 * @internal - Do not call directly. Use requireAuth() or getAuthOrNull() instead.
 */
async function getUserByClerkId(
  ctx: QueryCtx | MutationCtx,
  clerkId: string,
): Promise<Id<"users"> | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();

  return user?._id ?? null;
}

async function ensureUserExists(
  ctx: QueryCtx | MutationCtx,
  identity: NonNullable<Awaited<ReturnType<QueryCtx["auth"]["getUserIdentity"]>>>,
  existingUserId: Id<"users"> | null,
): Promise<Id<"users"> | null> {
  if (existingUserId || !("insert" in ctx.db)) {
    // Already exists or read-only context (queries cannot create users)
    return existingUserId;
  }

  const email =
    typeof identity.email === "string"
      ? identity.email
      : typeof identity.emailVerified === "string"
        ? identity.emailVerified
        : `no-email-${identity.subject}@placeholder.local`;

  const imageUrl =
    typeof identity.pictureUrl === "string"
      ? identity.pictureUrl
      : typeof identity.picture === "string"
        ? identity.picture
        : undefined;

  let insertError: unknown;
  try {
    const newId = await (ctx as MutationCtx).db.insert("users", {
      clerkId: identity.subject,
      email,
      name: identity.name,
      imageUrl,
    });
    return newId;
  } catch (err) {
    insertError = err;
    // fall through to re-read & de-duplicate
  }

  // Best-effort de-duplication: keep the earliest row, delete the rest.
  const matches = await (ctx as MutationCtx).db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .collect();

  if (matches.length > 0) {
    const sorted = matches.sort((a, b) => a._creationTime - b._creationTime);
    const keeper = sorted[0];
    const dupes = sorted.slice(1);
    for (const dupe of dupes) {
      await (ctx as MutationCtx).db.delete(dupe._id);
    }
    // keeper is guaranteed to exist since matches.length > 0
    return keeper!._id;
  }

  // If nothing found, bubble original error for visibility.
  if (insertError) {
    throw insertError;
  }

  return null;
}

/**
 * Validates authentication and returns the authenticated user's Convex ID.
 *
 * **Required for all mutations** - Call at the start of every mutation handler
 * to ensure only authenticated users can modify data.
 *
 * Uses lazy user creation for mutations only: If authenticated user doesn't exist in database,
 * automatically creates them. Queries remain read-only and will return an error if the user row
 * is missing so callers must provision via mutation first.
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
export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated: User must be signed in");
  }

  const existing = await getUserByClerkId(ctx, identity.subject);
  const userId = await ensureUserExists(ctx, identity, existing);

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
 * Lazy creation runs only for mutation contexts (queries are read-only). Queries that need
 * a user row should ensure it exists via a mutation (e.g., ensureUser) before calling.
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
export async function getAuthOrNull(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const existing = await getUserByClerkId(ctx, identity.subject);
  return ensureUserExists(ctx, identity, existing);
}

/**
 * Internal query: Lookup user by Clerk ID (for actions)
 *
 * Actions cannot access ctx.db directly, so they call this internal query.
 */
export const getUserByClerkIdInternal = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args): Promise<Id<"users"> | null> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    return user?._id ?? null;
  },
});

/**
 * Action-compatible auth validation (no lazy user creation)
 *
 * **Use in actions only** - Actions cannot access ctx.db, so this helper
 * uses ctx.runQuery() to look up the user.
 *
 * Unlike requireAuth(), this does NOT create users automatically. User must
 * already exist in database (created via Clerk webhook or mutation).
 *
 * @throws {Error} "Unauthenticated" if no Clerk session
 * @throws {Error} "User not found" if user doesn't exist in database
 *
 * @example
 * ```typescript
 * export const fetchData = action({
 *   handler: async (ctx, args) => {
 *     const userId = await requireAuthAction(ctx);
 *     // Make external API call...
 *   },
 * });
 * ```
 */
export async function requireAuthAction(ctx: ActionCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated: User must be signed in");
  }

  const userId = await ctx.runQuery(internal.auth.getUserByClerkIdInternal, {
    clerkId: identity.subject,
  });

  if (!userId) {
    throw new Error("User not found in database");
  }

  return userId;
}
