"use client";

import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { BookTile, BookTileSkeleton } from "./BookTile";
import { cn } from "@/lib/utils";
import { useAuthedQuery } from "@/lib/hooks/useAuthedQuery";

type FilterType = "all" | "currently-reading" | "read" | "want-to-read" | "favorites";

export function BookGrid() {
  const allBooks = useAuthedQuery(api.books.list, {});
  const [activeFilter, setActiveFilter] = useState<FilterType>("currently-reading");

  const filteredBooks = useMemo(() => {
    if (!allBooks) return null;

    if (activeFilter === "all") return allBooks;
    if (activeFilter === "favorites") return allBooks.filter((b) => b.isFavorite);
    return allBooks.filter((b) => b.status === activeFilter);
  }, [allBooks, activeFilter]);

  const counts = useMemo(() => {
    if (!allBooks) return { currentlyReading: 0, read: 0, wantToRead: 0, favorites: 0, all: 0 };
    return {
      currentlyReading: allBooks.filter((b) => b.status === "currently-reading").length,
      read: allBooks.filter((b) => b.status === "read").length,
      wantToRead: allBooks.filter((b) => b.status === "want-to-read").length,
      favorites: allBooks.filter((b) => b.isFavorite).length,
      all: allBooks.length,
    };
  }, [allBooks]);

  if (allBooks === undefined) {
    return <GridSkeleton />;
  }

  if (allBooks.length === 0) {
    return (
      <div className="text-left">
        <p className="font-display text-xl text-text-inkMuted">Your reading list awaits.</p>
        <p className="mt-2">
          <span className="cursor-pointer font-sans text-base text-ink hover:text-inkMuted relative group">
            + Add your first book
            <span className="absolute bottom-0 left-0 w-full h-px bg-ink transform scaleX(0) group-hover:scaleX(1) transition-transform duration-150 ease-out origin-left"></span>
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Filter Links */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-8">
        {[
          { label: "Currently Reading", type: "currently-reading", count: counts.currentlyReading },
          { label: "Read", type: "read", count: counts.read },
          { label: "Want to Read", type: "want-to-read", count: counts.wantToRead },
          { label: "Favorites", type: "favorites", count: counts.favorites },
          { label: "All", type: "all", count: counts.all },
        ].map((filter, index) => (
          <span
            key={filter.type}
            onClick={() => setActiveFilter(filter.type as FilterType)}
            className={cn(
              "group relative cursor-pointer font-mono text-sm uppercase tracking-wider",
              activeFilter === filter.type
                ? "text-ink"
                : "text-inkMuted hover:text-ink"
            )}
          >
            {filter.label}
            <span
              className={cn(
                "absolute inset-x-0 bottom-0 h-px bg-ink transition-transform duration-150 ease-out origin-left",
                activeFilter === filter.type ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
              )}
            />
            {index < 4 && <span className="mx-1 text-inkMuted">·</span>} {/* Middot separator */}
          </span>
        ))}
      </div>

      {/* Grid */}
      {filteredBooks && filteredBooks.length > 0 ? (
        <div className="grid gap-8 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredBooks.map((book) => (
            <BookTile key={book._id} book={book} />
          ))}
        </div>
      ) : (
        <div className="text-left">
          <p className="font-display text-xl text-text-inkMuted">No books in this category yet</p>
        </div>
      )}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, idx) => (
        <BookTileSkeleton key={idx} />
      ))}
    </div>
  );
}
