import { describe, expect, it } from "vitest";

import { llmExtract, makeStaticProvider } from "../../lib/import/llm";

const sampleBooks = [
  {
    tempId: "t1",
    title: "The Hobbit",
    author: "J. R. R. Tolkien",
    status: "read",
    isbn: "9780261103344",
  },
];

describe("llmExtract", () => {
  it("returns parsed rows from provider payload", async () => {
    const provider = makeStaticProvider({ books: sampleBooks });

    // Mock server environment
    const windowBackup = global.window;
    // @ts-expect-error - Deleting window to simulate server environment
    delete global.window;

    const result = await llmExtract("text", { provider });

    // Restore window
    if (windowBackup !== undefined) {
      global.window = windowBackup;
    }

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.title).toBe("The Hobbit");
    expect(result.errors).toHaveLength(0);
  });

  it("returns error when no provider is supplied", async () => {
    const windowBackup = global.window;
    // @ts-expect-error - simulate server environment
    delete global.window;

    const result = await llmExtract("text without provider", {});

    if (windowBackup !== undefined) {
      global.window = windowBackup;
    }

    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]!.message).toContain("No LLM provider supplied");
  });

  it("enforces token cap", async () => {
    const provider = makeStaticProvider({ books: sampleBooks });
    const bigText = "x".repeat(300_000); // ~75k tokens with divisor heuristic

    // Mock server environment
    const windowBackup = global.window;
    // @ts-expect-error - Deleting window to simulate server environment
    delete global.window;

    const result = await llmExtract(bigText, { provider, tokenCap: 60_000 });

    // Restore window
    if (windowBackup !== undefined) {
      global.window = windowBackup;
    }

    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]!.message).toContain("Token budget exceeded");
  });

  it("falls back to second provider when first fails", async () => {
    const failingProvider = {
      name: "openai" as const,
      call: async () => {
        throw new Error("boom");
      },
    };
    const fallback = makeStaticProvider({ books: sampleBooks });

    // Mock server environment
    const windowBackup = global.window;
    // @ts-expect-error - Deleting window to simulate server environment
    delete global.window;

    const result = await llmExtract("text", {
      provider: failingProvider,
      fallbackProvider: fallback,
    });

    // Restore window
    if (windowBackup !== undefined) {
      global.window = windowBackup;
    }

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("flags rows missing required fields", async () => {
    const provider = makeStaticProvider({ books: [{ author: "No Title" }] });

    // Mock server environment
    const windowBackup = global.window;
    // @ts-expect-error - Deleting window to simulate server environment
    delete global.window;

    const result = await llmExtract("text", { provider });

    // Restore window
    if (windowBackup !== undefined) {
      global.window = windowBackup;
    }

    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]!.message).toContain("Row missing required title or author");
  });
});
