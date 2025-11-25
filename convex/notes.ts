import { query, mutation } from "./_generated/server";
import { requireAuth } from "./auth";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const noteType = v.union(v.literal("note"), v.literal("quote"), v.literal("reflection"));

export const list = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.bookId);

    if (!book || book.userId !== userId) {
      return [];
    }

    return await ctx.db
      .query("notes")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    bookId: v.id("books"),
    type: noteType,
    content: v.string(),
    page: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"notes">> => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.bookId);

    if (!book || book.userId !== userId) {
      throw new Error("Access denied");
    }

    const now = Date.now();
    return await ctx.db.insert("notes", {
      bookId: args.bookId,
      userId,
      type: args.type,
      content: args.content,
      page: args.page,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("notes"),
    content: v.optional(v.string()),
    page: v.optional(v.string()),
    type: v.optional(noteType),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const { id, ...updates } = args;
    const note = await ctx.db.get(id);

    if (!note || note.userId !== userId) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(id, {
      content: updates.content ?? note.content,
      page: updates.page ?? note.page,
      type: updates.type ?? note.type,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const note = await ctx.db.get(args.id);

    if (!note || note.userId !== userId) {
      throw new Error("Access denied");
    }

    await ctx.db.delete(args.id);
  },
});
