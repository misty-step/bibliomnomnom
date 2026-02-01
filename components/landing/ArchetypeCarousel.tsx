/* eslint-disable design-tokens/no-raw-design-values -- Ticker animation requires fixed card widths */
"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

const archetypes = [
  {
    archetype: "The Polymath",
    tagline: "Eclectic explorer of psychological depths and quiet resilience",
  },
  {
    archetype: "The Night Owl",
    tagline: "Drawn to shadows, mysteries, and things that go bump in the night",
  },
  {
    archetype: "The Time Traveler",
    tagline: "Living a thousand lives across centuries and civilizations",
  },
  {
    archetype: "The Stargazer",
    tagline: "Reaching for the cosmos and pondering what lies beyond",
  },
  {
    archetype: "The Empath",
    tagline: "Finding beauty in the quiet moments between people",
  },
  {
    archetype: "The Seeker",
    tagline: "Questioning everything, from the self to the infinite",
  },
  {
    archetype: "The Strategist",
    tagline: "Obsessed with systems, power, and the games people play",
  },
  {
    archetype: "The Romantic",
    tagline: "Believing in love against all odds and reason",
  },
  {
    archetype: "The Detective",
    tagline: "Unraveling puzzles and hunting for hidden truths",
  },
  {
    archetype: "The Wanderer",
    tagline: "At home in foreign lands and unfamiliar tongues",
  },
  {
    archetype: "The Philosopher",
    tagline: "Wrestling with questions that have no easy answers",
  },
  {
    archetype: "The Rebel",
    tagline: "Drawn to those who fight against the status quo",
  },
  {
    archetype: "The Dreamer",
    tagline: "Lost in worlds that exist only in imagination",
  },
  {
    archetype: "The Historian",
    tagline: "Finding wisdom in the patterns of the past",
  },
  {
    archetype: "The Optimist",
    tagline: "Seeking stories of hope, growth, and redemption",
  },
  {
    archetype: "The Cynic",
    tagline: "Appreciating dark humor and unflinching honesty",
  },
  {
    archetype: "The Artist",
    tagline: "Drawn to beauty, creativity, and unconventional lives",
  },
  {
    archetype: "The Scientist",
    tagline: "Fascinated by how things work at every scale",
  },
  {
    archetype: "The Survivor",
    tagline: "Inspired by resilience in the face of impossible odds",
  },
  {
    archetype: "The Mentor",
    tagline: "Learning from those who've walked the path before",
  },
  {
    archetype: "The Adventurer",
    tagline: "Craving action, danger, and the thrill of the unknown",
  },
  {
    archetype: "The Introvert",
    tagline: "Finding depth in solitude and inner worlds",
  },
  {
    archetype: "The Collector",
    tagline: "Cataloging knowledge across every domain",
  },
  {
    archetype: "The Minimalist",
    tagline: "Seeking profound meaning in simple stories",
  },
  {
    archetype: "The Maximalist",
    tagline: "Reveling in sprawling epics and intricate worlds",
  },
  {
    archetype: "The Contrarian",
    tagline: "Deliberately reading against the grain",
  },
  {
    archetype: "The Nostalgic",
    tagline: "Returning to comfort reads and childhood favorites",
  },
  {
    archetype: "The Futurist",
    tagline: "Imagining what tomorrow might bring",
  },
  {
    archetype: "The Humanist",
    tagline: "Celebrating the full spectrum of human experience",
  },
  {
    archetype: "The Mystic",
    tagline: "Exploring the boundaries between known and unknown",
  },
] as const;

export function ArchetypeTicker() {
  const shouldReduceMotion = useReducedMotion();
  const [isPaused, setIsPaused] = useState(false);

  // Shuffle once on mount (useState initializer runs once)
  const [shuffled] = useState(() => [...archetypes].sort(() => Math.random() - 0.5));
  // Duplicate for seamless infinite loop
  const items = [...shuffled, ...shuffled];

  if (shouldReduceMotion) {
    return (
      <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
        {shuffled.map((item) => (
          <ArchetypeCard key={item.archetype} {...item} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div
        className={cn(
          "flex w-max gap-md pr-md",
          "animate-archetype-ticker",
          isPaused && "pause-animation",
        )}
      >
        {items.map((item, index) => (
          <ArchetypeCard
            key={`${item.archetype}-${index}`}
            {...item}
            aria-hidden={index >= shuffled.length}
          />
        ))}
      </div>
    </div>
  );
}

type ArchetypeCardProps = {
  archetype: string;
  tagline: string;
  "aria-hidden"?: boolean;
};

function ArchetypeCard({ archetype, tagline, ...rest }: ArchetypeCardProps) {
  return (
    <div
      className="flex w-[260px] flex-shrink-0 flex-col rounded-lg border border-line-ghost bg-surface-dawn p-md md:w-[320px]"
      {...rest}
    >
      <p className="font-display text-xl text-text-ink">{archetype}</p>
      <p className="mt-1 text-sm text-text-inkMuted line-clamp-2">{tagline}</p>
    </div>
  );
}
