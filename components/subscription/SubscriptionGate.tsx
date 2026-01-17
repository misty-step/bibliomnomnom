"use client";

import { type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEnsureTrial } from "@/lib/hooks/useEnsureTrial";
import { PaywallOverlay } from "./PaywallOverlay";

interface SubscriptionGateProps {
  children: ReactNode;
}

/**
 * SubscriptionGate enforces subscription access for protected content.
 *
 * Responsibilities (single responsibility principle):
 * 1. useEnsureTrial hook - handles trial creation side effect (explicit)
 * 2. This component - renders content or paywall based on access (pure)
 *
 * Shows PaywallOverlay if user doesn't have access.
 * Shows loading spinner while checking subscription status.
 */
export function SubscriptionGate({ children }: SubscriptionGateProps) {
  // Explicit side effect: ensure trial exists for existing users
  const { isLoading: isEnsuringTrial } = useEnsureTrial();

  // Pure query: get current subscription status
  const subscription = useQuery(api.subscriptions.get);

  // Loading state - either ensuring trial or loading subscription
  if (isEnsuringTrial || subscription === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-ghost border-t-text-ink" />
      </div>
    );
  }

  // Access check - pure rendering logic
  const hasAccess = subscription?.hasAccess ?? false;

  if (!hasAccess) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none blur-sm">{children}</div>
        <PaywallOverlay subscription={subscription} />
      </div>
    );
  }

  return <>{children}</>;
}
