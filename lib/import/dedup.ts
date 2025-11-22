import type { ActionCtx, DatabaseReader } from "../../convex/_generated/server";
import type { Doc, Id } from "../../convex/_generated/dataModel";

import type { DedupDecision, DedupMatch, DedupDecisionAction, ParsedBook } from "./types";
import { normalizeIsbn } from "./types";
import { normalizeApiId, normalizeTitleAuthorKey } from "./normalize";

type DbReader = Pick<DatabaseReader, "query" | "get">;

export type Match = DedupMatch;

const MATCH_CONFIDENCE: Record<NonNullable<Match["matchType"]>, number> = {
  isbn: 1,
  "title-author": 0.8,
  apiId: 0.6,
};

const MERGEABLE_FIELDS: (keyof Doc<"books">)[] = [
  "isbn",
  "edition",
  "publishedYear",
  "pageCount",
  "apiId",
  "apiSource",
  "privacy",
  "dateStarted",
  "dateFinished",
];

export const findMatches = async (
  db: DbReader,
  userId: Id<"users">,
  rows: ParsedBook[]
): Promise<Match[]> => {
  const existing = await db
    .query("books")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const isbnMap = new Map<string, Doc<"books">>();
  const titleAuthorMap = new Map<string, Doc<"books">>();
  const apiIdMap = new Map<string, Doc<"books">>();

  existing.forEach((book) => {
    const isbn = normalizeIsbn(book.isbn);
    if (isbn && !isbnMap.has(isbn)) {
      isbnMap.set(isbn, book);
    }

    const key = normalizeTitleAuthorKey(book.title, book.author);
    if (key && !titleAuthorMap.has(key)) {
      titleAuthorMap.set(key, book);
    }

    const apiId = normalizeApiId(book.apiId);
    if (apiId && !apiIdMap.has(apiId)) {
      apiIdMap.set(apiId, book);
    }
  });

  const matches: Match[] = [];

  rows.forEach((row) => {
    const isbn = normalizeIsbn(row.isbn);
    if (isbn && isbnMap.has(isbn)) {
      const match = isbnMap.get(isbn)!;
      matches.push({
        tempId: row.tempId,
        existingBookId: match._id,
        matchType: "isbn",
        confidence: MATCH_CONFIDENCE.isbn,
      });
      return;
    }

    const key = normalizeTitleAuthorKey(row.title, row.author);
    if (key && titleAuthorMap.has(key)) {
      const match = titleAuthorMap.get(key)!;
      matches.push({
        tempId: row.tempId,
        existingBookId: match._id,
        matchType: "title-author",
        confidence: MATCH_CONFIDENCE["title-author"],
      });
      return;
    }

    const apiId = normalizeApiId(row.apiId);
    if (apiId && apiIdMap.has(apiId)) {
      const match = apiIdMap.get(apiId)!;
      matches.push({
        tempId: row.tempId,
        existingBookId: match._id,
        matchType: "apiId",
        confidence: MATCH_CONFIDENCE.apiId,
      });
    }
  });

  return matches;
};

export type BookPatch = Partial<Doc<"books">>;

export const applyDecision = (
  existing: Doc<"books">,
  incoming: ParsedBook,
  action: DedupDecisionAction
): BookPatch | null => {
  if (action === "skip") return null;
  if (action === "create") return null; // handled by caller

  const patch: BookPatch = {};

  MERGEABLE_FIELDS.forEach((field) => {
    const current = existing[field];
    const candidate = incoming[field as keyof ParsedBook];

    const isEmpty = current === undefined || current === null;
    const hasIncoming = candidate !== undefined && candidate !== null;

    if (isEmpty && hasIncoming) {
      patch[field] = candidate as any;
    }
  });

  return Object.keys(patch).length ? patch : null;
};

export const buildNewBook = (
  incoming: ParsedBook,
  userId: Id<"users">
): Omit<Doc<"books">, "_id" | "_creationTime"> => {
  return {
    userId,
    title: incoming.title,
    author: incoming.author,
    description: undefined,
    isbn: incoming.isbn,
    edition: incoming.edition,
    publishedYear: incoming.publishedYear,
    pageCount: incoming.pageCount,
    status: incoming.status ?? "want-to-read",
    isFavorite: incoming.isFavorite ?? false,
    isAudiobook: incoming.isAudiobook ?? false,
    privacy: incoming.privacy ?? "private",
    timesRead: 0,
    dateStarted: incoming.dateStarted,
    dateFinished: incoming.dateFinished,
    coverUrl: incoming.coverUrl,
    apiCoverUrl: undefined,
    apiId: incoming.apiId,
    apiSource: incoming.apiSource,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

export const makeDecisionAction = (
  decision: DedupDecision
): DedupDecisionAction => decision.action;

export type DedupHelpers = {
  findMatches: typeof findMatches;
  applyDecision: typeof applyDecision;
  buildNewBook: typeof buildNewBook;
};

export const dedupHelpers: DedupHelpers = {
  findMatches,
  applyDecision,
  buildNewBook,
};
