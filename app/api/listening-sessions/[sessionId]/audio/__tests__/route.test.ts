import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

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

const convexSetAuthMock = vi.hoisted(() => vi.fn());
const convexQueryMock = vi.hoisted(() => vi.fn());
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(function ConvexHttpClientMock() {
    return {
      setAuth: convexSetAuthMock,
      query: convexQueryMock,
    };
  }),
}));

const originalConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

function makeRequestContext(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) } as never;
}

describe("listening session audio proxy route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://convex.example";
    authMock.mockReset();
    authMock.mockResolvedValue({
      userId: "user_123",
      getToken: vi.fn().mockResolvedValue("convex-token"),
    });
    convexSetAuthMock.mockReset();
    convexQueryMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalConvexUrl === undefined) {
      delete process.env.NEXT_PUBLIC_CONVEX_URL;
    } else {
      process.env.NEXT_PUBLIC_CONVEX_URL = originalConvexUrl;
    }
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce({ userId: null, getToken: vi.fn() });

    const response = await GET(
      new Request("https://example.com/api/listening-sessions/session_1/audio"),
      makeRequestContext("session_1"),
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when session is missing or audio is not set", async () => {
    convexQueryMock.mockResolvedValueOnce(null);

    const response = await GET(
      new Request("https://example.com/api/listening-sessions/session_missing/audio"),
      makeRequestContext("session_missing"),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toMatch(/audio/i);
  });

  it("returns proxied audio with private cache headers on success", async () => {
    convexQueryMock.mockResolvedValueOnce(
      "https://blob.vercel-storage.com/listening-sessions/sample.webm",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: {
            "content-type": "audio/webm",
            "content-length": "4",
            "accept-ranges": "bytes",
          },
        }),
      ),
    );

    const response = await GET(
      new Request("https://example.com/api/listening-sessions/session_1/audio"),
      makeRequestContext("session_1"),
    );
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/webm");
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });

  it("returns 403 when audio URL host is not trusted", async () => {
    convexQueryMock.mockResolvedValueOnce("https://evil.example.com/listening-sessions/audio.webm");

    const response = await GET(
      new Request("https://example.com/api/listening-sessions/session_1/audio"),
      makeRequestContext("session_1"),
    );

    expect(response.status).toBe(403);
  });

  it("returns 206 partial content when Range header is forwarded", async () => {
    convexQueryMock.mockResolvedValueOnce(
      "https://blob.vercel-storage.com/listening-sessions/sample.webm",
    );
    const fetchSpy = vi.fn().mockResolvedValueOnce(
      new Response(new Uint8Array([2, 3]), {
        status: 206,
        headers: {
          "content-type": "audio/webm",
          "content-range": "bytes 1-2/4",
          "accept-ranges": "bytes",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await GET(
      new Request("https://example.com/api/listening-sessions/session_1/audio", {
        headers: { range: "bytes=1-2" },
      }),
      makeRequestContext("session_1"),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 1-2/4");
    // Verify Range header was forwarded to blob storage
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { range: "bytes=1-2" } }),
    );
  });
});
