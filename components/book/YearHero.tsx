"use client";

import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format";

export interface YearStats {
  totalBooks: number;
  totalPages: number;
}

export interface YearHeroProps {
  year: number;
  stats: YearStats;
  className?: string;
}

export function YearHero({ year, stats, className }: YearHeroProps) {
  return (
    <section className={cn("py-12 md:py-16", className)}>
      <div className="flex flex-col items-center text-center">
        {/* Year */}
        <h2 className="font-display text-7xl md:text-8xl lg:text-9xl font-medium text-text-ink">
          {year}
        </h2>

        {/* Gold accent line */}
        <div className="mt-4 h-0.5 w-16 bg-deco-gold" />

        {/* Stats - single line */}
        <p className="mt-4 font-mono text-sm text-text-inkMuted">
          {stats.totalBooks} {pluralize(stats.totalBooks, "book")} ·{" "}
          {stats.totalPages.toLocaleString()} pages
        </p>
      </div>
    </section>
  );
}
