import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth, getAuthOrNull } from "./auth";
import type { Doc, Id } from "./_generated/dataModel";

// --- Types ---

export type ProfileStats = {
  totalBooks: number;
  booksRead: number;
  pagesRead: number;
  audiobookRatio: number;
  averagePace: number;
  topAuthors: Array<{ author: string; count: number }>;
};

export type BookRecommendation = {
  title: string;
  author: string;
  reason: string;
};

export type ProfileInsights = {
  tasteTagline: string;
  literaryTaste: {
    genres: string[];
    moods: string[];
    complexity: "accessible" | "moderate" | "literary";
  };
  thematicConnections: Array<{ theme: string; books: string[] }>;
  readingEvolution?: string;
  confidence: "early" | "developing" | "strong";
  recommendations?: {
    continueReading: BookRecommendation[];
    freshPerspective: BookRecommendation[];
    revisit: BookRecommendation[];
  };
};

// Thresholds
const MIN_BOOKS_FOR_PROFILE = 20;
const STALENESS_DAYS = 7;
const STALENESS_BOOK_DELTA = 5;
const STALENESS_BOOK_RATIO = 0.2;
const REGENERATION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// --- Stats Computation (Pure Functions) ---

function groupByAuthor(books: Doc<"books">[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const book of books) {
    const author = book.author.trim();
    counts.set(author, (counts.get(author) ?? 0) + 1);
  }
  return counts;
}

function getBookTimestamp(book: Doc<"books">): number {
  // Prefer explicit dateFinished, fallback to updatedAt, then creationTime
  return book.dateFinished ?? book.updatedAt ?? book._creationTime;
}

function calculatePace(books: Doc<"books">[]): number {
  if (books.length < 2) return 0;

  // Get timestamps for all read books
  const timestamps = books.map(getBookTimestamp).sort((a, b) => a - b);
  const first = timestamps[0]!;
  const last = timestamps[timestamps.length - 1]!;
  const monthsSpan = (last - first) / (1000 * 60 * 60 * 24 * 30);
  return monthsSpan > 0 ? books.length / monthsSpan : 0;
}

export function computeStats(books: Doc<"books">[]): ProfileStats {
  const read = books.filter((b) => b.status === "read");
  const audiobooks = books.filter((b) => b.isAudiobook);

  // Pages: sum pageCount, estimate 250 for missing
  const pages = books.reduce((sum, b) => sum + (b.pageCount ?? 250), 0);

  // Pace: books per month based on read books over time
  const pace = calculatePace(read);

  // Top authors: group by author, sort by count
  const authorCounts = groupByAuthor(books);
  const topAuthors = Array.from(authorCounts.entries())
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalBooks: books.length,
    booksRead: read.length,
    pagesRead: pages,
    audiobookRatio: books.length > 0 ? audiobooks.length / books.length : 0,
    averagePace: Math.round(pace * 10) / 10,
    topAuthors,
  };
}

function isProfileStale(profile: Doc<"readerProfiles">, currentBookCount: number): boolean {
  // Never generated
  if (!profile.lastGeneratedAt) return true;

  // Failed generation should be retryable
  if (profile.generationStatus === "failed") return true;

  // More than 7 days old
  const staleDays = STALENESS_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() - profile.lastGeneratedAt > staleDays) return true;

  // Significant book count change (>20% or 5+ books)
  const countAtGen = profile.bookCountAtGeneration ?? 0;
  const delta = currentBookCount - countAtGen;
  if (delta >= STALENESS_BOOK_DELTA) return true;
  if (countAtGen > 0 && delta / countAtGen > STALENESS_BOOK_RATIO) return true;

  return false;
}

function generateUsername(name: string | undefined, clerkId: string): string {
  if (name) {
    // Convert name to URL-safe slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20);
    if (slug.length >= 3) {
      return slug;
    }
  }
  // Fallback: use first 8 chars of clerkId
  return `reader-${clerkId.slice(0, 8).toLowerCase()}`;
}

// --- Queries ---

/**
 * Get own profile stats (fresh computation, no cache)
 * Used for displaying stats independently of insights
 */
export const getStats = query({
  args: {},
  handler: async (ctx): Promise<ProfileStats | null> => {
    const userId = await getAuthOrNull(ctx);
    if (!userId) return null;

    const books = await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return computeStats(books);
  },
});

