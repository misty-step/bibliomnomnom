import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCoverHandler } from "../../convex/books";
import * as authModule from "../../convex/auth";

const userId = "user_1" as any;

const makeCtx = (book: any | null, actionResult: any = null) => {
  const schedulerCalls: any[] = [];
  const runActionCalls: any[] = [];

  const ctx = {
    db: {
      get: async (_id: any) => book,
    },
    runQuery: async () => book,
    runAction: async (action: any, args: any) => {
      runActionCalls.push({ action, args });
      return actionResult;
    },
    scheduler: {
      runAfter: async (delay: number, actionPath: any, payload: any) => {
        schedulerCalls.push({ delay, actionPath, payload });
        return actionResult;
      },
    },
  } as any;

  return { ctx, schedulerCalls, runActionCalls };
};

describe("books.fetchCover", () => {
  beforeEach(() => {
    vi.spyOn(authModule, "requireAuthAction").mockResolvedValue(userId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns cover data when action succeeds", async () => {
    const book = {
      _id: "book1",
      userId,
      title: "Test",
      author: "Author",
      status: "want-to-read",
      isFavorite: false,
      isAudiobook: false,
      timesRead: 0,
      createdAt: 0,
      updatedAt: 0,
    } as any;

    const actionResult = {
      coverDataUrl: "data:image/jpeg;base64,abc",
      apiSource: "open-library" as const,
      apiCoverUrl: "https://covers.openlibrary.org/b/id/123-L.jpg",
    };

    const { ctx, runActionCalls } = makeCtx(book, actionResult);

    const result = await fetchCoverHandler(ctx, { bookId: book._id });

    expect(result.success).toBe(true);
    expect((result as any).coverDataUrl).toContain("data:image");
    expect((result as any).apiSource).toBe("open-library");
    expect(runActionCalls[0]?.args.bookId).toBe(book._id);
  });

  it("fails gracefully when action returns error", async () => {
    const book = { _id: "book2", userId, title: "X", author: "Y" } as any;
    const { ctx } = makeCtx(book, { error: "not found" });

    const result = await fetchCoverHandler(ctx, { bookId: book._id });

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error).toContain("not found");
    }
  });

  it("returns error when book already has a cover", async () => {
    const book = { _id: "book3", userId, title: "X", author: "Y", coverUrl: "existing" } as any;
    const { ctx } = makeCtx(book);

    const result = await fetchCoverHandler(ctx, { bookId: book._id });

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error).toContain("already has a cover");
    }
  });

  it("rejects when user does not own book", async () => {
    const book = { _id: "book4", userId: "other", title: "X", author: "Y" } as any;
    const { ctx } = makeCtx(book);

    await expect(fetchCoverHandler(ctx, { bookId: book._id })).rejects.toThrow("Access denied");
  });

  it("rejects when book not found", async () => {
    const { ctx } = makeCtx(null);

    await expect(fetchCoverHandler(ctx, { bookId: "missing" as any })).rejects.toThrow(
      "Access denied",
    );
  });
});
