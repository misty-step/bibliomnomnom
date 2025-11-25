"use client";

import { useQuery, type OptionalRestArgsOrSkip } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useAuth } from "./useAuth";

// Runs a Convex query only after auth is ready, preventing unauthenticated errors.
export function useAuthedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): Query["_returnType"] | undefined {
  const { isAuthenticated } = useAuth();
  const userRequestedSkip = args[0] === "skip";
  const shouldRun = isAuthenticated && !userRequestedSkip;
  const normalizedArgs = shouldRun ? args : (["skip"] as OptionalRestArgsOrSkip<Query>);

  return useQuery(query, ...normalizedArgs);
}
