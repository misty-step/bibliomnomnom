import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { log, withObservability } from "@/lib/api/withObservability";
import { isTrustedAudioHost } from "@/lib/listening-sessions/transcription";
import { captureError } from "@/lib/sentry";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

async function handleAudioProxy(request: Request, context: RouteContext) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const { sessionId } = await context.params;
  if (!sessionId?.trim()) {
    return NextResponse.json(
      { error: "sessionId is required." },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!convexUrl) {
    return NextResponse.json(
      { error: "Voice sessions are temporarily unavailable. Please try again shortly." },
      { status: 503, headers: { "x-request-id": requestId } },
    );
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return NextResponse.json(
      { error: "Authentication token missing." },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);

  let audioUrl: string | null;
  try {
    audioUrl = await convex.query(api.listeningSessions.getAudioUrlForOwner, {
      sessionId: sessionId as Id<"listeningSessions">,
    });
  } catch (error) {
    captureError(error, {
      tags: { api: "listening-session-audio-proxy" },
      extra: { requestId, userId, sessionId },
    });
    return NextResponse.json(
      { error: "Failed to look up session audio." },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  if (!audioUrl) {
    return NextResponse.json(
      { error: "Audio not found" },
      { status: 404, headers: { "x-request-id": requestId } },
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(audioUrl);
  } catch {
    return NextResponse.json(
      { error: "Audio URL is invalid." },
      { status: 403, headers: { "x-request-id": requestId } },
    );
  }

  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    !isTrustedAudioHost(parsedUrl.hostname)
  ) {
    return NextResponse.json(
      { error: "Audio host is not trusted." },
      { status: 403, headers: { "x-request-id": requestId } },
    );
  }

  const blobResponse = await fetch(audioUrl, { redirect: "error" });
  if (blobResponse.status === 404) {
    return NextResponse.json(
      { error: "Audio not found" },
      { status: 404, headers: { "x-request-id": requestId } },
    );
  }
  if (!blobResponse.ok || !blobResponse.body) {
    log("warn", "listening_session_audio_proxy_failed_fetch", {
      requestId,
      userIdSuffix: userId.slice(-6),
      status: blobResponse.status,
    });
    return NextResponse.json(
      { error: "Failed to fetch session audio." },
      { status: 502, headers: { "x-request-id": requestId } },
    );
  }

  const headers = new Headers();
  const contentType = blobResponse.headers.get("content-type");
  const contentLength = blobResponse.headers.get("content-length");
  if (contentType) headers.set("content-type", contentType);
  if (contentLength) headers.set("content-length", contentLength);
  headers.set("cache-control", "private, max-age=300");
  headers.set("x-request-id", requestId);

  return new Response(blobResponse.body, {
    status: 200,
    headers,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return withObservability(
    (req: Request) => handleAudioProxy(req, context),
    "listening-session-audio-proxy",
  )(request);
}
