"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useMutation } from "convex/react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useAuthedQuery } from "@/lib/hooks/useAuthedQuery";
import { PrivacyToggle } from "./PrivacyToggle";
import { UploadCover } from "./UploadCover";
import { EditBookModal } from "./EditBookModal";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { NoteList } from "@/components/notes/NoteList";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/Surface";
import { BOOK_STATUS_OPTIONS } from "./constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Assuming Popover component exists or will be created

type BookDetailProps = {
  bookId: Id<"books">;
};

export function BookDetail({ bookId }: BookDetailProps) {
  const book = useAuthedQuery(api.books.get, { id: bookId });
  const updateStatus = useMutation(api.books.updateStatus);
  const toggleFavorite = useMutation(api.books.toggleFavorite);

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

  // Helper to format date
  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  };

  const statusLabel = BOOK_STATUS_OPTIONS.find(
    (option) => option.value === localStatus
  )?.label;

  const statusDate =
    localStatus === "read" && book.dateFinished
      ? `Finished ${formatDate(book.dateFinished)}`
      : localStatus === "currently-reading" && book.dateStarted
      ? `Started ${formatDate(book.dateStarted)}`
      : null;

  return (
    <motion.article
      className="mx-auto grid max-w-full grid-cols-1 gap-y-16 motion-page md:grid-cols-[35%_50%_1fr] md:gap-x-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Cover Column */}
      <div className="relative flex flex-col items-center md:items-start">
        <div className="relative w-full max-w-md">
          <div className="relative aspect-[2/3] overflow-hidden rounded-[var(--radius-lg)] bg-surface-dawn shadow-[var(--elevation-raised)]">
            {book.coverUrl || book.apiCoverUrl ? (
              <Image
                src={(book.coverUrl ?? book.apiCoverUrl) as string}
                alt={`${book.title} cover`}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-canvas-boneMuted to-surface-dawn">
                <span className="font-display text-8xl text-text-ink/10">{book.title[0]}</span>
              </div>
            )}
          </div>
        </div>

        {/* Upload Cover */}
        <div className="mt-6">
          <UploadCover
            bookId={book._id}
            coverUrl={book.coverUrl}
            apiCoverUrl={book.apiCoverUrl}
          />
        </div>
      </div>

      {/* Details Column */}
      <div className="space-y-8 text-center md:col-span-2 md:text-left">
        <motion.h1
          className="font-display text-3xl text-text-ink md:text-5xl"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          {book.title}
        </motion.h1>
        <motion.p
          className="text-lg text-text-inkMuted md:text-xl"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {book.author}
        </motion.p>
        <motion.hr
          className="w-full border-t border-line-ember mt-4 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        />

        <motion.div
          className="mb-6 flex items-center justify-center gap-4 md:justify-start"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Status Display */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="cursor-pointer text-left focus:outline-none"
              >
                <p className="font-sans text-base text-ink">{statusLabel}</p>
                {statusDate && (
                  <p className="font-sans text-sm text-inkMuted">{statusDate}</p>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <div className="flex flex-col">
                {BOOK_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-canvas-boneMuted",
                      localStatus === option.value && "bg-canvas-boneMuted"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {book.isFavorite && (
            <span className="text-accent-ember text-base md:text-xl" aria-label="Favorite">
              ★
            </span>
          )}
        </motion.div>

        {book.description && (
          <motion.p
            className="mb-8 text-text-inkMuted leading-relaxed text-sm md:text-base"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {book.description}
          </motion.p>
        )}

        <motion.div
          className="flex items-center justify-center gap-3 md:justify-start"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <button
            onClick={handleFavoriteToggle}
            disabled={isTogglingFavorite}
            className="font-sans text-sm text-inkMuted hover:text-ink hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            {book.isFavorite ? "★ Unfavorite" : "☆ Favorite"}
          </button>
          <EditBookModal book={book} />
        </motion.div>

        {/* Privacy Toggle */}
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <PrivacyToggle bookId={book._id} privacy={book.privacy} />
        </motion.div>

        {/* Metadata */}
        {(book.edition || book.isbn || book.pageCount || book.publishedYear) && (
          <motion.div
            className="border-t border-line-ghost pt-16"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <h2 className="mb-6 text-center font-display text-2xl text-text-ink md:text-left">Details</h2>
            <BookMetadata book={book} />
          </motion.div>
        )}

        {/* Notes Section */}
        <motion.div
          className="mt-16"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h2 className="font-mono text-xs uppercase tracking-wider text-ink">NOTES</h2>
          <hr className="w-full border-t border-line-ember mt-2 mb-8" />
          <NotesSection bookId={book._id} />
        </motion.div>
      </div>
    </motion.article>
  );
}

function BookMetadata({ book }: { book: Doc<"books"> }) {
  const items = [
    { label: "Edition", value: book.edition },
    { label: "ISBN", value: book.isbn },
    { label: "Pages", value: book.pageCount?.toString() },
    { label: "Published", value: book.publishedYear?.toString() },
  ].filter((item) => item.value);

  return (
    <div className="mx-auto grid max-w-lg gap-6 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <p className="mb-1 text-xs font-mono uppercase tracking-wider text-text-inkSubtle">{item.label}</p>
          <p className="font-display text-base text-text-ink">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function NotesSection({ bookId }: { bookId: Id<"books"> }) {
  const [selectedNote, setSelectedNote] = useState<Doc<"notes"> | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <NoteEditor bookId={bookId} note={selectedNote} onSaved={() => setSelectedNote(null)} />
      </div>
      <div>
        <NoteList bookId={bookId} onEdit={setSelectedNote} />
      </div>
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
