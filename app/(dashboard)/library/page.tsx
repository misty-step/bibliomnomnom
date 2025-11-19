"use client";

import { Suspense } from "react";
import { motion } from "framer-motion"; // Import motion
import { AddBookSheet } from "@/components/book/AddBookSheet";
import { LibraryView } from "@/components/book/LibraryView";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ErrorState } from "@/components/shared/ErrorState";
import { BookTileSkeleton } from "@/components/book/BookTile";

export default function LibraryPage() {
  return (
    <section className="motion-fade-in">
      <div className="w-full lg:max-w-[calc(100%-15%)]"> {/* Roughly 70% width with 15% right margin */}
        <motion.h1
          className="font-display text-4xl text-ink mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          LIBRARY
        </motion.h1>
        <motion.hr
          className="border-line-ember mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        />
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AddBookSheet triggerLabel="Add Book" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ErrorBoundary
            fallback={
              <ErrorState message="We couldn't load your library. Please refresh and try again." />
            }
          >
            <Suspense fallback={<LibrarySkeleton />}>
              <LibraryView />
            </Suspense>
          </ErrorBoundary>
        </motion.div>
      </div>
    </section>
  );
}

function LibrarySkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <BookTileSkeleton key={idx} />
      ))}
    </div>
  );
}
