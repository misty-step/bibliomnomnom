import { describe, expect, it, vi } from "vitest";
import {
  llmExtract,
  createOpenRouterExtractionProvider,
  createOpenRouterVerificationProvider,
} from "../../lib/import/llm";

describe("llmExtract coverage", () => {
  it("handles fallback provider logic", async () => {
    const provider = {
      name: "openrouter" as const,
      call: vi.fn().mockResolvedValue(JSON.stringify({ books: [] })), // Returns empty
    };
    const fallback = {
      name: "openrouter" as const,
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
      name: "openrouter" as const,
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

  it("handles OpenRouter provider calls", async () => {
    const provider = createOpenRouterExtractionProvider({ apiKey: "key", model: "test/model" });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ books: [] }) } }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await provider.call("prompt");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.anything(),
    );
  });

  it("handles OpenRouter provider errors", async () => {
    const provider = createOpenRouterExtractionProvider({ apiKey: "key", model: "test/model" });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "Error" } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(provider.call("prompt")).rejects.toThrow("OpenRouter error");
  });

  it("handles verification issues", async () => {
    const provider = {
      name: "openrouter" as const,
      call: vi.fn().mockResolvedValue(JSON.stringify({ books: [{ title: "T", author: "A" }] })),
    };
    const verifier = {
      name: "openrouter" as const,
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

    const result = await llmExtract("text", { provider, verifierProvider: verifier });

    if (windowBackup !== undefined) {
      global.window = windowBackup;
    }

    expect(result.warnings.some((w) => w.includes("verification"))).toBe(true);
  });
});

describe("Providers", () => {
  it("createOpenRouterExtractionProvider returns provider", () => {
    const p = createOpenRouterExtractionProvider({ apiKey: "key", model: "test/model" });
    expect(p.name).toBe("openrouter");
    expect(p.call).toBeDefined();
  });

  it("createOpenRouterVerificationProvider returns provider", () => {
    const p = createOpenRouterVerificationProvider({ apiKey: "key", model: "test/model" });
    expect(p.name).toBe("openrouter");
    expect(p.call).toBeDefined();
  });
});
