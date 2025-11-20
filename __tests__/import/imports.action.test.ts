import { describe, expect, it, vi } from "vitest";

import { preparePreviewHandler } from "../../convex/imports";
import * as llmModule from "../../lib/import/llm";
import * as authModule from "../../convex/auth";

const userId = "user_1" as any;

const makeCtx = (opts: { books?: any[]; run?: any }) => {
  const books = opts.books ?? [];
  let inserted: any = null;
  let patched: any = null;
  const run = opts.run ?? { value: null };

  const ctx = {
    db: {
      query: (table: string) => ({
        withIndex: (index: string, fn: any) => {
          const matcher = { eq: (_field: string, value: any) => value };
          fn(matcher);
          return {
            collect: async () => (table === "books" ? books : []),
            first: async () => run.value,
          };
        },
      }),
      insert: async (_table: string, doc: any) => {
        inserted = doc;
      },
      patch: async (_id: any, doc: any) => {
        patched = doc;
      },
    },
    auth: { userId },
  } as any;

  return { ctx, getInserted: () => inserted, getPatched: () => patched, run };
};

describe("preparePreviewHandler", () => {
  it("returns preview using client rows and writes importRun", async () => {
    const { ctx, getInserted } = makeCtx({});

    vi.spyOn(authModule, "requireAuth").mockResolvedValue(userId);

    const result = await preparePreviewHandler(ctx, {
      importRunId: "run1",
      sourceType: "csv",
      rows: [
        {
          tempId: "t1",
          title: "Dune",
          author: "Frank Herbert",
        },
      ] as any,
      page: 0,
      totalPages: 1,
    } as any);

    expect(result.books).toHaveLength(1);
    expect(result.dedupMatches).toHaveLength(0);

    const saved = getInserted();
    expect(saved?.importRunId).toBe("run1");
    expect(saved?.counts.rows).toBe(1);

    vi.restoreAllMocks();
  });

  it("invokes llm path for non-csv sources and patches existing run", async () => {
    vi.spyOn(authModule, "requireAuth").mockResolvedValue(userId);

    const llmSpy = vi
      .spyOn(llmModule, "llmExtract")
      .mockResolvedValue({ rows: [{ tempId: "t2", title: "Book", author: "A" } as any], warnings: [], errors: [], tokenUsage: 10 });

    const existing = { _id: "runDoc" } as any;
    const { ctx, getPatched, run } = makeCtx({ run: { value: existing } });

    const result = await preparePreviewHandler(ctx, {
      importRunId: "run2",
      sourceType: "txt",
      rawText: "some text",
      page: 0,
      totalPages: 2,
    } as any);

    expect(result.books).toHaveLength(1);
    expect(llmSpy).toHaveBeenCalled();

    const patched = getPatched();
    expect(patched?.status).toBe("previewed");
    expect(patched?.counts.rows).toBe(1);

    vi.restoreAllMocks();
  });
});
