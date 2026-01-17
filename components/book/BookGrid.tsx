"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookTile, BookTileSkeleton } from "./BookTile";
import { AddBookSheet } from "./AddBookSheet";
import { YearHero } from "./YearHero";
import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format";
import { useAuthedQuery } from "@/lib/hooks/useAuthedQuery";
import { EmptyState } from "@/components/shared/EmptyState";
import { WelcomeCard } from "@/components/onboarding/WelcomeCard";
import { Button } from "@/components/ui/button";
import { BookOpen, Star, Library, Upload, BookPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FetchMissingCoversButton } from "./FetchMissingCoversButton";

type FilterType = "library" | "to-read" | "favorites";

export function BookGrid() {
  const router = useRouter();
  const allBooks = useAuthedQuery(api.books.list, {});
  const [activeFilter, setActiveFilter] = useState<FilterType>("library");
  const [manualAddOpen, setManualAddOpen] = useState(false);

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
    <>
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
                      : "border-transparent bg-transparent text-text-inkMuted hover:bg-canvas-boneMuted hover:text-text-ink",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5",
                      isActive
                        ? "text-canvas-bone"
                        : "text-text-inkSubtle group-hover:text-text-ink",
                    )}
                  />
                  <span className="font-sans text-sm font-medium">{filter.label}</span>
                  {filter.count > 0 && (
                    <span
                      className={cn(
                        "ml-1 font-mono text-xs",
                        isActive
                          ? "text-canvas-bone/70"
                          : "text-text-inkSubtle group-hover:text-text-ink/70",
                      )}
                    >
                      {filter.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Add Book Dropdown */}
          <div className="flex items-center gap-3">
            <FetchMissingCoversButton hidden={!allBooks || allBooks.length === 0} />
            <AddBookButton
              onManualAdd={() => setManualAddOpen(true)}
              onImport={() => router.push("/import")}
            />
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[50vh]">
          {activeFilter === "library" && (
            <LibraryView
              readingBooks={libraryBooks.reading}
              finishedBooks={libraryBooks.finished}
              onManualAdd={() => setManualAddOpen(true)}
              onImport={() => router.push("/import")}
            />
          )}
          {activeFilter === "to-read" && (
            <ToReadView
              books={toReadBooks}
              onManualAdd={() => setManualAddOpen(true)}
              onImport={() => router.push("/import")}
            />
          )}
          {activeFilter === "favorites" && <FavoritesView books={favoriteBooks} />}
        </div>
      </div>

      {/* Manual Add Dialog */}
      <AddBookSheet isOpen={manualAddOpen} onOpenChange={setManualAddOpen} />
    </>
  );
}

// Month names for display
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Book = NonNullable<ReturnType<typeof useAuthedQuery<typeof api.books.list>>>[number];

// Group finished books by year and month
function groupBooksByYearMonth(books: Book[]) {
  // Sort by dateFinished DESC (newest first)
  const sorted = [...books].sort((a, b) => (b.dateFinished ?? 0) - (a.dateFinished ?? 0));

  // Group by year, then month
  const grouped: Record<number, Record<number, Book[]>> = {};
  const booksWithoutDate: Book[] = [];

  for (const book of sorted) {
    if (!book.dateFinished) {
      booksWithoutDate.push(book);
      continue;
    }

    const date = new Date(book.dateFinished);
    const year = date.getFullYear();
    const month = date.getMonth();

    if (!grouped[year]) grouped[year] = {};
    if (!grouped[year][month]) grouped[year][month] = [];

    grouped[year][month].push(book);
  }

  return { grouped, booksWithoutDate };
}

// Calculate stats for a set of books
function getBookStats(books: Book[]) {
  return {
    count: books.length,
    pages: books.reduce((sum, b) => sum + (b.pageCount ?? 0), 0),
    favorites: books.filter((b) => b.isFavorite).length,
    audiobooks: books.filter((b) => b.isAudiobook).length,
  };
}

// Month Section with stats
function MonthSection({ month, books }: { month: number; books: Book[] }) {
  const stats = getBookStats(books);
  const monthName = MONTH_NAMES[month];

  return (
    <div className="mt-10 first:mt-0">
      {/* Month header with stats */}
      <div className="mb-6 flex items-baseline gap-3">
        <h3 className="font-display text-xl font-medium text-text-ink">{monthName}</h3>
        <span className="font-mono text-xs tracking-wide text-text-inkMuted">
          • {stats.count} {pluralize(stats.count, "book")}
          {stats.favorites > 0 && ` • ${stats.favorites} ${pluralize(stats.favorites, "favorite")}`}
          {stats.audiobooks > 0 &&
            ` • ${stats.audiobooks} ${pluralize(stats.audiobooks, "audiobook")}`}
        </span>
        <div className="h-px flex-1 bg-line-ghost/50" />
      </div>

      {/* Books grid */}
      <BooksGrid books={books} />
    </div>
  );
}

