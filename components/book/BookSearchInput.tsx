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
  const { query, setQuery, results, isLoading, error, clear, isQueryValid } = useBookSearch();

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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle selection
  const handleSelect = useCallback(
    (result: BookSearchResult) => {
      onSelect(result);
      clear();
      setIsOpen(false);
    },
    [onSelect, clear],
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
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
    [isOpen, results, highlightedIndex, handleSelect],
  );

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

        {/* Input - combobox pattern requires aria-expanded despite textbox role */}
        {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
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
          aria-expanded={showDropdown ? true : undefined}
          aria-haspopup="listbox"
          aria-controls="search-results"
          aria-activedescendant={
            highlightedIndex >= 0 ? `search-result-${highlightedIndex}` : undefined
          }
          className={cn(
            "w-full rounded-md border border-line-ghost bg-canvas-bone py-2.5 pl-10 pr-10 text-sm text-text-ink placeholder:text-text-inkSubtle",
            "focus:border-text-inkMuted focus:outline-none focus:ring-1 focus:ring-text-inkMuted",
            "disabled:cursor-not-allowed disabled:opacity-50",
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
          className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-md border border-line-ghost bg-canvas-bone shadow-lg"
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
              <p>No books found for &quot;{query}&quot;</p>
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

export type { BookSearchResult };
