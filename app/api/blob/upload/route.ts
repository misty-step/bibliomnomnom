import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { log } from "@/lib/api/log";
import { withObservability } from "@/lib/api/withObservability";
import { captureError } from "@/lib/sentry";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
          tokenPayload: JSON.stringify({ userId }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        log("info", "blob_upload_completed", { url: blob.url });
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    captureError(error, {
      tags: { api: "blob-upload" },
      extra: { userId },
    });
    // Return generic error to client - specific error logged to Sentry
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}, "blob-upload");
