"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookCard } from "./BookCard";
import { EmptyState } from "@/components/shared/EmptyState";

type StatusFilter = "all" | "want-to-read" | "currently-reading" | "read";

export function BookGrid() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const books = useQuery(api.books.list, {
    status: statusFilter === "all" ? undefined : statusFilter,
    favoritesOnly,
  });

  return (
    <div className="space-y-6">
      <Filters
        status={statusFilter}
        favoritesOnly={favoritesOnly}
        onStatusChange={setStatusFilter}
        onFavoritesChange={setFavoritesOnly}
      />
      {books === undefined ? (
        <GridSkeleton />
      ) : books.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((book) => (
            <BookCard key={book._id} book={book} />
          ))}
        </div>
      ) : (
        <LibraryEmptyState />
      )}
    </div>
  );
}

type FiltersProps = {
  status: StatusFilter;
  favoritesOnly: boolean;
  onStatusChange: (value: StatusFilter) => void;
  onFavoritesChange: (value: boolean) => void;
};

function Filters({
  status,
  favoritesOnly,
  onStatusChange,
  onFavoritesChange,
}: FiltersProps) {
  const chips: Array<{ value: StatusFilter; label: string }> = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "want-to-read", label: "Want to Read" },
      { value: "currently-reading", label: "Reading" },
      { value: "read", label: "Read" },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-paper-secondary/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => onStatusChange(chip.value)}
            className={`rounded-full px-4 py-1 text-sm font-medium transition ${
              status === chip.value
                ? "bg-leather text-paper"
                : "bg-paper text-ink hover:bg-paper/80"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={favoritesOnly}
          onChange={(event) => onFavoritesChange(event.target.checked)}
          className="rounded border-border text-leather focus:ring-leather/40"
        />
        Favorites only
      </label>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="space-y-3 rounded-2xl border border-border p-4">
          <div className="h-48 rounded-xl bg-paper animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-paper" />
          <div className="h-3 w-1/2 rounded bg-paper" />
        </div>
      ))}
    </div>
  );
}

function LibraryEmptyState() {
  return (
    <EmptyState
      title="Your shelves are empty"
      description="Use the Add Book button to start logging your collection."
    />
  );
}
