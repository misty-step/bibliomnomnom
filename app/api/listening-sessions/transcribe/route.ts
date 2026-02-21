import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { log, withObservability } from "@/lib/api/withObservability";
import { requireListeningSessionEntitlement } from "@/lib/listening-sessions/entitlements";
import {
  transcribeAudio,
  TranscribeHttpError,
  type TranscriptionResponse,
} from "@/lib/listening-sessions/transcription";

// Budget: 10s audio fetch + 25s ElevenLabs + 25s Deepgram = 60s worst-case.
export const maxDuration = 60;

type TranscribeRequest = {
  sessionId: Id<"listeningSessions">;
};

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
    const parsed = (await request.json()) as Partial<{
      sessionId: unknown;
      audioUrl: unknown;
    }>;
    if (typeof parsed !== "object" || parsed === null) {
      return NextResponse.json(
        { error: "sessionId is required." },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
    if ("audioUrl" in parsed) {
      return NextResponse.json(
        { error: "audioUrl is no longer accepted. Use sessionId." },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
    if (!parsed.sessionId || typeof parsed.sessionId !== "string") {
      return NextResponse.json(
        { error: "sessionId is required." },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
    body = { sessionId: parsed.sessionId as Id<"listeningSessions"> };
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

  let audioUrl: string | null = null;
  try {
    audioUrl = await entitlement.convex.query(api.listeningSessions.getAudioUrlForOwner, {
      sessionId: body.sessionId,
    });
  } catch (error) {
    log("error", "listening_session_audio_lookup_failed", {
      requestId,
      userIdSuffix: userId.slice(-6),
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to resolve session audio." },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }
  if (!audioUrl) {
    return NextResponse.json(
      { error: "Audio not found" },
      { status: 404, headers: { "x-request-id": requestId } },
    );
  }

  try {
    const transcribeStart = Date.now();
    const transcription: TranscriptionResponse = await transcribeAudio(
      audioUrl,
      elevenLabsKey,
      deepgramKey,
    );
    const transcribeLatencyMs = Date.now() - transcribeStart;
    const transcribeFallbackUsed =
      transcription.provider === "deepgram" && Boolean(elevenLabsKey?.trim());

    try {
      await entitlement.convex.mutation(api.listeningSessions.recordTranscribeTelemetry, {
        sessionId: body.sessionId,
        transcribeLatencyMs,
        transcribeFallbackUsed,
      });
    } catch (error) {
      log("warn", "listening_session_transcribe_telemetry_update_failed", {
        requestId,
        userIdSuffix: userId.slice(-6),
        sessionId: body.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    log("info", "listening_session_transcribed", {
      requestId,
      userIdSuffix: userId.slice(-6),
      provider: transcription.provider,
      transcribeLatencyMs,
      transcribeFallbackUsed,
      transcriptChars: transcription.transcript.length,
    });

    return NextResponse.json(transcription, { headers: { "x-request-id": requestId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    try {
      await entitlement.convex.mutation(api.listeningSessions.fail, {
        sessionId: body.sessionId,
        message,
        failedStage: "transcribing",
      });
    } catch {
      // no-op
    }
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
