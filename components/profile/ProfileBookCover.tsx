/* eslint-disable design-tokens/no-raw-design-values -- Tailwind bracket notation for micro text sizes */
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type ProfileBookCoverProps = {
  title: string;
  author?: string;
  coverUrl?: string; // If from library (pre-existing)
  className?: string;
  size?: "sm" | "md" | "lg";
  showReason?: boolean;
  reason?: string;
  isReread?: boolean;
};

/**
 * Fetch cover from Open Library API.
 * Returns cover URL or null if not found.
 */
async function fetchOpenLibraryCover(title: string, author?: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${title}${author ? ` ${author}` : ""}`);
    const searchUrl = `https://openlibrary.org/search.json?q=${query}&limit=1&fields=cover_i`;
    const res = await fetch(searchUrl, { next: { revalidate: 86400 } }); // Cache 24h

    if (!res.ok) return null;

    const data = await res.json();
    const coverId = data.docs?.[0]?.cover_i;

    if (coverId) {
      return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
    }
    return null;
  } catch {
    return null;
  }
}

const sizeClasses = {
  sm: "w-24", // ~96px - for compact grids
  md: "w-32", // ~128px - default
  lg: "w-40", // ~160px - featured
};

/**
 * Reusable book cover component for profile displays.
 * Hybrid approach: uses provided coverUrl, fetches from Open Library, or shows typography card.
 */
export function ProfileBookCover({
  title,
  author,
  coverUrl: providedCover,
  className,
  size = "md",
  showReason = false,
  reason,
  isReread = false,
}: ProfileBookCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(providedCover || null);
  const [loading, setLoading] = useState(!providedCover);
  const [failed, setFailed] = useState(false);

  // Fetch from Open Library if no cover provided
  useEffect(() => {
    if (providedCover) return;

    let cancelled = false;

    fetchOpenLibraryCover(title, author).then((url) => {
      if (cancelled) return;
      setCoverUrl(url);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [title, author, providedCover]);

  const showTypographyCard = !coverUrl || failed;

  return (
    <div className={cn("group relative", sizeClasses[size], className)}>
      <div
        className={cn(
          "relative aspect-[2/3] w-full overflow-hidden rounded-sm",
          "shadow-surface transition-all duration-300",
          "group-hover:-translate-y-1 group-hover:shadow-raised",
          "group-active:scale-95",
        )}
      >
        {/* Loading skeleton */}
        {loading && !showTypographyCard && (
          <div className="absolute inset-0 bg-canvas-boneMuted animate-pulse" />
        )}

        {/* Cover image */}
        {coverUrl && !failed && (
          <Image
            src={coverUrl}
            alt={title}
            fill
            className={cn(
              "object-cover transition-transform duration-500",
              "group-hover:scale-105",
              loading && "opacity-0",
            )}
            sizes="(max-width: 768px) 25vw, 15vw"
            onLoad={() => setLoading(false)}
            onError={() => setFailed(true)}
          />
        )}

        {/* Typography fallback card */}
        {showTypographyCard && !loading && (
          <div className="absolute inset-0 bg-surface-dawn border border-line-ghost p-3 flex flex-col justify-between">
            <div className="space-y-1">
              <h4 className="font-display text-sm leading-tight text-text-ink line-clamp-4">
                {title}
              </h4>
              {author && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-text-inkMuted line-clamp-2">
                  {author}
                </p>
              )}
            </div>
            <div className="h-0.5 w-6 bg-text-inkMuted/40" />
          </div>
        )}

        {/* Re-read badge */}
        {isReread && (
          <div className="absolute top-1 right-1 bg-text-ink text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-surface-dawn">
            Re-read
          </div>
        )}
      </div>

      {/* Title/Author below cover (optional) */}
      {showReason && (
        <div className="mt-2 space-y-0.5">
          <p className="font-display text-sm text-text-ink leading-tight line-clamp-2">{title}</p>
          {author && <p className="text-xs text-text-inkMuted line-clamp-1">{author}</p>}
        </div>
      )}

      {/* Reason tooltip on hover */}
      {reason && (
        <div
          className={cn(
            "absolute -bottom-2 left-0 right-0 translate-y-full",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            "bg-text-ink/95 text-surface-dawn text-xs p-2 rounded",
            "pointer-events-none z-10",
          )}
        >
          {isReread && <span className="text-surface-dawn font-medium mr-1">[Re-read]</span>}
          {reason}
        </div>
      )}
    </div>
  );
}
