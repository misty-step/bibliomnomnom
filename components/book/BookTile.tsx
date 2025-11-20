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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={shouldReduce ? undefined : { y: -4 }}
      transition={{ 
        type: "spring", 
        stiffness: 250, 
        damping: 25, 
        mass: 1 
      }}
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
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm shadow-surface transition-shadow duration-300 group-hover:shadow-raised bg-canvas-boneMuted">
        
        {/* 1. The Cover (Visible by default) */}
        <div className="absolute inset-0 transition-opacity duration-300 ease-out group-hover:opacity-0">
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
        </div>

        {/* 2. The Index Card (Visible on Hover) */}
        <div className="absolute inset-0 flex flex-col justify-between p-5 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 bg-canvas-bone/90 backdrop-blur-sm m-1.5 rounded-sm shadow-sm ring-1 ring-inset ring-black/5">
          
          {/* Top: Content */}
          <div className="flex flex-col items-start space-y-3 w-full">
            
            {/* Title - Left aligned, balanced, allowing more lines */}
            <h3 className="font-display text-lg font-medium text-text-ink leading-snug text-balance text-left line-clamp-5">
              {book.title}
            </h3>

            {/* Author - Subordinate, Mono */}
            <p className="font-mono text-xs uppercase tracking-wider text-text-inkMuted text-left line-clamp-2">
              {book.author}
            </p>
          </div>

          {/* Bottom: Metadata / Status */}
          <div className="w-full flex items-end justify-between pt-2 border-t border-line-ghost/50 mt-2">
             {/* Year */}
             <span className="font-mono text-xs text-text-inkSubtle">
               {book.publishedYear}
             </span>
             
             {/* Badges (Only visible here now) */}
             <div className="flex gap-2">
                {book.isAudiobook && <Headphones className="h-3.5 w-3.5 text-text-inkMuted" />}
                {book.isFavorite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
             </div>
          </div>
        </div>

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