"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { PrivacyToggle } from "./PrivacyToggle";
import { UploadCover } from "./UploadCover";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { NoteList } from "@/components/notes/NoteList";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS = [
  { value: "want-to-read", label: "Want to Read" },
  { value: "currently-reading", label: "Reading" },
  { value: "read", label: "Read" },
] as const;

type Tab = "details" | "notes";

type BookDetailProps = {
  bookId: Id<"books">;
};

export function BookDetail({ bookId }: BookDetailProps) {
  const book = useQuery(api.books.get, { id: bookId });
  const updateStatus = useMutation(api.books.updateStatus);
  const toggleFavorite = useMutation(api.books.toggleFavorite);

  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [localStatus, setLocalStatus] = useState<Doc<"books">["status"]>("want-to-read");
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const currentStatus = book?.status;
  useEffect(() => {
    if (currentStatus) {
      setLocalStatus(currentStatus);
    }
  }, [currentStatus]);

  if (book === undefined) {
    return <BookDetailSkeleton />;
  }

  if (!book) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-paper-secondary/70 p-8 text-center">
        <p className="text-sm text-ink-faded">We couldn&apos;t find that book.</p>
      </div>
    );
  }

  const handleStatusChange = async (nextStatus: Doc<"books">["status"]) => {
    setLocalStatus(nextStatus);
    try {
      await updateStatus({ id: book._id, status: nextStatus });
    } catch (err) {
      console.error(err);
      setLocalStatus(book.status);
    }
  };

  const handleFavoriteToggle = async () => {
    setIsTogglingFavorite(true);
    try {
      await toggleFavorite({ id: book._id });
    } catch (err) {
      console.error(err);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  return (
    <motion.section
      className="space-y-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <header className="space-y-6 rounded-3xl border border-border bg-paper-secondary/70 p-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="relative h-64 w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-paper">
            {book.coverUrl || book.apiCoverUrl ? (
              <Image
                src={(book.coverUrl ?? book.apiCoverUrl) as string}
                alt={`${book.title} cover`}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-ink-faded">
                No cover yet
              </div>
            )}
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={localStatus} />
              <Button
                variant="outline"
                size="sm"
                onClick={handleFavoriteToggle}
                disabled={isTogglingFavorite}
              >
                {book.isFavorite ? "★ Favorite" : "☆ Favorite"}
              </Button>
            </div>
            <div>
              <h1 className="font-serif text-4xl text-leather">{book.title}</h1>
              <p className="text-lg text-ink-faded">{book.author}</p>
            </div>
            {book.description ? (
              <p className="text-sm text-ink-faded">{book.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-4">
              <StatusSelect value={localStatus} onChange={handleStatusChange} />
            </div>
          </div>
        </div>
        <UploadCover bookId={book._id} coverUrl={book.coverUrl} apiCoverUrl={book.apiCoverUrl} />
        <PrivacyToggle bookId={book._id} privacy={book.privacy} />
      </header>

      <nav className="flex gap-3 rounded-full border border-border bg-paper-secondary/70 p-1 text-sm font-medium text-ink">
        <TabButton label="Overview" isActive={activeTab === "details"} onClick={() => setActiveTab("details")} />
        <TabButton label="Notes" isActive={activeTab === "notes"} onClick={() => setActiveTab("notes")} />
      </nav>

      {activeTab === "details" ? (
        <BookMetadata book={book} />
      ) : (
        <NotesSection bookId={book._id} />
      )}
    </motion.section>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-full px-4 py-2 transition",
        isActive ? "bg-paper shadow text-leather" : "text-ink/70 hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: Doc<"books">["status"];
  onChange: (value: Doc<"books">["status"]) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-ink-faded">
      Status
      <select
        className="rounded-xl border border-border bg-paper px-3 py-2 text-sm text-ink focus:border-leather focus:outline-none focus:ring-2 focus:ring-leather/40"
        value={value}
        onChange={(event) => onChange(event.target.value as Doc<"books">["status"])}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function BookMetadata({ book }: { book: Doc<"books"> }) {
  const items = [
    { label: "Edition", value: book.edition },
    { label: "ISBN", value: book.isbn },
    { label: "Pages", value: book.pageCount?.toString() },
    { label: "Published", value: book.publishedYear?.toString() },
  ].filter((item) => item.value);

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-paper-secondary/70 p-8 text-center text-sm text-ink-faded">
        No metadata yet. Edit the book to add more details.
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-paper-secondary/70 p-6 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs uppercase tracking-wide text-ink-faded">{item.label}</p>
          <p className="text-base text-ink">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function NotesSection({ bookId }: { bookId: Id<"books"> }) {
  const [selectedNote, setSelectedNote] = useState<Doc<"notes"> | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <NoteList bookId={bookId} onEdit={setSelectedNote} />
      </div>
      <NoteEditor bookId={bookId} note={selectedNote} onSaved={() => setSelectedNote(null)} />
    </div>
  );
}

function BookDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-72 animate-pulse rounded-3xl border border-border bg-paper-secondary/70" />
      <div className="h-12 animate-pulse rounded-full border border-border bg-paper-secondary/70" />
      <div className="h-96 animate-pulse rounded-3xl border border-border bg-paper-secondary/70" />
    </div>
  );
}
