"use node";

import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { logger } from "../../lib/logger";

const OPEN_LIBRARY_API = "https://openlibrary.org/api/books";
const OPEN_LIBRARY_SEARCH_API = "https://openlibrary.org/search.json";
const OPEN_LIBRARY_COVERS_URL = "https://covers.openlibrary.org/b/id";
const GOOGLE_BOOKS_API = "https://www.googleapis.com/books/v1/volumes";
const FETCH_TIMEOUT_MS = 8000; // Increased for parallel requests

export type CoverCandidate = {
  url: string;
  source: "open-library" | "google-books";
  apiId?: string;
  width?: number;
  height?: number;
};

type CoverResult =
  | {
      coverDataUrl: string;
      apiSource: "open-library" | "google-books";
      apiCoverUrl: string;
    }
  | {
      error: string;
    };

function cleanIsbn(isbn: string): string {
  return isbn.replace(/[-\s]/g, "");
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, contentType = "image/jpeg"): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const base64 = btoa(binary);
  return `data:${contentType};base64,${base64}`;
}

async function fetchGoogleBooksCandidates(
  isbn?: string,
  title?: string,
  author?: string,
): Promise<CoverCandidate[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  if (!apiKey) {
    logger.warn("GOOGLE_BOOKS_API_KEY not configured, skipping Google Books");
    return [];
  }

  const queries: string[] = [];
  if (isbn) queries.push(`isbn:${cleanIsbn(isbn)}`);
  if (title && author) queries.push(`intitle:${title}+inauthor:${author}`);
  else if (title) queries.push(`intitle:${title}`);

  if (queries.length === 0) return [];

  // Run queries in parallel
  const results = await Promise.allSettled(
    queries.map(async (q) => {
      const url = `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(q)}&key=${apiKey}&maxResults=3`;
      logger.info({ url }, "Fetching Google Books");

      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`Google Books API error: ${res.status}`);
      return res.json();
    }),
  );

  const candidates: CoverCandidate[] = [];

  for (const result of results) {
    if (result.status === "rejected") {
      logger.error({ err: result.reason }, "Google Books query failed");
      continue;
    }

    const items = result.value.items || [];
    for (const item of items) {
      const links = item.volumeInfo?.imageLinks;
      if (!links) continue;

      // Extract all available sizes
      const bestUrl = links.extraLarge || links.large || links.medium || links.thumbnail;
      if (bestUrl) {
        // Force HTTPS
        const secureUrl = bestUrl.replace(/^http:/, "https:");
        candidates.push({
          url: secureUrl,
          source: "google-books",
          apiId: item.id,
        });
      }
    }
  }

  return candidates;
}

async function fetchOpenLibraryCandidates(
  isbn?: string,
  title?: string,
  author?: string,
): Promise<CoverCandidate[]> {
  const candidates: CoverCandidate[] = [];

  // 1. ISBN Lookup
  if (isbn) {
    const cleaned = cleanIsbn(isbn);
    const url = `${OPEN_LIBRARY_API}?bibkeys=ISBN:${cleaned}&format=json&jscmd=data`;

    try {
      logger.info({ url }, "Fetching Open Library ISBN");
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const data = await res.json();
        const book = data[`ISBN:${cleaned}`];
        if (book?.cover) {
          if (book.cover.large) {
            candidates.push({
              url: book.cover.large,
              source: "open-library",
              apiId: `isbn/${cleaned}`,
            });
          } else if (book.cover.medium) {
            candidates.push({
              url: book.cover.medium,
              source: "open-library",
              apiId: `isbn/${cleaned}`,
            });
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "Open Library ISBN fetch failed");
    }
  }

  // 2. Search Lookup (Title + Author)
  if (title) {
    const q = `${title} ${author || ""}`.trim();
    const url = `${OPEN_LIBRARY_SEARCH_API}?q=${encodeURIComponent(q)}&fields=cover_i,title,author_name&limit=5`;

    try {
      logger.info({ url }, "Fetching Open Library Search");
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const data = await res.json();
        for (const doc of data.docs || []) {
          if (doc.cover_i) {
            candidates.push({
              url: `${OPEN_LIBRARY_COVERS_URL}/${doc.cover_i}-L.jpg`,
              source: "open-library",
              apiId: `olid/${doc.cover_i}`,
            });
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "Open Library Search fetch failed");
    }
  }

  return candidates;
}

/**
 * Public action to search for covers
 */
export const searchCovers = action({
  args: {
    title: v.string(),
    author: v.optional(v.string()),
    isbn: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<CoverCandidate[]> => {
    logger.info(args, "Starting federated cover search");

    const [googleResults, openLibResults] = await Promise.all([
      fetchGoogleBooksCandidates(args.isbn, args.title, args.author),
      fetchOpenLibraryCandidates(args.isbn, args.title, args.author),
    ]);

    const all = [...googleResults, ...openLibResults];

    // Deduplicate by URL
    const unique = Array.from(new Map(all.map((c) => [c.url, c])).values());

    logger.info({ count: unique.length }, "Cover search complete");
    return unique;
  },
});

/**
 * Helper function that contains the core search logic
 * Separated from action wrapper to enable testing
 *
 * @param book - The book object containing ISBN, title, and author
 * @returns Promise<CoverResult> with success/data or error message
 */
export async function searchBookCoverHelper(
  book: { isbn?: string; title?: string; author?: string } | null,
): Promise<CoverResult> {
  if (!book) {
    return { error: "Book not found" };
  }

  const [googleResults, openLibResults] = await Promise.all([
    fetchGoogleBooksCandidates(book.isbn, book.title, book.author),
    fetchOpenLibraryCandidates(book.isbn, book.title, book.author),
  ]);

  const candidates = [...googleResults, ...openLibResults];

  if (candidates.length === 0) {
    return { error: "Cover not found for this book. Try uploading manually." };
  }

  // Heuristic: Prefer Google Books (usually higher res) -> Open Library
  // Prefer the first result as they are usually sorted by relevance from the APIs
  const best = candidates.find((c) => c.source === "google-books") || candidates[0];

  if (!best) return { error: "Cover not found" };

  try {
    const response = await fetchWithTimeout(best.url);
    if (!response.ok) throw new Error("Failed to download image");

    const buffer = await response.arrayBuffer();
    return {
      coverDataUrl: arrayBufferToDataUrl(buffer),
      apiSource: best.source,
      apiCoverUrl: best.url,
    };
  } catch (err) {
    logger.error({ err, url: best.url }, "Failed to process best cover");
    return { error: "Failed to download selected cover" };
  }
}

/**
 * Internal action to fetch best cover (legacy support + background jobs)
 */
export const searchBookCover = internalAction({
  args: {
    bookId: v.id("books"),
  },
  handler: async (ctx, args): Promise<CoverResult> => {
    const book = await ctx.runQuery(internal.books.getForAction, {
      bookId: args.bookId,
    });

    return searchBookCoverHelper(book);
  },
});

export const search = searchBookCover;
