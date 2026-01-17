"use client";

import Link from "next/link";
import { BookOpen, Sparkles } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

interface PaywallOverlayProps {
  subscription:
    | (Doc<"subscriptions"> & {
        hasAccess: boolean;
        daysRemaining: number | null;
      })
    | null;
}

/**
 * PaywallOverlay displays when user doesn't have active subscription access.
 * Shows different messaging based on whether trial expired or subscription expired.
 */
export function PaywallOverlay({ subscription }: PaywallOverlayProps) {
  const isTrialExpired = subscription?.status === "trialing";
  const isSubscriptionExpired =
    subscription?.status === "expired" || subscription?.status === "canceled";

  const title = isTrialExpired
    ? "Your free trial has ended"
    : isSubscriptionExpired
      ? "Your subscription has expired"
      : "Subscribe to access your library";

  const subtitle = isTrialExpired
    ? "Subscribe now to keep tracking your books and unlock all features."
    : "Get unlimited access to your personal library and reading insights.";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-canvas-bone/80 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-xl border border-line-ghost bg-surface-dawn p-8 text-center shadow-raised">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-dawn">
          <BookOpen className="h-8 w-8 text-accent-leather" />
        </div>

        <h2 className="mb-2 font-display text-2xl font-semibold text-text-ink">{title}</h2>

        <p className="mb-6 text-text-inkMuted">{subtitle}</p>

        <div className="space-y-3">
          <Link
            href="/pricing"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-text-ink px-6 py-3 font-medium text-canvas-bone transition-colors hover:bg-text-inkMuted"
          >
            <Sparkles className="h-4 w-4" />
            View Plans
          </Link>

          <p className="text-xs text-text-inkMuted">Plans start at $5/month. Cancel anytime.</p>
        </div>
      </div>
    </div>
  );
}
