# External Book Search via Open Library API

**Status**: Specification complete, ready for implementation
**Estimated Effort**: 5-6 hours
**Priority**: ADOPTION BLOCKER — 10x faster book adding vs manual entry
**Branch**: `feature/open-library-search`

---

## Executive Summary

Add book search functionality using Open Library API integrated directly into AddBookSheet. Users search by title/author, select a result to auto-fill the form, edit if needed, then save. This transforms the "add book" workflow from 2-minute manual entry to 3-second search-and-select.

**User Value**:
- 10x faster book adding (search → select → done)
- Auto-populated metadata (covers, ISBN, page count, year)
- Higher data quality from authoritative source
- Users add more books → more engagement → better retention

---

## User Context

**Who**: All bibliomnomnom users adding books to their library

**Problem**: Manual entry requires typing 5-10 fields per book. Users with large libraries (100+ books) abandon the app due to friction.

**Solution**: Search external database, auto-fill form fields, let user edit before saving.

**Success Criteria**:
- Search returns relevant results in <1 second
- Selected result pre-fills all available fields
- User can still manually enter if book not found
- Books saved with `apiSource: "open-library"` for tracking

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Search books by title/author query string | Must |
| F2 | Display search results with covers, titles, authors, year | Must |
| F3 | Select result to auto-fill AddBookSheet form | Must |
| F4 | Allow editing pre-filled fields before saving | Must |
| F5 | Fallback to manual entry when search fails or no results | Must |
| F6 | Debounced search input (300ms) to prevent API spam | Must |
| F7 | Loading state during search | Must |
| F8 | Error state with retry option | Should |
| F9 | Keyboard navigation in results (arrow keys, enter) | Should |
| F10 | Add ISBN field to AddBookSheet form | Must |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NF1 | Search response time | < 1 second P95 |
| NF2 | API timeout | 5 seconds max |
| NF3 | Results limit | 10 items max |
| NF4 | Debounce delay | 300ms |
| NF5 | No API key required | Open Library is free |

---

## Architecture Decision

### Selected Approach: Open Library API Only

**Rationale**:
- **Simplicity**: No API key management, no rate limit concerns
- **Existing Pattern**: Already used in codebase for cover fetching (`coverFetch.ts`)
- **Cost**: Free, unlimited (with reasonable use)
- **Coverage**: 50M+ editions, sufficient for most users

### Alternative Considered: Google Books Fallback

**Why Not Chosen**:
- Adds complexity (two APIs, fallback logic)
- Requires API key and environment variable management
- Google Books has daily rate limits (1000 req/day free)
- Marginal benefit for additional complexity

---

## Open Library API Reference

### Search Endpoint

```
GET https://openlibrary.org/search.json
```

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (title, author, or combined) |
| `fields` | string | No | Comma-separated fields to return |
| `limit` | number | No | Max results (default 100, we use 10) |
| `page` | number | No | Pagination (1-indexed) |

**Recommended Fields** (minimize response size):
```
key,title,author_name,isbn,first_publish_year,number_of_pages_median,cover_i
```

**Example Request**:
```bash
curl "https://openlibrary.org/search.json?q=dune+frank+herbert&fields=key,title,author_name,isbn,first_publish_year,number_of_pages_median,cover_i&limit=10"
```

**Example Response**:
```json
{
  "numFound": 847,
  "start": 0,
  "docs": [
    {
      "key": "/works/OL893415W",
      "title": "Dune",
      "author_name": ["Frank Herbert"],
      "isbn": ["9780441013593", "0441013597", "9780340960196"],
      "first_publish_year": 1965,
      "number_of_pages_median": 604,
      "cover_i": 8442807
    }
  ]
}
```

### Cover Image URL Construction

```
https://covers.openlibrary.org/b/id/{cover_i}-{size}.jpg
```

**Sizes**:
- `S` — Small (~42px width)
- `M` — Medium (~180px width) ← **Use this**
- `L` — Large (~360px width)

**Example**:
```
https://covers.openlibrary.org/b/id/8442807-M.jpg
```

