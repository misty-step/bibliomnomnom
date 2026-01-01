"use client";

/**
 * Loading skeleton for the profile page.
 * Mimics the hero card layout with subtle pulse animation.
 */
export function ProfileSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Hero section skeleton */}
      <section className="bg-canvas-bone">
        <div className="max-w-6xl mx-auto px-md py-2xl md:py-3xl animate-pulse">
          {/* Avatar + Name row */}
          <div className="flex items-center gap-lg mb-md">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-canvas-bone-muted" />
            <div className="h-12 w-48 bg-canvas-bone-muted rounded" />
          </div>

          {/* Tagline */}
          <div className="h-6 w-96 max-w-full bg-canvas-bone-muted rounded mb-lg" />

          {/* Divider */}
          <div className="w-16 h-px bg-canvas-bone-muted mb-md" />

          {/* Stats + Buttons row */}
          <div className="flex flex-wrap items-center gap-md">
            <div className="h-4 w-32 bg-canvas-bone-muted rounded" />
            <div className="flex gap-sm">
              <div className="h-8 w-24 bg-canvas-bone-muted rounded-full" />
              <div className="h-8 w-20 bg-canvas-bone-muted/50 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats section skeleton */}
      <section className="bg-surface-dawn border-y border-line-ghost">
        <div className="max-w-6xl mx-auto px-md py-xl animate-pulse">
          <div className="flex flex-col md:flex-row gap-xl md:gap-3xl">
            <div className="space-y-sm">
              <div className="h-4 w-32 bg-canvas-bone-muted rounded mb-md" />
              <div className="h-4 w-48 bg-canvas-bone-muted rounded" />
              <div className="h-4 w-40 bg-canvas-bone-muted rounded" />
              <div className="h-4 w-44 bg-canvas-bone-muted rounded" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Generating state - shown while AI insights are being created.
 */
export function ProfileGenerating() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-md">
      <div className="max-w-md w-full text-center">
        {/* Animated books */}
        <div className="mb-lg relative">
          <div className="inline-flex items-center justify-center w-20 h-20">
            {/* Animated page-turning effect */}
            <div className="relative w-12 h-16">
              <div className="absolute inset-0 bg-text-ink/10 rounded-r animate-pulse" />
              <div
                className="absolute inset-0 bg-text-ink/20 rounded-r animate-pulse"
                style={{ animationDelay: "0.2s" }}
              />
              <div
                className="absolute inset-0 bg-text-ink/30 rounded-r animate-pulse"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>
        </div>

        <h2 className="font-display text-2xl text-text-ink mb-sm">Analyzing your library...</h2>
        <p className="font-sans text-base text-text-ink-muted">This usually takes 30-60 seconds</p>
      </div>
    </div>
  );
}
