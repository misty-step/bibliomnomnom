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
