"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { identifyUser, initPostHog, resetUser } from "@/lib/analytics/posthog";

type PostHogProviderProps = {
  children: ReactNode;
};

export function PostHogProvider({ children }: PostHogProviderProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && user?.id) {
      identifyUser(user.id);
      wasSignedIn.current = true;
      return;
    }

    if (wasSignedIn.current) {
      resetUser();
      wasSignedIn.current = false;
    }
  }, [isLoaded, isSignedIn, user?.id]);

  return <>{children}</>;
}