/**
 * Get current user's profile with status
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthOrNull(ctx);
    if (!userId) return { status: "unauthenticated" as const };

    // Get book count first
    const books = await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const bookCount = books.length;

    // Check if below threshold
    if (bookCount < MIN_BOOKS_FOR_PROFILE) {
      return {
        status: "below_threshold" as const,
        bookCount,
        booksNeeded: MIN_BOOKS_FOR_PROFILE - bookCount,
      };
    }

    // Look for existing profile
    const profile = await ctx.db
      .query("readerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      // No profile exists yet
      return {
        status: "no_profile" as const,
        bookCount,
        stats: computeStats(books),
      };
    }

    // Check generation status
    const isCurrentlyGenerating =
      profile.generationStatus === "pending" || profile.generationStatus === "generating";

    // If regenerating (has previous insights), show profile with spinner
    // If first generation (no insights yet), show full generating screen
    if (isCurrentlyGenerating && !profile.insights) {
      return {
        status: "generating" as const,
        bookCount,
        profile: {
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          stats: profile.stats,
          isPublic: profile.isPublic,
        },
      };
    }

    if (profile.generationStatus === "failed") {
      return {
        status: "failed" as const,
        bookCount,
        error: profile.generationError ?? "Generation failed",
        profile: {
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          stats: computeStats(books), // Fresh stats
          isPublic: profile.isPublic,
        },
      };
    }

    // Profile is complete (or regenerating with existing insights)
    const isStale = isProfileStale(profile, bookCount);
    return {
      status: "ready" as const,
      bookCount,
      isStale,
      isRegenerating: isCurrentlyGenerating,
      profile: {
        _id: profile._id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        stats: computeStats(books), // Always fresh stats
        insights: profile.insights,
        isPublic: profile.isPublic,
        lastGeneratedAt: profile.lastGeneratedAt,
      },
    };
  },
});

/**
 * Get public profile by username (no auth required)
 */
export const getPublic = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const profile = await ctx.db
      .query("readerProfiles")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();

    if (!profile || !profile.isPublic) return null;
    if (profile.generationStatus !== "complete" || !profile.insights) return null;

    // Return sanitized public data
    return {
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      stats: {
        totalBooks: profile.stats.totalBooks,
        booksRead: profile.stats.booksRead,
        pagesRead: profile.stats.pagesRead,
        averagePace: profile.stats.averagePace,
      },
      insights: {
        tasteTagline: profile.insights.tasteTagline,
        readerArchetype: profile.insights.readerArchetype,
        literaryTaste: profile.insights.literaryTaste,
        thematicConnections: profile.insights.thematicConnections,
        confidence: profile.insights.confidence,
      },
    };
  },
});

/**
 * Check if a username is available
 */
export const checkUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const userId = await getAuthOrNull(ctx);

    // Validate format
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(username)) {
      return { available: false, reason: "Invalid format" };
    }

    const existing = await ctx.db
      .query("readerProfiles")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();

    if (existing && existing.userId !== userId) {
      return { available: false, reason: "Username taken" };
    }

    return { available: true };
  },
});

// --- Internal Queries (for actions) ---

export const getProfileForAction = internalQuery({
  args: { profileId: v.id("readerProfiles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.profileId);
  },
});

export const getBooksForProfile = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getUserForProfile = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// --- Mutations ---

/**
 * Create or update profile and trigger insight generation
 */
export const generateProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    // Get user info for defaults
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Get books and verify threshold
    const books = await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (books.length < MIN_BOOKS_FOR_PROFILE) {
      throw new Error(`Need at least ${MIN_BOOKS_FOR_PROFILE} books to generate profile`);
    }

    // Check for existing profile
    const existing = await ctx.db
      .query("readerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      // Check cooldown
      if (existing.lastGeneratedAt && now - existing.lastGeneratedAt < REGENERATION_COOLDOWN_MS) {
        throw new Error("Please wait before regenerating");
      }

      // Update to pending and trigger regeneration
      await ctx.db.patch(existing._id, {
        generationStatus: "pending",
        generationError: undefined,
        stats: computeStats(books),
        updatedAt: now,
      });

      await ctx.scheduler.runAfter(0, internal.actions.profileInsights.generate, {
        profileId: existing._id,
      });

      return existing._id;
    }

    // Create new profile
    const username = generateUsername(user.name, user.clerkId);

    // Ensure username is unique
    let finalUsername = username;
    let attempt = 0;
    while (true) {
      const conflict = await ctx.db
        .query("readerProfiles")
        .withIndex("by_username", (q) => q.eq("username", finalUsername))
        .unique();
      if (!conflict) break;
      attempt++;
      finalUsername = `${username}-${attempt}`;
      if (attempt > 100) throw new Error("Could not generate unique username");
    }

    const profileId = await ctx.db.insert("readerProfiles", {
      userId,
      username: finalUsername,
      displayName: user.name,
      avatarUrl: user.imageUrl,
      stats: computeStats(books),
      insights: undefined,
      generationStatus: "pending",
      generationError: undefined,
      lastGeneratedAt: undefined,
      bookCountAtGeneration: undefined,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    });

    // Schedule insight generation
    await ctx.scheduler.runAfter(0, internal.actions.profileInsights.generate, { profileId });

    return profileId;
  },
});

