import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { updateCoverFromBlobHandler } from "../../convex/books";
import * as authModule from "../../convex/auth";

const userId = "user_1" as any;

const makeCtx = (books: any[] = []) => {
  const patchCalls: { id: any; doc: any }[] = [];

  const ctx = {
    db: {
      get: async (id: any) => books.find((b) => b._id === id) ?? null,
      patch: async (id: any, doc: any) => {
        patchCalls.push({ id, doc });
        const target = books.find((b) => b._id === id);
        if (target) Object.assign(target, doc);
      },
    },
  } as any;

  return { ctx, books, patchCalls };
};

describe("books.updateCoverFromBlob", () => {
  beforeEach(() => {
    vi.spyOn(authModule, "requireAuth").mockResolvedValue(userId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("updates cover fields for owning user", async () => {
    vi.useFakeTimers();
    const now = new Date("2025-01-01T00:00:00Z");
    vi.setSystemTime(now);

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

    const { ctx, books, patchCalls } = makeCtx([book]);

    await updateCoverFromBlobHandler(ctx, {
      bookId: book._id,
      blobUrl: "https://blob.vercel-storage.com/covers/book1.jpg",
      apiSource: "open-library",
      apiCoverUrl: "https://covers.openlibrary.org/b/id/12345-L.jpg",
    });

    expect(books[0].coverUrl).toBe("https://blob.vercel-storage.com/covers/book1.jpg");
    expect(books[0].apiSource).toBe("open-library");
    expect(books[0].apiCoverUrl).toContain("openlibrary");
    expect(books[0].updatedAt).toBe(now.getTime());
    expect(patchCalls[0]?.doc.updatedAt).toBe(now.getTime());
  });

  it("rejects when user does not own the book", async () => {
    const book = {
      _id: "book2",
      userId: "other_user",
      title: "Not yours",
      author: "A",
      status: "want-to-read",
      isFavorite: false,
      isAudiobook: false,
      timesRead: 0,
      createdAt: 0,
      updatedAt: 0,
    } as any;

    const { ctx, patchCalls } = makeCtx([book]);

    await expect(
      updateCoverFromBlobHandler(ctx, {
        bookId: book._id,
        blobUrl: "https://blob.vercel-storage.com/covers/book2.jpg",
        apiSource: "google-books",
        apiCoverUrl: "https://books.google.com/books/content?id=123",
      }),
    ).rejects.toThrow("Access denied");

    expect(patchCalls).toHaveLength(0);
  });

  it("rejects when book does not exist", async () => {
    const { ctx } = makeCtx();

    await expect(
      updateCoverFromBlobHandler(ctx, {
        bookId: "missing" as any,
        blobUrl: "https://blob.vercel-storage.com/covers/missing.jpg",
        apiSource: "open-library",
        apiCoverUrl: "https://covers.openlibrary.org/b/id/999-L.jpg",
      }),
    ).rejects.toThrow("Access denied");
  });
});
