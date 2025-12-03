import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { probeBlob, probeClerk, probeConvex } from "../probes";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
  global.fetch = originalFetch;
});

describe("probe helpers", () => {
  it("returns unknown when url missing", async () => {
    await expect(probeConvex(undefined)).resolves.toEqual({ status: "unknown" });
    await expect(probeClerk(undefined)).resolves.toEqual({ status: "unknown" });
    await expect(probeBlob(undefined)).resolves.toEqual({ status: "unknown" });
  });

  it("marks service up on 200", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await probeConvex("https://convex.cloud");
    expect(result.status).toBe("up");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("marks service down on non-200", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    const result = await probeBlob("https://blob.example.com");
    expect(result).toEqual({
      status: "down",
      latencyMs: expect.any(Number),
      error: "http-503",
    });
  });

  it("times out slow requests", async () => {
    global.fetch = vi.fn((_url, init?: RequestInit) => {
      const signal = init?.signal;

      return new Promise((_, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }) as unknown as typeof fetch;

    const promise = probeConvex("https://slow.convex.cloud", 50);
    vi.advanceTimersByTime(60);

    await expect(promise).resolves.toMatchObject({
      status: "down",
      error: "timeout",
    });
  });

  it("builds clerk jwks url correctly", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchSpy;

    await probeClerk("https://clerk.accounts.dev");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://clerk.accounts.dev/.well-known/jwks.json",
      expect.objectContaining({ method: "GET", signal: expect.any(AbortSignal) }),
    );
  });
});
