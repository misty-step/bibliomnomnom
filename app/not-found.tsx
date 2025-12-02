import Link from "next/link";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas-bone">
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
        className="pointer-events-none absolute inset-0 bg-text-ink opacity-25"
        style={{
          maskImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.5' fill='black'/%3E%3C/svg%3E")`,
          maskRepeat: "repeat",
          WebkitMaskImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.5' fill='black'/%3E%3C/svg%3E")`,
          WebkitMaskRepeat: "repeat",
        }}
      />

      {/* Theme Toggle - Top Right */}
      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>

      {/* Main content - centered */}
      <div className="relative z-10 text-center">
        {/* MASSIVE 404 */}
        <h1 className="font-display text-[12rem] leading-none tracking-tighter text-text-ink sm:text-[16rem] lg:text-[20rem]">
          404
        </h1>

        {/* Understated copy */}
        <p className="mb-16 mt-12 text-lg text-text-inkMuted">
          This page isn&apos;t in our collection
        </p>

        {/* CTA button - match landing page style */}
        <Link
          href="/library"
          className="inline-flex rounded-md bg-text-ink px-8 py-3 font-sans text-base text-canvas-bone transition-all hover:bg-text-inkMuted"
        >
          Return to Library
        </Link>
      </div>
    </div>
  );
}
