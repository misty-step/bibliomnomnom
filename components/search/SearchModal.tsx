"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SearchBar } from "./SearchBar";
import { SearchResults } from "./SearchResults";
import type { SearchResult } from "@/convex/search";

type SearchModalProps = {
  onSelectResult?: (result: SearchResult) => void;
  triggerLabel?: string;
};

export function SearchModal({
  onSelectResult,
  triggerLabel = "Add Book",
}: SearchModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useAction(api.search.searchBooks);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setDebouncedQuery("");
      setResults([]);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 500);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    search({ query: debouncedQuery, maxResults: 12 })
      .then((data) => {
        if (cancelled) return;
        setResults(data ?? []);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Search failed", err);
        setResults([]);
        setError("Unable to fetch books right now. Please try again.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, search]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (onSelectResult) {
        onSelectResult(result);
      } else {
        console.log("Selected result", result);
      }
    },
    [onSelectResult]
  );

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>{triggerLabel}</Button>
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="mx-4 w-full max-w-4xl rounded-2xl border border-border bg-paper p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-start justify-between">
              <div>
                <h2 className="font-serif text-2xl text-leather">Find a Book</h2>
                <p className="text-sm text-ink-faded">
                  Search Google Books and add titles directly to your library.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-border p-2 text-ink-faded transition hover:text-ink"
                aria-label="Close search"
              >
                ✕
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <SearchBar
                value={query}
                onChange={setQuery}
                onClear={() => setQuery("")}
                isLoading={isSearching}
              />
              <SearchResults
                results={results}
                query={debouncedQuery}
                isLoading={isSearching}
                error={error}
                onSelect={handleSelect}
              />
            </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
