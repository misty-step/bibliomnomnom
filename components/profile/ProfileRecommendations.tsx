"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  Compass,
  RefreshCw,
  Award,
  Sparkles,
  BookOpen,
  Star,
  Film,
  Users,
} from "lucide-react";
import { ProfileBookCover } from "./ProfileBookCover";
import { cn } from "@/lib/utils";

// Badge configuration - unified gold color scheme for all badges
const BADGE_CONFIG: Record<string, { icon: typeof Award; label: string }> = {
  "similar-atmosphere": {
    icon: Sparkles,
    label: "Similar Atmosphere",
  },
  "same-author-style": {
    icon: Users,
    label: "Same Author Style",
  },
  "award-winner": {
    icon: Award,
    label: "Award Winner",
  },
  "cult-classic": {
    icon: Star,
    label: "Cult Classic",
  },
  "genre-defining": {
    icon: BookOpen,
    label: "Genre Defining",
  },
  "recently-adapted": {
    icon: Film,
    label: "Recently Adapted",
  },
};

// Unified badge styling - all gold
const BADGE_CLASSNAME = "bg-deco-gold/10 text-deco-goldDark";

// Schema-compatible recommendation with optional enhanced fields
type BookRecommendation = {
  title: string;
  author: string;
  reason: string;
  detailedReason?: string;
  connectionBooks?: string[];
  badges?: string[];
  isReread?: boolean;
};

// Combined schema structure supporting both new and legacy formats
type RecommendationsData = {
  goDeeper?: BookRecommendation[];
  goWider?: BookRecommendation[];
  continueReading?: BookRecommendation[];
  freshPerspective?: BookRecommendation[];
  revisit?: BookRecommendation[];
};

type ProfileRecommendationsProps = {
  recommendations: RecommendationsData;
};

/**
 * Convert mixed/legacy recommendations to normalized structure.
 */
function normalizeRecommendations(recs: RecommendationsData) {
  const goDeeper = recs.goDeeper ?? [];
  const goWider = recs.goWider ?? [];

  if (goDeeper.length > 0 || goWider.length > 0) {
    return { goDeeper, goWider };
  }

  // Fall back to legacy format
  const continueReading = recs.continueReading ?? [];
  const freshPerspective = recs.freshPerspective ?? [];
  const revisit = (recs.revisit ?? []).map((book) => ({ ...book, isReread: true }));

  return {
    goDeeper: [...continueReading, ...revisit],
    goWider: freshPerspective,
  };
}

/**
 * Single recommendation feature card.
 * Horizontal layout: cover on left, full content on right.
 * No truncation - shows complete reasoning immediately.
 */
