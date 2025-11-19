"use client";

import { api } from "@/convex/_generated/api";
import { useAuthedQuery } from "@/lib/hooks/useAuthedQuery";

export function StatsBar() {
  const books = useAuthedQuery(api.books.list, {});

  if (!books) {
    return (
      <div className="border-b border-line-ghost bg-canvas-bone">
        <div className="mx-auto max-w-7xl px-8 py-3">
          <div className="h-5 w-64 animate-pulse rounded bg-text-ink/5" />
        </div>
      </div>
    );
  }

  const totalBooks = books.length;
  const booksRead = books.filter((b) => b.status === "read").length;
  const favorites = books.filter((b) => b.isFavorite).length;
  const currentlyReading = books.filter((b) => b.status === "currently-reading").length;

  return (
    <div className="border-b border-line-ghost bg-canvas-boneMuted">
      <div className="mx-auto max-w-7xl px-8 py-3">
        <div className="flex items-center gap-6 font-mono text-sm uppercase tracking-wider text-text-inkMuted">
          <span>
            <strong className="font-semibold text-text-ink">{booksRead}</strong> read
          </span>
          <span className="text-text-inkSubtle">•</span>
          <span>
            <strong className="font-semibold text-text-ink">{currentlyReading}</strong> reading
          </span>
          <span className="text-text-inkSubtle">•</span>
          <span>
            <strong className="font-semibold text-accent-ember">{favorites}</strong> favorites
          </span>
          <span className="text-text-inkSubtle">•</span>
          <span>
            <strong className="font-semibold text-text-ink">{totalBooks}</strong> total
          </span>
        </div>
      </div>
    </div>
  );
}
