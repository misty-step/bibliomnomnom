import { describe, expect, it, vi } from "vitest";
import { llmExtract, createOpenAIProvider, createGeminiProvider } from "../../lib/import/llm";

describe("llmExtract coverage", () => {
  it("handles fallback provider logic", async () => {
    const provider = {
      name: "openai" as const,
      call: vi.fn().mockResolvedValue(JSON.stringify({ books: [] })), // Returns empty
    };
    const fallback = {
      name: "gemini" as const,
      call: vi.fn().mockResolvedValue(JSON.stringify({ books: [{ title: "T", author: "A" }] })),
    };

    // Server only check
    const windowBackup = global.window;
    // Server only check
    delete (global as any).window;

    const result = await llmExtract("text", { provider, fallbackProvider: fallback });

    // Restore window
    if (windowBackup !== undefined) {
      global.window = windowBackup;
    }

    expect(result.rows).toHaveLength(1);
    expect(fallback.call).toHaveBeenCalled();
  });

  it("handles validation and collection limits", async () => {
    const provider = {
      name: "openai" as const,
      call: vi.fn().mockImplementation(async () => {
        // Generate > 300 (IMPORT_PAGE_SIZE) books
        const books = Array.from({ length: 305 }, (_, i) => ({
          title: `Title ${i}`,
          author: `Author ${i}`,
        }));
        return JSON.stringify({ books });
      }),
    };

    // Server only check
    const windowBackup = global.window;
    // Server only check
    delete (global as any).window;

    const result = await llmExtract("text", { provider });

    if (windowBackup !== undefined) {
      global.window = windowBackup;
    }

    // Debug output if needed
    // console.log(result.warnings);

    expect(result.rows).toHaveLength(305);
    expect(result.warnings.some((w) => w.includes("preview will paginate"))).toBe(true);
  });

  it("handles OpenAI provider calls", async () => {
    const provider = createOpenAIProvider("key");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ books: [] }) } }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await provider.call("prompt");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.anything(),
    );
  });

  it("handles OpenAI provider errors", async () => {
    const provider = createOpenAIProvider("key");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Error",
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(provider.call("prompt")).rejects.toThrow("OpenAI API error");
  });

  it("handles Gemini provider calls", async () => {
    const provider = createGeminiProvider("key");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ books: [] }) }] } }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await provider.call("prompt");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("generativelanguage.googleapis.com"),
      expect.anything(),
    );
  });

  it("handles Gemini provider errors", async () => {
    const provider = createGeminiProvider("key");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Error",
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(provider.call("prompt")).rejects.toThrow("Gemini API error");
  });

  it("handles verification issues", async () => {
    const provider = {
      name: "openai" as const,
      call: vi.fn().mockResolvedValue(JSON.stringify({ books: [{ title: "T", author: "A" }] })),
    };
    const fallback = {
      name: "gemini" as const,
      call: vi
        .fn()
        .mockResolvedValue(
          JSON.stringify({ complete: false, estimatedTotal: 5, issues: ["Missing books"] }),
        ),
    };

    // Server only check
    const windowBackup = global.window;
    // Server only check
    delete (global as any).window;

    const result = await llmExtract("text", { provider, fallbackProvider: fallback });

    if (windowBackup !== undefined) {
      global.window = windowBackup;
    }

    expect(result.warnings.some((w) => w.includes("verification"))).toBe(true);
  });
});

describe("Providers", () => {
  it("createOpenAIProvider returns provider", () => {
    const p = createOpenAIProvider("key");
    expect(p.name).toBe("openai");
    expect(p.call).toBeDefined();
  });

  it("createGeminiProvider returns provider", () => {
    const p = createGeminiProvider("key");
    expect(p.name).toBe("gemini");
    expect(p.call).toBeDefined();
  });
});
