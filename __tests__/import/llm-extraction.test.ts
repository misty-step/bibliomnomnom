import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { llmExtract, makeStaticProvider, LlmProvider } from "../../lib/import/llm";

describe("llmExtract", () => {
  beforeEach(() => {
    vi.stubGlobal("window", undefined); // Simulate server environment
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns error when no provider is supplied", async () => {
    const result = await llmExtract("Some book text", {});

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("No LLM provider");
  });

  it("extracts books from static provider response", async () => {
    const provider = makeStaticProvider({
      books: [
        { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
        { title: "1984", author: "George Orwell" },
      ],
    });

    const result = await llmExtract("Book list here", { provider });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.title).toBe("The Great Gatsby");
    expect(result.rows[1]!.author).toBe("George Orwell");
    expect(result.errors).toHaveLength(0);
  });

  it("handles timeout errors gracefully with retry", async () => {
    let callCount = 0;
    const mockProvider: LlmProvider = {
      name: "openrouter",
      call: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          // First two calls timeout
          const error = new Error("Request timed out");
          error.name = "AbortError";
          throw error;
        }
        // Third call succeeds
        return JSON.stringify({ books: [{ title: "Test Book", author: "Test Author" }] });
      }),
    };

    const result = await llmExtract("Some text", { provider: mockProvider });

    expect(callCount).toBe(3); // Should have retried twice
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.title).toBe("Test Book");
  });

  it("returns error after max retries on persistent timeout", async () => {
    const mockProvider: LlmProvider = {
      name: "openrouter",
      call: vi.fn().mockImplementation(async () => {
        const error = new Error("Request timed out");
        error.name = "AbortError";
        throw error;
      }),
    };

    const result = await llmExtract("Some text", { provider: mockProvider });

    // 3 attempts (1 initial + 2 retries)
    expect(mockProvider.call).toHaveBeenCalledTimes(3);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("timed out");
  });

  it("falls back to fallback provider when primary fails", async () => {
    const failingProvider: LlmProvider = {
      name: "openrouter",
      call: vi.fn().mockRejectedValue(new Error("Primary failed")),
    };

    const fallbackProvider: LlmProvider = {
      name: "openrouter",
      call: vi
        .fn()
        .mockResolvedValue(
          JSON.stringify({ books: [{ title: "Fallback Book", author: "Fallback Author" }] }),
        ),
    };

    const result = await llmExtract("Some text", {
      provider: failingProvider,
      fallbackProvider,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.title).toBe("Fallback Book");
  });

  it("rejects token budget exceeding files", async () => {
    const provider = makeStaticProvider({ books: [] });
    const hugeText = "x".repeat(500_000); // ~125k tokens

    const result = await llmExtract(hugeText, { provider, tokenCap: 50_000 });

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("Token budget exceeded");
  });

  it("sanitizes rows with missing required fields", async () => {
    const provider = makeStaticProvider({
      books: [
        { title: "Valid Book", author: "Valid Author" },
        { title: "Missing Author" }, // No author
        { author: "Missing Title" }, // No title
        { title: "Another Valid", author: "Another Author" },
      ],
    });

    const result = await llmExtract("Some text", { provider });

    expect(result.rows).toHaveLength(2); // Only valid rows
    expect(result.errors).toHaveLength(2); // Two rows missing required fields
    expect(result.rows[0]!.title).toBe("Valid Book");
    expect(result.rows[1]!.title).toBe("Another Valid");
  });
});
