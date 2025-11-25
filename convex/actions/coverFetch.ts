import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

const OPEN_LIBRARY_API = "https://openlibrary.org/api/books";
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
 */
function cleanIsbn(isbn: string): string {
  return isbn.replace(/[-\s]/g, "");
}

/**
 * Fetch with timeout
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
 */
function arrayBufferToDataUrl(buffer: ArrayBuffer, contentType = "image/jpeg"): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:${contentType};base64,${base64}`;
}

/**
 * Try to fetch cover from Open Library
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
 * Helper function that contains the core search logic
 * Separated from action wrapper to enable testing
 * This is exported so tests can call it directly
 */
export async function searchBookCoverHelper(book: { isbn?: string } | null): Promise<CoverResult> {
  if (!book) {
    return { error: "Book not found" };
  }

  if (!book.isbn) {
    return { error: "No ISBN available for this book" };
  }

  // Try Open Library first (free, unlimited)
  console.log(`Searching Open Library for ISBN: ${book.isbn}`);
  const openLibraryResult = await tryOpenLibrary(book.isbn);

  if (openLibraryResult) {
    console.log("Cover found on Open Library");
    return openLibraryResult;
  }

  // Fall back to Google Books (requires API key, rate limited)
  console.log("Open Library failed, trying Google Books");
  const googleBooksResult = await tryGoogleBooks(book.isbn);

  if (googleBooksResult) {
    console.log("Cover found on Google Books");
    return googleBooksResult;
  }

  // Both APIs failed
  console.log("Cover not found on any API");
  return {
    error: "Cover not found for this book. Try uploading manually.",
  };
}

/**
 * Search for book cover across multiple APIs with cascading fallback
 * Internal action - callable only from other Convex functions
 *
 * Note: Actions cannot access ctx.db directly, so we create an internal
 * query to fetch the book. This is the Convex best practice for actions.
 */
export const searchBookCover = internalAction({
  args: {
    bookId: v.id("books"),
  },
  handler: async (ctx, args): Promise<CoverResult> => {
    // Actions can't access database directly - need to call query
    // For now, we'll pass the book data from the mutation that calls this
    // This will be fixed when we add the orchestration mutation
    return {
      error: "This action must be called with book data from mutation",
    };
  },
});

/**
 * Export the internal action for testing
 * In production, this is accessed via internal.actions.coverFetch.searchBookCover
 */
export const search = searchBookCover;
