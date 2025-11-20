"use client";

import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { BookTile, BookTileSkeleton } from "./BookTile";
import { AddBookSheet } from "./AddBookSheet";
import { cn } from "@/lib/utils";
import { useAuthedQuery } from "@/lib/hooks/useAuthedQuery";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { BookOpen, Star, Library } from "lucide-react";

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
    { label: "Library", type: "library" as FilterType, count: counts.library, icon: Library },
    { label: "Queue", type: "to-read" as FilterType, count: counts.toRead, icon: BookOpen },
    { label: "Favorites", type: "favorites" as FilterType, count: counts.favorites, icon: Star },
  ];

  return (
    <div className="space-y-8">
      {/* Filter Bar & Actions */}
      <div className="flex flex-col items-start justify-between gap-6 border-b border-line-ghost pb-6 sm:flex-row sm:items-center">
        {/* Filter Pills */}
        <nav className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {filters.map((filter) => {
            const Icon = filter.icon;
            const isActive = activeFilter === filter.type;
            return (
              <button
                key={filter.type}
                onClick={() => setActiveFilter(filter.type)}
                className={cn(
                  "group flex items-center gap-2 rounded-full border px-4 py-1.5 transition-all duration-fast ease-fast",
                  isActive
                    ? "border-text-ink bg-text-ink text-canvas-bone shadow-sm"
                    : "border-transparent bg-transparent text-text-inkMuted hover:bg-canvas-boneMuted hover:text-text-ink"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-canvas-bone" : "text-text-inkSubtle group-hover:text-text-ink")} />
                <span className="font-sans text-sm font-medium">{filter.label}</span>
                {filter.count > 0 && (
                  <span
                    className={cn(
                      "ml-1 font-mono text-xs",
                      isActive ? "text-canvas-bone/70" : "text-text-inkSubtle group-hover:text-text-ink/70"
                    )}
                  >
                    {filter.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Add Book Button */}
        <AddBookButton />
      </div>

      {/* Content */}
      <div className="min-h-[50vh]">
        {activeFilter === "library" && (
          <LibraryView
            readingBooks={libraryBooks.reading}
            finishedBooks={libraryBooks.finished}
          />
        )}
        {activeFilter === "to-read" && <ToReadView books={toReadBooks} />}
        {activeFilter === "favorites" && <FavoritesView books={favoriteBooks} />}
      </div>
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
        title="Your shelves are bare."
        description="A library without books is just a room. Add your first read to bring it to life."
        action={<AddBookButton variant="primary" />}
      />
    );
  }

  return (
    <div className="space-y-16">
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
        title="Your queue is empty."
        description="No books waiting in the wings. Find something new to look forward to."
        action={<AddBookButton variant="primary" />}
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
        title="No favorites yet."
        description="Mark the books that changed you as favorites. They'll appear here."
      />
    );
  }

  return <BooksGrid books={books} />;
}

// Shared Components
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <h2 className="font-display text-2xl font-medium text-text-ink">
        {children}
      </h2>
      <div className="h-px flex-1 bg-line-ghost" />
    </div>
  );
}

function BooksGrid({
  books,
}: {
  books: NonNullable<ReturnType<typeof useAuthedQuery<typeof api.books.list>>>;
}) {
  return (
    <div
      className="grid gap-x-6 gap-y-10"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))" }}
    >
      {books.map((book) => (
        <BookTile key={book._id} book={book} />
      ))}
    </div>
  );
}

function AddBookButton({ variant = "ghost" }: { variant?: "primary" | "ghost" }) {
  return (
    <div className="flex-shrink-0">
      <AddBookSheet
        triggerLabel="Add Book"
        triggerVariant={variant}
      />
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="space-y-8">
      {/* Skeleton filter bar */}
      <div className="flex items-center justify-between border-b border-line-ghost pb-6">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-8 w-24 animate-pulse rounded-full bg-text-ink/5" />
          ))}
        </div>
        <div className="h-9 w-28 animate-pulse rounded-md bg-text-ink/5" />
      </div>

      {/* Skeleton grid */}
      <div
        className="grid gap-x-6 gap-y-10"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))" }}
      >
        {Array.from({ length: 8 }).map((_, idx) => (
          <BookTileSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
}
