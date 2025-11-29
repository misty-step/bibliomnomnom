"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const OPEN_LIBRARY_COVERS_URL = "https://covers.openlibrary.org/b/id";
const USER_AGENT = "bibliomnomnom/1.0 (book tracking app)";
const FETCH_TIMEOUT_MS = 5000;
const MAX_RESULTS = 10;
const MIN_QUERY_LENGTH = 2;

/**
 * Search result type returned to client
 * Maps Open Library response fields to our book schema
 */
export type BookSearchResult = {
  /** Open Library work key (e.g., "/works/OL893415W") */
  apiId: string;
  /** Book title */
  title: string;
  /** Author name(s), joined with ", " if multiple */
  author: string;
  /** ISBN-13 preferred, falls back to ISBN-10 */
  isbn?: string;
  /** First publication year */
  publishedYear?: number;
  /** Median page count across editions */
  pageCount?: number;
  /** Cover image URL (Medium size) */
  coverUrl?: string;
};

/**
 * Open Library search document shape (partial)
 * Only the fields we request from the API
 */
export type OpenLibraryDoc = {
  key: string;
  title?: string;
  author_name?: string[];
  isbn?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
};

/**
 * Extract best ISBN from array
 * Prefers ISBN-13 (13 digits) over ISBN-10 (10 digits)
 */
export function extractBestIsbn(isbns?: string[]): string | undefined {
  if (!isbns || isbns.length === 0) return undefined;

  // Find first ISBN-13 (exactly 13 digits)
  const isbn13 = isbns.find((isbn) => /^\d{13}$/.test(isbn));
  if (isbn13) return isbn13;

  // Fall back to first ISBN-10 (10 chars, last may be X)
  const isbn10 = isbns.find((isbn) => /^\d{9}[\dX]$/.test(isbn));
  if (isbn10) return isbn10;

  // Last resort: first ISBN in array
  return isbns[0];
}

/**
 * Construct cover URL from Open Library cover ID
 * Returns medium-sized cover (M = ~180px width)
 */
export function buildCoverUrl(coverId?: number): string | undefined {
  if (!coverId) return undefined;
  return `${OPEN_LIBRARY_COVERS_URL}/${coverId}-M.jpg`;
}

/**
 * Map Open Library document to BookSearchResult
 */
export function mapToSearchResult(doc: OpenLibraryDoc): BookSearchResult {
  return {
    apiId: doc.key,
    title: doc.title ?? "Unknown Title",
    author: doc.author_name?.join(", ") ?? "Unknown Author",
    isbn: extractBestIsbn(doc.isbn),
    publishedYear: doc.first_publish_year,
    pageCount: doc.number_of_pages_median,
    coverUrl: buildCoverUrl(doc.cover_i),
  };
}

/**
 * Core search logic separated for testing
 * Calls Open Library API and maps results
 */
export async function searchBooksHelper(query: string): Promise<BookSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
    fields: "key,title,author_name,isbn,first_publish_year,number_of_pages_median,cover_i",
    limit: String(MAX_RESULTS),
  });

  const url = `${OPEN_LIBRARY_SEARCH_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`Open Library API error: ${response.status}`);
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();
    const docs: OpenLibraryDoc[] = data.docs ?? [];

    return docs.map(mapToSearchResult);
  } catch (error) {
    console.error("Open Library search failed:", error);

    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Search timed out. Please try again.");
    }
    if (error instanceof Error && error.message.startsWith("Search failed")) {
      throw error;
    }
    throw new Error("Search failed. Please try again.");
  }
}

/**
 * Search Open Library for books matching query
 *
 * @param query - Search string (title, author, or combined)
 * @returns Array of BookSearchResult (max 10)
 * @throws Error if API call fails or times out
 */
export const searchBooks = action({
  args: {
    query: v.string(),
  },
  handler: async (_, { query }): Promise<BookSearchResult[]> => {
    return searchBooksHelper(query);
  },
});
