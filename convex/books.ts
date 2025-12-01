import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth, requireAuthAction } from "./auth";
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
  v.literal("read"),
);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const isMissingCover = (book: Doc<"books"> | null | undefined): book is Doc<"books"> =>
  book != null && !book.coverUrl && !book.apiCoverUrl;

const clampLimit = (limit: number | undefined) =>
  Math.min(MAX_LIMIT, Math.max(1, limit ?? DEFAULT_LIMIT));

export const list = query({
  args: {
    status: v.optional(statusField),
    favoritesOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const { status, favoritesOnly } = args;

    let booksQuery = ctx.db.query("books").withIndex("by_user", (q) => q.eq("userId", userId));

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

/**
 * Internal query for actions to fetch book data
 * No auth required - ownership validation happens in the calling mutation
 */
export const getForAction = internalQuery({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.bookId);
  },
});

type ListMissingCoversArgs = {
  userId: Id<"users">;
  bookId?: Id<"books">;
  bookIds?: Id<"books">[];
  cursor?: string | null;
  limit?: number;
};

export type ListMissingCoversResult = {
  items: Doc<"books">[];
  nextCursor?: string | null;
};

export async function listMissingCoversHandler(
  ctx: QueryCtx,
  args: ListMissingCoversArgs,
): Promise<ListMissingCoversResult> {
  const { userId, bookId, bookIds, cursor } = args;
  const ids = bookIds ?? (bookId ? [bookId] : undefined);

  if (ids?.length) {
    const books = await Promise.all(ids.map((id) => ctx.db.get(id)));
    const ownedMissing = books.filter(
      (book): book is Doc<"books"> => isMissingCover(book) && book.userId === userId,
    );

    return { items: ownedMissing.slice(0, MAX_LIMIT) };
  }

  const numItems = clampLimit(args.limit);

  const page = await ctx.db
    .query("books")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) =>
      q.and(q.eq(q.field("coverUrl"), undefined), q.eq(q.field("apiCoverUrl"), undefined)),
    )
    .paginate({ numItems, cursor: cursor ?? null });

  return {
    items: page.page,
    nextCursor: page.continueCursor,
  };
}

