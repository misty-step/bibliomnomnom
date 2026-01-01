"use client";

import { motion } from "framer-motion";
import { RefreshCw, Share2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProfileHeroProps = {
  profile: {
    displayName?: string;
    avatarUrl?: string;
    tasteTagline?: string;
    readerArchetype?: string; // "The Polymath", "Digital Sovereign", etc.
    isPublic: boolean;
    lastGeneratedAt?: number;
  };
  stats?: {
    booksRead: number;
    pagesRead: number;
  };
  onShare: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  isStale?: boolean;
};

// Centered reveal animation
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 1, 0.35, 1] as const },
  },
};

/**
 * Left-aligned hero section with editorial typography.
 * Name as visual anchor, elegant italic tagline, minimal ghost buttons.
 */
export function ProfileHero({
  profile,
  stats,
  onShare,
  onRegenerate,
  isRegenerating,
  isStale,
}: ProfileHeroProps) {
  const displayName = profile.displayName || "Reader";
  const archetype = profile.readerArchetype || "Reader";
  const pagesInK = stats ? Math.round(stats.pagesRead / 1000) : 0;

  return (
    <section className="bg-canvas-bone">
      <motion.div
        className="max-w-6xl mx-auto px-md pt-lg pb-2xl md:pb-3xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Avatar + Archetype row */}
        <div className="flex items-center gap-lg mb-md">
          {profile.avatarUrl && (
            <motion.div variants={itemVariants}>
              <div className="relative h-20 w-20 md:h-24 md:w-24 overflow-hidden rounded-full ring-2 ring-deco-gold ring-offset-4 ring-offset-canvas-bone shadow-raised">
                <Image
                  src={profile.avatarUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </div>
            </motion.div>
          )}

          {/* Archetype as hero text */}
          <motion.h1
            className="font-display text-5xl md:text-7xl text-text-ink tracking-tight"
            variants={itemVariants}
          >
            {archetype}
          </motion.h1>
        </div>

        {/* Display name underneath */}
        <motion.p className="text-lg md:text-xl text-text-inkMuted mb-sm" variants={itemVariants}>
          {displayName}
        </motion.p>

        {/* Taste tagline - no quotation marks */}
        {profile.tasteTagline && (
          <motion.p
            className="font-display text-xl md:text-2xl text-text-inkMuted italic max-w-2xl"
            variants={itemVariants}
          >
            {profile.tasteTagline}
          </motion.p>
        )}

        {/* Divider */}
        <motion.div className="w-16 h-px bg-line-ghost mt-lg mb-md" variants={itemVariants} />

        {/* Stats + Actions row */}
        <motion.div className="flex flex-wrap items-center gap-md" variants={itemVariants}>
          {stats && (
            <p className="text-sm text-text-inkMuted">
              {stats.booksRead} books · {pagesInK}k pages
            </p>
          )}

          <div className="flex gap-sm">
            <Button onClick={onShare} variant="ghost" size="sm" className="rounded-full">
              <Share2 className="w-4 h-4 mr-1.5" />
              {profile.isPublic ? "Share" : "Make Public"}
            </Button>
            <Button
              onClick={onRegenerate}
              variant="ghost"
              size="sm"
              disabled={isRegenerating}
              className="rounded-full"
            >
              <RefreshCw className={cn("w-4 h-4 mr-1.5", isRegenerating && "animate-spin")} />
              {isStale ? "Update" : "Refresh"}
            </Button>
          </div>
        </motion.div>

        {/* Stale indicator */}
        {isStale && (
          <motion.p className="text-xs text-accent-ember mt-sm" variants={itemVariants}>
            New insights available based on recent reading
          </motion.p>
        )}
      </motion.div>
    </section>
  );
}
