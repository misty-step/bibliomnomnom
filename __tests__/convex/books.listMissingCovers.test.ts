import { describe, expect, it } from "vitest";

import { listMissingCoversHandler } from "../../convex/books";

const userId = "user_1" as any;

const baseBook = (id: number, overrides: Record<string, any> = {}) => ({
  _id: `book_${id}` as any,
  userId,
  title: `Book ${id}`,
  author: "Author",
  status: "want-to-read" as const,
  isFavorite: false,
  isAudiobook: false,
  privacy: "private" as const,
  timesRead: 0,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const makeCtx = (books: any[]) => {
  return {
    db: {
      getMany: async (ids: any[]) => ids.map((id) => books.find((b) => b._id === id) ?? null),
      query: () => {
        return {
          withIndex: (_index: string, apply: (q: any) => void) => {
            let filtered = [...books];

            const qHelpers = {
              eq: (fieldName: any, value: any) => {
                if (typeof fieldName === "string") {
                  filtered = filtered.filter((book) => (book as any)[fieldName] === value);
                }
                return true;
              },
              field: (name: string) => name,
              and: (...conditions: boolean[]) => conditions.every(Boolean),
            };

            apply(qHelpers);
            return {
              filter: (predicate: (q: any) => boolean) => {
                const filteredBooks = filtered.filter((book) => {
                  const q = {
                    eq: (lhs: any, rhs: any) => lhs === rhs,
                    field: (name: string) => (book as any)[name],
                    and: (...conditions: boolean[]) => conditions.every(Boolean),
                  };

                  return predicate(q);
                });

                return {
                  paginate: ({ numItems, cursor }: { numItems: number; cursor?: string | null }) =>
                    paginateBooks({ books: filteredBooks, numItems, cursor }),
                };
              },
              paginate: ({ numItems, cursor }: { numItems: number; cursor?: string | null }) =>
                paginateBooks({ books: filtered, numItems, cursor }),
            };
          },
        };
      },
    },
  } as any;
};

const paginateBooks = ({
  books,
  numItems,
  cursor,
}: {
  books: any[];
  numItems: number;
  cursor?: string | null;
}) => {
  const start = cursor ? Number(cursor) : 0;
  const page = books.slice(start, start + numItems);
  const continueCursor = start + numItems < books.length ? String(start + numItems) : null;
  return { page, continueCursor };
};

describe("listMissingCoversHandler", () => {
  it("filters to caller-owned missing covers when bookIds provided", async () => {
    const books = [
      baseBook(1, { coverUrl: undefined, apiCoverUrl: undefined }),
      baseBook(2, { coverUrl: "https://example.com/cover.jpg" }),
      baseBook(3, { userId: "other" }),
    ];

    const ctx = makeCtx(books);

    const result = await listMissingCoversHandler(ctx, {
      userId,
      bookIds: [books[0]._id, books[1]._id, books[2]._id],
    });

    expect(result.items.map((b) => b._id)).toEqual([books[0]._id]);
    expect(result.nextCursor).toBeUndefined();
  });

  it("paginates user books missing covers", async () => {
    const books = [
      baseBook(1, { coverUrl: undefined, apiCoverUrl: undefined }),
      baseBook(2, { coverUrl: undefined, apiCoverUrl: undefined }),
      baseBook(3, { coverUrl: undefined, apiCoverUrl: "api" }),
      baseBook(4, { coverUrl: undefined, apiCoverUrl: undefined }),
      baseBook(5, { userId: "other" }),
    ];

    const ctx = makeCtx(books);

    const result = await listMissingCoversHandler(ctx, {
      userId,
      limit: 2,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.every((b) => b.userId === userId)).toBe(true);
    expect(result.items.every((b) => !b.coverUrl && !b.apiCoverUrl)).toBe(true);
    expect(result.nextCursor).toBe("2");
  });

  it("respects cursor pagination", async () => {
    const books = [
      baseBook(1, { coverUrl: undefined, apiCoverUrl: undefined }),
      baseBook(2, { coverUrl: undefined, apiCoverUrl: undefined }),
      baseBook(3, { coverUrl: undefined, apiCoverUrl: undefined }),
    ];

    const ctx = makeCtx(books);

    const first = await listMissingCoversHandler(ctx, { userId, limit: 2 });
    const second = await listMissingCoversHandler(ctx, {
      userId,
      cursor: first.nextCursor,
      limit: 2,
    });

    expect(first.items.map((b) => b._id)).toEqual([books[0]._id, books[1]._id]);
    expect(second.items.map((b) => b._id)).toEqual([books[2]._id]);
    expect(second.nextCursor).toBeNull();
  });

  it("caps bookIds path at 50 entries", async () => {
    const books = Array.from({ length: 55 }, (_, i) =>
      baseBook(i, { coverUrl: undefined, apiCoverUrl: undefined }),
    );

    const ctx = makeCtx(books);

    const result = await listMissingCoversHandler(ctx, {
      userId,
      bookIds: books.map((b) => b._id),
      limit: 5,
    });

    expect(result.items).toHaveLength(50);
  });
});
