/* eslint-disable design-tokens/no-raw-design-values -- Framer Motion viewport margin API */
"use client";

import { motion } from "framer-motion";
import { ProfileBookCover } from "./ProfileBookCover";

// Support both legacy string format and new object format
type ThematicBook = string | { title: string; author: string; coverUrl?: string };

type ProfileInsightsProps = {
  insights: {
    tasteTagline: string;
    literaryTaste: {
      genres: string[];
      moods: string[];
      complexity: "accessible" | "moderate" | "literary";
    };
    thematicConnections: Array<{
      theme: string;
      description?: string;
      books: ThematicBook[];
    }>;
    confidence: "early" | "developing" | "strong";
  };
};

/**
 * Single thematic connection card - shows theme with book covers
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
 * Thematic connections as stacked cards
 */
function ThematicConnections({
  connections,
}: {
  connections: ProfileInsightsProps["insights"]["thematicConnections"];
}) {
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
 * Literary Taste section - simplified vertical lists
 * Complexity removed per design plan
 */
export function ProfileInsights({ insights }: ProfileInsightsProps) {
  const hasGenres = insights.literaryTaste.genres.length > 0;
  const hasMoods = insights.literaryTaste.moods.length > 0;

  return (
    <>
      {/* Literary Taste - simple vertical lists */}
      <section className="bg-surface-dawn border-y border-line-ghost">
        <div className="max-w-6xl mx-auto px-md py-2xl">
          {/* Section header with gold underline */}
          <div className="mb-xl">
            <div className="flex items-center gap-md">
              <h2 className="font-display text-2xl text-text-ink">Literary Taste</h2>
              {insights.confidence !== "strong" && (
                <span className="text-xs text-text-inkSubtle bg-canvas-boneMuted px-sm py-xs rounded-full">
                  {insights.confidence === "early" ? "Early insights" : "Developing"}
                </span>
              )}
            </div>
            <div className="w-16 h-0.5 bg-deco-gold mt-xs" />
          </div>

          <div className="grid gap-2xl md:grid-cols-2">
            {/* Genres - DRAWN TO */}
            {hasGenres && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <p className="text-xs text-text-inkMuted font-mono uppercase tracking-wider mb-md">
                  Drawn to
                </p>
                <ul className="space-y-sm">
                  {insights.literaryTaste.genres.map((genre) => (
                    <li key={genre} className="text-text-ink">
                      {genre}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Moods - SEEKING */}
            {hasMoods && (
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
                  {insights.literaryTaste.moods.map((mood) => (
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

      {/* Thematic Connections - stacked cards */}
      <ThematicConnections connections={insights.thematicConnections} />
    </>
  );
}
