import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { log, withObservability } from "@/lib/api/withObservability";
import { requireListeningSessionEntitlement } from "@/lib/listening-sessions/entitlements";
import {
  transcribeAudio,
  TranscribeHttpError,
  type TranscriptionResponse,
} from "@/lib/listening-sessions/transcription";

type TranscribeRequest = {
  audioUrl: string;
};

function isTrustedAudioHost(hostname: string): boolean {
  return hostname === "blob.vercel-storage.com" || hostname.endsWith(".blob.vercel-storage.com");
}

export const POST = withObservability(async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Please sign in to transcribe audio." },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  let body: TranscribeRequest;
  try {
    const parsed = (await request.json()) as Partial<TranscribeRequest>;
    if (!parsed.audioUrl || typeof parsed.audioUrl !== "string") {
      return NextResponse.json(
        { error: "audioUrl is required." },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
    body = { audioUrl: parsed.audioUrl };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  const deepgramKey = process.env.DEEPGRAM_API_KEY?.trim();
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!deepgramKey && !elevenLabsKey) {
    return NextResponse.json(
      {
        error: "No STT provider is configured. Set DEEPGRAM_API_KEY or ELEVENLABS_API_KEY.",
      },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  const entitlement = await requireListeningSessionEntitlement({
    requestId,
    clerkId: userId,
    getToken,
    rateLimit: {
      key: `listening-sessions:transcribe:${userId}`,
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

  let parsedAudioUrl: URL;
  try {
    parsedAudioUrl = new URL(body.audioUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid audio URL" },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  if (!["http:", "https:"].includes(parsedAudioUrl.protocol)) {
    return NextResponse.json(
      { error: "Invalid audio URL" },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  if (!isTrustedAudioHost(parsedAudioUrl.hostname)) {
    return NextResponse.json(
      { error: "Untrusted audio host" },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  try {
    const transcription: TranscriptionResponse = await transcribeAudio(
      body.audioUrl,
      deepgramKey,
      elevenLabsKey,
    );

    log("info", "listening_session_transcribed", {
      requestId,
      userIdSuffix: userId.slice(-6),
      provider: transcription.provider,
      transcriptChars: transcription.transcript.length,
    });

    return NextResponse.json(transcription, { headers: { "x-request-id": requestId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    log("error", "listening_session_transcription_failed", {
      requestId,
      userIdSuffix: userId.slice(-6),
      error: message,
    });
    const status = error instanceof TranscribeHttpError ? error.status : 500;
    return NextResponse.json(
      { error: message },
      { status, headers: { "x-request-id": requestId } },
    );
  }
}, "listening-session-transcribe");
