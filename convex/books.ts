import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";
import type { Doc, Id } from "./_generated/dataModel";

type PublicBook = {
  _id: Id<"books">;
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  apiCoverUrl?: string;
  status: Doc<"books">["status"];
  isFavorite: boolean;
  isAudiobook: boolean;
  publishedYear?: number;
};

const statusField = v.union(
  v.literal("want-to-read"),
  v.literal("currently-reading"),
  v.literal("read")
);

export const list = query({
  args: {
    status: v.optional(statusField),
    favoritesOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const { status, favoritesOnly } = args;

    let booksQuery = ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId));

    if (status) {
      booksQuery = booksQuery.filter((q) => q.eq(q.field("status"), status));
    }

    if (favoritesOnly) {
      booksQuery = booksQuery.filter((q) => q.eq(q.field("isFavorite"), true));
    }

    return await booksQuery.collect();
  },
});

export const get = query({
  args: { id: v.id("books") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.id);

    if (!book || book.userId !== userId) {
      return null;
    }

    return book;
  },
});

export const getPublic = query({
  args: { id: v.id("books") },
  handler: async (ctx, args): Promise<PublicBook | null> => {
    const book = await ctx.db.get(args.id);

    if (!book || book.privacy !== "public") {
      return null;
    }

    return {
      _id: book._id,
      title: book.title,
      author: book.author,
      description: book.description,
      coverUrl: book.coverUrl,
      apiCoverUrl: book.apiCoverUrl,
      status: book.status,
      isFavorite: book.isFavorite,
      isAudiobook: book.isAudiobook,
      publishedYear: book.publishedYear,
    };
  },
});

const baseBookFields = {
  title: v.string(),
  author: v.string(),
  description: v.optional(v.string()),
  isbn: v.optional(v.string()),
  edition: v.optional(v.string()),
  publishedYear: v.optional(v.number()),
  pageCount: v.optional(v.number()),
  status: statusField,
  isAudiobook: v.optional(v.boolean()),
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
};

export const create = mutation({
  args: {
    ...baseBookFields,
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    return await ctx.db.insert("books", {
      userId,
      title: args.title,
      author: args.author,
      description: args.description,
      isbn: args.isbn,
      edition: args.edition,
      publishedYear: args.publishedYear,
      pageCount: args.pageCount,
      status: args.status,
      isFavorite: false,
      isAudiobook: args.isAudiobook ?? false,
      privacy: "private",
      timesRead: 0,
      dateStarted: undefined,
      dateFinished: undefined,
      coverUrl: args.coverUrl,
      apiCoverUrl: args.apiCoverUrl,
      apiId: args.apiId,
      apiSource: args.apiSource,
      createdAt: now,
      updatedAt: now,
    });
  },
});

const optionalBookFields = Object.fromEntries(
  Object.entries(baseBookFields).map(([key, validator]) => [
    key,
    v.optional(validator as any),
  ])
);

export const update = mutation({
  args: {
    id: v.id("books"),
    ...optionalBookFields,
    privacy: v.optional(v.union(v.literal("private"), v.literal("public"))),
    isFavorite: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const { id, ...updates } = args;
    const book = await ctx.db.get(id);

    if (!book || book.userId !== userId) {
      throw new Error("Book not found or access denied");
    }

    const patch: Partial<Doc<"books">> = {
      updatedAt: Date.now(),
    };

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value !== "undefined") {
        (patch as any)[key] = value;
      }
    }

    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("books") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.id);

    if (!book || book.userId !== userId) {
      throw new Error("Book not found or access denied");
    }

    await ctx.db.delete(args.id);
  },
});
