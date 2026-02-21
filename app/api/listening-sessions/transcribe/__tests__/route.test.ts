import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { MAX_LISTENING_SESSION_AUDIO_BYTES } from "@/lib/constants";

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

const entitlementMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/listening-sessions/entitlements", () => ({
  requireListeningSessionEntitlement: entitlementMock,
}));
const convexQueryMock = vi.hoisted(() => vi.fn());

const originalDeepgramKey = process.env.DEEPGRAM_API_KEY;
const originalElevenLabsKey = process.env.ELEVENLABS_API_KEY;

describe("listening sessions transcribe route", () => {
  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/transcribe", {
        method: "POST",
        headers: { "x-request-id": "req-transcribe-1", "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session_1" }),
      }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get("x-request-id")).toBe("req-transcribe-1");
  });

  it("returns 400 when body is invalid JSON", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/transcribe", {
        method: "POST",
        headers: {
          "x-request-id": "req-transcribe-invalid-json",
          "Content-Type": "application/json",
        },
        body: "{not valid json",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body.");
    expect(res.headers.get("x-request-id")).toBe("req-transcribe-invalid-json");
  });

  it("returns 400 when sessionId is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/transcribe", {
        method: "POST",
        headers: {
          "x-request-id": "req-transcribe-missing-audio",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("sessionId is required.");
    expect(res.headers.get("x-request-id")).toBe("req-transcribe-missing-audio");
  });

  it("returns 400 when request uses legacy audioUrl field", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });
    entitlementMock.mockResolvedValueOnce({ ok: true, convex: { query: convexQueryMock } });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/transcribe", {
        method: "POST",
        headers: {
          "x-request-id": "req-transcribe-legacy-field",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioUrl: "https://blob.vercel-storage.com/listening-sessions/legacy.webm",
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/sessionId/i);
  });

  it("returns 500 when no STT provider is configured", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });
    entitlementMock.mockResolvedValueOnce({ ok: true, convex: { query: convexQueryMock } });
    convexQueryMock.mockResolvedValueOnce(
      "https://blob.vercel-storage.com/listening-sessions/audio.webm",
    );
    delete process.env.DEEPGRAM_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/transcribe", {
        method: "POST",
        headers: { "x-request-id": "req-transcribe-2", "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session_1" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch("No STT provider");
  });

  it("returns 404 when no audio is available for session", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });
    process.env.DEEPGRAM_API_KEY = "test_deepgram_key";
    entitlementMock.mockResolvedValueOnce({ ok: true, convex: { query: convexQueryMock } });
    convexQueryMock.mockResolvedValueOnce(null);

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/transcribe", {
        method: "POST",
        headers: { "x-request-id": "req-transcribe-3", "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session_missing" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Audio not found");
  });

  it("returns 413 when uploaded audio exceeds max size", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });
    process.env.DEEPGRAM_API_KEY = "test_deepgram_key";
    entitlementMock.mockResolvedValueOnce({ ok: true, convex: { query: convexQueryMock } });
    convexQueryMock.mockResolvedValueOnce(
      "https://blob.vercel-storage.com/listening-sessions/big.webm",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            "content-type": "audio/webm",
            "content-length": String(MAX_LISTENING_SESSION_AUDIO_BYTES + 1),
          },
        });
      }),
    );

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/transcribe", {
        method: "POST",
        headers: { "x-request-id": "req-transcribe-4", "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session_big" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body.error).toBe("Uploaded audio is too large");
  });

  it("falls back to Deepgram when ElevenLabs fails", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });
    process.env.DEEPGRAM_API_KEY = "test_deepgram_key";
    process.env.ELEVENLABS_API_KEY = "test_elevenlabs_key";
    entitlementMock.mockResolvedValueOnce({ ok: true, convex: { query: convexQueryMock } });
    convexQueryMock.mockResolvedValueOnce(
      "https://blob.vercel-storage.com/listening-sessions/sample.webm",
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.startsWith("https://blob.vercel-storage.com/")) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            "content-type": "audio/webm",
            "content-length": "3",
          },
        });
      }

      if (url === "https://api.elevenlabs.io/v1/speech-to-text") {
        return new Response("elevenlabs down", { status: 500 });
      }

      if (url.startsWith("https://api.deepgram.com/v1/listen")) {
        return new Response(
          JSON.stringify({
            results: {
              channels: [{ alternatives: [{ transcript: "hello world", confidence: 0.99 }] }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/transcribe", {
        method: "POST",
        headers: { "x-request-id": "req-transcribe-fallback", "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session_fallback" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.provider).toBe("deepgram");
    expect(body.transcript).toBe("hello world");
    expect(res.headers.get("x-request-id")).toBe("req-transcribe-fallback");

    const urls = fetchMock.mock.calls.map(([callInput]) => {
      if (typeof callInput === "string") return callInput;
      if (callInput instanceof URL) return callInput.toString();
      return callInput.url;
    });
    const elevenLabsIdx = urls.indexOf("https://api.elevenlabs.io/v1/speech-to-text");
    const deepgramIdx = urls.findIndex((url) =>
      url.startsWith("https://api.deepgram.com/v1/listen"),
    );
    expect(elevenLabsIdx).toBeGreaterThanOrEqual(0);
    expect(deepgramIdx).toBeGreaterThanOrEqual(0);
    expect(elevenLabsIdx).toBeLessThan(deepgramIdx);
  });

  it("returns 402 when subscription access is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });
    process.env.DEEPGRAM_API_KEY = "test_deepgram_key";
    entitlementMock.mockResolvedValueOnce({
      ok: false,
      status: 402,
      error: "Subscription required to use voice sessions.",
    });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/transcribe", {
        method: "POST",
        headers: { "x-request-id": "req-transcribe-no-access", "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "session_denied" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.error).toBe("Subscription required to use voice sessions.");
  });

  afterEach(() => {
    if (originalDeepgramKey === undefined) {
      delete process.env.DEEPGRAM_API_KEY;
    } else {
      process.env.DEEPGRAM_API_KEY = originalDeepgramKey;
    }

    if (originalElevenLabsKey === undefined) {
      delete process.env.ELEVENLABS_API_KEY;
    } else {
      process.env.ELEVENLABS_API_KEY = originalElevenLabsKey;
    }

    entitlementMock.mockReset();
    convexQueryMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