**Missing Cover Handling**:
- Returns 1x1 transparent pixel if no cover exists
- Check `cover_i` exists before constructing URL

### Rate Limits & Best Practices

- **No official rate limit** for search API
- **Recommended**: Include `User-Agent` header identifying your app
- **Courtesy**: Debounce requests (300ms minimum)
- **Cover API**: 100 requests per 5 minutes per IP (for non-OLID requests)

**Required Header**:
```typescript
headers: {
  "User-Agent": "bibliomnomnom/1.0 (book tracking app)"
}
```

---

## Detailed Implementation

### File 1: `convex/actions/bookSearch.ts`

**Purpose**: Convex action that calls Open Library search API

**Full Implementation**:

```typescript
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const OPEN_LIBRARY_COVERS_URL = "https://covers.openlibrary.org/b/id";
const USER_AGENT = "bibliomnomnom/1.0 (book tracking app)";
const FETCH_TIMEOUT_MS = 5000;
const MAX_RESULTS = 10;

/**
 * Result type returned to frontend
 * Maps Open Library response to our book schema fields
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
 */
type OpenLibraryDoc = {
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
function extractBestIsbn(isbns?: string[]): string | undefined {
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
 */
function buildCoverUrl(coverId?: number): string | undefined {
  if (!coverId) return undefined;
  return `${OPEN_LIBRARY_COVERS_URL}/${coverId}-M.jpg`;
}

/**
 * Map Open Library document to our BookSearchResult type
 */
function mapToSearchResult(doc: OpenLibraryDoc): BookSearchResult {
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
    // Validate query
    const trimmedQuery = query.trim();
    if (!trimmedQuery || trimmedQuery.length < 2) {
      return [];
    }

    // Build URL with query parameters
    const params = new URLSearchParams({
      q: trimmedQuery,
      fields: "key,title,author_name,isbn,first_publish_year,number_of_pages_median,cover_i",
      limit: String(MAX_RESULTS),
    });

    const url = `${OPEN_LIBRARY_SEARCH_URL}?${params.toString()}`;

    try {
      // Fetch with timeout
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

      // Map and return results
      return docs.map(mapToSearchResult);
    } catch (error) {
      // Log error for debugging
      console.error("Open Library search failed:", error);

      // Re-throw with user-friendly message
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error("Search timed out. Please try again.");
      }
      throw new Error("Search failed. Please try again.");
    }
  },
});
```

**Key Design Decisions**:
1. Uses `action` (not `internalAction`) — called directly from client
2. No auth required — search is public
3. 5s timeout via `AbortSignal.timeout()` — fail fast
4. ISBN-13 preferred — modern standard
5. Graceful handling of missing fields

---

### File 2: `hooks/useBookSearch.ts`

**Purpose**: React hook managing search state with debouncing

**Full Implementation**:

```typescript
import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { BookSearchResult } from "@/convex/actions/bookSearch";

// Re-export type for consumers
export type { BookSearchResult };

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Custom debounce hook
 * Returns debounced value after delay
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook return type
 */
export type UseBookSearchReturn = {
  /** Current search query */
  query: string;
  /** Update search query */
  setQuery: (query: string) => void;
  /** Search results (empty array if none) */
  results: BookSearchResult[];
  /** True while API call in progress */
  isLoading: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Clear query and results */
  clear: () => void;
  /** True if query is long enough to trigger search */
  isQueryValid: boolean;
};

/**
 * Hook for searching books via Open Library API
 *
 * Features:
 * - Debounced input (300ms)
 * - Loading and error states
 * - Automatic search on query change
 * - Minimum query length validation
 *
 * @example
 * ```tsx
 * const { query, setQuery, results, isLoading, error } = useBookSearch();
 * ```
 */
export function useBookSearch(): UseBookSearchReturn {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchBooks = useAction(api.actions.bookSearch.searchBooks);
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  const isQueryValid = debouncedQuery.trim().length >= MIN_QUERY_LENGTH;

  // Trigger search when debounced query changes
  useEffect(() => {
    // Clear results if query too short
    if (!isQueryValid) {
      setResults([]);
      setError(null);
      return;
    }

    // Perform search
    const performSearch = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const searchResults = await searchBooks({ query: debouncedQuery });
        setResults(searchResults);
      } catch (err) {
        console.error("Search failed:", err);
        setError(err instanceof Error ? err.message : "Search failed. Please try again.");
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery, isQueryValid, searchBooks]);

  // Clear function
  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clear,
    isQueryValid,
  };
}
```

