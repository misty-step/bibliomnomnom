"use client";

import { useConvexAuth } from "convex/react";

type UseAuthResult = {
  isLoading: boolean;
  isAuthenticated: boolean;
};

export function useAuth(): UseAuthResult {
  const { isLoading, isAuthenticated } = useConvexAuth();
  return { isLoading, isAuthenticated };
}
