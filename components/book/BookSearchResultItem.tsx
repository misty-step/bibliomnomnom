"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { BookSearchResult } from "@/hooks/useBookSearch";

type BookSearchResultItemProps = {
  /** Search result data */
  result: BookSearchResult;
  /** Called when item is clicked/selected */
  onSelect: (result: BookSearchResult) => void;
  /** True if this item is currently highlighted (keyboard nav) */
  isHighlighted?: boolean;
  /** Index in list (for ARIA) */
  index: number;
};

/**
 * Placeholder image for books without covers
 * Simple SVG book icon
 */
const PLACEHOLDER_COVER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60' viewBox='0 0 40 60'%3E%3Crect fill='%23E5E0D5' width='40' height='60'/%3E%3Cpath fill='%23A39E93' d='M10 15h20v2H10zm0 6h20v2H10zm0 6h14v2H10z'/%3E%3C/svg%3E";

/**
 * Individual search result item
 * Displays cover thumbnail, title, author, and year
 */
export function BookSearchResultItem({
  result,
  onSelect,
  isHighlighted = false,
  index,
}: BookSearchResultItemProps) {
  const handleClick = () => {
    onSelect(result);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(result);
    }
  };

  return (
    <div
      role="option"
      aria-selected={isHighlighted}
      id={`search-result-${index}`}
      tabIndex={-1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors",
        isHighlighted ? "bg-canvas-boneMuted" : "hover:bg-canvas-boneMuted/50",
      )}
    >
      {/* Cover Thumbnail - 40x60px maintains 2:3 book aspect ratio */}
      {/* eslint-disable-next-line design-tokens/no-raw-design-values */}
      <div className="relative h-[60px] w-[40px] flex-shrink-0 overflow-hidden rounded-sm bg-canvas-boneMuted">
        <Image
          src={result.coverUrl ?? PLACEHOLDER_COVER}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
          unoptimized={!result.coverUrl}
        />
      </div>

      {/* Text Content */}
      <div className="min-w-0 flex-1">
        {/* Title */}
        <p className="truncate font-display text-sm font-medium text-text-ink">{result.title}</p>
        {/* Author and Year */}
        <p className="truncate text-xs text-text-inkMuted">
          {result.author}
          {result.publishedYear && (
            <span className="ml-1 text-text-inkSubtle">· {result.publishedYear}</span>
          )}
        </p>
      </div>
    </div>
  );
}
