import { describe, expect, it, vi } from "vitest";

import { commitImportHandler } from "../../convex/imports";
import * as authModule from "../../convex/auth";

const userId = "user_1" as any;

const makeCtx = (opts: { books?: any[]; previews?: any[]; run?: any }) => {
  const books = opts.books ?? [];
  const previews = opts.previews ?? [];
  const runDoc = opts.run ?? {
    _id: "run_1",
    userId,
    importRunId: "run1",
    status: "previewed",
    page: 0,
    counts: { rows: 1, created: 0, merged: 0, skipped: 0, errors: 0 },
  };

  const ctx = {
    db: {
      query: (table: string) => ({
        withIndex: (index: string, fn: any) => {
          const filters: Record<string, any> = {};
          const matcher: any = {
            eq: (field: string, value: any) => {
              filters[field] = value;
              return matcher;
            },
          };
          fn(matcher);
          return {
            first: async () => {
              if (table === "importRuns") return runDoc;
              if (table === "importPreviews") {
                const page = filters.page;
                return previews.find((p) => p.page === page) ?? null;
              }
              return null;
            },
            collect: async () => (table === "books" ? books : []),
          };
        },
      }),
      get: async (id: any) => books.find((b) => b._id === id) ?? null,
      insert: async (_table: string, doc: any) => {
        books.push({ _id: `b${books.length + 1}`, ...doc });
      },
      patch: async (_id: any, doc: any) => {
        if (_id === runDoc._id) {
          Object.assign(runDoc, doc, { counts: { ...runDoc.counts, ...doc.counts } });
        } else {
          const target = books.find((b) => b._id === _id);
          if (target) Object.assign(target, doc);
        }
      },
    },
  } as any;

  return { ctx, runDoc, books };
};

describe("commitImportHandler", () => {
  it("creates new books for create action", async () => {
    vi.spyOn(authModule, "requireAuth").mockResolvedValue(userId);

    const { ctx, books } = makeCtx({
      previews: [
        {
          books: [
            {
              tempId: "t1",
              title: "New Book",
              author: "Anon",
            },
          ],
          page: 0,
        },
      ],
    });

    const result = await commitImportHandler(ctx, {
      importRunId: "run1",
      page: 0,
      decisions: [
        {
          tempId: "t1",
          action: "create",
        },
      ],
    } as any);

    expect(result.created).toBe(1);
    expect(books).toHaveLength(1);

    vi.restoreAllMocks();
  });

  it("merges when existingBookId provided", async () => {
    vi.spyOn(authModule, "requireAuth").mockResolvedValue(userId);

    const existing = {
      _id: "book1",
      userId,
      title: "Old",
      author: "Anon",
      status: "want-to-read",
      isFavorite: true,
      isAudiobook: false,
      timesRead: 0,
      createdAt: 0,
      updatedAt: 0,
    } as any;

    const { ctx } = makeCtx({
      books: [existing],
      previews: [
        {
          books: [
            {
              tempId: "t2",
              title: "Old",
              author: "Anon",
              isbn: "123",
            },
          ],
          page: 0,
        },
      ],
    });

    const result = await commitImportHandler(ctx, {
      importRunId: "run1",
      page: 0,
      decisions: [{ tempId: "t2", action: "merge", existingBookId: "book1" as any }],
    } as any);

    expect(result.merged).toBe(1);
    expect(result.errors).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it("commits multiple pages when previews exist", async () => {
    vi.spyOn(authModule, "requireAuth").mockResolvedValue(userId);

    const { ctx, books } = makeCtx({
      previews: [
        { page: 0, books: [{ tempId: "t1", title: "A", author: "B" }] },
        { page: 1, books: [{ tempId: "t2", title: "C", author: "D" }] },
      ],
    });

    const page0 = await commitImportHandler(ctx, {
      importRunId: "run1",
      page: 0,
      decisions: [{ tempId: "t1", action: "create" }],
    } as any);

    expect(page0.errors).toHaveLength(0);
    expect(page0.created).toBe(1);
    expect(books).toHaveLength(1);

    const page1 = await commitImportHandler(ctx, {
      importRunId: "run1",
      page: 1,
      decisions: [{ tempId: "t2", action: "create" }],
    } as any);

    expect(page1.errors).toHaveLength(0);
    expect(page1.created).toBe(1);
    expect(books).toHaveLength(2);

    vi.restoreAllMocks();
  });

  it("returns error when preview missing and does not patch run", async () => {
    vi.spyOn(authModule, "requireAuth").mockResolvedValue(userId);

    const { ctx, runDoc, books } = makeCtx({
      previews: [{ page: 0, books: [{ tempId: "t1", title: "A", author: "B" }] }],
    });

    const result = await commitImportHandler(ctx, {
      importRunId: "run1",
      page: 1,
      decisions: [{ tempId: "t1", action: "create" }],
    } as any);

    expect(result.created).toBe(0);
    expect(result.errors[0]?.message).toMatch(/Preview required for page 2/);
    expect(books).toHaveLength(0);
    expect(runDoc.status).toBe("previewed");
    expect(runDoc.page).toBe(0);

    vi.restoreAllMocks();
  });
});
