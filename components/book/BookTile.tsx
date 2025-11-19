"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Star, Headphones } from "lucide-react";

import type { Doc } from "@/convex/_generated/dataModel";

type BookTileProps = {
  book: Doc<"books">;
};

export function BookTile({ book }: BookTileProps) {
  const router = useRouter();
  const shouldReduce = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const coverSrc = book.coverUrl ?? book.apiCoverUrl;

  const navigate = () => {
    router.push(`/library/books/${book._id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate();
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={shouldReduce ? undefined : { y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="group relative cursor-pointer"
      onClick={navigate}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${book.title} by ${book.author}${book.isFavorite ? ", Favorite" : ""}${book.isAudiobook ? ", Audiobook" : ""}`}
    >
      {/* Cover Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm shadow-md">
        {/* Cover Image */}
        {coverSrc ? (
          <Image
            src={coverSrc}
            alt={`${book.title} cover`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-canvas-boneMuted to-canvas-bone">
            <span className="font-display text-6xl text-text-ink/10">{book.title[0]}</span>
          </div>
        )}

        {/* Hover Overlay */}
        <motion.div
          initial={false}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/70"
          aria-hidden={!isHovered}
        >
          {/* Badges - Top Right */}
          <div className="absolute right-2 top-2 flex flex-col gap-2">
            {book.isAudiobook && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: isHovered ? 1 : 0,
                  scale: isHovered ? 1 : 0.8
                }}
                transition={{ duration: 0.2, delay: isHovered ? 0.05 : 0 }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 border border-white/20"
              >
                <Headphones className="h-4 w-4 text-white" aria-hidden="true" />
              </motion.div>
            )}
            {book.isFavorite && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: isHovered ? 1 : 0,
                  scale: isHovered ? 1 : 0.8
                }}
                transition={{ duration: 0.2, delay: isHovered ? 0.1 : 0 }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 border border-white/20"
              >
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              </motion.div>
            )}
          </div>

          {/* Title & Author - Bottom */}
          <div className="absolute inset-x-0 bottom-0 p-3">
            <motion.div
              initial={false}
              animate={{
                opacity: isHovered ? 1 : 0,
                y: isHovered ? 0 : 10
              }}
              transition={{
                duration: 0.3,
                ease: "easeOut",
                delay: isHovered ? 0.1 : 0
              }}
            >
              <h3 className="font-display text-sm font-semibold text-white line-clamp-2 leading-tight">
                {book.title}
              </h3>
              <p className="mt-1 text-xs text-white/80 line-clamp-1">
                {book.author}
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.article>
  );
}

export function BookTileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] w-full rounded-sm bg-text-ink/5" />
    </div>
  );
}