**Key Design Decisions**:
1. Custom `useDebounce` — no external dependency
2. `isQueryValid` exposed — UI can show "type more" hint
3. `clear()` function — for explicit reset
4. Error messages preserved — show to user

---

### File 3: `components/book/BookSearchResultItem.tsx`

**Purpose**: Single search result row component

**Full Implementation**:

```typescript
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { BookSearchResult } from "@/hooks/useBookSearch";

type BookSearchResultItemProps = {
  /** Search result data */
  result: BookSearchResult;
  /** Called when item is clicked/selected */
  onSelect: (result: BookSearchResult) => void;
  /** True if this item is currently highlighted (keyboard nav) */
  isHighlighted?: boolean;
  /** Index in list (for aria) */
  index: number;
};

/**
 * Placeholder image for books without covers
 * Simple SVG book icon
 */
const PLACEHOLDER_COVER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60' viewBox='0 0 40 60'%3E%3Crect fill='%23E5E0D5' width='40' height='60'/%3E%3Cpath fill='%23A39E93' d='M10 15h20v2H10zm0 6h20v2H10zm0 6h14v2H10z'/%3E%3C/svg%3E";

/**
 * Individual search result item
 * Displays cover thumbnail, title, author, and year
 */
export function BookSearchResultItem({
  result,
  onSelect,
  isHighlighted = false,
  index,
}: BookSearchResultItemProps) {
  const handleClick = () => {
    onSelect(result);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(result);
    }
  };

  return (
    <div
      role="option"
      aria-selected={isHighlighted}
      id={`search-result-${index}`}
      tabIndex={-1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors",
        isHighlighted
          ? "bg-canvas-boneMuted"
          : "hover:bg-canvas-boneMuted/50"
      )}
    >
      {/* Cover Thumbnail */}
      <div className="relative h-[60px] w-[40px] flex-shrink-0 overflow-hidden rounded-sm bg-canvas-boneMuted">
        <Image
          src={result.coverUrl ?? PLACEHOLDER_COVER}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
          unoptimized={!result.coverUrl} // Don't optimize placeholder
        />
      </div>

      {/* Text Content */}
      <div className="min-w-0 flex-1">
        {/* Title */}
        <p className="truncate font-display text-sm font-medium text-text-ink">
          {result.title}
        </p>
        {/* Author and Year */}
        <p className="truncate text-xs text-text-inkMuted">
          {result.author}
          {result.publishedYear && (
            <span className="ml-1 text-text-inkSubtle">
              · {result.publishedYear}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
```

**Key Design Decisions**:
1. SVG placeholder — no external image dependency
2. `aria-selected` and `role="option"` — accessibility
3. Keyboard support — Enter/Space to select
4. Truncation — handles long titles gracefully

---

### File 4: `components/book/BookSearchInput.tsx`

**Purpose**: Search input with dropdown results

**Full Implementation**:

