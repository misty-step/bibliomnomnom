import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { log, withObservability } from "@/lib/api/withObservability";
import { captureError } from "@/lib/sentry";

const ALLOWED_TYPES = [
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/x-m4a",
];
const MAX_FILE_SIZE = 120 * 1024 * 1024; // 120MB

export const POST = withObservability(async (request: Request) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
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

    return NextResponse.json(response);
  } catch (error) {
    captureError(error, {
      tags: { api: "blob-upload-audio" },
      extra: { userId },
    });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}, "blob-upload-audio");
