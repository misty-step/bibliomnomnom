import { NextResponse } from "next/server";
import { withObservability } from "@/lib/api/withObservability";
import { overallStatus } from "@/lib/health/types";
import { makeUnknownServices, probeBlob, probeClerk, probeConvex } from "@/lib/health/probes";

export const runtime = "nodejs";
const OVERALL_TIMEOUT_MS = 750;
const BLOB_HEALTH_URL = "https://blob.vercel-storage.com";

/**
 * Health check endpoint for uptime monitoring and deployment verification
 *
 * Returns 200 OK if the application is running and can respond to requests
 * Includes basic service availability checks
 */
export const GET = withObservability(async (req) => {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || req.headers.get("x-health-mode") || "shallow";

    const deepRequested = mode === "deep";
    const services = deepRequested ? await runProbesWithinBudget() : makeUnknownServices();

    const status = overallStatus(services, "healthy");

    const health = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || "local",
      services,
    };

    return NextResponse.json(health, {
      status: status === "healthy" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}, "health-check");

async function runProbesWithinBudget() {
  const perProbe = OVERALL_TIMEOUT_MS / 3;

  const [convex, clerk, blob] = await Promise.all([
    probeConvex(process.env.NEXT_PUBLIC_CONVEX_URL, perProbe),
    probeClerk(process.env.CLERK_JWT_ISSUER_DOMAIN, perProbe),
    probeBlob(process.env.BLOB_READ_WRITE_TOKEN ? BLOB_HEALTH_URL : undefined, perProbe),
  ]);

  return { convex, clerk, blob };
}
