import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { timingSafeCompare, validateWebhookToken } from "../../../lib/security/webhookToken";

describe("timingSafeCompare", () => {
  describe("empty string handling", () => {
    it("returns false when first string is empty", () => {
      expect(timingSafeCompare("", "secret")).toBe(false);
    });

    it("returns false when second string is empty", () => {
      expect(timingSafeCompare("secret", "")).toBe(false);
    });

    it("returns false when both strings are empty", () => {
      // CRITICAL: This is the security fix - empty strings should NOT match
      expect(timingSafeCompare("", "")).toBe(false);
    });
  });

  describe("length mismatch", () => {
    it("returns false for different length strings", () => {
      expect(timingSafeCompare("short", "longer")).toBe(false);
    });

    it("returns false when one is prefix of other", () => {
      expect(timingSafeCompare("secret", "secret123")).toBe(false);
    });
  });

  describe("matching strings", () => {
    it("returns true for identical strings", () => {
      expect(timingSafeCompare("secret123", "secret123")).toBe(true);
    });

    it("returns true for long identical strings", () => {
      const token = "a".repeat(256);
      expect(timingSafeCompare(token, token)).toBe(true);
    });

    it("returns true for special characters", () => {
      expect(timingSafeCompare("!@#$%^&*()", "!@#$%^&*()")).toBe(true);
    });
  });

  describe("non-matching strings of same length", () => {
    it("returns false for completely different strings", () => {
      expect(timingSafeCompare("abcdefgh", "12345678")).toBe(false);
    });

    it("returns false for strings differing by one character", () => {
      expect(timingSafeCompare("secret123", "secret124")).toBe(false);
    });

    it("returns false for strings with swapped characters", () => {
      expect(timingSafeCompare("ab", "ba")).toBe(false);
    });
  });
});

describe("validateWebhookToken", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("environment variable validation", () => {
    it("throws when expected token is undefined", () => {
      expect(() => validateWebhookToken("any", undefined)).toThrow(
        "Webhook authentication not configured",
      );
    });

    it("throws when expected token is empty string", () => {
      expect(() => validateWebhookToken("any", "")).toThrow(
        "Webhook authentication not configured",
      );
    });

    it("uses CONVEX_WEBHOOK_TOKEN from env when not explicitly provided", () => {
      process.env.CONVEX_WEBHOOK_TOKEN = "env_secret";
      expect(() => validateWebhookToken("env_secret")).not.toThrow();
    });
  });

  describe("provided token validation", () => {
    it("throws when provided token is empty string", () => {
      expect(() => validateWebhookToken("", "expected")).toThrow("Invalid webhook token");
    });

    it("throws when provided token is wrong", () => {
      expect(() => validateWebhookToken("wrong", "expected")).toThrow("Invalid webhook token");
    });
  });

  describe("successful validation", () => {
    it("does not throw for matching tokens", () => {
      expect(() => validateWebhookToken("correct_token", "correct_token")).not.toThrow();
    });

    it("does not throw for matching long tokens", () => {
      const token = "wh_" + "x".repeat(64);
      expect(() => validateWebhookToken(token, token)).not.toThrow();
    });
  });

  describe("security edge cases", () => {
    it("rejects empty provided token even with empty expected (double empty)", () => {
      // Both empty should fail - not match
      expect(() => validateWebhookToken("", "")).toThrow();
    });

    it("rejects null-ish values", () => {
      // @ts-expect-error - testing runtime behavior with invalid input
      expect(() => validateWebhookToken(null, "expected")).toThrow();
      // @ts-expect-error - testing runtime behavior with invalid input
      expect(() => validateWebhookToken(undefined, "expected")).toThrow();
    });
  });
});
