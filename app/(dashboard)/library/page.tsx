"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { AddBookModal } from "@/components/book/AddBookModal";
import { LibraryView } from "@/components/book/LibraryView";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ErrorState } from "@/components/shared/ErrorState";
import { BookCardSkeleton } from "@/components/book/BookCardSkeleton";

export default function LibraryPage() {
  return (
    <motion.section
      className="space-y-8 px-4 py-8 sm:px-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl text-leather">Your Library</h1>
          <p className="text-ink-faded">
            Browse every book you&apos;re dreaming about, reading, or remembering.
          </p>
        </div>
        <AddBookModal triggerLabel="Add Book" />
      </div>
      <ErrorBoundary
        fallback={
          <ErrorState message="We couldn’t load your library. Please refresh and try again." />
        }
      >
        <Suspense fallback={<LibrarySkeleton />}>
          <LibraryView />
        </Suspense>
      </ErrorBoundary>
    </motion.section>
  );
}

function LibrarySkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 animate-pulse rounded bg-paper-secondary/80" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <BookCardSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
}
