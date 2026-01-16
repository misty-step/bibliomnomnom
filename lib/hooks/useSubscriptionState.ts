"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Discriminated union representing all possible subscription states.
 *
 * Used for context-aware UI rendering (pricing page, CTAs, banners).
 */
export type SubscriptionState =
  | { state: "loading" }
  | { state: "unauthenticated" }
  | { state: "trialing"; daysRemaining: number; isUrgent: boolean }
  | { state: "trial_expired" }
  | { state: "active" }
  | { state: "canceled"; daysRemaining: number };

/**
 * Hook to get the current user's subscription state as a discriminated union.
 *
 * Wraps Clerk auth and Convex checkAccess query into a clean state machine.
 * Useful for rendering context-aware CTAs (pricing page, trial banners, etc).
 *
 * States:
 * - loading: Auth or subscription data still loading
 * - unauthenticated: User not signed in
 * - trialing: Active trial (includes daysRemaining and isUrgent flag for <=3 days)
 * - trial_expired: Trial ended, no access
 * - active: Paid subscription active
 * - canceled: Subscription canceled but still has access until period end
 */
export function useSubscriptionState(): SubscriptionState {
  const { isSignedIn, isLoaded } = useAuth();

  // Skip Convex query if not signed in
  const accessCheck = useQuery(api.subscriptions.checkAccess, isSignedIn ? {} : "skip");

  // Still loading auth
  if (!isLoaded) {
    return { state: "loading" };
  }

  // Not signed in
  if (!isSignedIn) {
    return { state: "unauthenticated" };
  }

  // Still loading subscription data
  if (accessCheck === undefined) {
    return { state: "loading" };
  }

  // Has access - determine type
  if (accessCheck.hasAccess) {
    if (accessCheck.status === "trialing") {
      const days = accessCheck.daysRemaining ?? 0;
      return {
        state: "trialing",
        daysRemaining: days,
        isUrgent: days <= 3,
      };
    }

    if (accessCheck.status === "active") {
      return { state: "active" };
    }

    // Canceled but still has access until period end
    if (accessCheck.status === "canceled") {
      return {
        state: "canceled",
        daysRemaining: accessCheck.daysRemaining ?? 0,
      };
    }
  }

  // No access - determine reason
  if (accessCheck.reason === "trial_expired") {
    return { state: "trial_expired" };
  }

  if (accessCheck.reason === "subscription_expired") {
    return { state: "trial_expired" }; // Same UI treatment
  }

  // Fallback for edge cases (no_subscription, etc)
  // This shouldn't happen with auto-trial, but handle gracefully
  return { state: "unauthenticated" };
}
