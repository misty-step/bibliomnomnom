"use client";

import { useEffect, useState, useMemo } from "react";

type ExtractionPhase = "parsing" | "previewing" | "committing";

interface ExtractionProgressProps {
  phase: ExtractionPhase;
  booksFound?: number;
}

const LITERARY_QUOTES = [
  "A reader lives a thousand lives before he dies.",
  "Books are a uniquely portable magic.",
  "There is no friend as loyal as a book.",
  "Reading is dreaming with open eyes.",
  "The library is inhabited by spirits...",
  "Words are, of course, the most powerful drug.",
  "A book must be an ice-axe to break the frozen sea.",
  "Books may well be the only true magic.",
];

const PHASE_MESSAGES: Record<ExtractionPhase, string[]> = {
  parsing: ["Reading your file...", "Scanning pages...", "Decoding the text..."],
  previewing: [
    "Consulting the oracle...",
    "Cataloging discoveries...",
    "Extracting titles and authors...",
    "Cross-referencing the archives...",
  ],
  committing: ["Adding to your shelves...", "Filing the cards...", "Organizing the stacks..."],
};

const formatElapsed = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

export function ExtractionProgress({ phase, booksFound = 0 }: ExtractionProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  // Elapsed time counter
  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Rotate quotes every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % LITERARY_QUOTES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Rotate status messages every 4 seconds
  useEffect(() => {
    const messages = PHASE_MESSAGES[phase];
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [phase]);

  const currentMessage = PHASE_MESSAGES[phase][messageIndex % PHASE_MESSAGES[phase].length];
  const currentQuote = LITERARY_QUOTES[quoteIndex];

  // Generate book spines for animation (stable values)
  const bookSpines = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        width: 8 + ((i * 7 + 3) % 8), // Deterministic but varied
        height: 40 + ((i * 11 + 5) % 30), // Deterministic but varied
        hue: 20 + ((i * 13) % 30), // Warm browns/ambers
        delay: i * 0.15,
      })),
    [],
  );

  return (
    <div className="py-16 px-4 flex flex-col items-center justify-center space-y-8 motion-fade-in">
      {/* Animated book spines */}
      <div className="relative h-20 w-64 overflow-hidden">
        <div className="absolute inset-0 flex items-end justify-center gap-0.5">
          {bookSpines.map((spine, i) => (
            <div
              key={i}
              className="book-spine rounded-t-sm"
              style={
                {
                  width: `${spine.width}px`,
                  backgroundColor: `oklch(0.45 0.08 ${spine.hue})`,
                  animationDelay: `${spine.delay}s`,
                  "--spine-height": `${spine.height}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        {/* Shelf */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-b from-stone-600 to-stone-700 rounded-sm shadow-md" />
      </div>

      {/* Status message */}
      <div className="text-center space-y-2">
        <p className="font-display text-xl text-text-ink animate-pulse">{currentMessage}</p>
        {booksFound > 0 && (
          <p className="text-sm text-status-positive font-medium">
            {booksFound} book{booksFound !== 1 ? "s" : ""} found so far
          </p>
        )}
      </div>

      {/* Literary quote */}
      <blockquote className="max-w-sm text-center transition-opacity duration-500">
        <p className="text-sm italic text-text-inkMuted leading-relaxed">
          &ldquo;{currentQuote}&rdquo;
        </p>
      </blockquote>

      {/* Elapsed time */}
      <p className="text-xs text-text-inkSubtle tracking-wide">{formatElapsed(elapsed)} elapsed</p>

      <style jsx>{`
        .book-spine {
          height: 0;
          animation: shelve 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes shelve {
          0% {
            height: 0;
            opacity: 0;
            transform: translateY(0.625rem);
          }
          100% {
            height: var(--spine-height);
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .book-spine {
            animation: none;
            height: var(--spine-height);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
