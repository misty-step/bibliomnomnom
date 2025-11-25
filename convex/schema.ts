import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),
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
    .index("by_user", ["userId"]),
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
});
