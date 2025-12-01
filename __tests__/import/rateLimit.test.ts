import { describe, expect, it, vi } from "vitest";

import { checkImportRateLimits, shouldSkipRateLimits } from "../../lib/import/rateLimit";
import type { ImportRunRepository } from "../../lib/import/repository/interfaces";
import type { Id } from "../../convex/_generated/dataModel";

const fakeId = (id: string) => id as Id<"users">;

describe("shouldSkipRateLimits", () => {
  it("returns true in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(shouldSkipRateLimits()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns false in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(shouldSkipRateLimits()).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("checkImportRateLimits", () => {
  const userId = fakeId("user1");
  const mockRepo = {
    findRecentByUser: vi.fn(),
    findByUserAndRun: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  } as unknown as ImportRunRepository;

  it("throws when daily limit exceeded", async () => {
    mockRepo.findRecentByUser = vi.fn().mockResolvedValue(Array(5).fill({}));

    await expect(
      checkImportRateLimits(mockRepo, userId, {
        dailyLimit: 5,
        concurrentLimit: 1,
        previewTimeoutMs: 1000,
      }),
    ).rejects.toThrow("Too many imports today");
  });

  it("throws when concurrent limit exceeded", async () => {
    const now = Date.now();
    mockRepo.findRecentByUser = vi
      .fn()
      .mockResolvedValue([{ status: "previewed", updatedAt: now, _creationTime: now }]);

    await expect(
      checkImportRateLimits(mockRepo, userId, {
        dailyLimit: 5,
        concurrentLimit: 1,
        previewTimeoutMs: 10000,
      }),
    ).rejects.toThrow("Too many concurrent imports");
  });

  it("allows if under limits", async () => {
    mockRepo.findRecentByUser = vi.fn().mockResolvedValue([]);

    await expect(
      checkImportRateLimits(mockRepo, userId, {
        dailyLimit: 5,
        concurrentLimit: 1,
        previewTimeoutMs: 1000,
      }),
    ).resolves.not.toThrow();
  });

  it("ignores stale concurrent imports", async () => {
    const now = Date.now();
    // Stale import (older than timeout)
    mockRepo.findRecentByUser = vi
      .fn()
      .mockResolvedValue([
        { status: "previewed", updatedAt: now - 20000, _creationTime: now - 20000 },
      ]);

    await expect(
      checkImportRateLimits(mockRepo, userId, {
        dailyLimit: 5,
        concurrentLimit: 1,
        previewTimeoutMs: 10000,
      }),
    ).resolves.not.toThrow();
  });
});
