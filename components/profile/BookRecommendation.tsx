/* eslint-disable design-tokens/no-raw-design-values -- Tailwind bracket notation for micro text sizes */
"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { RefreshCw, Award, Sparkles, BookOpen, Star, Film, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// Badge configuration with brand-tinted colors (warm sepia palette)
const BADGE_CONFIG: Record<string, { icon: typeof Award; label: string; className: string }> = {
  "similar-atmosphere": {
    icon: Sparkles,
    label: "Similar Atmosphere",
    className: "bg-accent-ember/10 text-accent-ember border border-accent-ember/20",
  },
  "same-author-style": {
    icon: Users,
    label: "Same Author Style",
    className: "bg-deco-plum/10 text-deco-plum border border-deco-plum/20",
  },
  "award-winner": {
    icon: Award,
    label: "Award Winner",
    className: "bg-deco-gold/15 text-deco-goldDark border border-deco-gold/30",
  },
  "cult-classic": {
    icon: Star,
    label: "Cult Classic",
    className: "bg-accent-rose/10 text-accent-rose border border-accent-rose/20",
  },
  "genre-defining": {
    icon: BookOpen,
    label: "Genre Defining",
    className: "bg-status-positive/10 text-status-positive border border-status-positive/20",
  },
  "recently-adapted": {
    icon: Film,
    label: "Recently Adapted",
    className: "bg-accent-teal/10 text-accent-teal border border-accent-teal/20",
  },
};
const DEFAULT_BADGE_CLASSNAME = "bg-canvas-bone/90 text-text-ink border border-line-ghost";
const MAX_VISIBLE_BADGES = 2;

function formatBadgeLabel(rawBadge: string): string {
  const config = BADGE_CONFIG[rawBadge];
  if (config) return config.label;

  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawBadge)) {
    return rawBadge
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return rawBadge;
}

function getVisibleBadges(badges?: string[]) {
  const visible: Array<{ id: string; label: string; icon: typeof Award; className: string }> = [];
  const seen = new Set<string>();

  for (const rawBadge of badges ?? []) {
    const cleaned = String(rawBadge).trim().replace(/\s+/g, " ").slice(0, 32);
    if (!cleaned) continue;

    const config = BADGE_CONFIG[cleaned];
    const label = formatBadgeLabel(cleaned);
    const normalizedLabel = label.toLowerCase();
    if (seen.has(normalizedLabel)) continue;
    seen.add(normalizedLabel);

    visible.push({
      id: cleaned,
      label,
      icon: config?.icon ?? Award,
      className: config?.className ?? DEFAULT_BADGE_CLASSNAME,
    });

    if (visible.length >= MAX_VISIBLE_BADGES) break;
  }

  return visible;
}

// Hostnames that Next.js Image can optimize (configured in next.config.ts)
const OPTIMIZABLE_IMAGE_HOSTNAMES = [
  "books.googleusercontent.com",
  "books.google.com",
  "covers.openlibrary.org",
  "lh3.googleusercontent.com",
  "images.unsplash.com",
];

export type BookRecommendationProps = {
  title: string;
  author: string;
  coverUrl?: string;
  reason: string; // Short hook < 80 chars
  detailedReason?: string; // 2-3 sentence explanation
  connectionBooks?: string[]; // Titles from user's library
  badges?: string[]; // Short tags from recommendation generation
  isReread?: boolean;
  className?: string;
};

