// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { requireListeningSessionEntitlement } from "@/lib/listening-sessions/entitlements";

const queryMock = vi.hoisted(() => vi.fn());
const mutationMock = vi.hoisted(() => vi.fn());
const setAuthMock = vi.hoisted(() => vi.fn());

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class MockConvexHttpClient {
    setAuth = setAuthMock;
    query = queryMock;
    mutation = mutationMock;
    constructor(_url: string) {}
  },
}));

vi.mock("@/lib/api/withObservability", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/api/withObservability")>();
  return { ...mod, log: vi.fn() };
});

const originalConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

describe("listening sessions entitlements", () => {
  it("returns 503 when Convex URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;

    const res = await requireListeningSessionEntitlement({
      requestId: "req-1",
      clerkId: "user_123",
      getToken: vi.fn().mockResolvedValue("token"),
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(503);
      expect(res.error).toMatch("temporarily unavailable");
    }
  });

  it("returns 401 when Clerk token is missing", async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";

    const res = await requireListeningSessionEntitlement({
      requestId: "req-2",
      clerkId: "user_123",
      getToken: vi.fn().mockResolvedValue(null),
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(401);
      expect(res.error).toBe("Authentication token missing.");
    }
  });

  it("returns 402 when access is denied", async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    queryMock.mockResolvedValueOnce({ hasAccess: false, reason: "subscription_expired" });

    const res = await requireListeningSessionEntitlement({
      requestId: "req-3",
      clerkId: "user_123",
      getToken: vi.fn().mockResolvedValue("token"),
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(402);
      expect(res.error).toBe("Subscription required to use voice sessions.");
    }
  });

  it("attempts to create a trial when no subscription exists", async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    queryMock
      .mockResolvedValueOnce({ hasAccess: false, reason: "no_subscription" })
      .mockResolvedValueOnce({ hasAccess: true, status: "trialing" });
    mutationMock.mockResolvedValueOnce({});

    const res = await requireListeningSessionEntitlement({
      requestId: "req-4",
      clerkId: "user_123",
      getToken: vi.fn().mockResolvedValue("token"),
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.convex).toBeTruthy();
    }
    expect(mutationMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("returns 429 when rate limited", async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    queryMock.mockResolvedValueOnce({ hasAccess: true, status: "active" });
    mutationMock.mockResolvedValueOnce({ success: false });

    const res = await requireListeningSessionEntitlement({
      requestId: "req-5",
      clerkId: "user_123",
      getToken: vi.fn().mockResolvedValue("token"),
      rateLimit: {
        key: "listening-sessions:test",
        limit: 1,
        windowMs: 1000,
        errorMessage: "rate limited",
      },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(429);
      expect(res.error).toBe("rate limited");
    }
  });

  it("returns convex client when rate limit passes", async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    queryMock.mockResolvedValueOnce({ hasAccess: true, status: "active" });
    mutationMock.mockResolvedValueOnce({ success: true });

    const res = await requireListeningSessionEntitlement({
      requestId: "req-6",
      clerkId: "user_123",
      getToken: vi.fn().mockResolvedValue("token"),
      rateLimit: {
        key: "listening-sessions:test",
        limit: 10,
        windowMs: 1000,
      },
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.convex).toBeTruthy();
    }
  });
});

afterEach(() => {
  if (originalConvexUrl === undefined) {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
  } else {
    process.env.NEXT_PUBLIC_CONVEX_URL = originalConvexUrl;
  }

  queryMock.mockReset();
  mutationMock.mockReset();
  setAuthMock.mockReset();
  vi.restoreAllMocks();
});
