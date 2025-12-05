"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

const OPEN_LIBRARY_API = "https://openlibrary.org/api/books";
const OPEN_LIBRARY_SEARCH_API = "https://openlibrary.org/search.json";
const OPEN_LIBRARY_COVERS_URL = "https://covers.openlibrary.org/b/id";
const GOOGLE_BOOKS_API = "https://www.googleapis.com/books/v1/volumes";
const FETCH_TIMEOUT_MS = 5000;

type CoverResult =
  | {
      coverDataUrl: string;
      apiSource: "open-library" | "google-books";
      apiCoverUrl: string;
    }
  | {
      error: string;
    };

/**
 * Clean ISBN by removing dashes and spaces
 *
 * @param isbn - The raw ISBN string (10 or 13 digits)
 * @returns Cleaned ISBN string containing only numbers (and 'X' for ISBN-10)
 */
function cleanIsbn(isbn: string): string {
  return isbn.replace(/[-\s]/g, "");
}

/**
 * Fetch with timeout wrapper
 *
 * @param url - The URL to fetch
 * @param options - Fetch options (method, headers, etc.)
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns The Response object
 * @throws Error if fetch fails or times out
 */
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

/**
 * Convert ArrayBuffer to base64 data URL
 *
 * @param buffer - The binary image data
 * @param contentType - MIME type (default: "image/jpeg")
 * @returns A complete data URL string (e.g., "data:image/jpeg;base64,...")
 */
function arrayBufferToDataUrl(buffer: ArrayBuffer, contentType = "image/jpeg"): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    // bytes[i] is guaranteed to be defined within the array bounds
    binary += String.fromCharCode(bytes[i]!);
  }
  const base64 = btoa(binary);
  return `data:${contentType};base64,${base64}`;
}

/**
 * Try to fetch cover from Open Library
 *
 * @param isbn - The cleaned ISBN to search for
 * @returns CoverResult on success, null on failure or no cover found
 */
async function tryOpenLibrary(isbn: string): Promise<CoverResult | null> {
  try {
    const cleanedIsbn = cleanIsbn(isbn);
    const url = `${OPEN_LIBRARY_API}?bibkeys=ISBN:${cleanedIsbn}&format=json&jscmd=data`;

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const bookData = data[`ISBN:${cleanedIsbn}`];

    if (!bookData?.cover) {
      return null;
    }

    // Prefer large cover, fall back to medium
    const coverUrl = bookData.cover.large || bookData.cover.medium;

    if (!coverUrl) {
      return null;
    }

    // Fetch the actual image
    const imageResponse = await fetchWithTimeout(coverUrl);

    if (!imageResponse.ok) {
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    // Convert to data URL
    const coverDataUrl = arrayBufferToDataUrl(imageBuffer);

    return {
      coverDataUrl,
      apiSource: "open-library",
      apiCoverUrl: coverUrl,
    };
  } catch (error) {
    // Network error or timeout
    console.error("Open Library fetch failed:", error);
    return null;
  }
}

/**
 * Try to fetch cover from Google Books
 *
 * @param isbn - The cleaned ISBN to search for
 * @returns CoverResult on success, null on failure or no cover found
 */
async function tryGoogleBooks(isbn: string): Promise<CoverResult | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  if (!apiKey) {
    console.log("GOOGLE_BOOKS_API_KEY not configured, skipping Google Books");
    return null;
  }

  try {
    const cleanedIsbn = cleanIsbn(isbn);
    const url = `${GOOGLE_BOOKS_API}?q=isbn:${cleanedIsbn}&key=${apiKey}`;

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return null;
    }

    const volumeInfo = data.items[0].volumeInfo;
    const imageLinks = volumeInfo?.imageLinks;

    if (!imageLinks) {
      return null;
    }

    // Prefer larger images
    const coverUrl =
      imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.thumbnail;

    if (!coverUrl) {
      return null;
    }

    // Fetch the actual image
    const imageResponse = await fetchWithTimeout(coverUrl);

    if (!imageResponse.ok) {
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    // Convert to data URL
    const coverDataUrl = arrayBufferToDataUrl(imageBuffer);

    return {
      coverDataUrl,
      apiSource: "google-books",
      apiCoverUrl: coverUrl,
    };
  } catch (error) {
    // Network error or timeout
    console.error("Google Books fetch failed:", error);
    return null;
  }
}

