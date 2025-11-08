"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { SearchResult } from "@/convex/search";

type SearchResultsProps = {
  results: SearchResult[];
  isLoading: boolean;
  error?: string | null;
  query: string;
  onSelect?: (result: SearchResult) => void;
};

export function SearchResults({
  results,
  isLoading,
  error,
  query,
  onSelect,
}: SearchResultsProps) {
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!query) {
    return (
      <div className="rounded-lg border border-border bg-paper-secondary p-4 text-sm text-ink-faded">
        Start typing to search millions of titles.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-lg border border-border bg-paper-secondary p-4"
          >
            <div className="mb-3 h-40 rounded-md bg-border" />
            <div className="mb-2 h-4 w-3/4 rounded bg-border" />
            <div className="h-4 w-1/2 rounded bg-border" />
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-paper-secondary p-4 text-sm text-ink-faded">
        No books found for <span className="font-semibold text-ink">{query}</span>. Try a different title or author.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((result) => (
        <article
          key={result.apiId}
          className="flex flex-col rounded-lg border border-border bg-paper p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="mb-4 flex h-40 items-center justify-center overflow-hidden rounded-md border border-border bg-paper-secondary">
            {result.apiCoverUrl ? (
              <div className="relative h-full w-full">
                <Image
                  src={result.apiCoverUrl}
                  alt={`${result.title} cover`}
                  fill
                  className="object-cover"
                  sizes="160px"
                />
              </div>
            ) : (
              <span className="text-sm text-ink-faded">No cover</span>
            )}
          </div>
          <h3 className="font-serif text-lg text-leather">{result.title}</h3>
          <p className="text-sm text-ink-faded">{result.author}</p>
          <p className="mt-2 line-clamp-3 text-sm text-ink-faded">
            {result.description || "No description available."}
          </p>
          <div className="mt-4 flex items-center justify-between text-xs text-ink-faded">
            {result.publishedYear ? <span>{result.publishedYear}</span> : <span />}
            {result.pageCount ? <span>{result.pageCount} pages</span> : <span />}
          </div>
          <Button
            className="mt-4"
            onClick={() => onSelect?.(result)}
          >
            Add to Library
          </Button>
        </article>
      ))}
    </div>
  );
}
