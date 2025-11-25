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

// Helper to create mock fetch responses
const mockFetchResponse = (data: any, ok = true, status = 200) => {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as Response);
};

describe("searchBookCoverHelper", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("returns cover from Open Library when ISBN found", async () => {
    // Mock Open Library API response
    global.fetch = vi
      .fn()
      .mockImplementationOnce(() =>
        mockFetchResponse({
          "ISBN:9780547928227": {
            cover: {
              large: "https://covers.openlibrary.org/b/id/12345-L.jpg",
              medium: "https://covers.openlibrary.org/b/id/12345-M.jpg",
            },
          },
        }),
      )
      // Mock image fetch
      .mockImplementationOnce(() =>
        mockFetchResponse(
          new ArrayBuffer(100), // Simulate image data
          true,
          200,
        ),
      );

    const result = await searchBookCoverHelper(mockBook);

    expect(result).toHaveProperty("coverDataUrl");
    expect(result).toHaveProperty("apiSource", "open-library");
    expect(result).toHaveProperty("apiCoverUrl", "https://covers.openlibrary.org/b/id/12345-L.jpg");
    expect((result as any).coverDataUrl).toMatch(/^data:image\//);
  });

  it("falls back to Google Books when Open Library fails", async () => {
    // Mock environment variable
    const originalEnv = process.env.GOOGLE_BOOKS_API_KEY;
    process.env.GOOGLE_BOOKS_API_KEY = "test-api-key";

    global.fetch = vi
      .fn()
      // Open Library returns empty
      .mockImplementationOnce(() => mockFetchResponse({}))
      // Google Books returns result
      .mockImplementationOnce(() =>
        mockFetchResponse({
          items: [
            {
              volumeInfo: {
                imageLinks: {
                  thumbnail:
                    "https://books.google.com/books/content?id=123&printsec=frontcover&img=1",
                },
              },
            },
          ],
        }),
      )
      // Mock image fetch
      .mockImplementationOnce(() => mockFetchResponse(new ArrayBuffer(100)));

    const result = await searchBookCoverHelper(mockBook);

    expect(result).toHaveProperty("coverDataUrl");
    expect(result).toHaveProperty("apiSource", "google-books");
    expect((result as any).apiCoverUrl).toContain("books.google.com");

    // Cleanup
    if (originalEnv) {
      process.env.GOOGLE_BOOKS_API_KEY = originalEnv;
    } else {
      delete process.env.GOOGLE_BOOKS_API_KEY;
    }
  });

  it("returns error when both APIs fail", async () => {
    global.fetch = vi
      .fn()
      // Open Library returns empty
      .mockImplementationOnce(() => mockFetchResponse({}))
      // Google Books returns empty (no API key fallback)
      .mockImplementationOnce(() =>
        mockFetchResponse({
          items: [],
        }),
      );

    const result = await searchBookCoverHelper(mockBook);

    expect(result).toHaveProperty("error");
    expect((result as any).error).toContain("Cover not found");
  });

  it("returns error when book has no ISBN", async () => {
    const bookWithoutIsbn = { ...mockBook, isbn: undefined };

    const result = await searchBookCoverHelper(bookWithoutIsbn);

    expect(result).toHaveProperty("error");
    expect((result as any).error).toContain("No ISBN");
  });

  it("returns error when book not found", async () => {
    const result = await searchBookCoverHelper(null);

    expect(result).toHaveProperty("error");
    expect((result as any).error).toContain("Book not found");
  });

  it("handles network timeout gracefully", async () => {
    // Mock fetch that takes too long (longer than FETCH_TIMEOUT_MS which is 5000ms)
    global.fetch = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockFetchResponse({})), 6000)), // 6 seconds (longer than 5s timeout)
    );

    const result = await searchBookCoverHelper(mockBook);

    expect(result).toHaveProperty("error");
    expect((result as any).error).toMatch(/Cover not found|timeout|failed/i);
  }, 15000); // Increase test timeout to 15s to allow for both API attempts

  it("handles invalid image content type", async () => {
    global.fetch = vi
      .fn()
      // Open Library returns cover URL
      .mockImplementationOnce(() =>
        mockFetchResponse({
          "ISBN:9780547928227": {
            cover: {
              large: "https://covers.openlibrary.org/b/id/12345-L.jpg",
            },
          },
        }),
      )
      // Image fetch returns HTML instead of image
      .mockImplementationOnce(() => mockFetchResponse("<html>Not Found</html>", false, 404));

    const result = await searchBookCoverHelper(mockBook);

    // Should fall back to Google Books or return error
    expect(result).toHaveProperty("error");
  });

  it("prefers large cover over medium from Open Library", async () => {
    global.fetch = vi
      .fn()
      .mockImplementationOnce(() =>
        mockFetchResponse({
          "ISBN:9780547928227": {
            cover: {
              large: "https://covers.openlibrary.org/b/id/12345-L.jpg",
              medium: "https://covers.openlibrary.org/b/id/12345-M.jpg",
            },
          },
        }),
      )
      .mockImplementationOnce(() => mockFetchResponse(new ArrayBuffer(100)));

    const result = await searchBookCoverHelper(mockBook);

    expect((result as any).apiCoverUrl).toContain("-L.jpg");
    expect((result as any).apiCoverUrl).not.toContain("-M.jpg");
  });

  it("cleans ISBN format for API calls", async () => {
    const bookWithDashesInIsbn = {
      ...mockBook,
      isbn: "978-0-547-92822-7",
    };

    global.fetch = vi
      .fn()
      .mockImplementationOnce(() => mockFetchResponse({}))
      .mockImplementationOnce(() => mockFetchResponse({ items: [] }));

    await searchBookCoverHelper(bookWithDashesInIsbn);

    // Verify fetch was called with cleaned ISBN (no dashes)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("9780547928227"),
      expect.any(Object),
    );
  });
});
