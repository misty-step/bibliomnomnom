import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { searchBookCoverHelper } from "../../../convex/actions/coverFetch";

// Mock book data
const mockBook = {
  _id: "book_123" as any,
  userId: "user_1" as any,
  title: "The Fellowship of the Ring",
  author: "J.R.R. Tolkien",
  isbn: "9780547928227",
  status: "read" as const,
  isFavorite: false,
  isAudiobook: false,
  privacy: "private" as const,
  timesRead: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// Mock responses
const MOCK_OL_ISBN_RESPONSE = {
  "ISBN:9780547928227": {
    cover: {
      large: "https://covers.openlibrary.org/b/id/12345-L.jpg",
      medium: "https://covers.openlibrary.org/b/id/12345-M.jpg",
    },
  },
};

const MOCK_OL_SEARCH_RESPONSE = {
  docs: [{ cover_i: 54321 }],
};

const MOCK_GOOGLE_RESPONSE = {
  items: [
    {
      id: "g123",
      volumeInfo: {
        imageLinks: {
          thumbnail: "https://books.google.com/books/content?id=123&printsec=frontcover&img=1",
          large: "https://books.google.com/books/content?id=123&printsec=frontcover&img=1&zoom=3",
        },
      },
    },
  ],
};

const createMockFetch = (
  scenarios: {
    olIsbn?: any;
    olSearch?: any;
    google?: any;
    image?: boolean;
    delay?: number;
  } = {},
) => {
  return vi.fn().mockImplementation(async (url: string) => {
    if (scenarios.delay) {
      await new Promise((resolve) => setTimeout(resolve, scenarios.delay));
    }

    // Open Library ISBN
    if (url.includes("openlibrary.org/api/books")) {
      if (scenarios.olIsbn === null) return { ok: false, status: 404 };
      return {
        ok: true,
        status: 200,
        json: async () => scenarios.olIsbn ?? {},
      };
    }

    // Open Library Search
    if (url.includes("openlibrary.org/search.json")) {
      if (scenarios.olSearch === null) return { ok: false, status: 404 };
      return {
        ok: true,
        status: 200,
        json: async () => scenarios.olSearch ?? { docs: [] },
      };
    }

    // Google Books
    if (url.includes("googleapis.com")) {
      if (scenarios.google === null) return { ok: false, status: 404 };
      return {
        ok: true,
        status: 200,
        json: async () => scenarios.google ?? { items: [] },
      };
    }

    // Image Download (catch-all for image URLs)
    if (url.match(/\.(jpg|jpeg|png)|img=1/)) {
      if (scenarios.image === false) return { ok: false, status: 404 };
      return {
        ok: true,
        status: 200,
        headers: new Map([["content-type", "image/jpeg"]]),
        arrayBuffer: async () => new ArrayBuffer(100),
      };
    }

    return { ok: false, status: 404 };
  });
};

describe("searchBookCoverHelper", () => {
  let originalFetch: typeof global.fetch;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
    // Default: No Google API Key (unless test sets it)
    delete process.env.GOOGLE_BOOKS_API_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("returns error when book is null", async () => {
    const result = await searchBookCoverHelper(null);

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toBe("Book not found");
  });

  it("returns cover from Open Library when ISBN found (Google disabled)", async () => {
    global.fetch = createMockFetch({
      olIsbn: MOCK_OL_ISBN_RESPONSE,
    });

    const result = await searchBookCoverHelper(mockBook);

    expect(result).toHaveProperty("coverDataUrl");
    expect(result).toHaveProperty("apiSource", "open-library");
    expect((result as any).apiCoverUrl).toContain("12345-L.jpg");
  });

  it("prefers Google Books when API key present and both found", async () => {
    process.env.GOOGLE_BOOKS_API_KEY = "test-key";

    global.fetch = createMockFetch({
      olIsbn: MOCK_OL_ISBN_RESPONSE,
      google: MOCK_GOOGLE_RESPONSE,
    });

    const result = await searchBookCoverHelper(mockBook);

    expect(result).toHaveProperty("coverDataUrl");
    expect(result).toHaveProperty("apiSource", "google-books"); // Google preferred
    expect((result as any).apiCoverUrl).toContain("books.google.com");
  });

  it("falls back to Open Library when Google Books fails/empty", async () => {
    process.env.GOOGLE_BOOKS_API_KEY = "test-key";

    global.fetch = createMockFetch({
      olIsbn: MOCK_OL_ISBN_RESPONSE,
      google: { items: [] }, // Empty Google result
    });

    const result = await searchBookCoverHelper(mockBook);

    expect(result).toHaveProperty("apiSource", "open-library");
  });

  it("falls back to OL Search when ISBN lookups fail", async () => {
    global.fetch = createMockFetch({
      olIsbn: {}, // Empty ISBN result
      olSearch: MOCK_OL_SEARCH_RESPONSE,
    });

    const result = await searchBookCoverHelper(mockBook);

    expect(result).toHaveProperty("apiSource", "open-library");
    expect((result as any).apiCoverUrl).toContain("54321-L.jpg");
  });

  it("returns error when all sources fail", async () => {
    process.env.GOOGLE_BOOKS_API_KEY = "test-key";
    global.fetch = createMockFetch({
      olIsbn: {},
      olSearch: { docs: [] },
      google: { items: [] },
    });

    const result = await searchBookCoverHelper(mockBook);

    expect(result).toHaveProperty("error");
    expect((result as any).error).toMatch(/Cover not found/);
  });

  it("handles network timeout gracefully", async () => {
    // This test relies on FETCH_TIMEOUT_MS in code (8000ms)
    // We simulate a delay longer than that.
    // However, modifying the internal timeout constant is hard.
    // We can just verify it handles rejection.

    global.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

    const result = await searchBookCoverHelper(mockBook);
    // Should return error, not crash
    expect(result).toHaveProperty("error");
  });

  it("cleans ISBN format for API calls", async () => {
    const bookWithDashes = { ...mockBook, isbn: "978-0-547-92822-7" };
    const fetchSpy = createMockFetch({ olIsbn: {} });
    global.fetch = fetchSpy;

    await searchBookCoverHelper(bookWithDashes);

    // Check calls
    const calls = fetchSpy.mock.calls.map((c) => c[0]);
    const isbnCall = calls.find((url) => url.includes("openlibrary.org/api"));
    expect(isbnCall).toContain("9780547928227"); // cleaned
  });
});