```typescript
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useBookSearch, type BookSearchResult } from "@/hooks/useBookSearch";
import { BookSearchResultItem } from "./BookSearchResultItem";
import { cn } from "@/lib/utils";

type BookSearchInputProps = {
  /** Called when user selects a search result */
  onSelect: (result: BookSearchResult) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Auto-focus input on mount */
  autoFocus?: boolean;
  /** Disable input */
  disabled?: boolean;
};

/**
 * Book search input with dropdown results
 *
 * Features:
 * - Debounced search (300ms)
 * - Loading spinner
 * - Keyboard navigation (↑/↓, Enter, Escape)
 * - Click outside to close
 * - Error handling with retry hint
 */
export function BookSearchInput({
  onSelect,
  placeholder = "Search by title or author...",
  autoFocus = false,
  disabled = false,
}: BookSearchInputProps) {
  const { query, setQuery, results, isLoading, error, clear, isQueryValid } =
    useBookSearch();

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open dropdown when results exist
  useEffect(() => {
    if (results.length > 0 || (isQueryValid && (isLoading || error))) {
      setIsOpen(true);
      setHighlightedIndex(-1);
    }
  }, [results, isQueryValid, isLoading, error]);

  // Close dropdown when query cleared
  useEffect(() => {
    if (!query.trim()) {
      setIsOpen(false);
    }
  }, [query]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;

        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && results[highlightedIndex]) {
            handleSelect(results[highlightedIndex]);
          }
          break;

        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          inputRef.current?.focus();
          break;
      }
    },
    [isOpen, results, highlightedIndex]
  );

  // Handle selection
  const handleSelect = (result: BookSearchResult) => {
    onSelect(result);
    clear();
    setIsOpen(false);
  };

  // Handle clear button
  const handleClear = () => {
    clear();
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const showDropdown = isOpen && (results.length > 0 || isLoading || error);

  return (
    <div ref={containerRef} className="relative">
      {/* Input Container */}
      <div className="relative">
        {/* Search Icon */}
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-inkSubtle" />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-label="Search for books"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-controls="search-results"
          aria-activedescendant={
            highlightedIndex >= 0 ? `search-result-${highlightedIndex}` : undefined
          }
          className={cn(
            "w-full rounded-md border border-line-ghost bg-canvas-bone py-2.5 pl-10 pr-10 text-sm text-text-ink placeholder:text-text-inkSubtle",
            "focus:border-text-inkMuted focus:outline-none focus:ring-1 focus:ring-text-inkMuted",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />

        {/* Loading Spinner or Clear Button */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-text-inkSubtle" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-text-inkSubtle hover:text-text-ink"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          id="search-results"
          role="listbox"
          className="absolute z-50 mt-1 max-h-[320px] w-full overflow-auto rounded-md border border-line-ghost bg-canvas-bone shadow-lg"
        >
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-sm text-text-inkMuted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="px-4 py-8 text-center text-sm text-text-inkMuted">
              <p className="text-accent-ember">{error}</p>
              <p className="mt-1">Try a different search term.</p>
            </div>
          )}

          {/* No Results State */}
          {!isLoading && !error && results.length === 0 && isQueryValid && (
            <div className="px-4 py-8 text-center text-sm text-text-inkMuted">
              <p>No books found for "{query}"</p>
              <p className="mt-1">Try different keywords or add manually below.</p>
            </div>
          )}

          {/* Results */}
          {!isLoading && !error && results.length > 0 && (
            <div className="py-1">
              {results.map((result, index) => (
                <BookSearchResultItem
                  key={result.apiId}
                  result={result}
                  onSelect={handleSelect}
                  isHighlighted={index === highlightedIndex}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Key Design Decisions**:
1. Full keyboard support — arrows, enter, escape
2. ARIA attributes — screen reader accessible
3. Click outside closes — standard UX pattern
4. Three states in dropdown — loading, error, results
5. "Add manually" hint — guides user when search fails

---

### File 5: Modifications to `components/book/AddBookSheet.tsx`

**Changes Required**:

#### 1. Add New State Variables (after line 78)

```typescript
// Search-related state
const [apiId, setApiId] = useState<string | undefined>(undefined);
const [apiSource, setApiSource] = useState<"open-library" | "manual">("manual");
const [isbn, setIsbn] = useState("");
const [publishedYear, setPublishedYear] = useState("");
const [pageCount, setPageCount] = useState("");
const [apiCoverUrl, setApiCoverUrl] = useState<string | undefined>(undefined);
```

#### 2. Add Import for BookSearchInput (line 1-15 area)

```typescript
import { BookSearchInput, type BookSearchResult } from "./BookSearchInput";
```

#### 3. Add Handler for Book Selection (after handleRemoveCover, ~line 160)

```typescript
/**
 * Handle selection of search result
 * Pre-fills form with book data from Open Library
 */
