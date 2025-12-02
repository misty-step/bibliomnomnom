"use client";

import { useQuery, type OptionalRestArgsOrSkip } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useUserProvisioning } from "@/app/ConvexClientProvider";
import { useAuth } from "./useAuth";

/**
 * Runs a Convex query only after auth is ready AND user is provisioned in DB.
 *
 * Prevents race condition where query runs before ensureUser mutation completes,
 * causing "User not found in database" errors on first login.
 */
export function useAuthedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): Query["_returnType"] | undefined {
  const { isAuthenticated } = useAuth();
  const { isProvisioned } = useUserProvisioning();
  const userRequestedSkip = args[0] === "skip";
  const shouldRun = isAuthenticated && isProvisioned && !userRequestedSkip;
  const normalizedArgs = shouldRun ? args : (["skip"] as OptionalRestArgsOrSkip<Query>);

  return useQuery(query, ...normalizedArgs);
}
