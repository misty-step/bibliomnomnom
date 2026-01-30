"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

const ROTATION_INTERVAL = 5000;

const archetypes = [
  {
    archetype: "The Polymath",
    tagline: "Eclectic explorer of psychological depths and quiet resilience",
    themes: ["Identity & belonging", "Systems thinking", "Unreliable narrators"],
    genres: ["Literary fiction", "Psychological thriller", "Narrative nonfiction"],
    stats: "127 books · 41k pages",
  },
  {
    archetype: "The Night Owl",
    tagline: "Drawn to shadows, mysteries, and things that go bump in the night",
    themes: ["Gothic atmosphere", "Moral ambiguity", "Hidden secrets"],
    genres: ["Horror", "Dark fantasy", "Crime fiction"],
    stats: "89 books · 28k pages",
  },
  {
    archetype: "The Time Traveler",
    tagline: "Living a thousand lives across centuries and civilizations",
    themes: ["Rise and fall of empires", "Lives shaped by history", "What-ifs"],
    genres: ["Historical fiction", "Epic fantasy", "Alternate history"],
    stats: "156 books · 52k pages",
  },
  {
    archetype: "The Stargazer",
    tagline: "Reaching for the cosmos and pondering what lies beyond",
    themes: ["First contact", "Human expansion", "Tech ethics"],
    genres: ["Hard sci-fi", "Space opera", "Speculative fiction"],
    stats: "112 books · 38k pages",
  },
  {
    archetype: "The Empath",
    tagline: "Finding beauty in the quiet moments between people",
    themes: ["Family dynamics", "Healing & growth", "Love in all forms"],
    genres: ["Contemporary fiction", "Romance", "Memoir"],
    stats: "203 books · 61k pages",
  },
  {
    archetype: "The Seeker",
    tagline: "Questioning everything, from the self to the infinite",
    themes: ["Meaning of existence", "Eastern & Western philosophy", "Consciousness"],
    genres: ["Philosophy", "Spirituality", "Literary fiction"],
    stats: "78 books · 24k pages",
  },
] as const;

const variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

export function ArchetypeCarousel() {
  const shouldReduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { amount: 0.35 });

  const activeArchetype = archetypes[activeIndex] ?? archetypes[0]!;
  const canAutoRotate = useMemo(
    () => isInView && !isHovered && !shouldReduceMotion,
    [isInView, isHovered, shouldReduceMotion],
  );

  const goTo = useCallback((index: number) => {
    setActiveIndex((current) => (index + archetypes.length) % archetypes.length);
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % archetypes.length);
  }, []);

  useEffect(() => {
    if (!canAutoRotate) return undefined;
    const timer = window.setInterval(goNext, ROTATION_INTERVAL);
    return () => window.clearInterval(timer);
  }, [canAutoRotate, goNext]);

  return (
    <div ref={containerRef} className="space-y-md">
      <div
        className="rounded-lg border border-line-ghost bg-surface-dawn p-lg"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocusCapture={() => setIsHovered(true)}
        onBlurCapture={() => setIsHovered(false)}
      >
        <div className="grid gap-lg md:grid-cols-[1.2fr_1fr]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeArchetype.archetype}
              variants={variants}
              initial={shouldReduceMotion ? undefined : "enter"}
              animate="center"
              exit={shouldReduceMotion ? undefined : "exit"}
              transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
              className="space-y-4"
            >
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-text-inkSubtle">
                  archetype
                </p>
                <p className="font-display text-3xl text-text-ink">{activeArchetype.archetype}</p>
                <p className="mt-2 text-text-inkMuted">{activeArchetype.tagline}</p>
              </div>
              <p className="text-sm text-text-inkMuted">{activeArchetype.stats}</p>
            </motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${activeArchetype.archetype}-details`}
              variants={variants}
              initial={shouldReduceMotion ? undefined : "enter"}
              animate="center"
              exit={shouldReduceMotion ? undefined : "exit"}
              transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
              className="space-y-4"
            >
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-text-inkSubtle">
                  themes
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeArchetype.themes.map((theme) => (
                    <span
                      key={theme}
                      className="rounded-md border border-line-ghost bg-canvas-bone px-3 py-1 text-xs text-text-inkMuted"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-text-inkSubtle">
                  genres
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeArchetype.genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-md border border-line-ghost bg-canvas-bone px-3 py-1 text-xs text-text-inkMuted"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {archetypes.map((archetype, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={archetype.archetype}
              type="button"
              aria-label={`Show ${archetype.archetype}`}
              aria-pressed={isActive}
              onClick={() => goTo(index)}
              className={cn(
                "h-2 w-2 rounded-full transition-colors duration-150",
                isActive
                  ? "bg-text-ink"
                  : "bg-line-ghost hover:bg-text-inkMuted focus-visible:bg-text-inkMuted",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
