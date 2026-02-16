import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

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

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;

describe("listening sessions synthesize route", () => {
  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

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

  it("returns fallback synthesis when OpenRouter key is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });
    delete process.env.OPENROUTER_API_KEY;

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/synthesize", {
        method: "POST",
        headers: { "x-request-id": "req-synth-2", "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript:
            "I liked the way the author framed uncertainty. What does this imply for the ending?",
          context: {
            book: { title: "Example Book", author: "Author" },
            currentlyReading: [],
            wantToRead: [],
            read: [],
            recentNotes: [],
          },
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("fallback");
    expect(Array.isArray(body.artifacts?.insights)).toBe(true);
    expect(Array.isArray(body.artifacts?.followUpQuestions)).toBe(true);
  });
});

afterEach(() => {
  if (originalOpenRouterApiKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
  }

  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