function RecommendationCard({
  book,
  variant = "deeper",
}: {
  book: BookRecommendation;
  variant?: "deeper" | "wider";
}) {
  const validBadges = book.badges?.filter((b) => BADGE_CONFIG[b]) ?? [];

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={cn(
        "flex gap-md md:gap-lg p-md md:p-lg bg-surface-dawn rounded-lg border border-line-ghost",
        "hover:shadow-md transition-shadow",
        "", // variant styling removed - using unified design
      )}
    >
      {/* Cover - larger size */}
      <div className="shrink-0 w-28 md:w-36">
        <ProfileBookCover
          title={book.title}
          author={book.author}
          size="lg"
          isReread={book.isReread}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-sm">
        {/* Title + Author */}
        <div>
          <h3 className="font-display text-base md:text-lg text-text-ink leading-tight">
            {book.title}
          </h3>
          <p className="text-sm text-text-inkMuted mt-xs">{book.author}</p>
        </div>

        {/* Full reason - no truncation */}
        <p className="text-sm md:text-base text-text-ink leading-relaxed">
          {book.detailedReason || book.reason}
        </p>

        {/* Connection books */}
        {book.connectionBooks && book.connectionBooks.length > 0 && (
          <p className="text-sm text-text-inkMuted">
            <span className="font-medium">Because you read:</span> {book.connectionBooks.join(", ")}
          </p>
        )}

        {/* Badges */}
        {validBadges.length > 0 && (
          <div className="flex flex-wrap gap-xs pt-xs">
            {validBadges.map((badge) => {
              const config = BADGE_CONFIG[badge];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <span
                  key={badge}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    BADGE_CLASSNAME,
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {config.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Re-read indicator (mobile - since cover badge may be small) */}
        {book.isReread && (
          <div className="md:hidden flex items-center gap-1 text-xs text-text-inkMuted">
            <RefreshCw className="h-3 w-3" />
            <span>Worth re-reading</span>
          </div>
        )}
      </div>
    </motion.article>
  );
}

/**
 * Book recommendations as feature cards with full reasoning.
 * Two-column layout on desktop: Go Deeper | Go Wider side by side.
 */
export function ProfileRecommendations({ recommendations }: ProfileRecommendationsProps) {
  const normalized = normalizeRecommendations(recommendations);
  const hasAny = normalized.goDeeper.length > 0 || normalized.goWider.length > 0;
  const hasDeeper = normalized.goDeeper.length > 0;
  const hasWider = normalized.goWider.length > 0;
  const shouldReduce = useReducedMotion();

  if (!hasAny) return null;

  return (
    <div className="max-w-6xl mx-auto px-md py-2xl md:py-3xl">
      {/* Section header with gold underline */}
      <motion.div
        className="mb-xl"
        initial={shouldReduce ? undefined : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <h2 className="font-display text-2xl md:text-3xl text-text-ink mb-xs">What to Read Next</h2>
        <div className="w-16 h-0.5 bg-deco-gold mb-sm" />
        <p className="text-text-inkMuted max-w-2xl">
          Personalized recommendations based on your reading patterns and literary preferences
        </p>
      </motion.div>

      {/* Two-column layout on desktop */}
      <div
        className={cn("grid gap-xl", hasDeeper && hasWider ? "md:grid-cols-2" : "md:grid-cols-1")}
      >
        {/* Go Deeper column */}
        {hasDeeper && (
          <div>
            <motion.div
              className="flex items-center gap-sm mb-lg"
              initial={shouldReduce ? undefined : { opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <ArrowDown className="w-5 h-5 text-text-inkMuted" />
              <div>
                <h3 className="font-display text-lg text-text-ink">Go Deeper</h3>
                <p className="text-sm text-text-inkMuted">
                  Master the themes you&apos;ve been exploring
                </p>
              </div>
            </motion.div>

            <div className="space-y-md">
              {normalized.goDeeper.map((book) => (
                <RecommendationCard
                  key={`${book.title}-${book.author}`}
                  book={book}
                  variant="deeper"
                />
              ))}
            </div>
          </div>
        )}

        {/* Go Wider column */}
        {hasWider && (
          <div>
            <motion.div
              className="flex items-center gap-sm mb-lg"
              initial={shouldReduce ? undefined : { opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Compass className="w-5 h-5 text-text-inkMuted" />
              <div>
                <h3 className="font-display text-lg text-text-ink">Go Wider</h3>
                <p className="text-sm text-text-inkMuted">
                  Discover perspectives outside your usual path
                </p>
              </div>
            </motion.div>

            <div className="space-y-md">
              {normalized.goWider.map((book) => (
                <RecommendationCard
                  key={`${book.title}-${book.author}`}
                  book={book}
                  variant="wider"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for recommendations section.
 */
export function ProfileRecommendationsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-md py-2xl md:py-3xl animate-pulse">
      <div className="space-y-2 mb-xl">
        <div className="h-8 w-48 bg-text-ink/5 rounded" />
        <div className="h-5 w-80 bg-text-ink/5 rounded" />
      </div>

      <div className="space-y-md">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-lg p-lg bg-surface-dawn rounded-lg border border-line-ghost"
          >
            <div className="w-32 aspect-[2/3] bg-text-ink/5 rounded" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-48 bg-text-ink/5 rounded" />
              <div className="h-4 w-32 bg-text-ink/5 rounded" />
              <div className="h-16 w-full bg-text-ink/5 rounded" />
              <div className="h-4 w-64 bg-text-ink/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
