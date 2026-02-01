"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

export function PostHogProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();

  // Initialize PostHog on mount
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        // Use reverse proxy to bypass ad blockers
        api_host: "/ingest",
        ui_host: "https://us.i.posthog.com",
        // Only create person profiles for identified users
        person_profiles: "identified_only",
        // Manual pageview tracking via PostHogPageview component
        capture_pageview: false,
        // Privacy: mask all text and inputs in session recordings
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: "*",
        },
        // Disable in development unless explicitly enabled
        loaded: (ph) => {
          if (process.env.NODE_ENV === "development") {
            ph.debug();
          }
        },
      });
    }
  }, []);

  // Identify user when auth state changes
  useEffect(() => {
    if (isSignedIn && userId) {
      posthog.identify(userId, {
        // Only include non-PII properties
        created_at: user?.createdAt?.toISOString(),
      });
    } else if (!isSignedIn) {
      posthog.reset();
    }
  }, [isSignedIn, userId, user]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
