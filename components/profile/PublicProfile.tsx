/* eslint-disable design-tokens/no-raw-design-values -- Framer Motion viewport margin API */
"use client";

import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ProfileBookCover } from "./ProfileBookCover";
import { cn } from "@/lib/utils";

// Orchestrated reveal animation
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

type PublicProfileProps = {
  username: string;
};

// Removed GenreTag/MoodTag pill components - now using simple lists

// Support both legacy string format and new object format
type ThematicBook = string | { title: string; author: string; coverUrl?: string };

type ThematicConnection = {
  theme: string;
  description?: string;
  books: ThematicBook[];
};

/**
 * Single thematic connection card - stacked layout.
 */
function ThemeCard({
  theme,
  description,
  books,
}: {
  theme: string;
  description?: string;
  books: ThematicBook[];
}) {
  const normalizeBook = (book: ThematicBook) => {
    if (typeof book === "string") {
      return { title: book, author: "", coverUrl: undefined };
    }
    return book;
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4 }}
      className="bg-surface-dawn rounded-lg p-lg border border-line-ghost"
    >
      {/* Theme title with gold underline */}
      <div className="mb-md">
        <h3 className="font-display text-xl text-text-ink mb-xs">{theme}</h3>
        <div className="w-12 h-0.5 bg-deco-gold" />
      </div>

      {/* Description if available */}
      {description && (
        <p className="text-text-inkMuted leading-relaxed mb-lg max-w-2xl">{description}</p>
      )}

      {/* Book covers - horizontal scroll */}
      <div className="flex gap-md overflow-x-auto pb-sm -mx-lg px-lg scrollbar-hide">
        {books.map((book) => {
          const normalized = normalizeBook(book);
          return (
            <ProfileBookCover
              key={normalized.title}
              title={normalized.title}
              author={normalized.author}
              coverUrl={normalized.coverUrl}
              size="md"
              className="shrink-0"
            />
          );
        })}
      </div>

      {/* Book count */}
      <p className="text-xs text-text-inkSubtle font-mono uppercase tracking-wider mt-md">
        {books.length} {books.length === 1 ? "book" : "books"}
      </p>
    </motion.article>
  );
}

/**
 * Thematic connections as stacked cards for public profile.
 */
function PublicThematicConnections({ connections }: { connections: ThematicConnection[] }) {
  if (connections.length === 0) return null;

  return (
    <section className="bg-canvas-bone border-y border-line-ghost">
      <div className="max-w-6xl mx-auto px-md py-2xl">
        {/* Section header with gold underline */}
        <div className="mb-xl">
          <h2 className="font-display text-2xl text-text-ink mb-xs">Your Literary Universe</h2>
          <div className="w-16 h-0.5 bg-deco-gold" />
        </div>

        {/* Stacked theme cards */}
        <div className="space-y-lg">
          {connections.map((connection) => (
            <ThemeCard
              key={connection.theme}
              theme={connection.theme}
              description={connection.description}
              books={connection.books}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Public profile view for /readers/[username]
 * Displays sanitized profile data without requiring authentication.
 * Uses full-bleed section backgrounds matching the private profile.
 */
export function PublicProfile({ username }: PublicProfileProps) {
  const profile = useQuery(api.profiles.getPublic, { username });

  // Loading
  if (profile === undefined) {
    return <PublicProfileSkeleton />;
  }

  // Not found or private
  if (profile === null) {
    return (
      <div className="min-h-screen bg-canvas-bone flex flex-col items-center justify-center px-md">
        <div className="max-w-md w-full text-center">
          <h1 className="font-display text-3xl text-text-ink mb-lg">Profile Not Found</h1>

          <p className="font-sans text-base text-text-inkMuted leading-relaxed mb-lg">
            This reader profile doesn&apos;t exist or isn&apos;t public.
          </p>

          <Link href="/">
            <Button variant="secondary" size="md">
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile.displayName || profile.username;
  const archetype = profile.insights?.readerArchetype || "Reader";
  const pagesInK = Math.round(profile.stats.pagesRead / 1000);

  return (
    <div className="min-h-screen">
      {/* Hero section - archetype as hero text */}
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
          {profile.insights?.tasteTagline && (
            <motion.p
              className="font-display text-xl md:text-2xl text-text-inkMuted italic max-w-2xl"
              variants={itemVariants}
            >
              {profile.insights.tasteTagline}
            </motion.p>
          )}

          {/* Divider */}
          <motion.div className="w-16 h-px bg-line-ghost mt-lg mb-md" variants={itemVariants} />

          {/* Stats inline */}
          <motion.p className="text-sm text-text-inkMuted" variants={itemVariants}>
            {profile.stats.booksRead} books · {pagesInK}k pages
          </motion.p>
        </motion.div>
      </section>

      {/* Literary Taste - full-bleed section */}
      {profile.insights && (
        <section className="bg-surface-dawn border-y border-line-ghost">
          <div className="max-w-6xl mx-auto px-md py-2xl">
            {/* Section header with gold underline */}
            <div className="mb-xl">
              <h2 className="font-display text-2xl text-text-ink mb-xs">Literary Taste</h2>
              <div className="w-16 h-0.5 bg-deco-gold" />
            </div>

            <div className="grid gap-xl md:grid-cols-2">
              {/* Genres - DRAWN TO */}
              {profile.insights.literaryTaste.genres.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  <p className="text-xs text-text-inkMuted font-mono uppercase tracking-wider mb-md">
                    Drawn to
                  </p>
                  <ul className="space-y-sm">
                    {profile.insights.literaryTaste.genres.map((genre) => (
                      <li key={genre} className="text-text-ink">
                        {genre}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Moods - SEEKING */}
              {profile.insights.literaryTaste.moods.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                >
                  <p className="text-xs text-text-inkMuted font-mono uppercase tracking-wider mb-md">
                    Seeking
                  </p>
                  <ul className="space-y-sm">
                    {profile.insights.literaryTaste.moods.map((mood) => (
                      <li key={mood} className="text-text-ink">
                        {mood}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Thematic Connections - Gmail-style master-detail */}
      {profile.insights && profile.insights.thematicConnections.length > 0 && (
        <PublicThematicConnections connections={profile.insights.thematicConnections} />
      )}

      {/* CTA section */}
      <section className="bg-surface-dawn border-t border-line-ghost">
        <div className="max-w-6xl mx-auto px-md py-2xl">
          <p className="text-sm text-text-inkMuted mb-md">Want your own reader profile?</p>
          <Link href="/">
            <Button variant="primary" size="md">
              <Sparkles className="w-4 h-4 mr-2" />
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function PublicProfileSkeleton() {
  return (
    <div className="min-h-screen bg-canvas-bone">
      <div className="max-w-6xl mx-auto px-md py-3xl animate-pulse">
        {/* Avatar + Name row */}
        <div className="flex items-center gap-lg mb-md">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-canvas-boneMuted" />
          <div className="h-12 w-48 bg-canvas-boneMuted rounded" />
        </div>
        {/* Tagline */}
        <div className="h-6 w-80 bg-canvas-boneMuted rounded mb-lg" />
        {/* Stats */}
        <div className="h-4 w-32 bg-canvas-boneMuted rounded" />
      </div>
    </div>
  );
}