// Finished Books Timeline - organized by year and month (Art Deco Editorial)
function FinishedBooksTimeline({ books }: { books: Book[] }) {
  const { grouped, booksWithoutDate } = useMemo(() => groupBooksByYearMonth(books), [books]);

  // Get years sorted descending
  const years = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-24">
      {/* Main timeline */}
      {years.map((year) => {
        const monthsObj = grouped[year] ?? {};
        const months = Object.keys(monthsObj)
          .map(Number)
          .sort((a, b) => b - a);

        // Calculate year stats
        const yearBooks = months.flatMap((month) => monthsObj[month] ?? []);
        const yearStats = getBookStats(yearBooks);

        return (
          <div key={year} className="space-y-12">
            {/* Art Deco Year Header */}
            <YearHero
              year={year}
              stats={{
                totalBooks: yearStats.count,
                totalPages: yearStats.pages,
              }}
            />

            {/* Month sections with bento layouts */}
            <div className="space-y-16">
              {months.map((month) => {
                const monthBooks = monthsObj[month];
                if (!monthBooks) return null;
                return <MonthSection key={month} month={month} books={monthBooks} />;
              })}
            </div>
          </div>
        );
      })}

      {/* Books without dates (edge case) */}
      {booksWithoutDate.length > 0 && (
        <div className="mt-20">
          <div className="mb-8 flex items-center gap-4">
            <h2 className="font-display text-2xl font-medium text-text-ink">Undated</h2>
            <div className="h-px flex-1 bg-line-ghost" />
          </div>
          <BooksGrid books={booksWithoutDate} />
        </div>
      )}
    </div>
  );
}

// Library View - sectioned into Currently Reading and Finished
function LibraryView({
  readingBooks,
  finishedBooks,
  onManualAdd,
  onImport,
}: {
  readingBooks: ReturnType<typeof useAuthedQuery<typeof api.books.list>>;
  finishedBooks: ReturnType<typeof useAuthedQuery<typeof api.books.list>>;
  onManualAdd: () => void;
  onImport: () => void;
}) {
  // Get subscription to detect first-time users
  const subscription = useQuery(api.subscriptions.get);

  const hasReading = readingBooks && readingBooks.length > 0;
  const hasFinished = finishedBooks && finishedBooks.length > 0;
  const isEmpty = !hasReading && !hasFinished;

  // Detect first-time user: subscription created within last 60 seconds
  // Capture mount time in state to avoid calling Date.now() during render
  const [mountTime] = useState(() => Date.now());
  const isFirstTime = subscription?.createdAt && mountTime - subscription.createdAt < 60_000;

  if (isEmpty) {
    // Show WelcomeCard for first-time users
    if (isFirstTime && subscription) {
      return (
        <WelcomeCard
          daysRemaining={subscription.daysRemaining ?? 14}
          onImport={onImport}
          onAddBook={onManualAdd}
        />
      );
    }

    // Show standard EmptyState for returning users with empty library
    return (
      <EmptyState
        title="Your shelves are empty"
        description="Add books to start tracking your reading journey."
        action={
          <div className="flex items-center gap-4">
            <Button onClick={onManualAdd}>Add a Book</Button>
            <button
              onClick={onImport}
              className="font-sans text-sm text-text-inkMuted transition-colors duration-fast hover:text-text-ink"
            >
              or import
            </button>
          </div>
        }
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

      {/* Finished Section - Timeline View */}
      {hasFinished && (
        <section>
          <FinishedBooksTimeline books={finishedBooks} />
        </section>
      )}
    </div>
  );
}

// To Read View
function ToReadView({
  books,
  onManualAdd,
  onImport,
}: {
  books: ReturnType<typeof useAuthedQuery<typeof api.books.list>>;
  onManualAdd: () => void;
  onImport: () => void;
}) {
  if (!books || books.length === 0) {
    return (
      <EmptyState
        title="Nothing in the queue"
        description="Add books you're curious about—they'll wait here."
        action={
          <div className="flex items-center gap-4">
            <Button onClick={onManualAdd}>Add a Book</Button>
            <button
              onClick={onImport}
              className="font-sans text-sm text-text-inkMuted hover:text-text-ink transition-colors duration-fast"
            >
              or import
            </button>
          </div>
        }
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
        description="Mark a book as a favorite and it'll appear here."
      />
    );
  }

  return <BooksGrid books={books} />;
}

// Shared Components
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <h2 className="font-display text-2xl font-medium text-text-ink">{children}</h2>
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

function AddBookButton({
  onManualAdd,
  onImport,
}: {
  onManualAdd: () => void;
  onImport: () => void;
}) {
  return (
    <div className="flex-shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Add Book</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onManualAdd}>
            <BookPlus className="mr-2 h-4 w-4" />
            Add Manually
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onImport}>
            <Upload className="mr-2 h-4 w-4" />
            Import Library
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
