"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation } from "convex/react";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/convex/_generated/api";
import { useAuth as useAppAuth } from "@/lib/hooks/useAuth";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

/**
 * Custom auth adapter for Convex that uses @clerk/nextjs instead of @clerk/clerk-react.
 *
 * In Next.js 16, @clerk/clerk-react hooks fail during hydration because they expect
 * a different provider context. This adapter wraps @clerk/nextjs's SSR-safe useAuth
 * to provide the exact interface ConvexProviderWithClerk expects.
 */
function useClerkNextjsAuth() {
  const { isLoaded, isSignedIn, getToken, orgId, orgRole } = useAuth();

  // Wrap getToken to ensure type compatibility
  const wrappedGetToken = useCallback(
    async (options: { template?: "convex"; skipCache?: boolean }) => {
      try {
        const token = await getToken(options);
        return token ?? null;
      } catch {
        return null;
      }
    },
    [getToken],
  );

  return useMemo(
    () => ({
      isLoaded,
      isSignedIn,
      getToken: wrappedGetToken,
      orgId,
      orgRole,
    }),
    [isLoaded, isSignedIn, wrappedGetToken, orgId, orgRole],
  );
}

// Context to track user provisioning status in Convex database
const UserProvisioningContext = createContext<{ isProvisioned: boolean }>({
  isProvisioned: false,
});

export function useUserProvisioning() {
  return useContext(UserProvisioningContext);
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convexUrl || !convex) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas-bone px-6 text-center">
        <div className="space-y-3 max-w-md">
          <p className="font-display text-xl text-text-ink">Backend not configured</p>
          <p className="text-sm text-text-inkMuted">
            NEXT_PUBLIC_CONVEX_URL is missing. Add your Convex deployment URL to the Vercel
            environment (preview & prod) and redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useClerkNextjsAuth}>
      <UserProvisioningProvider>{children}</UserProvisioningProvider>
    </ConvexProviderWithClerk>
  );
}

/**
 * Ensures user exists in Convex database before any queries run.
 *
 * Tracks provisioning state so useAuthedQuery can skip queries until
 * the user record exists, preventing "User not found" race conditions
 * on first login.
 */
function UserProvisioningProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAppAuth();
  const ensureUser = useMutation(api.users.ensureUser);
  const [isProvisioned, setIsProvisioned] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isProvisioned) {
      ensureUser()
        .then(() => setIsProvisioned(true))
        .catch((error) => {
          console.error("Failed to ensure user exists:", error);
        });
    }
    // Reset on logout
    if (!isLoading && !isAuthenticated && isProvisioned) {
      setIsProvisioned(false);
    }
  }, [isLoading, isAuthenticated, isProvisioned, ensureUser]);

  return (
    <UserProvisioningContext.Provider value={{ isProvisioned }}>
      {children}
    </UserProvisioningContext.Provider>
  );
}
