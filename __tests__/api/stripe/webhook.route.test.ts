import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Hoist mock functions
const { mockAction, mockQuery, mockMutation, mockSubscriptionsRetrieve, mockConstructEvent } =
  vi.hoisted(() => ({
    mockAction: vi.fn(),
    mockQuery: vi.fn(),
    mockMutation: vi.fn(),
    mockSubscriptionsRetrieve: vi.fn(),
    mockConstructEvent: vi.fn(),
  }));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class MockConvexHttpClient {
    action = mockAction;
    query = mockQuery;
    mutation = mockMutation;
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
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

import { POST } from "../../../app/api/stripe/webhook/route";

describe("Stripe Webhook Route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      STRIPE_WEBHOOK_SECRET: "whsec_test",
      CONVEX_WEBHOOK_TOKEN: "test_webhook_token",
    };
    // Default: event not yet processed (idempotency)
    mockQuery.mockResolvedValue(false);
    mockMutation.mockResolvedValue({ _id: "event_123" });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const makeRequest = (body = "{}") =>
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body,
      headers: {
        "stripe-signature": "t=1234567890,v1=sig",
      },
    });

  describe("checkout.session.completed", () => {
    it("creates subscription from checkout session with trial", async () => {
      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            metadata: { clerkId: "user_abc123" },
            customer: "cus_123",
            subscription: "sub_456",
          },
        },
      };

      mockConstructEvent.mockReturnValue(event);
      mockSubscriptionsRetrieve.mockResolvedValue({
        id: "sub_456",
        status: "trialing",
        trial_end: 1704240000, // 14 days from now
        cancel_at_period_end: false,
        items: {
          data: [
            {
              price: { id: "price_monthly" },
              current_period_end: 1704844800,
            },
          ],
        },
      });

      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith("sub_456");
      expect(mockAction).toHaveBeenCalledWith(
        expect.anything(), // api.subscriptions.upsertFromWebhook
        {
          webhookToken: "test_webhook_token",
          clerkId: "user_abc123",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_456",
          status: "trialing",
          priceId: "price_monthly",
          currentPeriodEnd: 1704844800000,
          trialEndsAt: 1704240000000,
          cancelAtPeriodEnd: false,
        },
      );
    });

    it("ignores non-subscription checkout sessions", async () => {
      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "payment", // One-time payment, not subscription
            metadata: { clerkId: "user_abc123" },
          },
        },
      };

      mockConstructEvent.mockReturnValue(event);

      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      expect(mockAction).not.toHaveBeenCalled();
    });

    it("logs error when clerkId missing from metadata", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            metadata: {}, // No clerkId
            customer: "cus_123",
            subscription: "sub_456",
          },
        },
      };

      mockConstructEvent.mockReturnValue(event);

      const response = await POST(makeRequest());

      expect(response.status).toBe(200); // Still returns 200 to avoid Stripe retries
      // Verify structured error log
      const calls = consoleSpy.mock.calls;
      const errorLog = calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.msg === "stripe_webhook_missing_clerk_id";
        } catch {
          return false;
        }
      });
      expect(errorLog).toBeDefined();
      expect(mockAction).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("customer.subscription.updated", () => {
    it("updates subscription status", async () => {
      const event = {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_456",
            customer: "cus_123",
            status: "active",
            trial_end: null,
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  price: { id: "price_monthly" },
                  current_period_end: 1707523200,
                },
              ],
            },
          },
        },
      };

      mockConstructEvent.mockReturnValue(event);

      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      expect(mockAction).toHaveBeenCalledWith(
        expect.anything(), // api.subscriptions.updateByStripeCustomer
        {
          webhookToken: "test_webhook_token",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_456",
          status: "active",
          priceId: "price_monthly",
          currentPeriodEnd: 1707523200000,
          trialEndsAt: undefined,
          cancelAtPeriodEnd: false,
        },
      );
    });

    it("handles subscription cancellation scheduled", async () => {
      const event = {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_456",
            customer: "cus_123",
            status: "active",
            cancel_at_period_end: true, // Canceling at end of period
            items: {
              data: [
                {
                  price: { id: "price_annual" },
                  current_period_end: 1735689600,
                },
              ],
            },
          },
        },
      };

      mockConstructEvent.mockReturnValue(event);

      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      expect(mockAction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          webhookToken: "test_webhook_token",
          cancelAtPeriodEnd: true,
          status: "active", // Still active until period ends
        }),
      );
    });
  });

  describe("customer.subscription.deleted", () => {
    it("marks subscription as expired", async () => {
      const event = {
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_456",
            customer: "cus_123",
          },
        },
      };

      mockConstructEvent.mockReturnValue(event);

      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      expect(mockAction).toHaveBeenCalledWith(
        expect.anything(), // api.subscriptions.updateByStripeCustomer
        {
          webhookToken: "test_webhook_token",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_456",
          status: "expired",
          cancelAtPeriodEnd: false,
        },
      );
    });
  });

  describe("invoice events", () => {
    it("handles invoice.payment_succeeded (logging only)", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const event = {
        type: "invoice.payment_succeeded",
        data: {
          object: { id: "inv_123" },
        },
      };

      mockConstructEvent.mockReturnValue(event);

      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      const calls = consoleSpy.mock.calls;
      const successLog = calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.msg === "stripe_webhook_invoice_succeeded";
        } catch {
          return false;
        }
      });
      expect(successLog).toBeDefined();
      expect(mockAction).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("handles invoice.payment_failed (logging only)", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const event = {
        type: "invoice.payment_failed",
        data: {
          object: { id: "inv_123" },
        },
      };

      mockConstructEvent.mockReturnValue(event);

      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      const calls = consoleSpy.mock.calls;
      const failLog = calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.msg === "stripe_webhook_invoice_failed";
        } catch {
          return false;
        }
      });
      expect(failLog).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    it("returns 400 when signature missing", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const request = new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
        // No stripe-signature header
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid request" });

      consoleSpy.mockRestore();
    });

    it("returns 400 when signature verification fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockConstructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const response = await POST(makeRequest());

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid request" });

      consoleSpy.mockRestore();
    });

    it("returns 500 when handler throws", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const event = {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_456",
            customer: "cus_123",
            status: "active",
            items: { data: [{ price: { id: "price_monthly" }, current_period_end: 123 }] },
          },
        },
      };

      mockConstructEvent.mockReturnValue(event);
      mockAction.mockRejectedValue(new Error("Database error"));

      const response = await POST(makeRequest());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Internal server error" });

      consoleSpy.mockRestore();
    });
  });

  describe("unhandled events", () => {
    it("returns success for unhandled event types", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const event = {
        type: "customer.created",
        data: { object: { id: "cus_123" } },
      };

      mockConstructEvent.mockReturnValue(event);

      const response = await POST(makeRequest());

      expect(response.status).toBe(200);
      // Verify structured log output for unhandled event
      const calls = consoleSpy.mock.calls;
      const unhandledLog = calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0] as string);
          return parsed.msg === "stripe_webhook_unhandled";
        } catch {
          return false;
        }
      });
      expect(unhandledLog).toBeDefined();
      const logData = JSON.parse(unhandledLog![0] as string);
      expect(logData.type).toBe("customer.created");
      expect(mockAction).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
