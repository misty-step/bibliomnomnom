import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAuth,
  mockGetToken,
  mockAction,
  mockQuery,
  mockSetAuth,
  mockCheckoutSessionRetrieve,
  mockSubscriptionRetrieve,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetToken: vi.fn(),
  mockAction: vi.fn(),
  mockQuery: vi.fn(),
  mockSetAuth: vi.fn(),
  mockCheckoutSessionRetrieve: vi.fn(),
  mockSubscriptionRetrieve: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class MockConvexHttpClient {
    action = mockAction;
    query = mockQuery;
    setAuth = mockSetAuth;
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: mockCheckoutSessionRetrieve,
      },
    },
    subscriptions: {
      retrieve: mockSubscriptionRetrieve,
    },
  },
  stripeTimestampToMs: (ts: number) => ts * 1000,
}));

vi.mock("@/lib/stripe-utils", () => ({
  mapStripeStatus: (status: string) => {
    const map: Record<string, string> = {
      trialing: "trialing",
      active: "active",
      canceled: "canceled",
      past_due: "past_due",
    };
    return map[status] ?? "expired";
  },
}));

vi.mock("@/lib/api/withObservability", () => ({
  withObservability: (handler: (request: Request) => Promise<Response>) => handler,
  log: vi.fn(),
}));

import { POST } from "../../../app/api/stripe/checkout/confirm/route";

describe("Stripe Checkout Confirm Route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CONVEX_WEBHOOK_TOKEN: "test_webhook_token",
      NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud",
    };
    mockGetToken.mockResolvedValue("mock_convex_token");
    mockAuth.mockResolvedValue({ userId: "user_abc123", getToken: mockGetToken });
    mockQuery.mockResolvedValue({ hasAccess: true, status: "active" });
    mockAction.mockResolvedValue("sub_doc_123");
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const makeRequest = (body: Record<string, unknown>) =>
    new Request("http://localhost/api/stripe/checkout/confirm", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null, getToken: mockGetToken });

    const response = await POST(makeRequest({ sessionId: "cs_test_123" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockAction).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid session id", async () => {
    const response = await POST(makeRequest({ sessionId: "bad_session" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid sessionId." });
    expect(mockCheckoutSessionRetrieve).not.toHaveBeenCalled();
  });

  it("returns 503 when webhook token is missing", async () => {
    delete process.env.CONVEX_WEBHOOK_TOKEN;

    const response = await POST(makeRequest({ sessionId: "cs_test_123" }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Billing is temporarily unavailable. Please try again shortly.",
    });
    expect(mockAction).not.toHaveBeenCalled();
  });

  it("returns 403 when checkout session belongs to a different user", async () => {
    mockCheckoutSessionRetrieve.mockResolvedValue({
      mode: "subscription",
      metadata: { clerkId: "user_other" },
      customer: "cus_123",
      subscription: "sub_456",
    });
    mockSubscriptionRetrieve.mockResolvedValue({
      id: "sub_456",
      status: "active",
      trial_end: null,
      cancel_at_period_end: false,
      metadata: {},
      items: { data: [{ price: { id: "price_monthly" }, current_period_end: 1707523200 }] },
    });

    const response = await POST(makeRequest({ sessionId: "cs_test_123" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Checkout session does not belong to this user.",
    });
    expect(mockAction).not.toHaveBeenCalled();
  });

  it("syncs subscription and confirms access", async () => {
    mockCheckoutSessionRetrieve.mockResolvedValue({
      mode: "subscription",
      metadata: { clerkId: "user_abc123" },
      customer: "cus_123",
      subscription: "sub_456",
    });
    mockSubscriptionRetrieve.mockResolvedValue({
      id: "sub_456",
      status: "active",
      trial_end: null,
      cancel_at_period_end: false,
      metadata: { clerkId: "user_abc123" },
      items: { data: [{ price: { id: "price_monthly" }, current_period_end: 1707523200 }] },
    });

    const response = await POST(makeRequest({ sessionId: "cs_test_123" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      synced: true,
      hasAccess: true,
      status: "active",
    });

    expect(mockAction).toHaveBeenCalledWith(expect.anything(), {
      webhookToken: "test_webhook_token",
      clerkId: "user_abc123",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_456",
      status: "active",
      priceId: "price_monthly",
      currentPeriodEnd: 1707523200000,
      trialEndsAt: undefined,
      cancelAtPeriodEnd: false,
    });
    expect(mockSetAuth).toHaveBeenCalledWith("mock_convex_token");
    expect(mockQuery).toHaveBeenCalledWith(expect.anything());
  });
});
