"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles, BookOpen, Camera, BarChart3, Download, Import, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Surface } from "@/components/ui/Surface";
import { Footer } from "@/components/layout/Footer";
import { useToast } from "@/hooks/use-toast";
import { useSubscriptionState, type SubscriptionState } from "@/lib/hooks/useSubscriptionState";

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

// FAQ items with visibility rules based on subscription state
const getFaqs = (state: SubscriptionState) => {
  const allFaqs = [
    {
      id: "after-trial",
      question: "What happens after the trial?",
      answer:
        "After 14 days, you'll need to subscribe to continue using bibliomnomnom. Your library and all your data remain safe—you just won't be able to access them until you subscribe.",
      // Show for unauthenticated and trialing
      showFor: ["unauthenticated", "trialing"],
    },
    {
      id: "cancel",
      question: "Can I cancel anytime?",
      answer:
        "Absolutely. Cancel with one click from your account settings. You'll keep access until the end of your billing period, and we'll never charge you again.",
      showFor: ["unauthenticated", "trialing", "trial_expired", "active", "canceled"],
    },
    {
      id: "ai-features",
      question: "What AI features are included?",
      answer:
        "You get personalized reading insights that analyze your patterns, smart recommendations based on your taste (not generic bestseller lists), and OCR note capture that lets you photograph book pages and extract quotes automatically.",
      showFor: ["unauthenticated", "trialing", "trial_expired", "active", "canceled"],
    },
    {
      id: "privacy",
      question: "Is my data private?",
      answer:
        "Your reading history is yours alone. We never sell your data, never share it with third parties, and never use it for advertising. You can export or delete everything at any time.",
      showFor: ["unauthenticated", "trialing", "trial_expired", "active", "canceled"],
    },
    {
      id: "credit-card",
      question: "Do I need a credit card to start?",
      answer:
        "No. Start your 14-day trial with just an email address. We'll only ask for payment details when you decide to subscribe.",
      // Only show for unauthenticated users
      showFor: ["unauthenticated"],
    },
  ];

  return allFaqs.filter((faq) => faq.showFor.includes(state.state));
};

// Get hero content based on subscription state
function getHeroContent(state: SubscriptionState) {
  switch (state.state) {
    case "unauthenticated":
      return {
        headline: "Your AI reading companion",
        subline: "Smart insights. Personalized recommendations. Beautiful tracking.",
      };
    case "trialing":
      return {
        headline: "Make your library permanent",
        subline: `You have ${state.daysRemaining} days left in your trial. Subscribe to keep your books.`,
      };
    case "trial_expired":
      return {
        headline: "Your shelves are waiting",
        subline: "Subscribe to regain access to your library and all your reading data.",
      };
    case "active":
      return {
        headline: "You're a member",
        subline: "Thanks for being part of bibliomnomnom. Manage your subscription below.",
      };
    case "canceled":
      return {
        headline: "We'll miss you",
        subline: `You have access until your billing period ends (${state.daysRemaining} days). Change your mind?`,
      };
    default:
      return {
        headline: "Your AI reading companion",
        subline: "Smart insights. Personalized recommendations. Beautiful tracking.",
      };
  }
}

