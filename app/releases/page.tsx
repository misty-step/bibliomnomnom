import { Metadata } from "next";
import Link from "next/link";
import { ReleasesList } from "./ReleasesList";
import { getReleases } from "./lib";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Footer } from "@/components/layout/Footer";
import { Rss } from "lucide-react";

export const metadata: Metadata = {
  title: "Releases | bibliomnomnom",
  description: "See what's new in bibliomnomnom - the book tracker for voracious readers",
};

// Revalidate every hour
export const revalidate = 3600;

export default async function ReleasesPage() {
  const releases = await getReleases();

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas-bone">
      {/* Radial gradient background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 30% 40%, var(--color-canvas-bone) 0%, var(--color-canvas-bone-muted) 100%)",
        }}
      />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 md:px-16">
        <Link href="/" className="flex flex-col">
          <span className="font-display text-2xl text-text-ink">bibliomnomnom</span>
          <span className="text-xs text-text-inkSubtle">for voracious readers</span>
        </Link>
        <ThemeToggle />
      </nav>

      {/* Main content */}
      <main className="relative z-10 mx-auto max-w-3xl px-8 py-16 md:px-16">
        <header className="mb-12 text-center">
          <h1 className="text-balance font-display text-5xl tracking-tight text-text-ink md:text-6xl">
            Releases
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-text-inkMuted">
            Every update to your reading companion, documented.
          </p>
          <a
            href="/releases/rss"
            className="mt-4 inline-flex items-center gap-2 text-sm text-text-inkSubtle hover:text-text-ink transition-colors"
          >
            <Rss className="h-4 w-4" />
            Subscribe via RSS
          </a>
        </header>

        {releases.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-text-ink/5">
              <span className="text-3xl">📚</span>
            </div>
            <h2 className="font-display text-xl text-text-ink mb-2">No releases yet</h2>
            <p className="text-text-inkMuted max-w-md mx-auto">
              We&apos;re just getting started. Check back soon for updates, or subscribe to the RSS
              feed to be notified.
            </p>
          </div>
        ) : (
          <ReleasesList releases={releases} />
        )}
      </main>

      <Footer />
    </div>
  );
}
