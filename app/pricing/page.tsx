"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Sparkles, BookOpen, Camera, BarChart3, Download, Import } from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Surface } from "@/components/ui/Surface";
import { Footer } from "@/components/layout/Footer";

const features = [
  {
    icon: Sparkles,
    name: "AI Reading Insights",
    description: "Personalized analysis of your reading patterns and habits",
  },
  {
    icon: BookOpen,
    name: "Smart Recommendations",
    description: "AI-powered book suggestions based on your taste",
  },
  {
    icon: Camera,
    name: "OCR Note Capture",
    description: "Photograph pages and extract quotes automatically",
  },
  {
    icon: BarChart3,
    name: "Reading Analytics",
    description: "Track your progress with beautiful visualizations",
  },
  {
    icon: Import,
    name: "Goodreads Import",
    description: "Bring your entire reading history in seconds",
  },
  {
    icon: Download,
    name: "Export Your Data",
    description: "Your library is yours—download anytime",
  },
];

const faqs = [
  {
    question: "What happens after the trial?",
    answer:
      "After 14 days, you'll need to subscribe to continue using bibliomnomnom. Your library and all your data remain safe—you just won't be able to access them until you subscribe.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. Cancel with one click from your account settings. You'll keep access until the end of your billing period, and we'll never charge you again.",
  },
  {
    question: "What AI features are included?",
    answer:
      "You get personalized reading insights that analyze your patterns, smart recommendations based on your taste (not generic bestseller lists), and OCR note capture that lets you photograph book pages and extract quotes automatically.",
  },
  {
    question: "Is my data private?",
    answer:
      "Your reading history is yours alone. We never sell your data, never share it with third parties, and never use it for advertising. You can export or delete everything at any time.",
  },
  {
    question: "Do I need a credit card to start?",
    answer:
      "No. Start your 14-day trial with just an email address. We'll only ask for payment details when you decide to subscribe.",
  },
];

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);

  const monthlyPrice = 15;
  const annualPrice = 129;
  const annualMonthly = Math.round(annualPrice / 12);

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
            Your AI reading companion
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-inkMuted">
            Smart insights. Personalized recommendations. Beautiful tracking.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="mx-auto mb-24 max-w-md">
          {/* Billing Toggle */}
          <div className="mb-8 flex items-center justify-center gap-4">
            <button
              onClick={() => setIsAnnual(false)}
              className={`font-mono text-sm transition-colors ${
                !isAnnual ? "text-text-ink" : "text-text-inkMuted hover:text-text-ink"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative h-6 w-11 rounded-full bg-text-inkSubtle transition-colors"
              aria-label={isAnnual ? "Switch to monthly billing" : "Switch to annual billing"}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-canvas-bone shadow-sm transition-transform ${
                  isAnnual ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`font-mono text-sm transition-colors ${
                isAnnual ? "text-text-ink" : "text-text-inkMuted hover:text-text-ink"
              }`}
            >
              Annual
              <span className="ml-2 rounded-full bg-status-positive/10 px-2 py-0.5 text-xs text-status-positive">
                2 months free
              </span>
            </button>
          </div>

          <Surface elevation="raised" padding="xl" className="text-center">
            {/* Price */}
            <div className="mb-6">
              {isAnnual ? (
                <>
                  <span className="font-display text-6xl text-text-ink">${annualPrice}</span>
                  <span className="ml-2 text-text-inkMuted">/year</span>
                  <p className="mt-2 text-sm text-text-inkMuted">
                    ${annualMonthly}/month, billed annually
                  </p>
                </>
              ) : (
                <>
                  <span className="font-display text-6xl text-text-ink">${monthlyPrice}</span>
                  <span className="ml-2 text-text-inkMuted">/month</span>
                </>
              )}
            </div>

            {/* CTA */}
            <Link
              href="/sign-up"
              className="mb-4 inline-flex w-full justify-center rounded-md bg-text-ink px-6 py-3 font-sans text-base text-canvas-bone transition-all hover:bg-text-inkMuted"
            >
              Start 14-day free trial
            </Link>

            <p className="text-sm text-text-inkSubtle">
              No credit card required. Full access for 14 days.
            </p>
          </Surface>
        </div>

        {/* Features Grid */}
        <div className="mb-24">
          <h2 className="mb-12 text-center font-display text-3xl text-text-ink">
            Everything you need to track your reading
          </h2>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-text-ink/5">
                  <feature.icon className="h-5 w-5 text-text-ink" />
                </div>
                <div>
                  <h3 className="font-sans font-medium text-text-ink">{feature.name}</h3>
                  <p className="mt-1 text-sm text-text-inkMuted">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
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
          <p className="mb-6 text-text-inkMuted">Ready to transform your reading life?</p>
          <Link
            href="/sign-up"
            className="inline-flex rounded-md bg-text-ink px-8 py-3 font-sans text-base text-canvas-bone transition-all hover:bg-text-inkMuted"
          >
            Start Your Free Trial
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
