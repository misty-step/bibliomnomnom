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
    let cancelled = false;

    const performSearch = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const searchResults = await searchBooks({ query: debouncedQuery });
        if (!cancelled) {
          setResults(searchResults);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Search failed:", err);
          setError(err instanceof Error ? err.message : "Search failed. Please try again.");
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    performSearch();

    return () => {
      cancelled = true;
    };
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
