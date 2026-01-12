"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Hook to ensure authenticated user has a trial subscription.
 *
 * Call this hook explicitly at the dashboard level to auto-enroll
 * existing users who don't have a subscription. This makes the
 * side effect visible rather than hiding it in a component.
 *
 * The hook triggers a mutation when no subscription exists. After
 * the mutation completes, the Convex query automatically updates
 * to reflect the new subscription.
 *
 * @returns Object with:
 *   - isLoading: true while checking subscription or creating trial
 */
export function useEnsureTrial() {
  const mutationTriggered = useRef(false);

  const subscription = useQuery(api.subscriptions.get);
  const ensureTrialExists = useMutation(api.subscriptions.ensureTrialExists);

  // Trigger mutation only once when we detect no subscription
  useEffect(() => {
    // Skip if still loading query
    if (subscription === undefined) return;

    // Skip if subscription exists
    if (subscription !== null) return;

    // Skip if we already triggered the mutation
    if (mutationTriggered.current) return;

    // Mark as triggered before async call to prevent double-firing
    mutationTriggered.current = true;

    // Fire and forget - Convex query will update when mutation completes
    ensureTrialExists().catch(console.error);
  }, [subscription, ensureTrialExists]);

  // Loading until subscription is loaded and not null
  // Once mutation creates subscription, Convex will update query automatically
  return {
    isLoading: subscription === undefined || subscription === null,
  };
}