/**
 * Toggle public sharing
 */
export const togglePublic = mutation({
  args: { isPublic: v.boolean() },
  handler: async (ctx, { isPublic }) => {
    const userId = await requireAuth(ctx);

    const profile = await ctx.db
      .query("readerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("Profile not found");

    // Can only make public if insights are complete
    if (isPublic && profile.generationStatus !== "complete") {
      throw new Error("Cannot share incomplete profile");
    }

    await ctx.db.patch(profile._id, {
      isPublic,
      updatedAt: Date.now(),
    });

    return { isPublic };
  },
});

/**
 * Update username
 */
export const updateUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const userId = await requireAuth(ctx);

    // Validate format
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(username)) {
      throw new Error(
        "Username must be 3-30 characters, lowercase letters, numbers, and hyphens only",
      );
    }

    const profile = await ctx.db
      .query("readerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("Profile not found");

    // Check uniqueness
    const existing = await ctx.db
      .query("readerProfiles")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();

    if (existing && existing._id !== profile._id) {
      throw new Error("Username already taken");
    }

    await ctx.db.patch(profile._id, {
      username,
      updatedAt: Date.now(),
    });

    return { username };
  },
});

/**
 * Update display name
 */
export const updateDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, { displayName }) => {
    const userId = await requireAuth(ctx);

    if (displayName.length > 50) {
      throw new Error("Display name too long");
    }

    const profile = await ctx.db
      .query("readerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      displayName: displayName.trim() || undefined,
      updatedAt: Date.now(),
    });

    return { displayName };
  },
});

// --- Internal Mutations (for actions) ---

export const updateGenerationStatus = internalMutation({
  args: {
    profileId: v.id("readerProfiles"),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      generationStatus: args.status,
      generationError: args.error,
      updatedAt: Date.now(),
    });
  },
});

// Legacy recommendation format
const legacyRecommendationValidator = v.object({
  title: v.string(),
  author: v.string(),
  reason: v.string(),
});

// New recommendation format with rich reasoning
const newRecommendationValidator = v.object({
  title: v.string(),
  author: v.string(),
  reason: v.string(), // Short hook < 80 chars
  detailedReason: v.optional(v.string()), // 2-3 sentence explanation
  connectionBooks: v.optional(v.array(v.string())), // Titles from user's library
  badges: v.optional(v.array(v.string())), // "similar-atmosphere", "award-winner", etc.
  isReread: v.optional(v.boolean()),
});

// Evolution phase for structured timeline
const evolutionPhaseValidator = v.object({
  title: v.string(), // "The Thriller Years"
  period: v.string(), // "2019-2021"
  description: v.string(),
  keyBooks: v.array(v.string()), // 2-4 representative titles
  catalyst: v.optional(v.string()), // Book that triggered shift
});

// Structured evolution with phases
const structuredEvolutionValidator = v.object({
  phases: v.array(evolutionPhaseValidator),
  narrative: v.string(), // Overall 2-3 paragraph story
  trajectory: v.string(), // Future speculation
});

export const saveInsights = internalMutation({
  args: {
    profileId: v.id("readerProfiles"),
    insights: v.object({
      tasteTagline: v.string(),
      readerArchetype: v.optional(v.string()),
      literaryTaste: v.object({
        genres: v.array(v.string()),
        moods: v.array(v.string()),
        complexity: v.union(v.literal("accessible"), v.literal("moderate"), v.literal("literary")),
      }),
      thematicConnections: v.array(
        v.object({
          theme: v.string(),
          description: v.optional(v.string()),
          books: v.array(
            v.union(
              v.string(), // Legacy format
              v.object({
                title: v.string(),
                author: v.string(),
                coverUrl: v.optional(v.string()),
              }),
            ),
          ),
        }),
      ),
      readingEvolution: v.optional(v.union(v.string(), structuredEvolutionValidator)),
      evolutionSpeculation: v.optional(v.string()),
      confidence: v.union(v.literal("early"), v.literal("developing"), v.literal("strong")),
      recommendations: v.optional(
        v.object({
          // New format (primary)
          goDeeper: v.optional(v.array(newRecommendationValidator)),
          goWider: v.optional(v.array(newRecommendationValidator)),
          // Legacy format (backward compat)
          continueReading: v.optional(v.array(legacyRecommendationValidator)),
          freshPerspective: v.optional(v.array(legacyRecommendationValidator)),
          revisit: v.optional(v.array(legacyRecommendationValidator)),
        }),
      ),
    }),
    bookCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      insights: args.insights,
      generationStatus: "complete",
      generationError: undefined,
      lastGeneratedAt: Date.now(),
      bookCountAtGeneration: args.bookCount,
      updatedAt: Date.now(),
    });
  },
});
