import { query } from "./_generated/server";
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
