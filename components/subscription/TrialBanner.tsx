"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X } from "lucide-react";
import { useState } from "react";

/**
 * TrialBanner displays subscription status to users:
 * - No subscription: Prompt to start free trial
 * - Trialing: Show days remaining
 * - Active: No banner
 * - Expired: Show upgrade prompt (non-dismissible)
 */
export function TrialBanner() {
  const [dismissed, setDismissed] = useState(false);
  const accessCheck = useQuery(api.subscriptions.checkAccess);

  // Loading state - don't show anything
  if (accessCheck === undefined) {
    return null;
  }

  // Active subscription - no banner
  if (accessCheck.hasAccess && accessCheck.status === "active") {
    return null;
  }

  // Dismissed and not expired - don't show
  if (
    dismissed &&
    accessCheck.reason !== "trial_expired" &&
    accessCheck.reason !== "subscription_expired"
  ) {
    return null;
  }

  // No subscription - show trial prompt
  if (accessCheck.reason === "no_subscription") {
    return (
      <div className="border-b border-line-ghost/50 bg-surface-dawn">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-8 py-3">
          <p className="text-sm text-text-inkMuted">
            <span className="font-medium text-text-ink">Welcome!</span> Start your 14-day free trial
            to unlock all features.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="shrink-0 rounded-md bg-text-ink px-4 py-1.5 text-sm font-medium text-canvas-bone transition-colors hover:bg-text-inkMuted"
            >
              Get Started
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="text-text-inkMuted transition-colors hover:text-text-ink"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Trialing - show days remaining
  if (accessCheck.hasAccess && accessCheck.status === "trialing") {
    const days = accessCheck.daysRemaining ?? 0;
    const isUrgent = days <= 3;

    return (
      <div
        className={`border-b ${isUrgent ? "border-status-warning/30 bg-status-warning/5" : "border-line-ghost/50 bg-surface-dawn"}`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-8 py-3">
          <p className="text-sm text-text-inkMuted">
            <span className={`font-medium ${isUrgent ? "text-status-warning" : "text-text-ink"}`}>
              {days} {days === 1 ? "day" : "days"} left
            </span>{" "}
            in your free trial. {isUrgent && "Subscribe now to keep your library."}
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className={`shrink-0 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                isUrgent
                  ? "bg-status-warning text-white hover:bg-status-warning/90"
                  : "bg-text-ink text-canvas-bone hover:bg-text-inkMuted"
              }`}
            >
              {isUrgent ? "Keep Your Library" : "Become a Member"}
            </Link>
            {!isUrgent && (
              <button
                onClick={() => setDismissed(true)}
                className="text-text-inkMuted transition-colors hover:text-text-ink"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Expired - show lockout (non-dismissible)
  if (accessCheck.reason === "trial_expired" || accessCheck.reason === "subscription_expired") {
    return (
      <div className="border-b border-status-error/30 bg-status-error/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-8 py-3">
          <p className="text-sm text-text-inkMuted">
            <span className="font-medium text-status-error">
              {accessCheck.reason === "trial_expired"
                ? "Your trial has ended"
                : "Your subscription has expired"}
            </span>
            . Subscribe to regain access to your library.
          </p>
          <Link
            href="/pricing"
            className="shrink-0 rounded-md bg-status-error px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-status-error/90"
          >
            Restore Access
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
