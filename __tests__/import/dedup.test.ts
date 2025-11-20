import { describe, expect, it } from "vitest";

import { dedupHelpers, applyDecision } from "../../lib/import/dedup";
import { normalizeTitleAuthorKey } from "../../lib/import/normalize";
import type { ParsedBook } from "../../lib/import/types";
import type { Doc, Id } from "../../convex/_generated/dataModel";

const fakeId = (id: string) => id as Id<"books">;

const book = (overrides: Partial<Doc<"books">> = {}): Doc<"books"> => ({
  _id: fakeId(overrides._id ?? "book_1"),
  userId: overrides.userId as Id<"users">,
  title: "Dune",
  author: "Frank Herbert",
  description: undefined,
  isbn: "9780441013593",
  edition: undefined,
  publishedYear: 1965,
  pageCount: 412,
  status: "read",
  isFavorite: false,
  isAudiobook: false,
  privacy: "private",
  timesRead: 1,
  dateStarted: undefined,
  dateFinished: undefined,
  coverUrl: undefined,
  apiCoverUrl: undefined,
  apiId: overrides.apiId ?? undefined,
  apiSource: overrides.apiSource ?? undefined,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const incoming = (overrides: Partial<ParsedBook> = {}): ParsedBook => ({
  tempId: "tmp1",
  title: "Dune",
  author: "Frank Herbert",
  status: "read",
  isbn: "9780441013593",
  edition: "Special",
  publishedYear: 1965,
  pageCount: 420,
  isAudiobook: true,
  isFavorite: true,
  coverUrl: "https://covers.example/dune.jpg",
  privacy: "private",
  apiId: "gb:dune",
  apiSource: "google-books",
  ...overrides,
});

describe("normalizeTitleAuthorKey", () => {
  it("folds diacritics and punctuation", () => {
    const key = normalizeTitleAuthorKey("Cien años de soledad!", "G. G. Márquez");
    expect(key).toBe("cien anos de soledad|g g marquez");
  });
});

describe("findMatches", () => {
  const userId = "user_1" as Id<"users">;

  const makeDb = (docs: Doc<"books">[]): any => ({
    query: () => ({
      withIndex: (_: string, fn: any) => (
        fn({ eq: (_field: string, value: Id<"users">) => value === userId }),
        {
          collect: async () => docs,
        }
      ),
    }),
    get: async () => undefined,
  });

  it("prefers isbn over title-author", async () => {
    const docs = [book({ _id: "b1", isbn: "123", apiId: "api-1", userId })];
    const rows: ParsedBook[] = [incoming({ tempId: "r1", isbn: "123", author: "Frank Herbert" })];

    const matches = await dedupHelpers.findMatches(makeDb(docs), userId, rows);

    expect(matches[0].matchType).toBe("isbn");
    expect(matches[0].existingBookId).toBe("b1" as Id<"books">);
  });

  it("falls back to title-author when isbn missing", async () => {
    const docs = [book({ _id: "b2", isbn: undefined, userId })];
    const rows: ParsedBook[] = [incoming({ tempId: "r2", isbn: undefined })];

    const matches = await dedupHelpers.findMatches(makeDb(docs), userId, rows);

    expect(matches[0].matchType).toBe("title-author");
    expect(matches[0].existingBookId).toBe("b2" as Id<"books">);
  });

  it("uses apiId when provided", async () => {
    const docs = [book({ _id: "b3", isbn: undefined, userId, apiId: "gb:dune" })];
    const rows: ParsedBook[] = [incoming({ tempId: "r3", isbn: undefined, apiId: "gb:dune" })];

    const matches = await dedupHelpers.findMatches(makeDb(docs), userId, rows);

    expect(matches[0].matchType).toBe("apiId");
    expect(matches[0].existingBookId).toBe("b3" as Id<"books">);
  });
});

describe("applyDecision", () => {
  it("merges only empty fields", () => {
    const existingBook = book({ edition: undefined, pageCount: undefined, userId: "user_1" as Id<"users"> });
    const patch = applyDecision(existingBook, incoming({ edition: "Special", pageCount: 999 }), "merge");

    expect(patch).toMatchObject({ edition: "Special", pageCount: 999 });
  });

  it("does not overwrite protected fields", () => {
    const existingBook = book({ isFavorite: true, coverUrl: "old", userId: "user_1" as Id<"users"> });
    const patch = applyDecision(existingBook, incoming({ isFavorite: false, coverUrl: "new" }), "merge");

    expect(patch).not.toHaveProperty("isFavorite");
    expect(patch).not.toHaveProperty("coverUrl");
  });
});