// Pricing CTA component with state-aware rendering
function PricingCTA({ isAnnual, state }: { isAnnual: boolean; state: SubscriptionState }) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceType: isAnnual ? "annual" : "monthly" }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout.");
      }
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start checkout.";
      console.error("Checkout error:", error);
      toast({
        title: "Checkout failed",
        description: message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handlePortal = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not open billing portal.");
      }
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open billing portal.";
      console.error("Portal error:", error);
      toast({
        title: "Could not open billing portal",
        description: message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const buttonStyles =
    "mb-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-text-ink px-6 py-3 font-sans text-base text-canvas-bone transition-all hover:bg-text-inkMuted disabled:opacity-50";

  if (state.state === "loading") {
    return (
      <div className="flex flex-col items-center">
        <div className="mb-4 h-12 w-full animate-pulse rounded-md bg-text-ink/10" />
        <div className="h-4 w-48 animate-pulse rounded bg-text-ink/5" />
      </div>
    );
  }

  if (state.state === "unauthenticated") {
    return (
      <>
        <Link href="/sign-up" className={buttonStyles}>
          Get Started
        </Link>
        <p className="text-sm text-text-inkSubtle">
          No credit card required. Full access for 14 days.
        </p>
      </>
    );
  }

  if (state.state === "trialing") {
    return (
      <>
        <button onClick={handleCheckout} disabled={isLoading} className={buttonStyles}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {state.isUrgent ? "Keep Your Library" : "Subscribe"}
        </button>
        <p className="text-sm text-text-inkSubtle">
          {state.isUrgent
            ? `Only ${state.daysRemaining} days left in your trial`
            : "Make your library permanent"}
        </p>
      </>
    );
  }

  if (state.state === "trial_expired") {
    return (
      <>
        <button onClick={handleCheckout} disabled={isLoading} className={buttonStyles}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Restore Access
        </button>
        <p className="text-sm text-text-inkSubtle">Your shelves are waiting</p>
      </>
    );
  }

  if (state.state === "active") {
    return (
      <>
        <button onClick={handlePortal} disabled={isLoading} className={buttonStyles}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Manage Membership
        </button>
        <p className="text-sm text-status-positive">You&apos;re all set</p>
      </>
    );
  }

  if (state.state === "canceled") {
    return (
      <>
        <button onClick={handleCheckout} disabled={isLoading} className={buttonStyles}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Resubscribe
        </button>
        <p className="text-sm text-text-inkSubtle">
          {state.daysRemaining} days of access remaining
        </p>
      </>
    );
  }

  return null;
}

// Bottom CTA with state-aware rendering
function BottomCTA({ state }: { state: SubscriptionState }) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceType: "annual" }), // Default to annual for bottom CTA
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout.");
      }
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start checkout.";
      console.error("Checkout error:", error);
      toast({
        title: "Checkout failed",
        description: message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const buttonStyles =
    "inline-flex items-center gap-2 rounded-md bg-text-ink px-8 py-3 font-sans text-base text-canvas-bone transition-all hover:bg-text-inkMuted disabled:opacity-50";

  if (state.state === "loading") {
    return null;
  }

  if (state.state === "unauthenticated") {
    return (
      <div className="text-center">
        <p className="mb-6 text-text-inkMuted">Ready to transform your reading life?</p>
        <Link href="/sign-up" className={buttonStyles}>
          Get Started Free
        </Link>
      </div>
    );
  }

  if (state.state === "trialing") {
    return (
      <div className="text-center">
        <p className="mb-6 text-text-inkMuted">
          {state.isUrgent
            ? `Don't lose your library—only ${state.daysRemaining} days left`
            : "Love your library? Make it permanent."}
        </p>
        <button onClick={handleCheckout} disabled={isLoading} className={buttonStyles}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {state.isUrgent ? "Keep Your Library" : "Subscribe"}
        </button>
      </div>
    );
  }

  if (state.state === "trial_expired") {
    return (
      <div className="text-center">
        <p className="mb-6 text-text-inkMuted">Your books are safe and waiting for you.</p>
        <button onClick={handleCheckout} disabled={isLoading} className={buttonStyles}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Restore Access
        </button>
      </div>
    );
  }

  if (state.state === "active") {
    return (
      <div className="text-center">
        <p className="mb-6 text-status-positive">Thank you for being a member.</p>
        <Link href="/library" className={buttonStyles}>
          Go to Library
        </Link>
      </div>
    );
  }

  if (state.state === "canceled") {
    return (
      <div className="text-center">
        <p className="mb-6 text-text-inkMuted">
          Changed your mind? We&apos;d love to have you back.
        </p>
        <button onClick={handleCheckout} disabled={isLoading} className={buttonStyles}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Resubscribe
        </button>
      </div>
    );
  }

  return null;
}

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);
  const state = useSubscriptionState();

  const monthlyPrice = 15;
  const annualPrice = 129;
  const annualMonthly = Math.round(annualPrice / 12);

  const heroContent = getHeroContent(state);
  const faqs = getFaqs(state);

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
          <h1 className="text-balance font-display text-5xl tracking-tight text-text-ink md:text-6xl">
            {heroContent.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-text-inkMuted">
            {heroContent.subline}
          </p>
        </div>

        {/* Pricing Card */}
        <div className="mx-auto mb-24 max-w-md">
          {/* Billing Toggle - hide for active subscribers */}
          {state.state !== "active" && (
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
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs transition-all duration-200 ${
                    isAnnual ? "bg-text-ink text-canvas-bone" : "bg-text-ink/10 text-text-inkMuted"
                  }`}
                >
                  2 months free
                </span>
              </button>
            </div>
          )}

          <Surface elevation="raised" padding="xl" className="text-center">
            {/* Price - hide for active subscribers */}
            {state.state !== "active" && (
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
            )}

            {/* CTA */}
            <PricingCTA isAnnual={isAnnual} state={state} />
          </Surface>
        </div>

        {/* Features Grid */}
        <div className="mb-24">
          <h2 className="mb-12 text-balance text-center font-display text-3xl text-text-ink">
            Everything you need to track your reading
          </h2>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-text-ink/5">
                  <feature.icon className="size-5 text-text-ink" />
                </div>
                <div>
                  <h3 className="font-sans font-medium text-text-ink">{feature.name}</h3>
                  <p className="mt-1 text-pretty text-sm text-text-inkMuted">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section - only show if there are FAQs for this state */}
        {faqs.length > 0 && (
          <div className="mb-16">
            <h2 className="mb-8 text-balance text-center font-display text-3xl text-text-ink">
              Frequently asked questions
            </h2>

            <div className="mx-auto max-w-3xl space-y-4">
              {faqs.map((faq) => (
                <details
                  key={faq.id}
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
                  <p className="mt-4 text-pretty text-text-inkMuted">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <BottomCTA state={state} />
      </main>

      <Footer />
    </div>
  );
}
