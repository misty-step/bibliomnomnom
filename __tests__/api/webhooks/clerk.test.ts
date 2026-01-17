import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Hoist mock functions so they're available during module initialization
const { mockMutation, mockVerify } = vi.hoisted(() => ({
  mockMutation: vi.fn(),
  mockVerify: vi.fn(),
}));

vi.mock("convex/browser", () => {
  return {
    ConvexHttpClient: class MockConvexHttpClient {
      mutation = mockMutation;
    },
  };
});

vi.mock("svix", () => {
  return {
    Webhook: class MockWebhook {
      verify = mockVerify;
    },
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => {
      const map: Record<string, string> = {
        "svix-id": "msg_123",
        "svix-timestamp": "1234567890",
        "svix-signature": "v1,signature",
      };
      return map[name];
    },
  }),
}));

// Import after mocks
import { POST } from "../../../app/api/webhooks/clerk/route";

describe("Clerk Webhook Route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CLERK_WEBHOOK_SECRET: "whsec_test123" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const makeRequest = (body: object) =>
    new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "svix-id": "msg_123",
        "svix-timestamp": "1234567890",
        "svix-signature": "v1,signature",
      },
    });

  describe("user.created event", () => {
    it("creates user in Convex with correct data", async () => {
      const event = {
        type: "user.created",
        data: {
          id: "user_abc123",
          email_addresses: [{ id: "email_1", email_address: "test@example.com" }],
          primary_email_address_id: "email_1",
          first_name: "John",
          last_name: "Doe",
          image_url: "https://img.clerk.com/avatar.jpg",
        },
      };

      mockVerify.mockReturnValue(event);

      const response = await POST(makeRequest(event));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ received: true });
      expect(mockMutation).toHaveBeenCalledWith(
        expect.anything(), // api.users.createOrUpdateUser
        {
          clerkId: "user_abc123",
          email: "test@example.com",
          name: "John Doe",
          imageUrl: "https://img.clerk.com/avatar.jpg",
        },
      );
    });

    it("handles user with only first name", async () => {
      const event = {
        type: "user.created",
        data: {
          id: "user_abc123",
          email_addresses: [{ id: "email_1", email_address: "test@example.com" }],
          primary_email_address_id: "email_1",
          first_name: "John",
          last_name: null,
          image_url: null,
        },
      };

      mockVerify.mockReturnValue(event);

      await POST(makeRequest(event));

      expect(mockMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: "John",
        }),
      );
    });

    it("handles user with no name", async () => {
      const event = {
        type: "user.created",
        data: {
          id: "user_abc123",
          email_addresses: [{ id: "email_1", email_address: "test@example.com" }],
          primary_email_address_id: "email_1",
          first_name: null,
          last_name: null,
        },
      };

      mockVerify.mockReturnValue(event);

      await POST(makeRequest(event));

      expect(mockMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: undefined,
        }),
      );
    });

    it("falls back to first email if primary not found", async () => {
      const event = {
        type: "user.created",
        data: {
          id: "user_abc123",
          email_addresses: [
            { id: "email_1", email_address: "first@example.com" },
            { id: "email_2", email_address: "second@example.com" },
          ],
          primary_email_address_id: "email_missing",
          first_name: "Test",
        },
      };

      mockVerify.mockReturnValue(event);

      await POST(makeRequest(event));

      expect(mockMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          email: "first@example.com",
        }),
      );
    });

    it("rejects user with no email", async () => {
      const event = {
        type: "user.created",
        data: {
          id: "user_abc123",
          email_addresses: [],
          first_name: "Test",
        },
      };

      mockVerify.mockReturnValue(event);

      const response = await POST(makeRequest(event));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "User has no email" });
      expect(mockMutation).not.toHaveBeenCalled();
    });
  });

  describe("user.updated event", () => {
    it("updates user in Convex", async () => {
      const event = {
        type: "user.updated",
        data: {
          id: "user_abc123",
          email_addresses: [{ id: "email_1", email_address: "updated@example.com" }],
          primary_email_address_id: "email_1",
          first_name: "Jane",
          last_name: "Smith",
          image_url: "https://img.clerk.com/new-avatar.jpg",
        },
      };

      mockVerify.mockReturnValue(event);

      const response = await POST(makeRequest(event));

      expect(response.status).toBe(200);
      expect(mockMutation).toHaveBeenCalledWith(expect.anything(), {
        clerkId: "user_abc123",
        email: "updated@example.com",
        name: "Jane Smith",
        imageUrl: "https://img.clerk.com/new-avatar.jpg",
      });
    });
  });

  describe("user.deleted event", () => {
    it("deletes user from Convex", async () => {
      const event = {
        type: "user.deleted",
        data: {
          id: "user_abc123",
        },
      };

      mockVerify.mockReturnValue(event);

      const response = await POST(makeRequest(event));

      expect(response.status).toBe(200);
      expect(mockMutation).toHaveBeenCalledWith(
        expect.anything(), // api.users.deleteUser
        { clerkId: "user_abc123" },
      );
    });

    it("handles deletion with no id gracefully", async () => {
      const event = {
        type: "user.deleted",
        data: {},
      };

      mockVerify.mockReturnValue(event);

      const response = await POST(makeRequest(event));

      expect(response.status).toBe(200);
      expect(mockMutation).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns 500 when webhook secret not configured", async () => {
      process.env.CLERK_WEBHOOK_SECRET = "";

      const response = await POST(makeRequest({}));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Webhook secret not configured" });
    });

    it("returns 400 when signature verification fails", async () => {
      mockVerify.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const response = await POST(makeRequest({}));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid signature" });
    });

    it("returns 500 when mutation fails", async () => {
      const event = {
        type: "user.created",
        data: {
          id: "user_abc123",
          email_addresses: [{ id: "email_1", email_address: "test@example.com" }],
          primary_email_address_id: "email_1",
        },
      };

      mockVerify.mockReturnValue(event);
      mockMutation.mockRejectedValue(new Error("Database error"));

      const response = await POST(makeRequest(event));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Database error" });
    });
  });

  describe("unhandled events", () => {
    it("returns success for unhandled event types", async () => {
      const event = {
        type: "session.created",
        data: { id: "session_123" },
      };

      mockVerify.mockReturnValue(event);

      const response = await POST(makeRequest(event));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: true });
      expect(mockMutation).not.toHaveBeenCalled();
    });
  });
});
