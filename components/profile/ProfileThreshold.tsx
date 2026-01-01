"use client";

import { motion } from "framer-motion";
import { BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type ProfileThresholdProps = {
  bookCount: number;
  booksNeeded: number;
};

/**
 * Encouraging message shown when user has fewer than 20 books.
 * Clean, aspirational design motivating users to add more books.
 */
export function ProfileThreshold({ bookCount, booksNeeded }: ProfileThresholdProps) {
  const threshold = bookCount + booksNeeded;
  const progressPercent = Math.round((bookCount / threshold) * 100);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-md">
      <motion.div
        className="max-w-md w-full text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Icon */}
        <div className="mb-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-canvas-boneMuted">
            <Sparkles className="w-8 h-8 text-text-inkMuted" />
          </div>
        </div>

        {/* Title */}
        <h1 className="font-display text-3xl text-text-ink mb-sm">Your Reader Profile Awaits</h1>

        {/* Description */}
        <p className="font-sans text-base text-text-inkMuted leading-relaxed mb-lg">
          Add {booksNeeded} more book{booksNeeded !== 1 ? "s" : ""} to unlock AI-powered insights
          about your reading patterns and literary identity.
        </p>

        {/* Progress bar */}
        <div className="mb-lg">
          <div className="h-2 bg-canvas-boneMuted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-text-ink rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, delay: 0.2 }}
            />
          </div>
          <p className="mt-xs text-sm text-text-inkSubtle">
            {bookCount} / {threshold} books
          </p>
        </div>

        {/* CTA */}
        <Link href="/library">
          <Button variant="primary" size="md">
            <BookOpen className="w-4 h-4 mr-2" />
            Add a Book
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
