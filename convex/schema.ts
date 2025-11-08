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
    status: v.union(
      v.literal("want-to-read"),
      v.literal("currently-reading"),
      v.literal("read")
    ),
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
      v.union(
        v.literal("google-books"),
        v.literal("open-library"),
        v.literal("manual")
      )
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
    type: v.union(
      v.literal("note"),
      v.literal("quote"),
      v.literal("reflection")
    ),
    content: v.string(),
    page: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_book", ["bookId"])
    .index("by_user", ["userId"]),
});
