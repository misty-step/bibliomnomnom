import type { DatabaseReader } from "../../convex/_generated/server";
import type { Doc, Id } from "../../convex/_generated/dataModel";

import type { DedupDecision, DedupMatch, DedupDecisionAction, ParsedBook } from "./types";
import { matchBooks } from "./dedup/core";
import { fetchUserBooks } from "./dedup/repository";

type DbReader = Pick<DatabaseReader, "query">;

export type Match = DedupMatch;

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
  const existing = await fetchUserBooks(db, userId);
  return matchBooks(existing, rows);
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
