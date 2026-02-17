import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { log, withObservability } from "@/lib/api/withObservability";
import { captureError } from "@/lib/sentry";
import { MAX_LISTENING_SESSION_AUDIO_BYTES } from "@/lib/constants";
import { requireListeningSessionEntitlement } from "@/lib/listening-sessions/entitlements";

const ALLOWED_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/x-m4a",
];

export const POST = withObservability(async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400, headers: { "x-request-id": requestId } },
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

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_LISTENING_SESSION_AUDIO_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId, kind: "listening-session-audio" }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        log("info", "listening_session_audio_uploaded", {
          url: blob.url,
          pathname: blob.pathname,
        });
      },
    });

    return NextResponse.json(response, { headers: { "x-request-id": requestId } });
  } catch (error) {
    captureError(error, {
      tags: { api: "blob-upload-audio" },
      extra: { userId },
    });
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }
}, "blob-upload-audio");