export const listMissingCovers = internalQuery({
  args: {
    userId: v.id("users"),
    bookId: v.optional(v.id("books")),
    bookIds: v.optional(v.array(v.id("books"))),
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: listMissingCoversHandler,
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
  description: v.optional(v.union(v.string(), v.null())),
  isbn: v.optional(v.union(v.string(), v.null())),
  edition: v.optional(v.union(v.string(), v.null())),
  publishedYear: v.optional(v.union(v.number(), v.null())),
  pageCount: v.optional(v.union(v.number(), v.null())),
  status: statusField,
  isAudiobook: v.optional(v.boolean()),
  isFavorite: v.optional(v.boolean()),
  dateFinished: v.optional(v.union(v.number(), v.null())),
  coverUrl: v.optional(v.union(v.string(), v.null())),
  apiCoverUrl: v.optional(v.union(v.string(), v.null())),
  apiId: v.optional(v.union(v.string(), v.null())),
  apiSource: v.optional(
    v.union(v.literal("google-books"), v.literal("open-library"), v.literal("manual"), v.null()),
  ),
};

export const create = mutation({
  args: {
    ...baseBookFields,
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    const cleanArgs = Object.fromEntries(
      Object.entries(args).map(([key, value]) => [key, value === null ? undefined : value]),
    );

    return await ctx.db.insert("books", {
      userId,
      title: cleanArgs.title as string,
      author: cleanArgs.author as string,
      description: cleanArgs.description as string | undefined,
      isbn: cleanArgs.isbn as string | undefined,
      edition: cleanArgs.edition as string | undefined,
      publishedYear: cleanArgs.publishedYear as number | undefined,
      pageCount: cleanArgs.pageCount as number | undefined,
      status: cleanArgs.status as Doc<"books">["status"],
      isFavorite: (cleanArgs.isFavorite as boolean) ?? false,
      isAudiobook: (cleanArgs.isAudiobook as boolean) ?? false,
      privacy: "private",
      timesRead: cleanArgs.status === "read" ? 1 : 0,
      dateStarted: cleanArgs.status === "currently-reading" ? now : undefined,
      dateFinished: cleanArgs.dateFinished as number | undefined,
      coverUrl: cleanArgs.coverUrl as string | undefined,
      apiCoverUrl: cleanArgs.apiCoverUrl as string | undefined,
      apiId: cleanArgs.apiId as string | undefined,
      apiSource: cleanArgs.apiSource as Doc<"books">["apiSource"],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("books"),
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    isbn: v.optional(v.union(v.string(), v.null())),
    edition: v.optional(v.union(v.string(), v.null())),
    publishedYear: v.optional(v.union(v.number(), v.null())),
    pageCount: v.optional(v.union(v.number(), v.null())),
    status: v.optional(statusField),
    isAudiobook: v.optional(v.boolean()),
    coverUrl: v.optional(v.union(v.string(), v.null())),
    apiCoverUrl: v.optional(v.union(v.string(), v.null())),
    apiId: v.optional(v.union(v.string(), v.null())),
    apiSource: v.optional(
      v.union(v.literal("google-books"), v.literal("open-library"), v.literal("manual"), v.null()),
    ),
    privacy: v.optional(v.union(v.literal("private"), v.literal("public"))),
    isFavorite: v.optional(v.boolean()),
    dateStarted: v.optional(v.union(v.number(), v.null())),
    dateFinished: v.optional(v.union(v.number(), v.null())),
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
      if (value === null) {
        (patch as any)[key] = undefined;
      } else if (typeof value !== "undefined") {
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

export const updateStatus = mutation({
  args: {
    id: v.id("books"),
    status: statusField,
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.id);

    if (!book || book.userId !== userId) {
      throw new Error("Access denied");
    }

    const now = Date.now();
    const updates: Partial<Doc<"books">> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "currently-reading" && !book.dateStarted) {
      updates.dateStarted = now;
    }

    if (args.status === "read") {
      if (!book.dateFinished) {
        updates.dateFinished = now;
      }

      updates.timesRead = book.timesRead + 1;

      if (!book.dateStarted) {
        updates.dateStarted = now;
      }
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const toggleFavorite = mutation({
  args: { id: v.id("books") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.id);

    if (!book || book.userId !== userId) {
      throw new Error("Access denied");
    }

    const newValue = !book.isFavorite;
    await ctx.db.patch(args.id, {
      isFavorite: newValue,
      updatedAt: Date.now(),
    });

    return newValue;
  },
});

export const updatePrivacy = mutation({
  args: {
    id: v.id("books"),
    privacy: v.union(v.literal("private"), v.literal("public")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.id);

    if (!book || book.userId !== userId) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(args.id, {
      privacy: args.privacy,
      updatedAt: Date.now(),
    });
  },
});

const updateCoverFromBlobArgs = {
  bookId: v.id("books"),
  blobUrl: v.string(),
  apiSource: v.union(v.literal("open-library"), v.literal("google-books")),
  apiCoverUrl: v.string(),
};

/**
 * Internal handler for updating a book's cover from an uploaded blob
 *
 * @param ctx - Convex mutation context
 * @param args - Arguments including bookId, blobUrl, apiSource, and apiCoverUrl
 * @throws Error if book not found or access denied
 */
export async function updateCoverFromBlobHandler(
  ctx: MutationCtx,
  args: {
    bookId: Id<"books">;
    blobUrl: string;
    apiSource: "open-library" | "google-books";
    apiCoverUrl: string;
  },
) {
  const userId = await requireAuth(ctx);
  const book = await ctx.db.get(args.bookId);

  if (!book || book.userId !== userId) {
    throw new Error("Access denied");
  }

  await ctx.db.patch(args.bookId, {
    coverUrl: args.blobUrl,
    apiSource: args.apiSource,
    apiCoverUrl: args.apiCoverUrl,
    updatedAt: Date.now(),
  });
}

/**
 * Mutation to update a book's cover after a successful blob upload
 *
 * @param bookId - ID of the book to update
 * @param blobUrl - URL of the uploaded blob (Vercel Blob)
 * @param apiSource - Source of the original cover image (open-library or google-books)
 * @param apiCoverUrl - Original URL of the cover image from the API
 */
export const updateCoverFromBlob = mutation({
  args: updateCoverFromBlobArgs,
  handler: updateCoverFromBlobHandler,
});

export const setApiCover = internalMutation({
  args: {
    bookId: v.id("books"),
    apiCoverUrl: v.string(),
    apiSource: v.union(v.literal("open-library"), v.literal("google-books")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.bookId);

    if (!book || book.userId !== userId) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(args.bookId, {
      apiCoverUrl: args.apiCoverUrl,
      apiSource: args.apiSource,
      updatedAt: Date.now(),
    });
  },
});

const fetchCoverArgs = {
  bookId: v.id("books"),
};

type CoverFetchResult =
  | {
      success: true;
      coverDataUrl: string;
      apiSource: "open-library" | "google-books";
      apiCoverUrl: string;
    }
  | { success: false; error: string };

/**
 * Internal handler for the fetch cover action
 *
 * @param ctx - Convex action context
 * @param args - Arguments including bookId
 * @returns CoverFetchResult with success status and data or error
 * @throws Error if user is not authenticated or book not found
 */
export async function fetchCoverHandler(
  ctx: ActionCtx,
  args: { bookId: Id<"books"> },
): Promise<CoverFetchResult> {
  const userId = await requireAuthAction(ctx);
  const book = await ctx.runQuery(internal.books.getForAction, {
    bookId: args.bookId,
  });

  if (!book || book.userId !== userId) {
    throw new Error("Access denied");
  }

  if (book.coverUrl) {
    return { success: false, error: "Book already has a cover" };
  }

  const result = await ctx.runAction(internal.actions.coverFetch.search, {
    bookId: args.bookId,
  });

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    coverDataUrl: result.coverDataUrl,
    apiSource: result.apiSource,
    apiCoverUrl: result.apiCoverUrl,
  };
}

/**
 * Action to fetch a book cover from external APIs (Open Library, Google Books)
 *
 * @param bookId - ID of the book to fetch cover for
 * @returns Object containing success status and cover data (base64 data URL) or error
 */
export const fetchCover = action({
  args: fetchCoverArgs,
  handler: fetchCoverHandler,
});

type FetchMissingCoversArgs = {
  limit?: number;
  cursor?: string | null;
  bookIds?: Id<"books">[];
};

type FetchMissingCoversResult = {
  processed: number;
  updated: number;
  failures: { bookId: Id<"books">; reason: string }[];
  nextCursor?: string | null;
};

export async function fetchMissingCoversHandler(
  ctx: ActionCtx,
  args: FetchMissingCoversArgs,
): Promise<FetchMissingCoversResult> {
  const userId = await requireAuthAction(ctx);
  const numItems = clampLimit(args.limit);

  const targets = await ctx.runQuery(internal.books.listMissingCovers, {
    userId,
    limit: numItems,
    cursor: args.cursor,
    bookIds: args.bookIds,
  });

  let processed = 0;
  let updated = 0;
  const failures: { bookId: Id<"books">; reason: string }[] = [];

  for (const book of targets.items) {
    if (!isMissingCover(book)) {
      continue;
    }

    processed += 1;

    const result = await ctx.runAction(internal.actions.coverFetch.search, {
      bookId: book._id,
    });

    if ("error" in result) {
      failures.push({ bookId: book._id, reason: result.error });
      continue;
    }

    await ctx.runMutation(internal.books.setApiCover, {
      bookId: book._id,
      apiCoverUrl: result.apiCoverUrl,
      apiSource: result.apiSource,
    });

    updated += 1;
  }

  return {
    processed,
    updated,
    failures,
    nextCursor: targets.nextCursor ?? null,
  };
}

export const fetchMissingCovers = action({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
    bookIds: v.optional(v.array(v.id("books"))),
  },
  handler: fetchMissingCoversHandler,
});
