"use client";

import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { BookTile, BookTileSkeleton } from "./BookTile";
import { AddBookSheet } from "./AddBookSheet";
import { cn } from "@/lib/utils";
import { useAuthedQuery } from "@/lib/hooks/useAuthedQuery";

type FilterType = "library" | "to-read" | "favorites";

export function BookGrid() {
  const allBooks = useAuthedQuery(api.books.list, {});
  const [activeFilter, setActiveFilter] = useState<FilterType>("library");

  // Compute counts and filtered books
  const { counts, libraryBooks, toReadBooks, favoriteBooks } = useMemo(() => {
    if (!allBooks) {
      return {
        counts: { library: 0, toRead: 0, favorites: 0 },
        libraryBooks: { reading: [], finished: [] },
        toReadBooks: [],
        favoriteBooks: [],
      };
    }

    const reading = allBooks.filter((b) => b.status === "currently-reading");
    const finished = allBooks.filter((b) => b.status === "read");
    const toRead = allBooks.filter((b) => b.status === "want-to-read");
    const favorites = allBooks.filter((b) => b.isFavorite);

    return {
      counts: {
        library: reading.length + finished.length,
        toRead: toRead.length,
        favorites: favorites.length,
      },
      libraryBooks: { reading, finished },
      toReadBooks: toRead,
      favoriteBooks: favorites,
    };
  }, [allBooks]);

  if (allBooks === undefined) {
    return <GridSkeleton />;
  }

  const filters = [
    { label: "Library", type: "library" as FilterType, count: counts.library },
    { label: "To Read", type: "to-read" as FilterType, count: counts.toRead },
    { label: "Favorites", type: "favorites" as FilterType, count: counts.favorites },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        {/* Filter Pills */}
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {filters.map((filter) => (
            <button
              key={filter.type}
              onClick={() => setActiveFilter(filter.type)}
              className={cn(
                "flex-shrink-0 rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all duration-150",
                activeFilter === filter.type
                  ? "bg-text-ink text-canvas-bone font-medium"
                  : "text-text-inkMuted hover:bg-line-ghost hover:text-text-ink"
              )}
            >
              {filter.label}
              {filter.count > 0 && (
                <span
                  className={cn(
                    "ml-1.5",
                    activeFilter === filter.type ? "opacity-70" : "opacity-50"
                  )}
                >
                  {filter.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Add Book Button */}
        <AddBookButton />
      </div>

      {/* Content */}
      {activeFilter === "library" && (
        <LibraryView
          readingBooks={libraryBooks.reading}
          finishedBooks={libraryBooks.finished}
        />
      )}
      {activeFilter === "to-read" && <ToReadView books={toReadBooks} />}
      {activeFilter === "favorites" && <FavoritesView books={favoriteBooks} />}
    </div>
  );
}

// Library View - sectioned into Currently Reading and Finished
function LibraryView({
  readingBooks,
  finishedBooks,
}: {
  readingBooks: ReturnType<typeof useAuthedQuery<typeof api.books.list>>;
  finishedBooks: ReturnType<typeof useAuthedQuery<typeof api.books.list>>;
}) {
  const hasReading = readingBooks && readingBooks.length > 0;
  const hasFinished = finishedBooks && finishedBooks.length > 0;
  const isEmpty = !hasReading && !hasFinished;

  if (isEmpty) {
    return (
      <EmptyState
        title="Your library awaits"
        subtitle="Add your first book to get started"
      />
    );
  }

  return (
    <div className="space-y-10">
      {/* Currently Reading Section */}
      {hasReading && (
        <section>
          <SectionHeader>Currently Reading</SectionHeader>
          <BooksGrid books={readingBooks} />
        </section>
      )}

      {/* Finished Section */}
      {hasFinished && (
        <section>
          <SectionHeader>Finished</SectionHeader>
          <BooksGrid books={finishedBooks} />
        </section>
      )}
    </div>
  );
}

// To Read View
function ToReadView({
  books,
}: {
  books: ReturnType<typeof useAuthedQuery<typeof api.books.list>>;
}) {
  if (!books || books.length === 0) {
    return (
      <EmptyState
        title="Nothing queued yet"
        subtitle="Add books you want to read"
      />
    );
  }

  return <BooksGrid books={books} />;
}

// Favorites View
function FavoritesView({
  books,
}: {
  books: ReturnType<typeof useAuthedQuery<typeof api.books.list>>;
}) {
  if (!books || books.length === 0) {
    return (
      <EmptyState
        title="No favorites yet"
        subtitle="Mark books as favorites to see them here"
      />
    );
  }

  return <BooksGrid books={books} />;
}

// Shared Components
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-text-inkMuted">
      {children}
    </h2>
  );
}

function BooksGrid({
  books,
}: {
  books: NonNullable<ReturnType<typeof useAuthedQuery<typeof api.books.list>>>;
}) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))" }}
    >
      {books.map((book) => (
        <BookTile key={book._id} book={book} />
      ))}
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="py-12 text-center">
      <p className="font-display text-xl text-text-inkMuted">{title}</p>
      <p className="mt-2 text-sm text-text-inkSubtle">{subtitle}</p>
    </div>
  );
}

function AddBookButton() {
  return (
    <div className="flex-shrink-0">
      <AddBookSheet
        triggerLabel="Add Book"
        triggerClassName="rounded-md bg-text-ink px-4 py-1.5 font-sans text-sm font-medium text-canvas-bone transition-colors hover:bg-text-inkMuted"
      />
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="space-y-6">
      {/* Skeleton filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-8 w-20 animate-pulse rounded-md bg-text-ink/5" />
          ))}
        </div>
        <div className="h-8 w-24 animate-pulse rounded-md bg-text-ink/5" />
      </div>

      {/* Skeleton grid */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))" }}
      >
        {Array.from({ length: 12 }).map((_, idx) => (
          <BookTileSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
}
