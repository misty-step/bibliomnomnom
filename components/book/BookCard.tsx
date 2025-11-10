"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import type { Doc } from "@/convex/_generated/dataModel";
import { StatusBadge } from "./StatusBadge";

type BookCardProps = {
  book: Doc<"books">;
};

export function BookCard({ book }: BookCardProps) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={
        shouldReduce
          ? undefined
          : { y: -8, boxShadow: "0 20px 30px rgba(0,0,0,0.08)" }
      }
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col rounded-2xl border border-border bg-paper p-4"
    >
      <div className="relative mb-4 h-48 w-full overflow-hidden rounded-xl border border-border bg-paper-secondary">
        {book.coverUrl || book.apiCoverUrl ? (
          <Image
            src={(book.coverUrl ?? book.apiCoverUrl) as string}
            alt={`${book.title} cover`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink-faded">
            No cover
          </div>
        )}
      </div>
      <div className="flex-1 space-y-2">
        <StatusBadge status={book.status} />
        <h3 className="font-serif text-xl text-leather">{book.title}</h3>
        <p className="text-sm text-ink-faded">{book.author}</p>
      </div>
    </motion.article>
  );
}
