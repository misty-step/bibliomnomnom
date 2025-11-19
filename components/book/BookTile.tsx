"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import type { Doc } from "@/convex/_generated/dataModel";

type BookTileProps = {
  book: Doc<"books">;
};

export function BookTile({ book }: BookTileProps) {
  const router = useRouter();
  const shouldReduce = useReducedMotion();
  const coverSrc = book.coverUrl ?? book.apiCoverUrl;

  const navigate = () => {
    router.push(`/library/books/${book._id}`);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={shouldReduce ? undefined : { y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="group cursor-pointer"
      onClick={navigate}
    >
      {/* Cover */}
      <div className="relative overflow-hidden rounded-lg">
        <div className="relative aspect-[2/3] w-full">
          {coverSrc ? (
            <Image
              src={coverSrc}
              alt={`${book.title} cover`}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-canvas-boneMuted to-canvas-bone">
              <span className="font-display text-6xl text-text-ink/10">{book.title[0]}</span>
            </div>
          )}
        </div>

        {/* Favorite Badge */}
        {book.isFavorite && (
          <div className="absolute right-2 top-2 rounded-full bg-accent-ember px-2 py-1 text-xs text-canvas-bone shadow-md">
            ★
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-2 text-left">
        <h3 className="font-display text-base text-text-ink line-clamp-2 leading-tight">
          {book.title}
        </h3>
        <p className="mt-1 font-sans text-sm text-text-inkMuted line-clamp-1">{book.author}</p>
      </div>
    </motion.article>
  );
}

export function BookTileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] w-full rounded-lg bg-text-ink/5" />
      <div className="mt-2 space-y-2">
        <div className="h-4 w-3/4 rounded bg-text-ink/10" />
        <div className="h-3 w-1/2 rounded bg-text-ink/5" />
      </div>
    </div>
  );
}
