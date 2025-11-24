"use client";

import { useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convexUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas-bone px-6 text-center">
        <div className="space-y-3 max-w-md">
          <p className="font-display text-xl text-text-ink">Backend not configured</p>
          <p className="text-sm text-text-inkMuted">
            NEXT_PUBLIC_CONVEX_URL is missing. Add your Convex deployment URL to the Vercel environment (preview & prod)
            and redeploy.
          </p>
        </div>
      </div>
    );
  }

  const convex = new ConvexReactClient(convexUrl);

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <EnsureUser />
      {children}
    </ConvexProviderWithClerk>
  );
}

/**
 * Ensures user exists in Convex database on authentication.
 *
 * Calls ensureUser mutation when user signs in, creating user record
 * if it doesn't exist. This happens before any queries run, preventing
 * "User not found" errors.
 */
function EnsureUser() {
  const { isLoaded, isSignedIn } = useAuth();
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      ensureUser().catch((error) => {
        console.error("Failed to ensure user exists:", error);
      });
    }
  }, [isLoaded, isSignedIn, ensureUser]);

  return null;
}
