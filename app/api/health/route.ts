import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Health check endpoint for uptime monitoring and deployment verification
 *
 * Returns 200 OK if the application is running and can respond to requests
 * Includes basic service availability checks
 */
export async function GET() {
  try {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || "local",
      services: {
        convex: !!process.env.NEXT_PUBLIC_CONVEX_URL,
        clerk: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        blob: !!process.env.BLOB_READ_WRITE_TOKEN,
      },
    };

    return NextResponse.json(health, {
      status: 200,
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
      { status: 503 }
    );
  }
}
