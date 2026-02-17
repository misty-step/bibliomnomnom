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

const originalDeepgramKey = process.env.DEEPGRAM_API_KEY;
const originalElevenLabsKey = process.env.ELEVENLABS_API_KEY;

describe("listening sessions transcribe route", () => {
  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/transcribe", {
        method: "POST",
        headers: { "x-request-id": "req-transcribe-1", "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: "https://example.com/audio.webm" }),
      }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get("x-request-id")).toBe("req-transcribe-1");
  });

  it("returns 500 when no STT provider is configured", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });
    delete process.env.DEEPGRAM_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/transcribe", {
        method: "POST",
        headers: { "x-request-id": "req-transcribe-2", "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: "https://example.com/audio.webm" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch("No STT provider");
  });

  it("returns 400 when audioUrl host is not trusted", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });
    process.env.DEEPGRAM_API_KEY = "test_deepgram_key";

    const res = await POST(
      new Request("https://example.com/api/listening-sessions/transcribe", {
        method: "POST",
        headers: { "x-request-id": "req-transcribe-3", "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: "https://example.com/audio.webm" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Untrusted audio host");
  });

  it("returns 413 when uploaded audio exceeds max size", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });
    process.env.DEEPGRAM_API_KEY = "test_deepgram_key";

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
        body: JSON.stringify({
          audioUrl: "https://blob.vercel-storage.com/listening-sessions/big.webm",
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body.error).toBe("Uploaded audio is too large");
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

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
