import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Hoist mock functions
const {
  mockQuery,
  mockCreate,
  mockAuth,
  mockCurrentUser,
  mockSetAuth,
  mockGetToken,
  mockRateLimit,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockCreate: vi.fn(),
  mockAuth: vi.fn(),
  mockCurrentUser: vi.fn(),
  mockSetAuth: vi.fn(),
  mockGetToken: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class MockConvexHttpClient {
    query = mockQuery;
    setAuth = mockSetAuth;
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  currentUser: mockCurrentUser,
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: mockCreate,
      },
    },
  },
  PRICES: {
    monthly: "price_monthly_123",
    annual: "price_annual_456",
  },
  TRIAL_DAYS: 14,
  getBaseUrl: () => "https://bibliomnomnom.com",
}));

vi.mock("@/lib/api/withObservability", () => ({
  withObservability: (handler: Function) => handler,
}));

// Mock rate limiter to always allow requests in tests
vi.mock("@/lib/api/rateLimit", () => ({
  rateLimit: mockRateLimit,
}));

import { POST } from "../../../app/api/stripe/checkout/route";

describe("Stripe Checkout Route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Default: rate limit allows requests
    mockRateLimit.mockReturnValue({ success: true, remaining: 4, resetMs: 3600000 });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const makeRequest = (body: object = { priceType: "monthly" }) =>
    new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

  describe("successful checkout", () => {
    beforeEach(() => {
      mockGetToken.mockResolvedValue("mock_convex_token");
      mockAuth.mockResolvedValue({ userId: "clerk_user_123", getToken: mockGetToken });
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: "user@example.com" }],
      });
    });

    it("creates checkout session for new user with monthly price", async () => {
      mockQuery.mockResolvedValue(null); // No existing subscription
      mockCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/session_123",
      });

      const response = await POST(makeRequest({ priceType: "monthly" }));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.url).toBe("https://checkout.stripe.com/session_123");

      expect(mockCreate).toHaveBeenCalledWith({
        customer: undefined,
        customer_email: "user@example.com",
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: "price_monthly_123",
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            clerkId: "clerk_user_123",
          },
        },
        success_url: "https://bibliomnomnom.com/library?checkout=success",
        cancel_url: "https://bibliomnomnom.com/pricing?checkout=canceled",
        metadata: {
          clerkId: "clerk_user_123",
        },
      });
    });

    it("creates checkout session with annual price", async () => {
      mockQuery.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/session_123",
      });

      const response = await POST(makeRequest({ priceType: "annual" }));

      expect(response.status).toBe(200);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price: "price_annual_456",
              quantity: 1,
            },
          ],
        }),
      );
    });

    it("defaults to annual if priceType invalid", async () => {
      mockQuery.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

      await POST(makeRequest({ priceType: "invalid" }));

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: "price_annual_456", quantity: 1 }],
        }),
      );
    });

    it("uses existing Stripe customer ID if available", async () => {
      mockQuery.mockResolvedValue({
        stripeCustomerId: "cus_existing_123",
      });
      mockCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/session_123",
      });

      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_existing_123",
          customer_email: undefined, // Not set when customer exists
        }),
      );
    });
  });

  describe("authentication errors", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null, getToken: mockGetToken });

      const response = await POST(makeRequest());

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 401 when Convex auth token is missing", async () => {
      mockGetToken.mockResolvedValue(null);
      mockAuth.mockResolvedValue({ userId: "clerk_user_123", getToken: mockGetToken });
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: "user@example.com" }],
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await POST(makeRequest());

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Authentication token missing" });
      expect(mockCreate).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("returns 400 when user has no email", async () => {
      mockGetToken.mockResolvedValue("mock_convex_token");
      mockAuth.mockResolvedValue({ userId: "clerk_user_123", getToken: mockGetToken });
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [],
      });

      const response = await POST(makeRequest());

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "User email not found" });
    });

    it("returns 400 when user object is null", async () => {
      mockGetToken.mockResolvedValue("mock_convex_token");
      mockAuth.mockResolvedValue({ userId: "clerk_user_123", getToken: mockGetToken });
      mockCurrentUser.mockResolvedValue(null);

      const response = await POST(makeRequest());

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "User email not found" });
    });
  });

  describe("request validation", () => {
    beforeEach(() => {
      mockGetToken.mockResolvedValue("mock_convex_token");
      mockAuth.mockResolvedValue({ userId: "clerk_user_123", getToken: mockGetToken });
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: "user@example.com" }],
      });
    });

    it("returns 400 for invalid JSON body", async () => {
      const request = new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid request body" });
    });
  });

  describe("rate limiting", () => {
    beforeEach(() => {
      mockGetToken.mockResolvedValue("mock_convex_token");
      mockAuth.mockResolvedValue({ userId: "clerk_user_123", getToken: mockGetToken });
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: "user@example.com" }],
      });
    });

    it("returns 429 when rate limit exceeded", async () => {
      mockRateLimit.mockReturnValue({ success: false, remaining: 0, resetMs: 3600000 });

      const response = await POST(makeRequest());

      expect(response.status).toBe(429);
      expect(await response.json()).toEqual({
        error: "Too many checkout attempts. Please try again later.",
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("calls rateLimit with correct key", async () => {
      mockQuery.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

      await POST(makeRequest());

      expect(mockRateLimit).toHaveBeenCalledWith("checkout:clerk_user_123", {
        limit: 5,
        windowMs: 60 * 60 * 1000,
      });
    });
  });

  describe("Stripe errors", () => {
    beforeEach(() => {
      mockGetToken.mockResolvedValue("mock_convex_token");
      mockAuth.mockResolvedValue({ userId: "clerk_user_123", getToken: mockGetToken });
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: "user@example.com" }],
      });
      mockQuery.mockResolvedValue(null);
    });

    it("returns 500 when Stripe API fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockCreate.mockRejectedValue(new Error("Stripe API error"));

      const response = await POST(makeRequest());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Stripe API error" });

      consoleSpy.mockRestore();
    });

    it("returns generic error message for non-Error throws", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockCreate.mockRejectedValue("string error");

      const response = await POST(makeRequest());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "Failed to create checkout session",
      });

      consoleSpy.mockRestore();
    });
  });
});
