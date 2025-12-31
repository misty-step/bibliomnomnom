/* eslint-disable design-tokens/no-raw-design-values -- Framer Motion viewport margin, Tailwind bracket notation */
"use client";

import { useRef, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BookRecommendation, BookRecommendationSkeleton } from "./BookRecommendation";
import { Button } from "@/components/ui/button";

export type RecommendationBook = {
  title: string;
  author: string;
  coverUrl?: string;
  reason: string;
  detailedReason?: string;
  connectionBooks?: string[];
  badges?: string[];
  isReread?: boolean;
};

type RecommendationCarouselProps = {
  title: string;
  description: string;
  books: RecommendationBook[];
  className?: string;
};

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 20,
    },
  },
};

export function RecommendationCarousel({
  title,
  description,
  books,
  className,
}: RecommendationCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const shouldReduce = useReducedMotion();

  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  const scroll = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.6;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, []);

  if (!books || books.length === 0) return null;

  return (
    <div className={cn("space-y-lg", className)}>
      {/* Section header */}
      <motion.div
        initial={shouldReduce ? undefined : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex items-start justify-between gap-4"
      >
        <div className="space-y-1">
          <h3 className="font-display text-xl md:text-2xl text-text-ink">{title}</h3>
          <p className="text-sm text-text-inkMuted max-w-md">{description}</p>
        </div>

        {/* Desktop scroll controls */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="h-8 w-8"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="h-8 w-8"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Scrollable carousel */}
      <div className="relative -mx-md md:-mx-0">
        <motion.div
          ref={scrollRef}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          onScroll={updateScrollState}
          className={cn(
            "flex gap-md md:gap-lg overflow-x-auto scrollbar-hide snap-x snap-mandatory",
            "px-md md:px-0 pb-4",
            "overscroll-x-contain",
            // Custom scrollbar styling for browsers that support it
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          )}
        >
          {books.map((book) => (
            <motion.div
              key={`${book.title}-${book.author}`}
              variants={itemVariants}
              className="flex-shrink-0 w-[140px] md:w-[180px] snap-start"
            >
              <BookRecommendation
                title={book.title}
                author={book.author}
                coverUrl={book.coverUrl}
                reason={book.reason}
                detailedReason={book.detailedReason}
                connectionBooks={book.connectionBooks}
                badges={book.badges}
                isReread={book.isReread}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Scroll fade indicators - visible on all viewports for scroll affordance */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-4 w-6 md:w-8 bg-gradient-to-r from-canvas-bone to-transparent pointer-events-none transition-opacity duration-200",
            !canScrollLeft && "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute right-0 top-0 bottom-4 w-6 md:w-8 bg-gradient-to-l from-canvas-bone to-transparent pointer-events-none transition-opacity duration-200",
            !canScrollRight && "opacity-0",
          )}
        />

        {/* Mobile scroll hint - positioned at bottom to avoid notch overlap */}
        {canScrollRight && books.length > 2 && (
          <div className="md:hidden absolute bottom-6 right-3 pointer-events-none">
            <span className="text-xs font-mono text-text-inkMuted bg-canvas-bone/95 px-2 py-1 rounded-full shadow-sm border border-line-ghost">
              {books.length - 2} more →
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Elegant divider between Go Deeper and Go Wider sections.
 */
export function RecommendationDivider() {
  return (
    <div className="flex items-center gap-lg py-xl">
      <div className="flex-1 h-px bg-line-ghost" />
      <span className="font-mono text-xs uppercase tracking-wider text-text-inkSubtle">or</span>
      <div className="flex-1 h-px bg-line-ghost" />
    </div>
  );
}

/**
 * Loading skeleton for recommendation section.
 */
export function RecommendationCarouselSkeleton() {
  return (
    <div className="space-y-lg animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-32 bg-text-ink/5 rounded" />
        <div className="h-4 w-64 bg-text-ink/5 rounded" />
      </div>
      <div className="flex gap-md overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[140px] md:w-[180px]">
            <BookRecommendationSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
