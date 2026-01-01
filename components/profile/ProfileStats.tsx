"use client";

import { motion } from "framer-motion";

type ProfileStatsProps = {
  stats: {
    totalBooks: number;
    booksRead: number;
    pagesRead: number;
    audiobookRatio: number;
    averagePace: number;
    topAuthors: Array<{ author: string; count: number }>;
  };
};

function RatioBar({
  ratio,
  leftLabel,
  rightLabel,
}: {
  ratio: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const leftPercent = Math.round((1 - ratio) * 100);
  const rightPercent = Math.round(ratio * 100);

  return (
    <div>
      <div className="flex justify-between text-xs text-text-inkMuted mb-xs">
        <span>
          {leftLabel} {leftPercent}%
        </span>
        <span>
          {rightPercent}% {rightLabel}
        </span>
      </div>
      <div className="h-1.5 bg-canvas-boneMuted rounded-full overflow-hidden flex">
        <motion.div
          className="h-full bg-text-ink"
          initial={{ width: 0 }}
          whileInView={{ width: `${leftPercent}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        />
        <motion.div
          className="h-full bg-text-inkMuted"
          initial={{ width: 0 }}
          whileInView={{ width: `${rightPercent}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        />
      </div>
    </div>
  );
}

/**
 * Simplified stats section - just top authors and format mix.
 * Main stats (books, pages) are now in the hero.
 */
export function ProfileStats({ stats }: ProfileStatsProps) {
  const hasTopAuthors = stats.topAuthors.length > 0;
  const hasAudiobooks = stats.audiobookRatio > 0;

  // If no meaningful content, don't render
  if (!hasTopAuthors && !hasAudiobooks) return null;

  return (
    <div className="max-w-6xl mx-auto px-md py-xl">
      <div className="flex flex-col md:flex-row gap-xl md:gap-3xl items-start">
        {/* Top authors with horizontal bar chart */}
        {hasTopAuthors && (
          <motion.div
            className="flex-1 max-w-xl"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-xs text-text-inkMuted font-mono uppercase tracking-wider mb-md">
              Most Read Authors
            </p>
            <div className="space-y-sm">
              {stats.topAuthors.slice(0, 8).map((author, index) => {
                // Calculate bar width proportional to max count
                const maxCount = stats.topAuthors[0]?.count || 1;
                const widthPercent = Math.round((author.count / maxCount) * 100);

                return (
                  <motion.div
                    key={author.author}
                    className="flex items-center gap-md"
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <span className="text-sm text-text-ink w-40 truncate">{author.author}</span>
                    <div className="flex-1 h-4 bg-canvas-boneMuted rounded overflow-hidden">
                      <motion.div
                        className="h-full bg-text-ink rounded"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${widthPercent}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.2 + index * 0.05 }}
                      />
                    </div>
                    <span className="text-xs text-text-inkMuted tabular-nums font-mono w-6 text-right">
                      {author.count}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Format mix - only if user has audiobooks */}
        {hasAudiobooks && (
          <motion.div
            className="w-full md:w-64"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <p className="text-xs text-text-inkMuted uppercase tracking-wider mb-md">
              How You Read
            </p>
            <RatioBar ratio={stats.audiobookRatio} leftLabel="Print" rightLabel="Audio" />
          </motion.div>
        )}
      </div>
    </div>
  );
}
