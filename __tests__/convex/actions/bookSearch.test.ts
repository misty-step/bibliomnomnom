import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  searchBooksHelper,
  extractBestIsbn,
  buildCoverUrl,
  mapToSearchResult,
  type OpenLibraryDoc,
} from "../../../convex/actions/bookSearch";

// Helper to create mock fetch responses
const mockFetchResponse = (data: any, ok = true, status = 200) => {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  } as Response);
};

describe("extractBestIsbn", () => {
  it("returns undefined for empty array", () => {
    expect(extractBestIsbn([])).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(extractBestIsbn(undefined)).toBeUndefined();
  });

  it("prefers ISBN-13 over ISBN-10", () => {
    const isbns = ["0441013597", "9780441013593"];
    expect(extractBestIsbn(isbns)).toBe("9780441013593");
  });

  it("returns ISBN-10 when no ISBN-13 available", () => {
    const isbns = ["0441013597", "044101359X"];
    expect(extractBestIsbn(isbns)).toBe("0441013597");
  });

  it("handles ISBN-10 with X check digit", () => {
    const isbns = ["044101359X"];
    expect(extractBestIsbn(isbns)).toBe("044101359X");
  });

  it("falls back to first ISBN when formats invalid", () => {
    const isbns = ["invalid-isbn", "also-invalid"];
    expect(extractBestIsbn(isbns)).toBe("invalid-isbn");
  });
});

describe("buildCoverUrl", () => {
  it("returns undefined for undefined coverId", () => {
    expect(buildCoverUrl(undefined)).toBeUndefined();
  });

  it("returns undefined for zero coverId", () => {
    expect(buildCoverUrl(0)).toBeUndefined();
  });

  it("constructs medium-sized cover URL", () => {
    expect(buildCoverUrl(8442807)).toBe("https://covers.openlibrary.org/b/id/8442807-M.jpg");
  });
});

describe("mapToSearchResult", () => {
  it("maps all fields correctly", () => {
    const doc: OpenLibraryDoc = {
      key: "/works/OL893415W",
      title: "Dune",
      author_name: ["Frank Herbert"],
      isbn: ["9780441013593"],
      first_publish_year: 1965,
      number_of_pages_median: 604,
      cover_i: 8442807,
    };

    const result = mapToSearchResult(doc);

    expect(result).toEqual({
      apiId: "/works/OL893415W",
      title: "Dune",
      author: "Frank Herbert",
      isbn: "9780441013593",
      publishedYear: 1965,
      pageCount: 604,
      coverUrl: "https://covers.openlibrary.org/b/id/8442807-M.jpg",
    });
  });

  it("joins multiple authors with comma", () => {
    const doc: OpenLibraryDoc = {
      key: "/works/OL123",
      title: "Test Book",
      author_name: ["Author One", "Author Two", "Author Three"],
    };

    const result = mapToSearchResult(doc);

    expect(result.author).toBe("Author One, Author Two, Author Three");
  });

  it("handles missing optional fields", () => {
    const doc: OpenLibraryDoc = {
      key: "/works/OL123",
    };

    const result = mapToSearchResult(doc);

    expect(result).toEqual({
      apiId: "/works/OL123",
      title: "Unknown Title",
      author: "Unknown Author",
      isbn: undefined,
      publishedYear: undefined,
      pageCount: undefined,
      coverUrl: undefined,
    });
  });
});

describe("searchBooksHelper", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("returns empty array for empty query", async () => {
    const result = await searchBooksHelper("");
    expect(result).toEqual([]);
  });

  it("returns empty array for whitespace query", async () => {
    const result = await searchBooksHelper("   ");
    expect(result).toEqual([]);
  });

  it("returns empty array for single character query", async () => {
    const result = await searchBooksHelper("a");
    expect(result).toEqual([]);
  });

  it("returns mapped results for valid query", async () => {
    global.fetch = vi.fn().mockImplementationOnce(() =>
      mockFetchResponse({
        numFound: 1,
        docs: [
          {
            key: "/works/OL893415W",
            title: "Dune",
            author_name: ["Frank Herbert"],
            isbn: ["9780441013593"],
            first_publish_year: 1965,
            number_of_pages_median: 604,
            cover_i: 8442807,
          },
        ],
      }),
    );

    const results = await searchBooksHelper("dune");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      apiId: "/works/OL893415W",
      title: "Dune",
      author: "Frank Herbert",
      isbn: "9780441013593",
      publishedYear: 1965,
      pageCount: 604,
      coverUrl: "https://covers.openlibrary.org/b/id/8442807-M.jpg",
    });
  });

  it("sends correct User-Agent header", async () => {
    global.fetch = vi.fn().mockImplementationOnce(() => mockFetchResponse({ docs: [] }));

    await searchBooksHelper("test");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("bibliomnomnom"),
        }),
      }),
    );
  });

  it("requests correct fields from API", async () => {
    global.fetch = vi.fn().mockImplementationOnce(() => mockFetchResponse({ docs: [] }));

    await searchBooksHelper("test");

    const url = (global.fetch as any).mock.calls[0][0] as string;
    expect(url).toContain("fields=");
    expect(url).toContain("key");
    expect(url).toContain("title");
    expect(url).toContain("author_name");
    expect(url).toContain("isbn");
    expect(url).toContain("first_publish_year");
    expect(url).toContain("number_of_pages_median");
    expect(url).toContain("cover_i");
  });

  it("limits results to 10", async () => {
    global.fetch = vi.fn().mockImplementationOnce(() => mockFetchResponse({ docs: [] }));

    await searchBooksHelper("test");

    const url = (global.fetch as any).mock.calls[0][0] as string;
    expect(url).toContain("limit=10");
  });

  it("throws user-friendly error on API error", async () => {
    global.fetch = vi.fn().mockImplementationOnce(() => mockFetchResponse({}, false, 500));

    await expect(searchBooksHelper("test")).rejects.toThrow("Search failed");
  });

  it("throws user-friendly error on timeout", async () => {
    global.fetch = vi.fn().mockImplementationOnce(() => {
      const error = new Error("Timeout");
      error.name = "TimeoutError";
      return Promise.reject(error);
    });

    await expect(searchBooksHelper("test")).rejects.toThrow("timed out");
  });

  it("handles empty docs array", async () => {
    global.fetch = vi.fn().mockImplementationOnce(() => mockFetchResponse({ docs: [] }));

    const results = await searchBooksHelper("xyznonexistent");

    expect(results).toEqual([]);
  });

  it("handles missing docs field", async () => {
    global.fetch = vi.fn().mockImplementationOnce(() => mockFetchResponse({}));

    const results = await searchBooksHelper("test");

    expect(results).toEqual([]);
  });
});
