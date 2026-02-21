import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { log, withObservability } from "@/lib/api/withObservability";
import { MAX_LISTENING_SESSION_AUDIO_BYTES } from "@/lib/constants";
import {
  DEFAULT_AUDIO_MIME_TYPE,
  extensionForAudioMimeType,
  normalizeAudioMimeType,
} from "@/lib/listening-sessions/mime";
import { requireListeningSessionEntitlement } from "@/lib/listening-sessions/entitlements";
import { captureError } from "@/lib/sentry";

export const maxDuration = 60;

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/x-m4a",
]);

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

function parseDurationHeader(value: string | null): number | null {
  if (value === null || value === "") return 0;
  const durationMs = Number(value);
  if (!Number.isFinite(durationMs)) return null;
  return Math.max(0, Math.floor(durationMs));
}

function parseBooleanHeader(value: string | null, fallback: boolean): boolean | null {
  if (value === null || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function classifyMutationError(error: unknown): { status: number; message: string } | null {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (
    normalized.includes("listening session not found") ||
    normalized.includes("session not found or access denied")
  ) {
    return { status: 404, message: "Listening session not found." };
  }
  if (normalized.includes("invalid session transition")) {
    return { status: 400, message: "Session is not ready for upload." };
  }
  return null;
}

async function handleUpload(request: Request, context: RouteContext) {
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

  const contentTypeHeader =
    request.headers.get("x-content-type") ?? request.headers.get("content-type");
  const contentType = normalizeAudioMimeType(contentTypeHeader);
  if (!contentType || !ALLOWED_AUDIO_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Invalid content-type. Expected an audio MIME type." },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  const durationMs = parseDurationHeader(request.headers.get("x-duration-ms"));
  if (durationMs === null) {
    return NextResponse.json(
      { error: "x-duration-ms must be a valid number." },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  const capReached = parseBooleanHeader(request.headers.get("x-cap-reached"), false);
  if (capReached === null) {
    return NextResponse.json(
      { error: "x-cap-reached must be true or false." },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  const transcriptLive = request.headers.get("x-transcript-live")?.trim() || undefined;

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_LISTENING_SESSION_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Uploaded audio is too large." },
      { status: 413, headers: { "x-request-id": requestId } },
    );
  }

  const entitlement = await requireListeningSessionEntitlement({
    requestId,
    clerkId: userId,
    getToken,
    rateLimit: {
      key: `listening-sessions:upload-audio:${userId}`,
      limit: 30,
      windowMs: 24 * 60 * 60 * 1000,
      errorMessage: "Too many voice sessions today. Please try again later.",
    },
  });
  if (!entitlement.ok) {
    return NextResponse.json(
      { error: entitlement.error },
      { status: entitlement.status, headers: { "x-request-id": requestId } },
    );
  }

  let audioBytes: ArrayBuffer;
  try {
    audioBytes = await request.arrayBuffer();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  if (!audioBytes.byteLength) {
    return NextResponse.json(
      { error: "Audio body is empty." },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  if (audioBytes.byteLength > MAX_LISTENING_SESSION_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Uploaded audio is too large." },
      { status: 413, headers: { "x-request-id": requestId } },
    );
  }

  // Validate session ownership and readiness before consuming blob storage quota.
  // This prevents orphaned blobs when the sessionId is invalid or not in "recording" state.
  try {
    const session = await entitlement.convex.query(api.listeningSessions.get, {
      sessionId: sessionId as Id<"listeningSessions">,
    });
    if (!session) {
      return NextResponse.json(
        { error: "Listening session not found." },
        { status: 404, headers: { "x-request-id": requestId } },
      );
    }
    if (session.status !== "recording") {
      return NextResponse.json(
        { error: "Session is not ready for upload." },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
  } catch (error) {
    const classified = classifyMutationError(error);
    if (classified) {
      return NextResponse.json(
        { error: classified.message },
        { status: classified.status, headers: { "x-request-id": requestId } },
      );
    }
    captureError(error, {
      tags: { api: "listening-session-upload" },
      extra: { requestId, sessionId, userId },
    });
    return NextResponse.json(
      { error: "Failed to validate session." },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  try {
    const extension = extensionForAudioMimeType(contentType ?? DEFAULT_AUDIO_MIME_TYPE);
    const pathname = `listening-sessions/${sessionId}-${Date.now()}.${extension}`;
    // NOTE: @vercel/blob v2 only supports access: "public" at the per-blob level.
    // Audio URLs are kept private by: (1) opaque sessionId+timestamp path, (2) audioUrl
    // stripped from all client-accessible Convex queries, (3) playback routed through
    // the auth-gated /api/listening-sessions/[sessionId]/audio proxy. Upgrading to a
    // Vercel Blob private store would add enforcement-level access control.
    // See: https://github.com/misty-step/bibliomnomnom/issues/160
    const uploaded = await put(pathname, audioBytes, {
      access: "public",
      contentType: contentType ?? DEFAULT_AUDIO_MIME_TYPE,
    });

    await entitlement.convex.mutation(api.listeningSessions.markTranscribing, {
      sessionId: sessionId as Id<"listeningSessions">,
      audioUrl: uploaded.url,
      durationMs,
      capReached,
      transcriptLive,
    });

    log("info", "listening_session_audio_uploaded_server_side", {
      requestId,
      sessionId,
      userIdSuffix: userId.slice(-6),
      bytes: audioBytes.byteLength,
    });

    return NextResponse.json(
      { ok: true },
      {
        status: 200,
        headers: { "x-request-id": requestId },
      },
    );
  } catch (error) {
    const classified = classifyMutationError(error);
    if (classified) {
      return NextResponse.json(
        { error: classified.message },
        { status: classified.status, headers: { "x-request-id": requestId } },
      );
    }

    captureError(error, {
      tags: { api: "listening-session-upload" },
      extra: {
        requestId,
        sessionId,
        userId,
      },
    });
    return NextResponse.json(
      { error: "Audio upload failed." },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  return withObservability(
    (req: Request) => handleUpload(req, context),
    "listening-session-upload",
  )(request);
}
