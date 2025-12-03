import { describe, expect, it, vi, afterEach, type Mock } from "vitest";
import { GET } from "../route";

const originalEnv = { ...process.env };

vi.mock("@/lib/api/withObservability", async () => {
  const mod = await vi.importActual<typeof import("@/lib/api/withObservability")>(
    "@/lib/api/withObservability",
  );
  return {
    ...mod,
    withObservability: (handler: any) => handler,
  };
});

vi.mock("@/lib/health/probes", () => ({
  probeConvex: vi.fn().mockResolvedValue({ status: "up", latencyMs: 10 }),
  probeClerk: vi.fn().mockResolvedValue({ status: "up", latencyMs: 12 }),
  probeBlob: vi.fn().mockResolvedValue({ status: "up", latencyMs: 8 }),
  makeUnknownServices: () => ({
    convex: { status: "unknown" },
    clerk: { status: "unknown" },
    blob: { status: "unknown" },
  }),
}));

describe("health route", () => {
  it("returns shallow health 200 with unknown services by default", async () => {
    const res = await GET(new Request("https://example.com/api/health"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.services.convex.status).toBe("unknown");
    expect(body.version.length).toBeGreaterThan(0);
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("returns deep health and 200 when all services up", async () => {
    const res = await GET(new Request("https://example.com/api/health?mode=deep"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.services.convex.status).toBe("up");
    expect(body.services.clerk.latencyMs).toBeDefined();
  });

  it("returns 503 when any service down", async () => {
    const { probeConvex } = await import("@/lib/health/probes");
    (probeConvex as unknown as Mock).mockResolvedValueOnce({
      status: "down",
      latencyMs: 30,
      error: "timeout",
    });

    const res = await GET(new Request("https://example.com/api/health?mode=deep"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.services.convex.status).toBe("down");
  });

  it("maps exceptions to unhealthy 503", async () => {
    const failingHandler = async () => {
      throw new Error("boom");
    };

    const { withObservability } = await import("@/lib/api/withObservability");
    const handler = withObservability(failingHandler, "health-check");

    const res = await handler(new Request("https://example.com/api/health"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.error).toBe("boom");
  });
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});
