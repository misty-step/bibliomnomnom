import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Brain, Download, Globe, Quote } from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ArchetypeCarousel } from "@/components/landing/ArchetypeCarousel";
import { CTAButton } from "@/components/landing/CTAButton";

export default async function HomePage() {
  const user = await currentUser();

  if (user) {
    redirect("/library");
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
        className="pointer-events-none absolute inset-0 opacity-25 bg-text-ink"
        style={{
          maskImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.5' fill='black'/%3E%3C/svg%3E")`,
          maskRepeat: "repeat",
          WebkitMaskImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.5' fill='black'/%3E%3C/svg%3E")`,
          WebkitMaskRepeat: "repeat",
        }}
      />

      {/* Navigation - Top Right */}
      <nav className="absolute right-6 top-6 z-10 flex items-center gap-4" aria-label="Main">
        <ThemeToggle />
      </nav>

      {/* Main content - asymmetric left alignment */}
      <main className="relative">
        <section className="relative flex min-h-screen items-center">
          <div className="w-full px-md md:px-lg lg:px-24">
            {/* Title - massive, left-aligned, 40% width on desktop */}
            <div className="mx-auto max-w-7xl">
              <div className="lg:w-2/5">
                {/* Title */}
                <h1
                  className="font-display text-8xl tracking-tight text-text-ink sm:text-9xl lg:text-[10rem]"
                  aria-label="bibliomnomnom"
                >
                  <span className="block">bibliom</span>
                  <span className="block -mt-6 sm:-mt-8 lg:-mt-12">nomnom</span>
                </h1>

                <div className="mt-8 space-y-3 md:mt-10">
                  {/* Tagline as subheading */}
                  <p className="font-mono text-sm uppercase tracking-widest text-text-inkMuted">
                    for voracious readers
                  </p>
                  <p className="font-sans text-lg text-text-inkMuted">
                    AI-powered insights for voracious readers
                  </p>
                </div>

                {/* CTA */}
                <div className="mt-12 md:mt-14">
                  <CTAButton href="/sign-in" location="hero">
                    Get Started
                  </CTAButton>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative">
          <div className="mx-auto max-w-6xl px-md py-2xl">
            <div className="grid gap-lg md:grid-cols-2">
              <div className="rounded-lg border border-line-ghost bg-surface-dawn p-lg">
                <div className="flex items-start gap-md">
                  <div className="rounded-md border border-line-ghost bg-canvas-bone p-2">
                    <Brain className="h-5 w-5 text-text-ink" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-xl text-text-ink">Reader Profile</h3>
                    <p className="text-sm text-text-inkMuted">
                      AI-generated insights reveal your reading identity
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-line-ghost bg-surface-dawn p-lg">
                <div className="flex items-start gap-md">
                  <div className="rounded-md border border-line-ghost bg-canvas-bone p-2">
                    <Download className="h-5 w-5 text-text-ink" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-xl text-text-ink">Import Library</h3>
                    <p className="text-sm text-text-inkMuted">
                      Bring your Goodreads history in seconds
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-line-ghost bg-surface-dawn p-lg">
                <div className="flex items-start gap-md">
                  <div className="rounded-md border border-line-ghost bg-canvas-bone p-2">
                    <Quote className="h-5 w-5 text-text-ink" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-xl text-text-ink">Notes & Quotes</h3>
                    <p className="text-sm text-text-inkMuted">Capture thoughts while you read</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-line-ghost bg-surface-dawn p-lg">
                <div className="flex items-start gap-md">
                  <div className="rounded-md border border-line-ghost bg-canvas-bone p-2">
                    <Globe className="h-5 w-5 text-text-ink" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-xl text-text-ink">Public Shelf</h3>
                    <p className="text-sm text-text-inkMuted">
                      Share your collection with the world
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative">
          <div className="mx-auto max-w-6xl px-md py-2xl">
            <div className="space-y-lg">
              <div>
                <h2 className="font-display text-3xl text-text-ink">What Your Profile Reveals</h2>
              </div>
              <ArchetypeCarousel />
            </div>
          </div>
        </section>

        <section className="relative">
          <div className="mx-auto max-w-6xl px-md py-2xl">
            <div className="flex flex-col items-start gap-md rounded-lg border border-line-ghost bg-canvas-bone p-lg">
              <h2 className="font-display text-3xl text-text-ink">
                Ready to discover your reader identity?
              </h2>
              <CTAButton href="/sign-in" location="closing">
                Build Your Reader Profile
              </CTAButton>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
