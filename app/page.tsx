"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function HomePage() {
  const { user, isLoaded } = useUser();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (isLoaded && user) {
      setShouldRedirect(true);
    }
  }, [isLoaded, user]);

  if (shouldRedirect) {
    window.location.href = "/library";
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas-bone">
      {/* Radial gradient background - subtle reading light */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 30% 40%, var(--color-canvas-bone) 0%, var(--color-canvas-bone-muted) 100%)",
        }}
      />

      {/* Dot pattern texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.5' fill='%231C1917'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      {/* Main content - asymmetric left alignment */}
      <div className="relative flex min-h-screen items-center">
        <div className="w-full px-8 md:px-16 lg:px-24">
          {/* Title - massive, left-aligned, 40% width on desktop */}
          <div className="mx-auto max-w-7xl">
            <div className="lg:w-2/5">
              {/* Title */}
              <h1 className="font-display text-8xl tracking-tight text-text-ink sm:text-9xl lg:text-[10rem]">
                <span className="block">bibliom</span>
                <span className="block -mt-6 sm:-mt-8 lg:-mt-12">nomnom</span>
              </h1>

              {/* Tagline as subheading */}
              <p className="mb-16 mt-8 font-mono text-sm uppercase tracking-widest text-text-inkMuted md:mb-20 md:mt-10">
                for voracious readers
              </p>

              {/* CTA */}
              <Link
                href="/sign-in"
                className="inline-flex rounded-md bg-text-ink px-8 py-3 font-sans text-base text-canvas-bone transition-all hover:bg-text-inkMuted"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Reduced motion fallback */}
      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
