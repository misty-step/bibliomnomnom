import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const handleUploadMock = vi.hoisted(() => vi.fn());
vi.mock("@vercel/blob/client", () => ({
  handleUpload: handleUploadMock,
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

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const entitlementMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/listening-sessions/entitlements", () => ({
  requireListeningSessionEntitlement: entitlementMock,
}));

describe("blob upload-audio route", () => {
  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce({ userId: null, getToken: vi.fn() });

    const res = await POST(
      new Request("https://example.com/api/blob/upload-audio", {
        method: "POST",
        headers: { "x-request-id": "req-upload-audio-unauth", "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get("x-request-id")).toBe("req-upload-audio-unauth");
    expect(handleUploadMock).not.toHaveBeenCalled();
  });

  it("returns 400 when body is invalid JSON", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123", getToken: vi.fn() });

    const res = await POST(
      new Request("https://example.com/api/blob/upload-audio", {
        method: "POST",
        headers: {
          "x-request-id": "req-upload-audio-invalid-json",
          "Content-Type": "application/json",
        },
        body: "{not valid json",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid request body");
    expect(handleUploadMock).not.toHaveBeenCalled();
  });

  it("returns 402 when subscription access is missing", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123", getToken: vi.fn() });
    entitlementMock.mockResolvedValueOnce({
      ok: false,
      status: 402,
      error: "Subscription required to use voice sessions.",
    });

    const res = await POST(
      new Request("https://example.com/api/blob/upload-audio", {
        method: "POST",
        headers: {
          "x-request-id": "req-upload-audio-no-access",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.error).toBe("Subscription required to use voice sessions.");
    expect(handleUploadMock).not.toHaveBeenCalled();
  });

  it("returns upload response when entitled", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123", getToken: vi.fn() });
    entitlementMock.mockResolvedValueOnce({ ok: true, convex: {} });
    handleUploadMock.mockResolvedValueOnce({ ok: true, url: "https://blob.example/file.webm" });

    const res = await POST(
      new Request("https://example.com/api/blob/upload-audio", {
        method: "POST",
        headers: { "x-request-id": "req-upload-audio-ok", "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("req-upload-audio-ok");
    expect(body).toEqual({ ok: true, url: "https://blob.example/file.webm" });
    expect(handleUploadMock).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    entitlementMock.mockReset();
    handleUploadMock.mockReset();
    authMock.mockReset();
    vi.restoreAllMocks();
  });
});
