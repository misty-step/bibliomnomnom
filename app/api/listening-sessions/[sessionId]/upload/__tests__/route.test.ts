import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const putMock = vi.hoisted(() => vi.fn());
vi.mock("@vercel/blob", () => ({
  put: putMock,
}));

const convexSetAuthMock = vi.hoisted(() => vi.fn());
const convexQueryMock = vi.hoisted(() => vi.fn());
const convexMutationMock = vi.hoisted(() => vi.fn());
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(() => ({
    setAuth: convexSetAuthMock,
    query: convexQueryMock,
    mutation: convexMutationMock,
  })),
}));

const entitlementMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/listening-sessions/entitlements", () => ({
  requireListeningSessionEntitlement: entitlementMock,
}));

const originalConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

function makeRequestContext(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) } as never;
}

describe("listening session upload route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://convex.example";

    authMock.mockReset();
    authMock.mockResolvedValue({
      userId: "user_123",
      getToken: vi.fn().mockResolvedValue("convex-token"),
    });
    entitlementMock.mockReset();
    entitlementMock.mockResolvedValue({
      ok: true,
      convex: {
        query: convexQueryMock,
        mutation: convexMutationMock,
      },
    });
    convexSetAuthMock.mockReset();
    convexQueryMock.mockReset();
    convexMutationMock.mockReset();
    putMock.mockReset();
    putMock.mockResolvedValue({
      url: "https://blob.vercel-storage.com/listening-sessions/session_1-1700.webm",
      pathname: "listening-sessions/session_1-1700.webm",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalConvexUrl === undefined) {
      delete process.env.NEXT_PUBLIC_CONVEX_URL;
    } else {
      process.env.NEXT_PUBLIC_CONVEX_URL = originalConvexUrl;
    }
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce({ userId: null, getToken: vi.fn() });

    const response = await POST(
      new Request("https://example.com/api/listening-sessions/session_1/upload", {
        method: "POST",
        headers: { "x-content-type": "audio/webm", "Content-Type": "audio/webm" },
        body: new Uint8Array([1, 2, 3]),
      }),
      makeRequestContext("session_1"),
    );

    expect(response.status).toBe(401);
    expect(putMock).not.toHaveBeenCalled();
    expect(convexMutationMock).not.toHaveBeenCalled();
  });

  it("returns 400 when content type is missing or invalid", async () => {
    const response = await POST(
      new Request("https://example.com/api/listening-sessions/session_1/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: new Uint8Array([1, 2, 3]),
      }),
      makeRequestContext("session_1"),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/content-type/i);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 413 when body exceeds max upload size", async () => {
    const response = await POST(
      new Request("https://example.com/api/listening-sessions/session_1/upload", {
        method: "POST",
        headers: {
          "x-content-type": "audio/webm",
          "Content-Type": "audio/webm",
          "content-length": String(MAX_LISTENING_SESSION_AUDIO_BYTES + 1),
        },
        body: new Uint8Array([1, 2, 3]),
      }),
      makeRequestContext("session_1"),
    );

    expect(response.status).toBe(413);
    expect(putMock).not.toHaveBeenCalled();
    expect(convexMutationMock).not.toHaveBeenCalled();
  });

  it("returns 404 when session is not found or not owned by user", async () => {
    convexMutationMock.mockRejectedValueOnce(new Error("Session not found or access denied"));

    const response = await POST(
      new Request("https://example.com/api/listening-sessions/session_missing/upload", {
        method: "POST",
        headers: { "x-content-type": "audio/webm", "Content-Type": "audio/webm" },
        body: new Uint8Array([1, 2, 3]),
      }),
      makeRequestContext("session_missing"),
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 when session transition is invalid", async () => {
    convexMutationMock.mockRejectedValueOnce(
      new Error("Invalid session transition from complete to transcribing"),
    );

    const response = await POST(
      new Request("https://example.com/api/listening-sessions/session_1/upload", {
        method: "POST",
        headers: { "x-content-type": "audio/webm", "Content-Type": "audio/webm" },
        body: new Uint8Array([1, 2, 3]),
      }),
      makeRequestContext("session_1"),
    );

    expect(response.status).toBe(400);
  });

  it("returns 200 and omits audioUrl on success", async () => {
    const response = await POST(
      new Request("https://example.com/api/listening-sessions/session_1/upload", {
        method: "POST",
        headers: {
          "x-content-type": "audio/webm",
          "x-duration-ms": "12345",
          "x-cap-reached": "false",
          "x-transcript-live": "alpha beta gamma",
          "Content-Type": "audio/webm",
        },
        body: new Uint8Array([1, 2, 3]),
      }),
      makeRequestContext("session_1"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect("audioUrl" in payload).toBe(false);
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(convexMutationMock).toHaveBeenCalledTimes(1);
  });
});
