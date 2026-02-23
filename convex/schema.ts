import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    username: v.optional(v.string()), // URL-safe slug for public profiles
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username", ["username"]),
  books: defineTable({
    userId: v.id("users"),
    title: v.string(),
    author: v.string(),
    description: v.optional(v.string()),
    isbn: v.optional(v.string()),
    edition: v.optional(v.string()),
    publishedYear: v.optional(v.number()),
    pageCount: v.optional(v.number()),
    status: v.union(v.literal("want-to-read"), v.literal("currently-reading"), v.literal("read")),
    isFavorite: v.boolean(),
    isAudiobook: v.boolean(),
    privacy: v.union(v.literal("private"), v.literal("public")),
    timesRead: v.number(),
    dateStarted: v.optional(v.number()),
    dateFinished: v.optional(v.number()),
    coverUrl: v.optional(v.string()),
    apiCoverUrl: v.optional(v.string()),
    apiId: v.optional(v.string()),
    apiSource: v.optional(
      v.union(v.literal("google-books"), v.literal("open-library"), v.literal("manual")),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_favorite", ["userId", "isFavorite"]),
  notes: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    type: v.union(v.literal("note"), v.literal("quote"), v.literal("reflection")),
    content: v.string(),
    page: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_book", ["bookId"])
    .index("by_user", ["userId"])
    .index("by_user_updatedAt", ["userId", "updatedAt"]),
  listeningSessions: defineTable({
    userId: v.id("users"),
    bookId: v.id("books"),
    status: v.union(
      v.literal("recording"),
      v.literal("transcribing"),
      v.literal("synthesizing"),
      v.literal("review"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    audioUrl: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    capReached: v.boolean(),
    capDurationMs: v.number(),
    warningDurationMs: v.number(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    transcriptLive: v.optional(v.string()),
    transcriptProvider: v.optional(v.string()),
    transcriptChars: v.optional(v.number()),
    rawNoteId: v.optional(v.id("notes")),
    synthesizedNoteIds: v.optional(v.array(v.id("notes"))),
    lastError: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    lastRetryAt: v.optional(v.number()),
    transcribeLatencyMs: v.optional(v.number()),
    synthesisLatencyMs: v.optional(v.number()),
    transcribeFallbackUsed: v.optional(v.boolean()),
    synthesisProvider: v.optional(v.string()),
    degradedMode: v.optional(v.boolean()),
    estimatedCostUsd: v.optional(v.number()),
    failedStage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_book", ["bookId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_book_status", ["userId", "bookId", "status"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_status", ["status"])
    .index("by_status_updatedAt", ["status", "updatedAt"])
    .index("by_createdAt", ["createdAt"]),
  listeningSessionTranscripts: defineTable({
    userId: v.id("users"),
    bookId: v.id("books"),
    sessionId: v.id("listeningSessions"),
    type: v.union(v.literal("segment"), v.literal("final")),
    provider: v.optional(v.string()),
    content: v.string(),
    chars: v.number(),
    segmentStartMs: v.optional(v.number()),
    segmentEndMs: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user_session", ["userId", "sessionId"])
    .index("by_book", ["bookId"])
    .index("by_createdAt", ["createdAt"]),
  listeningSessionArtifacts: defineTable({
    userId: v.id("users"),
    bookId: v.id("books"),
    sessionId: v.id("listeningSessions"),
    kind: v.union(
      v.literal("insight"),
      v.literal("openQuestion"),
      v.literal("quote"),
      v.literal("followUpQuestion"),
      v.literal("contextExpansion"),
    ),
    title: v.string(),
    content: v.string(),
    provider: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user_session", ["userId", "sessionId"])
    .index("by_book", ["bookId"])
    .index("by_kind", ["kind", "createdAt"]),
  importRuns: defineTable({
    userId: v.id("users"),
    importRunId: v.string(),
    status: v.union(v.literal("previewed"), v.literal("committed"), v.literal("failed")),
    sourceType: v.string(),
    page: v.number(),
    totalPages: v.number(),
    counts: v.object({
      rows: v.number(),
      created: v.number(),
      merged: v.number(),
      skipped: v.number(),
      errors: v.number(),
    }),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_run", ["userId", "importRunId"]),
  importPreviews: defineTable({
    userId: v.id("users"),
    importRunId: v.string(),
    page: v.number(),
    books: v.array(
      v.object({
        tempId: v.string(),
        title: v.string(),
        author: v.string(),
        status: v.optional(
          v.union(v.literal("want-to-read"), v.literal("currently-reading"), v.literal("read")),
        ),
        isbn: v.optional(v.string()),
        edition: v.optional(v.string()),
        publishedYear: v.optional(v.number()),
        pageCount: v.optional(v.number()),
        isAudiobook: v.optional(v.boolean()),
        isFavorite: v.optional(v.boolean()),
        dateStarted: v.optional(v.number()),
        dateFinished: v.optional(v.number()),
        coverUrl: v.optional(v.string()),
        apiSource: v.optional(
          v.union(v.literal("google-books"), v.literal("open-library"), v.literal("manual")),
        ),
        apiId: v.optional(v.string()),
        privacy: v.optional(v.union(v.literal("private"), v.literal("public"))),
      }),
    ),
    createdAt: v.number(),
  })
    .index("by_user_run_page", ["userId", "importRunId", "page"])
    .index("by_run_page", ["importRunId", "page"]),
  readerProfiles: defineTable({
    userId: v.id("users"),

    // User identity (for public display)
    username: v.string(), // unique, URL-safe slug
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),

    // Computed stats (refreshed on access)
    stats: v.object({
      totalBooks: v.number(),
      booksRead: v.number(),
      pagesRead: v.number(),
      audiobookRatio: v.number(),
      averagePace: v.number(),
      topAuthors: v.array(
        v.object({
          author: v.string(),
          count: v.number(),
        }),
      ),
    }),

    // AI-generated insights (cached)
    insights: v.optional(
      v.object({
        tasteTagline: v.string(),
        readerArchetype: v.optional(v.string()), // "The Polymath", "Digital Sovereign", etc.
        literaryTaste: v.object({
          genres: v.array(v.string()),
          moods: v.array(v.string()),
          complexity: v.union(
            v.literal("accessible"),
            v.literal("moderate"),
            v.literal("literary"),
          ),
        }),
        thematicConnections: v.array(
          v.object({
            theme: v.string(),
            description: v.optional(v.string()), // Theme description for detail panel
            // Support both legacy string format and new object format
            books: v.array(
              v.union(
                v.string(), // Legacy: just title
                v.object({
                  title: v.string(),
                  author: v.string(),
                  coverUrl: v.optional(v.string()), // From user's library
                }),
              ),
            ),
          }),
        ),
        // Enhanced reading evolution with timeline phases (replaces simple string)
        readingEvolution: v.optional(
          v.union(
            // Legacy: simple string format
            v.string(),
            // New: structured timeline format
            v.object({
              phases: v.array(
                v.object({
                  title: v.string(), // "The Thriller Years"
                  period: v.string(), // "2019-2021"
                  description: v.string(),
                  keyBooks: v.array(v.string()), // 2-4 representative titles
                  catalyst: v.optional(v.string()), // Book that triggered shift
                }),
              ),
              narrative: v.string(), // Overall 2-3 paragraph story
              trajectory: v.string(), // Future speculation
            }),
          ),
        ),
        evolutionSpeculation: v.optional(v.string()), // Legacy: kept for backward compat
        confidence: v.union(v.literal("early"), v.literal("developing"), v.literal("strong")),
        // Enhanced recommendation structure with reasoning and badges
        recommendations: v.optional(
          v.object({
            // Primary format with rich reasoning
            goDeeper: v.optional(
              v.array(
                v.object({
                  title: v.string(),
                  author: v.string(),
                  reason: v.string(), // Short hook < 80 chars
                  detailedReason: v.optional(v.string()), // 2-3 sentence explanation
                  connectionBooks: v.optional(v.array(v.string())), // Titles from user's library
                  badges: v.optional(v.array(v.string())), // "similar-atmosphere", "award-winner", etc.
                  isReread: v.optional(v.boolean()),
                }),
              ),
            ),
            goWider: v.optional(
              v.array(
                v.object({
                  title: v.string(),
                  author: v.string(),
                  reason: v.string(), // Short hook < 80 chars
                  detailedReason: v.optional(v.string()), // 2-3 sentence explanation
                  connectionBooks: v.optional(v.array(v.string())), // Titles from user's library
                  badges: v.optional(v.array(v.string())), // "genre-defining", "cult-classic", etc.
                }),
              ),
            ),
            // Legacy format - for backward compatibility
            continueReading: v.optional(
              v.array(
                v.object({
                  title: v.string(),
                  author: v.string(),
                  reason: v.string(),
                }),
              ),
            ),
            freshPerspective: v.optional(
              v.array(
                v.object({
                  title: v.string(),
                  author: v.string(),
                  reason: v.string(),
                }),
              ),
            ),
            revisit: v.optional(
              v.array(
                v.object({
                  title: v.string(),
                  author: v.string(),
                  reason: v.string(),
                }),
              ),
            ),
          }),
        ),
      }),
    ),

    // Generation state
    generationStatus: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    generationError: v.optional(v.string()),
    lastGeneratedAt: v.optional(v.number()),
    bookCountAtGeneration: v.optional(v.number()),

    // Sharing
    isPublic: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_username", ["username"])
    .index("by_public", ["isPublic"]),
  subscriptions: defineTable({
    userId: v.id("users"),
    stripeCustomerId: v.optional(v.string()),
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
    cancelAtPeriodEnd: v.boolean(),
    // Timestamp when status transitioned to past_due (for grace period calculation)
    // Only set on transition TO past_due, cleared when status changes to something else
    pastDueSince: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_stripe_customer", ["stripeCustomerId"]),
  // Rate limiting for API endpoints (works across serverless instances)
  rateLimits: defineTable({
    key: v.string(), // e.g., "checkout:user_123"
    timestamps: v.array(v.number()), // Request timestamps within window
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  // Webhook event idempotency (prevents duplicate processing)
  webhookEvents: defineTable({
    eventId: v.string(), // Stripe event.id
    eventType: v.string(), // e.g., "checkout.session.completed"
    processedAt: v.number(),
  }).index("by_event_id", ["eventId"]),
});
