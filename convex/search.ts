import { action } from "./_generated/server";
import { v } from "convex/values";

const GOOGLE_BOOKS_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";
const DEFAULT_MAX_RESULTS = 10;
const MAX_ALLOWED_RESULTS = 20;

export type SearchResult = {
  apiId: string;
  title: string;
  author: string;
  description?: string;
  isbn?: string;
  publishedYear?: number;
  pageCount?: number;
  apiCoverUrl?: string;
  apiSource: "google-books";
};

export const searchBooks = action({
  args: {
    query: v.string(),
    maxResults: v.optional(v.number()),
  },
  handler: async (_ctx, args): Promise<SearchResult[]> => {
    const query = args.query.trim();
    if (!query) {
      return [];
    }

    const maxResults = clampResults(args.maxResults);
    return await searchGoogleBooks(query, maxResults);
  },
});

function clampResults(value?: number) {
  if (!value) return DEFAULT_MAX_RESULTS;
  return Math.max(1, Math.min(MAX_ALLOWED_RESULTS, value));
}

async function searchGoogleBooks(
  query: string,
  maxResults: number
): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  if (!apiKey) {
    console.error("Missing GOOGLE_BOOKS_API_KEY environment variable");
    return [];
  }

  const url = new URL(GOOGLE_BOOKS_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error("Google Books API error:", response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];

    return items.map(transformVolume).filter(Boolean) as SearchResult[];
  } catch (error) {
    console.error("Google Books API request failed:", error);
    return [];
  }
}

function transformVolume(item: any): SearchResult | null {
  if (!item?.id || !item.volumeInfo) return null;

  const info = item.volumeInfo;
  const authors = Array.isArray(info.authors) ? info.authors.join(", ") : "Unknown";

  return {
    apiId: item.id,
    title: info.title ?? "Untitled",
    author: authors,
    description: info.description,
    isbn: extractIsbn(info.industryIdentifiers),
    publishedYear: extractYear(info.publishedDate),
    pageCount: typeof info.pageCount === "number" ? info.pageCount : undefined,
    apiCoverUrl: info.imageLinks?.thumbnail,
    apiSource: "google-books",
  };
}

function extractIsbn(identifiers?: Array<{ identifier?: string }> | null) {
  if (!Array.isArray(identifiers) || identifiers.length === 0) return undefined;
  return identifiers[0]?.identifier ?? undefined;
}

function extractYear(dateString?: string) {
  if (!dateString) return undefined;
  const year = parseInt(dateString.split("-")[0] ?? "", 10);
  return Number.isNaN(year) ? undefined : year;
}