/**
 * Try to fetch cover from Open Library by searching title + author
 * Used as fallback when no ISBN is available
 *
 * @param title - Book title
 * @param author - Book author
 * @returns CoverResult on success, null on failure or no cover found
 */
export async function tryOpenLibrarySearch(
  title: string,
  author: string,
): Promise<CoverResult | null> {
  try {
    const query = `${title} ${author}`.trim();
    if (!query) return null;

    const params = new URLSearchParams({
      q: query,
      fields: "cover_i",
      limit: "1",
    });

    const url = `${OPEN_LIBRARY_SEARCH_API}?${params.toString()}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const coverId = data.docs?.[0]?.cover_i;

    if (!coverId) {
      return null;
    }

    // Build cover URL (prefer large size)
    const coverUrl = `${OPEN_LIBRARY_COVERS_URL}/${coverId}-L.jpg`;

    // Fetch the actual image
    const imageResponse = await fetchWithTimeout(coverUrl);

    if (!imageResponse.ok) {
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    // Convert to data URL
    const coverDataUrl = arrayBufferToDataUrl(imageBuffer);

    return {
      coverDataUrl,
      apiSource: "open-library",
      apiCoverUrl: coverUrl,
    };
  } catch (error) {
    // Network error or timeout
    console.error("Open Library search failed:", error);
    return null;
  }
}

/**
 * Helper function that contains the core search logic
 * Separated from action wrapper to enable testing
 * This is exported so tests can call it directly
 *
 * Cascade strategy:
 * 1. If ISBN available: Open Library (ISBN) → Google Books (ISBN)
 * 2. If no ISBN or ISBN lookup fails: Open Library Search (title + author)
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

  // Try ISBN-based search first if ISBN is available
  if (book.isbn) {
    // Try Open Library first (free, unlimited)
    console.log(`Searching Open Library for ISBN: ${book.isbn}`);
    const openLibraryResult = await tryOpenLibrary(book.isbn);

    if (openLibraryResult) {
      console.log("Cover found on Open Library (ISBN)");
      return openLibraryResult;
    }

    // Fall back to Google Books (requires API key, rate limited)
    console.log("Open Library failed, trying Google Books");
    const googleBooksResult = await tryGoogleBooks(book.isbn);

    if (googleBooksResult) {
      console.log("Cover found on Google Books");
      return googleBooksResult;
    }
  }

  // Fallback: Search by title + author (works when no ISBN or ISBN lookup fails)
  if (book.title) {
    console.log(`Searching Open Library by title+author: "${book.title}" "${book.author || ""}"`);
    const searchResult = await tryOpenLibrarySearch(book.title, book.author || "");

    if (searchResult) {
      console.log("Cover found on Open Library (title+author search)");
      return searchResult;
    }
  }

  // All methods failed
  console.log("Cover not found on any API");
  return {
    error: "Cover not found for this book. Try uploading manually.",
  };
}

/**
 * Search for book cover across multiple APIs with cascading fallback
 * Internal action - callable only from other Convex functions
 *
 * Note: Actions cannot access ctx.db directly, so we call an internal
 * query to fetch the book. This is the Convex best practice for actions.
 *
 * @param ctx - The Convex action context
 * @param args - Arguments containing the bookId
 * @returns Promise<CoverResult> with success/data or error message
 */
export const searchBookCover = internalAction({
  args: {
    bookId: v.id("books"),
  },
  handler: async (ctx, args): Promise<CoverResult> => {
    // Actions can't access database directly - call internal query to get book
    const book = await ctx.runQuery(internal.books.getForAction, {
      bookId: args.bookId,
    });

    return searchBookCoverHelper(book);
  },
});

/**
 * Export the internal action for testing
 * In production, this is accessed via internal.actions.coverFetch.searchBookCover
 */
export const search = searchBookCover;
