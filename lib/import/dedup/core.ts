import type { Doc, Id } from "../../convex/_generated/dataModel";

import { normalizeApiId, normalizeTitleAuthorKey } from "../normalize";
import { normalizeIsbn } from "../types";
import type { DedupMatch as Match, ParsedBook } from "../types";

const MATCH_CONFIDENCE: Record<NonNullable<Match["matchType"]>, number> = {
  isbn: 1,
  "title-author": 0.8,
  apiId: 0.6,
};

export const matchBooks = (
  existingBooks: Doc<"books">[],
  incomingRows: ParsedBook[]
): Match[] => {
  const isbnMap = new Map<string, Doc<"books">>();
  const titleAuthorMap = new Map<string, Doc<"books">>();
  const apiIdMap = new Map<string, Doc<"books">>();

  existingBooks.forEach((book) => {
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

  incomingRows.forEach((row) => {
    const isbn = normalizeIsbn(row.isbn);
    if (isbn && isbnMap.has(isbn)) {
      const match = isbnMap.get(isbn)!;
      matches.push({
        tempId: row.tempId,
        existingBookId: match._id as Id<"books">,
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
        existingBookId: match._id as Id<"books">,
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
        existingBookId: match._id as Id<"books">,
        matchType: "apiId",
        confidence: MATCH_CONFIDENCE.apiId,
      });
    }
  });

  return matches;
};

export type { Match };