const handleBookSelected = (result: BookSearchResult) => {
  // Set basic fields
  setTitle(result.title);
  setAuthor(result.author);

  // Set optional fields
  setIsbn(result.isbn ?? "");
  setPublishedYear(result.publishedYear?.toString() ?? "");
  setPageCount(result.pageCount?.toString() ?? "");

  // Set API tracking fields
  setApiId(result.apiId);
  setApiSource("open-library");

  // Set cover if available
  if (result.coverUrl) {
    setCoverPreview(result.coverUrl);
    setApiCoverUrl(result.coverUrl);
    setCoverFile(null); // Clear any uploaded file
  }
};
```

#### 4. Update handleClose to Reset New Fields (line ~93-105)

```typescript
const handleClose = useCallback(() => {
  setIsOpen(false);
  // Reset form
  setTitle("");
  setAuthor("");
  setStatus("currently-reading");
  setCoverFile(null);
  setCoverPreview(null);
  setError(null);
  setIsFavorite(false);
  setIsAudiobook(false);
  setDateFinished("");
  // Reset new fields
  setIsbn("");
  setPublishedYear("");
  setPageCount("");
  setApiId(undefined);
  setApiSource("manual");
  setApiCoverUrl(undefined);
}, [setIsOpen]);
```

#### 5. Update handleSubmit to Include New Fields (line ~192-201)

```typescript
// Create book
await createBook({
  title: trimmedTitle,
  author: trimmedAuthor,
  status,
  coverUrl,
  isAudiobook,
  isFavorite,
  dateFinished: status === "read" ? dateFinishedTimestamp : undefined,
  apiSource,
  apiId,
  apiCoverUrl,
  isbn: isbn.trim() || undefined,
  publishedYear: publishedYear ? parseInt(publishedYear, 10) : undefined,
  pageCount: pageCount ? parseInt(pageCount, 10) : undefined,
});
```

#### 6. Add BookSearchInput to Form (after SideSheet title, before Cover Upload ~line 240)

```tsx
<SideSheet open={isOpen} onOpenChange={setIsOpen} title="Add Book">
  <form onSubmit={handleSubmit} className="space-y-8">
    {/* Book Search */}
    <div>
      <label className="mb-3 block font-mono text-xs uppercase tracking-wider text-text-inkMuted">
        Search
      </label>
      <BookSearchInput
        onSelect={handleBookSelected}
        disabled={isSubmitting}
        autoFocus
      />
      <p className="mt-2 text-xs text-text-inkSubtle">
        Search by title or author, or fill in manually below.
      </p>
    </div>

    {/* Divider */}
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-line-ghost" />
      <span className="text-xs text-text-inkSubtle">or enter manually</span>
      <div className="h-px flex-1 bg-line-ghost" />
    </div>

    {/* Cover Upload */}
    {/* ... existing code ... */}
```

#### 7. Add ISBN Field (after Author field, ~line 332)

```tsx
{/* ISBN */}
<div>
  <label className="mb-3 block font-mono text-xs uppercase tracking-wider text-text-inkMuted">
    ISBN
  </label>
  <Input
    type="text"
    value={isbn}
    onChange={(e) => setIsbn(e.target.value)}
    placeholder="9780441013593"
    disabled={isSubmitting}
    className="font-mono"
  />
</div>
```

#### 8. Add Page Count and Year Fields (optional, after ISBN)

```tsx
{/* Additional Metadata (collapsed by default for simplicity) */}
<div className="grid grid-cols-2 gap-4">
  <div>
    <label className="mb-3 block font-mono text-xs uppercase tracking-wider text-text-inkMuted">
      Published Year
    </label>
    <Input
      type="text"
      inputMode="numeric"
      value={publishedYear}
      onChange={(e) => setPublishedYear(e.target.value.replace(/\D/g, ""))}
      placeholder="1965"
      disabled={isSubmitting}
      maxLength={4}
    />
  </div>
  <div>
    <label className="mb-3 block font-mono text-xs uppercase tracking-wider text-text-inkMuted">
      Page Count
    </label>
    <Input
      type="text"
      inputMode="numeric"
      value={pageCount}
      onChange={(e) => setPageCount(e.target.value.replace(/\D/g, ""))}
      placeholder="604"
      disabled={isSubmitting}
    />
  </div>