export function BookRecommendation({
  title,
  author,
  coverUrl,
  reason,
  detailedReason,
  connectionBooks,
  badges,
  isReread,
  className,
}: BookRecommendationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const shouldReduce = useReducedMotion();
  const articleRef = useRef<HTMLElement>(null);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      const willExpand = !prev;
      // Scroll expanded content into view after animation
      if (willExpand && articleRef.current) {
        setTimeout(() => {
          articleRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 250);
      }
      return willExpand;
    });
  }, []);

  const isOptimizable = (src: string) => {
    if (src.startsWith("/")) return true;
    try {
      const url = new URL(src);
      return (
        OPTIMIZABLE_IMAGE_HOSTNAMES.includes(url.hostname) ||
        url.hostname.endsWith(".public.blob.vercel-storage.com")
      );
    } catch {
      return false;
    }
  };

  const showCover = coverUrl && !imageError;
  const hasDetails = detailedReason || (connectionBooks && connectionBooks.length > 0);
  const visibleBadges = getVisibleBadges(badges);

  return (
    <motion.article
      ref={articleRef}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={shouldReduce ? undefined : { y: -4 }}
      transition={{
        type: "spring",
        stiffness: 250,
        damping: 25,
        mass: 1,
      }}
      className={cn(
        "group relative cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-bone rounded-sm",
        "active:scale-[0.98] transition-transform",
        className,
      )}
      onClick={hasDetails ? toggleExpanded : undefined}
      role={hasDetails ? "button" : undefined}
      tabIndex={hasDetails ? 0 : undefined}
      onKeyDown={
        hasDetails
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleExpanded();
              }
            }
          : undefined
      }
      aria-label={`${title} by ${author}${isReread ? " (Re-read)" : ""}`}
      aria-expanded={hasDetails ? isExpanded : undefined}
    >
      {/* Cover Container - 2:3 aspect ratio matching BookTile */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm shadow-surface transition-shadow duration-300 group-hover:shadow-raised bg-canvas-boneMuted">
        {showCover ? (
          <>
            {/* Cover image */}
            <div className="absolute inset-0">
              {isOptimizable(coverUrl) ? (
                <Image
                  src={coverUrl}
                  alt={`${title} cover`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  onError={handleImageError}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverUrl}
                  alt={`${title} cover`}
                  className="h-full w-full object-cover"
                  onError={handleImageError}
                />
              )}
            </div>

            {/* Reason overlay at bottom - using brand-tinted dark */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-text-ink/85 to-transparent p-3 pt-8">
              <p className="text-xs text-white/90 line-clamp-2 leading-relaxed">{reason}</p>
              {hasDetails && <p className="text-[10px] text-white/60 mt-1">Tap for more</p>}
            </div>

            {/* Re-read badge */}
            {isReread && (
              <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-canvas-bone/90 px-2 py-1 text-xs font-medium text-text-ink shadow-sm">
                <RefreshCw className="h-3 w-3" />
                Re-read
              </div>
            )}
          </>
        ) : (
          /* No cover fallback - styled index card */
          <div className="absolute inset-0 m-1.5 flex flex-col justify-between rounded-sm border border-line-ghost/50 bg-canvas-bone p-4 shadow-sm ring-1 ring-inset ring-black/5">
            <div className="flex w-full flex-col items-start space-y-2">
              <h3 className="font-display text-base font-medium leading-snug text-text-ink text-balance text-left line-clamp-4">
                {title}
              </h3>
              <p className="font-mono text-xs uppercase tracking-wider text-text-inkMuted text-left line-clamp-1">
                {author}
              </p>
            </div>
            <div className="mt-auto pt-2 border-t border-line-ghost/50">
              <p className="text-xs text-text-inkMuted line-clamp-2 leading-relaxed">{reason}</p>
            </div>
            {isReread && (
              <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-text-ink/10 px-2 py-0.5 text-xs font-medium text-text-ink">
                <RefreshCw className="h-3 w-3" />
              </div>
            )}
          </div>
        )}

        {/* Badges - shown at top left */}
        {visibleBadges.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {visibleBadges.map((badge) => {
              const Icon = badge.icon;
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shadow-sm",
                    badge.className,
                  )}
                  title={badge.label}
                >
                  <Icon className="h-3 w-3" />
                  <span className="sr-only">{badge.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Title and author below card */}
      <div className="mt-2 space-y-0.5">
        <h3 className="font-display text-sm font-medium leading-tight text-text-ink line-clamp-2">
          {title}
        </h3>
        <p className="font-mono text-xs text-text-inkMuted line-clamp-1">{author}</p>
      </div>

      {/* Expanded detail panel */}
      <AnimatePresence>
        {isExpanded && hasDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 overflow-hidden"
          >
            <div className="rounded-md border border-line-ghost bg-canvas-bone p-3 space-y-3">
              {/* Detailed reason */}
              {detailedReason && (
                <p className="text-sm text-text-ink leading-relaxed">{detailedReason}</p>
              )}

              {/* Connection books */}
              {connectionBooks && connectionBooks.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-mono text-xs uppercase tracking-wider text-text-inkMuted">
                    Because you read:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {connectionBooks.map((bookTitle) => (
                      <span
                        key={bookTitle}
                        className="inline-block rounded-full bg-canvas-boneMuted px-2 py-0.5 text-xs text-text-ink"
                      >
                        {bookTitle}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Badges with labels */}
              {visibleBadges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {visibleBadges.map((badge) => {
                    const Icon = badge.icon;
                    return (
                      <span
                        key={badge.id}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          badge.className,
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {badge.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export function BookRecommendationSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="aspect-[2/3] w-full rounded-sm bg-text-ink/5" />
      <div className="h-4 w-3/4 rounded bg-text-ink/5" />
      <div className="h-3 w-1/2 rounded bg-text-ink/5" />
    </div>
  );
}
