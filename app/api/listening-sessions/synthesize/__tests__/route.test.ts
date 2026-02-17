import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const convexQueryMock = vi.hoisted(() => vi.fn());
const entitlementMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/listening-sessions/entitlements", () => ({
  requireListeningSessionEntitlement: entitlementMock,
}));

vi.mock("@/lib/api/withObservability", async () => {
  const mod = await vi.importActual<typeof import("@/lib/api/withObservability")>(
    "@/lib/api/withObservability",
  );
  return {
    ...mod,
    withObservability: (
      handler: Parameters<typeof mod.withObservability>[0],
      _operationName: Parameters<typeof mod.withObservability>[1],
      _options?: Parameters<typeof mod.withObservability>[2],
    ) => handler,
  };
});

const openRouterChatCompletionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/openrouter", async () => {
  const mod = await vi.importActual<typeof import("@/lib/ai/openrouter")>("@/lib/ai/openrouter");
  return {
    ...mod,
    openRouterChatCompletion: openRouterChatCompletionMock,
  };
});

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
const originalListeningModel = process.env.OPENROUTER_LISTENING_MODEL;
const originalListeningFallbackModels = process.env.OPENROUTER_LISTENING_FALLBACK_MODELS;
describe("listening sessions synthesize route", () => {
  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce({ userId: null, getToken: vi.fn() });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/synthesize", {
        method: "POST",
        headers: { "x-request-id": "req-synth-1", "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "A thought about this chapter." }),
      }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get("x-request-id")).toBe("req-synth-1");
  });

  it("returns 400 when body is invalid JSON", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123", getToken: vi.fn() });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/synthesize", {
        method: "POST",
        headers: { "x-request-id": "req-synth-invalid-json", "Content-Type": "application/json" },
        body: "{not valid json",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body.");
    expect(res.headers.get("x-request-id")).toBe("req-synth-invalid-json");
  });

  it("returns 400 when transcript is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123", getToken: vi.fn() });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/synthesize", {
        method: "POST",
        headers: {
          "x-request-id": "req-synth-missing-transcript",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ context: { book: { title: "Example", author: "Author" } } }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("transcript is required.");
    expect(res.headers.get("x-request-id")).toBe("req-synth-missing-transcript");
  });

  it("returns 400 when bookId is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123", getToken: vi.fn() });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/synthesize", {
        method: "POST",
        headers: { "x-request-id": "req-synth-missing-book", "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "Thoughts..." }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("bookId is required.");
    expect(res.headers.get("x-request-id")).toBe("req-synth-missing-book");
  });

  it("returns empty artifacts when transcript is whitespace", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123", getToken: vi.fn() });
    entitlementMock.mockResolvedValueOnce({ ok: true, convex: { query: convexQueryMock } });
    process.env.OPENROUTER_API_KEY = "test_openrouter_key";

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/synthesize", {
        method: "POST",
        headers: {
          "x-request-id": "req-synth-empty-transcript",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcript: "   \n\n  ", bookId: "book_123" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("empty-transcript");
    expect(body.artifacts).toEqual({
      insights: [],
      openQuestions: [],
      quotes: [],
      followUpQuestions: [],
      contextExpansions: [],
    });
    expect(res.headers.get("x-request-id")).toBe("req-synth-empty-transcript");
    expect(openRouterChatCompletionMock).not.toHaveBeenCalled();
  });

  it("returns fallback synthesis when OpenRouter key is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123", getToken: vi.fn() });
    convexQueryMock.mockResolvedValueOnce({
      book: { title: "Example Book", author: "Author", description: "" },
      currentlyReading: [],
      wantToRead: [],
      read: [],
      recentNotes: [],
    });
    entitlementMock.mockResolvedValueOnce({ ok: true, convex: { query: convexQueryMock } });
    delete process.env.OPENROUTER_API_KEY;

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/synthesize", {
        method: "POST",
        headers: { "x-request-id": "req-synth-2", "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book_123",
          transcript:
            "I liked the way the author framed uncertainty. What does this imply for the ending?",
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("fallback");
    expect(Array.isArray(body.artifacts?.insights)).toBe(true);
    expect(Array.isArray(body.artifacts?.followUpQuestions)).toBe(true);
  });

  it("fetches synthesis context server-side when Convex auth is available", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123", getToken: vi.fn() });
    delete process.env.OPENROUTER_API_KEY;
    convexQueryMock.mockResolvedValueOnce({
      book: { title: "Example Book", author: "Author", description: "A description." },
      currentlyReading: [],
      wantToRead: [],
      read: [],
      recentNotes: [],
    });
    entitlementMock.mockResolvedValueOnce({ ok: true, convex: { query: convexQueryMock } });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/synthesize", {
        method: "POST",
        headers: { "x-request-id": "req-synth-context", "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book_123",
          transcript: "Some thoughts about the chapter.",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(convexQueryMock).toHaveBeenCalledTimes(1);
  });

  it("returns OpenRouter artifacts when configured", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123", getToken: vi.fn() });
    convexQueryMock.mockResolvedValueOnce({
      book: { title: "Example Book", author: "Author", description: "" },
      currentlyReading: [],
      wantToRead: [],
      read: [],
      recentNotes: [],
    });
    entitlementMock.mockResolvedValueOnce({ ok: true, convex: { query: convexQueryMock } });
    process.env.OPENROUTER_API_KEY = "test_openrouter_key";
    process.env.OPENROUTER_LISTENING_MODEL = "google/gemini-3-pro-preview";
    process.env.OPENROUTER_LISTENING_FALLBACK_MODELS = "google/gemini-3-flash-preview";

    openRouterChatCompletionMock.mockResolvedValueOnce({
      content: JSON.stringify({
        insights: [
          { title: "One insight", content: "This matters because it changes what you do next." },
        ],
        openQuestions: ["What does this imply later?"],
        quotes: [{ text: "verbatim quote from transcript" }],
        followUpQuestions: ["Track this theme in the next chapter."],
        contextExpansions: [
          { title: "Related idea", content: "Look up the reference and compare." },
        ],
      }),
      raw: { model: "google/gemini-3-flash-preview", usage: { total_tokens: 123 } },
    });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/synthesize", {
        method: "POST",
        headers: { "x-request-id": "req-synth-openrouter", "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book_123",
          transcript:
            'I liked the way the author framed uncertainty. "verbatim quote from transcript" What does this imply later?',
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("openrouter");
    expect(body.model).toBe("google/gemini-3-flash-preview");
    expect(body.requestedModel).toBe("google/gemini-3-pro-preview");
    expect(body.artifacts.insights[0].title).toBe("One insight");
    expect(body.artifacts.quotes[0].text).toBe("verbatim quote from transcript");
    expect(res.headers.get("x-request-id")).toBe("req-synth-openrouter");
  });

  it("returns 402 when subscription access is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123", getToken: vi.fn() });
    entitlementMock.mockResolvedValueOnce({
      ok: false,
      status: 402,
      error: "Subscription required to use voice sessions.",
    });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/synthesize", {
        method: "POST",
        headers: { "x-request-id": "req-synth-no-access", "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "Thoughts...", bookId: "book_123" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.error).toBe("Subscription required to use voice sessions.");
    expect(openRouterChatCompletionMock).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  if (originalOpenRouterApiKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
  }

  if (originalListeningModel === undefined) {
    delete process.env.OPENROUTER_LISTENING_MODEL;
  } else {
    process.env.OPENROUTER_LISTENING_MODEL = originalListeningModel;
  }

  if (originalListeningFallbackModels === undefined) {
    delete process.env.OPENROUTER_LISTENING_FALLBACK_MODELS;
  } else {
    process.env.OPENROUTER_LISTENING_FALLBACK_MODELS = originalListeningFallbackModels;
  }

  authMock.mockReset();
  openRouterChatCompletionMock.mockReset();
  convexQueryMock.mockReset();
  entitlementMock.mockReset();

  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
