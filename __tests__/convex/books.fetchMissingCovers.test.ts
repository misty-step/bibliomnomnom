import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMissingCoversHandler } from "../../convex/books";
import * as authModule from "../../convex/auth";

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

const makeCtx = (listResponses: any | any[], actionResults: any[] = []) => {
  const runQueryCalls: any[] = [];
  const runActionCalls: any[] = [];
  const runMutationCalls: any[] = [];
  // Support single response (legacy) or array of responses for pagination
  const responses = Array.isArray(listResponses) ? [...listResponses] : [listResponses];
  let queryCallCount = 0;

  const ctx = {
    runQuery: async (query: any, args: any) => {
      runQueryCalls.push({ query, args });
      // Return next response or empty result for subsequent calls
      const response = responses[queryCallCount] ?? { items: [], nextCursor: null };
      queryCallCount++;
      return response;
    },
    runAction: async (_action: any, args: any) => {
      const next = actionResults.shift() ?? { error: "no result" };
      runActionCalls.push({ args });
      return next;
    },
    runMutation: async (mutation: any, args: any) => {
      runMutationCalls.push({ mutation, args });
    },
  } as any;

  return { ctx, runQueryCalls, runActionCalls, runMutationCalls };
};

describe("books.fetchMissingCovers", () => {
  beforeEach(() => {
    vi.spyOn(authModule, "requireAuthAction").mockResolvedValue(userId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("updates api cover fields and collects failures", async () => {
    vi.useFakeTimers();
    const now = new Date("2025-01-02T00:00:00Z");
    vi.setSystemTime(now);

    const books = [baseBook(1), baseBook(2)];

    // No nextCursor so processing stops after first batch
    const listResponse = { items: books, nextCursor: null };
    const actionResults = [
      { apiCoverUrl: "https://covers/1.jpg", apiSource: "open-library" },
      { error: "not found" },
    ];

    const { ctx, runMutationCalls } = makeCtx(listResponse, actionResults);

    const result = await fetchMissingCoversHandler(ctx, { limit: 5 });

    expect(result.processed).toBe(2);
    expect(result.updated).toBe(1);
    expect(result.failures).toEqual([{ bookId: books[1]._id, reason: "not found" }]);
    expect(result.nextCursor).toBeNull();

    expect(runMutationCalls).toHaveLength(1);
    expect(runMutationCalls[0].args.bookId).toBe(books[0]._id);
    expect(runMutationCalls[0].args.apiCoverUrl).toContain("covers/1.jpg");
  });

  it("clamps limit and passes cursor through", async () => {
    const listResponse = { items: [], nextCursor: null };
    const { ctx, runQueryCalls } = makeCtx(listResponse);

    await fetchMissingCoversHandler(ctx, { limit: 999, cursor: "abc" });

    expect(runQueryCalls[0]?.args.limit).toBe(50);
    expect(runQueryCalls[0]?.args.cursor).toBe("abc");
  });

  it("skips books that already have a cover", async () => {
    const books = [baseBook(1, { coverUrl: "existing" })];
    const listResponse = { items: books, nextCursor: null };
    const { ctx, runActionCalls, runMutationCalls } = makeCtx(listResponse, []);

    const result = await fetchMissingCoversHandler(ctx, {});

    expect(result.processed).toBe(0);
    expect(runActionCalls).toHaveLength(0);
    expect(runMutationCalls).toHaveLength(0);
  });
});