</div>
```

---

## UI/UX Specifications

### Search Input Behavior

| State | Visual | Behavior |
|-------|--------|----------|
| Empty | Placeholder text | No dropdown |
| Typing (<2 chars) | User input | No dropdown |
| Typing (≥2 chars) | User input | Wait 300ms, show loading |
| Loading | Spinner in dropdown | Show "Searching..." |
| Results | List of books | Show results (max 10) |
| No Results | Empty state message | Show "No books found" + hint |
| Error | Error message | Show error + retry hint |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `↓` Arrow Down | Move highlight down |
| `↑` Arrow Up | Move highlight up |
| `Enter` | Select highlighted item |
| `Escape` | Close dropdown, focus input |
| `Tab` | Close dropdown, move focus |

### Result Item Layout

```
┌─────────────────────────────────────────────────────┐
│ ┌───────┐                                           │
│ │       │  Title of the Book                        │
│ │ Cover │  Author Name · 1965                       │
│ │       │                                           │
│ └───────┘                                           │
└─────────────────────────────────────────────────────┘
  40x60px    Truncated if too long
```

### Form Flow After Selection

1. User selects result
2. Search input clears
3. Form fields populate:
   - Title ✓
   - Author ✓
   - ISBN ✓
   - Cover preview ✓ (if available)
   - Published Year ✓
   - Page Count ✓
4. User can edit any field
5. User selects status and flags
6. User clicks "Add Book"

---

## Test Scenarios

### Unit Tests: `convex/actions/bookSearch.ts`

| Test | Input | Expected |
|------|-------|----------|
| Valid query returns results | `"dune"` | Array of BookSearchResult |
| Empty query returns empty | `""` | `[]` |
| Short query returns empty | `"a"` | `[]` |
| Whitespace query returns empty | `"   "` | `[]` |
| Prefers ISBN-13 | `isbns: ["1234567890", "9781234567890"]` | `"9781234567890"` |
| Falls back to ISBN-10 | `isbns: ["1234567890"]` | `"1234567890"` |
| Builds cover URL | `cover_i: 12345` | `"https://covers.openlibrary.org/b/id/12345-M.jpg"` |
| Handles missing cover | `cover_i: undefined` | `undefined` |
| Joins multiple authors | `author_name: ["A", "B"]` | `"A, B"` |
| Handles API timeout | Network delay >5s | Throws "Search timed out" |
| Handles API error | 500 response | Throws "Search failed" |

### Unit Tests: `hooks/useBookSearch.ts`

| Test | Action | Expected |
|------|--------|----------|
| Initial state | Mount | `query: "", results: [], isLoading: false` |
| Query update | `setQuery("dune")` | `query: "dune"` |
| Debounce | Type "dune" quickly | API called once after 300ms |
| Loading state | Query changes | `isLoading: true` while fetching |
| Results populate | API returns | `results: [...]` |
| Error state | API throws | `error: "message"` |
| Clear function | `clear()` | `query: "", results: []` |
| isQueryValid | Query "a" | `isQueryValid: false` |
| isQueryValid | Query "ab" | `isQueryValid: true` |

### Component Tests: `BookSearchInput.tsx`

| Test | Action | Expected |
|------|--------|----------|
| Renders input | Mount | Input visible with placeholder |
| Shows loading | Type query | Spinner appears after debounce |
| Shows results | API returns | Dropdown with results |
| Keyboard down | Press ↓ | First result highlighted |
| Keyboard up | Press ↑ | Previous result highlighted |
| Keyboard enter | Press Enter on highlighted | `onSelect` called |
| Keyboard escape | Press Escape | Dropdown closes |
| Click result | Click item | `onSelect` called, dropdown closes |
| Click outside | Click outside | Dropdown closes |
| Clear button | Click X | Query and results clear |

### Integration Tests (Manual QA)

- [ ] Search "Dune" returns results with covers
- [ ] Search "xyzabc123" returns "no results" message
- [ ] Selecting result pre-fills all form fields
- [ ] Cover from search displays in preview
- [ ] Can change cover after search selection
- [ ] Can edit title/author after selection
- [ ] ISBN field shows and is editable
- [ ] Book saves with `apiSource: "open-library"`
- [ ] Book saves with `apiId` from search
- [ ] Manual entry still works (ignore search)
- [ ] Form resets completely when closed
- [ ] Works with slow network (loading state shows)
- [ ] Works with offline (error state shows)

---

## Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| Screen reader announces results | `role="listbox"` on dropdown |
| Screen reader reads selected item | `aria-activedescendant` updates |
| Keyboard-only usable | Full arrow/enter/escape support |
| Focus visible | Focus ring on input |
| Clear button labeled | `aria-label="Clear search"` |
| Loading announced | Spinner visible, text says "Searching..." |

---

## Error Handling

| Error | User Message | Recovery |
|-------|--------------|----------|
| Network timeout | "Search timed out. Please try again." | Type new query |
| API 500 error | "Search failed. Please try again." | Type new query |
| No results | "No books found for 'X'. Try different keywords or add manually below." | Edit query or use form |
| Rate limited | "Search failed. Please try again." | Wait, then retry |

---

## Performance Considerations

1. **Debounce**: 300ms delay prevents API spam during typing
2. **Limited results**: Max 10 results reduces payload size
3. **Minimal fields**: Only request needed fields from API
4. **Lazy cover loading**: Next.js Image handles lazy loading
5. **No caching**: Fresh results each search (API is fast)

---

## Security Considerations

1. **No API key**: Open Library is public, no secrets to protect
2. **User-Agent header**: Identifies app, not sensitive
3. **Input sanitization**: Query is URL-encoded automatically
4. **No PII**: Search queries not logged
5. **XSS prevention**: React escapes all rendered text

---

## Files Summary

### New Files

| File | Purpose | Lines Est. |
|------|---------|------------|
| `convex/actions/bookSearch.ts` | Open Library search action | ~100 |
| `hooks/useBookSearch.ts` | Search hook with debounce | ~80 |
| `components/book/BookSearchInput.tsx` | Search input + dropdown | ~180 |
| `components/book/BookSearchResultItem.tsx` | Result row component | ~60 |

### Modified Files

| File | Changes |
|------|---------|
| `components/book/AddBookSheet.tsx` | +BookSearchInput, +ISBN field, +new state |

---

## Implementation Checklist

### Phase 1: Backend (30 min)
- [ ] Create `convex/actions/bookSearch.ts`
- [ ] Test action in Convex dashboard
- [ ] Verify response mapping

### Phase 2: Hook (30 min)
- [ ] Create `hooks/useBookSearch.ts`
- [ ] Test debounce behavior
- [ ] Verify error handling

### Phase 3: UI Components (2 hours)
- [ ] Create `BookSearchResultItem.tsx`
- [ ] Create `BookSearchInput.tsx`
- [ ] Test keyboard navigation
- [ ] Test click handling
- [ ] Verify loading/error states

### Phase 4: Integration (1 hour)
- [ ] Add imports to `AddBookSheet.tsx`
- [ ] Add new state variables
- [ ] Add `handleBookSelected`
- [ ] Add search input to form
- [ ] Add ISBN field
- [ ] Update form submission
- [ ] Update form reset

### Phase 5: Testing (1 hour)
- [ ] Run through all manual QA tests
- [ ] Fix any bugs found
- [ ] Test accessibility with screen reader
- [ ] Test on mobile viewport

---

## Open Questions

None — ready for implementation.

---

**Last Updated**: 2025-11-29
**Author**: Claude (spec generation)
**Reviewers**: [pending]
