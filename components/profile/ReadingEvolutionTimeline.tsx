/* eslint-disable design-tokens/no-raw-design-values -- Framer Motion viewport margin API */
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileBookCover } from "./ProfileBookCover";

// Type for structured evolution (matches schema)
export type EvolutionPhase = {
  title: string;
  period: string;
  description: string;
  keyBooks: string[];
  catalyst?: string;
};

export type StructuredEvolution = {
  phases: EvolutionPhase[];
  narrative: string;
  trajectory: string;
};

type ReadingEvolutionTimelineProps = {
  evolution: StructuredEvolution;
  className?: string;
};

/**
 * Phase card - stacked layout with large book covers.
 * No alternating sides, no timeline spine.
 */
function PhaseCard({ phase, index }: { phase: EvolutionPhase; index: number }) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.article
      initial={shouldReduce ? undefined : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="bg-surface-dawn rounded-lg p-lg md:p-xl border border-line-ghost"
    >
      {/* Phase title + period on same line */}
      <div className="flex flex-wrap items-baseline gap-md mb-md">
        <h3 className="font-display text-2xl md:text-3xl text-text-ink">{phase.title}</h3>
        <span className="font-mono text-sm text-text-inkMuted">{phase.period}</span>
      </div>

      {/* Gold underline */}
      <div className="w-16 h-0.5 bg-deco-gold mb-lg" />

      {/* Description */}
      <p className="text-base md:text-lg text-text-inkMuted leading-relaxed mb-xl max-w-2xl">
        {phase.description}
      </p>

      {/* Large book covers - horizontal scroll */}
      <div className="flex gap-md overflow-x-auto pb-sm -mx-lg px-lg md:mx-0 md:px-0 scrollbar-hide">
        {phase.keyBooks.map((bookTitle) => {
          const isCatalyst = bookTitle === phase.catalyst;
          return (
            <div key={bookTitle} className="shrink-0 relative">
              <ProfileBookCover
                title={bookTitle}
                size="lg"
                className={cn(
                  isCatalyst && "ring-2 ring-offset-2 ring-deco-gold ring-offset-surface-dawn",
                )}
              />
              {isCatalyst && (
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-deco-gold flex items-center justify-center shadow-sm">
                  <Star className="w-3.5 h-3.5 text-white fill-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Catalyst call-out */}
      {phase.catalyst && (
        <p className="text-sm text-deco-goldDark mt-md flex items-center gap-sm">
          <Star className="w-4 h-4 text-deco-gold fill-deco-gold" />
          <em>{phase.catalyst}</em> sparked this shift
        </p>
      )}
    </motion.article>
  );
}

export function ReadingEvolutionTimeline({ evolution, className }: ReadingEvolutionTimelineProps) {
  const shouldReduce = useReducedMotion();

  // Split narrative into paragraphs for drop cap treatment
  const paragraphs = evolution.narrative.split("\n\n").filter(Boolean);
  const firstParagraph = paragraphs[0] || "";
  const remainingParagraphs = paragraphs.slice(1);

  return (
    <section className={cn("py-2xl", className)}>
      <div className="max-w-4xl mx-auto px-md">
        {/* Section header with gold underline */}
        <motion.div
          initial={shouldReduce ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-xl"
        >
          <h2 className="font-display text-2xl md:text-3xl text-text-ink mb-xs">
            Your Literary Journey
          </h2>
          <div className="w-16 h-0.5 bg-deco-gold" />
        </motion.div>

        {/* Opening narrative with drop cap */}
        <motion.div
          initial={shouldReduce ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mb-2xl"
        >
          <p className="font-display text-lg md:text-xl leading-relaxed text-text-ink first-letter:text-6xl md:first-letter:text-7xl first-letter:font-display first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-text-ink">
            {firstParagraph}
          </p>
          {remainingParagraphs.map((para, i) => (
            <p
              key={i}
              className="font-display text-lg md:text-xl leading-relaxed text-text-ink mt-4"
            >
              {para}
            </p>
          ))}
        </motion.div>

        {/* Stacked phase cards */}
        <div className="space-y-lg mb-2xl">
          {evolution.phases.map((phase, index) => (
            <PhaseCard key={phase.title} phase={phase} index={index} />
          ))}
        </div>

        {/* Trajectory - gold-framed future speculation */}
        <motion.div
          initial={shouldReduce ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl"
        >
          <div className="bg-deco-gold/5 border border-deco-gold/30 rounded-lg p-lg">
            <h3 className="font-display text-xl text-text-ink mb-sm flex items-center gap-sm">
              <span className="w-1.5 h-6 bg-deco-gold rounded-full" />
              Where You&apos;re Headed
            </h3>
            <p className="text-base text-text-inkMuted leading-relaxed italic pl-4">
              {evolution.trajectory}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Legacy fallback for string-based evolution data.
 * Renders simple text instead of timeline.
 */
export function ReadingEvolutionLegacy({
  evolution,
  speculation,
  className,
}: {
  evolution: string;
  speculation?: string;
  className?: string;
}) {
  return (
    <section className={cn("py-xl", className)}>
      <div className="max-w-2xl mx-auto px-md">
        {/* Section header with gold underline */}
        <div className="mb-lg">
          <h2 className="font-display text-2xl text-text-ink mb-xs">Reading Evolution</h2>
          <div className="w-12 h-0.5 bg-deco-gold" />
        </div>

        <p className="text-base text-text-ink leading-relaxed">{evolution}</p>

        {speculation && (
          <div className="mt-lg bg-deco-gold/5 border border-deco-gold/30 rounded-lg p-md">
            <p className="text-base text-text-inkMuted leading-relaxed italic">{speculation}</p>
          </div>
        )}
      </div>
    </section>
  );
}
