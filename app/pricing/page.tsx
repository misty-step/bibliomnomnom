import Link from "next/link";
import { Check } from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Surface } from "@/components/ui/Surface";
import { Footer } from "@/components/layout/Footer";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For casual readers",
    features: [
      "Unlimited books in your library",
      "Public reader profile",
      "Basic reading insights",
      "Import from Goodreads CSV",
      "Notes and quotes",
    ],
    cta: "Get Started",
    href: "/sign-up",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$5",
    period: "/month",
    description: "For voracious readers",
    features: [
      "Everything in Free",
      "Advanced AI-powered insights",
      "Reading goals and streaks",
      "Export your data anytime",
      "Priority support",
      "Early access to new features",
    ],
    cta: "Coming Soon",
    href: null,
    highlighted: true,
    badge: "Coming Soon",
  },
];

const faqs = [
  {
    question: "Can I use bibliomnomnom for free?",
    answer:
      "Absolutely! The Free tier includes unlimited books, public profiles, and core features. We believe everyone should be able to track their reading journey without barriers.",
  },
  {
    question: "What happens to my data if I cancel Pro?",
    answer:
      "Your library and all your data remain intact. You'll simply lose access to Pro-only features like AI insights and data export. You can re-subscribe anytime to regain access.",
  },
  {
    question: "Can I export my reading data?",
    answer:
      "Pro subscribers can export their full library, reading history, notes, and insights in standard formats. We believe in data portability—your reading history is yours.",
  },
  {
    question: "What are AI-powered insights?",
    answer:
      "Pro users get personalized reading pattern analysis, book recommendations based on their taste, and insights about their reading habits over time—all powered by AI that learns your preferences.",
  },
  {
    question: "Is there a team or family plan?",
    answer:
      "Not yet, but it's on our roadmap. If you're interested in a team plan, let us know—we'd love to hear how you'd use it.",
  },
];

export default function PricingPage() {
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

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 md:px-16">
        <Link href="/" className="flex flex-col">
          <span className="font-display text-2xl text-text-ink">bibliomnomnom</span>
          <span className="text-xs text-text-inkSubtle">for voracious readers</span>
        </Link>
        <ThemeToggle />
      </nav>

      {/* Main content */}
      <main className="relative z-10 mx-auto max-w-5xl px-8 py-16 md:px-16">
        {/* Hero */}
        <div className="mb-16 text-center">
          <h1 className="font-display text-5xl tracking-tight text-text-ink md:text-6xl">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-inkMuted">
            Start free, upgrade when you&apos;re ready. No hidden fees, no surprises.
          </p>
        </div>

        {/* Tier Cards */}
        <div className="mb-24 grid gap-8 md:grid-cols-2">
          {tiers.map((tier) => (
            <Surface
              key={tier.name}
              elevation={tier.highlighted ? "raised" : "soft"}
              padding="xl"
              className={`relative flex flex-col ${tier.highlighted ? "ring-2 ring-text-ink" : ""}`}
            >
              {tier.badge && (
                <span className="absolute right-4 top-4 rounded-full bg-text-ink px-3 py-1 font-mono text-xs text-canvas-bone">
                  {tier.badge}
                </span>
              )}

              <div className="mb-6">
                <h2 className="font-display text-2xl text-text-ink">{tier.name}</h2>
                <p className="mt-1 text-sm text-text-inkMuted">{tier.description}</p>
              </div>

              <div className="mb-8">
                <span className="font-display text-5xl text-text-ink">{tier.price}</span>
                <span className="ml-1 text-text-inkMuted">{tier.period}</span>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-text-ink">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-status-positive" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {tier.href ? (
                <Link
                  href={tier.href}
                  className="inline-flex justify-center rounded-md bg-text-ink px-6 py-3 font-sans text-base text-canvas-bone transition-all hover:bg-text-inkMuted"
                >
                  {tier.cta}
                </Link>
              ) : (
                <button
                  disabled
                  className="inline-flex cursor-not-allowed justify-center rounded-md bg-text-inkSubtle px-6 py-3 font-sans text-base text-canvas-bone"
                >
                  {tier.cta}
                </button>
              )}
            </Surface>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <h2 className="mb-8 text-center font-display text-3xl text-text-ink">
            Frequently asked questions
          </h2>

          <div className="mx-auto max-w-3xl space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-lg border border-line-ghost bg-surface-dawn p-4"
              >
                <summary className="cursor-pointer list-none font-sans text-lg text-text-ink">
                  <span className="flex items-center justify-between">
                    {faq.question}
                    <span className="ml-4 text-text-inkMuted transition-transform group-open:rotate-180">
                      ↓
                    </span>
                  </span>
                </summary>
                <p className="mt-4 text-text-inkMuted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <p className="mb-6 text-text-inkMuted">Ready to track your reading journey?</p>
          <Link
            href="/sign-up"
            className="inline-flex rounded-md bg-text-ink px-8 py-3 font-sans text-base text-canvas-bone transition-all hover:bg-text-inkMuted"
          >
            Get Started for Free
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
