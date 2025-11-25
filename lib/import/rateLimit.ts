import type { Id } from "@/convex/_generated/dataModel";

import type { ImportRunRepository } from "./repository/interfaces";

export type RateLimitConfig = {
  dailyLimit: number;
  concurrentLimit: number;
  previewTimeoutMs: number;
};

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  dailyLimit: 5,
  concurrentLimit: 1,
  previewTimeoutMs: 15 * 60 * 1000,
};

export const shouldSkipRateLimits = (): boolean => process.env.NODE_ENV === "development";

export const checkImportRateLimits = async (
  repository: ImportRunRepository,
  userId: Id<"users">,
  config: RateLimitConfig = DEFAULT_RATE_LIMITS,
): Promise<void> => {
  const now = Date.now();
  const runs = await repository.findRecentByUser(userId, 24 * 60 * 60 * 1000);

  if (runs.length >= config.dailyLimit) {
    throw new Error("Too many imports today. Please try again tomorrow.");
  }

  const inFlight = runs.filter(
    (run) =>
      run.status === "previewed" &&
      now - (run.updatedAt ?? run._creationTime ?? 0) < config.previewTimeoutMs,
  );

  if (inFlight.length >= config.concurrentLimit) {
    throw new Error(
      "Too many concurrent imports. Finish existing imports before starting another.",
    );
  }
};
