import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { log, withObservability } from "@/lib/api/withObservability";
import { MAX_LISTENING_SESSION_AUDIO_BYTES } from "@/lib/constants";

type TranscribeRequest = {
  audioUrl: string;
  mimeType?: string;
};

type TranscribeResponse = {
  transcript: string;
  provider: "deepgram" | "elevenlabs";
  confidence?: number;
};

function cleanTranscript(input: string): string {
  return input
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isTrustedAudioHost(hostname: string): boolean {
  return hostname === "blob.vercel-storage.com" || hostname.endsWith(".blob.vercel-storage.com");
}

async function readArrayBufferLimited(response: Response, maxBytes: number): Promise<ArrayBuffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error("Uploaded audio is too large");
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > maxBytes) {
      throw new Error("Uploaded audio is too large");
    }
    return bytes;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      throw new Error("Uploaded audio is too large");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

async function readAudioFromUrl(
  audioUrl: string,
): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  const parsed = new URL(audioUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Invalid audio URL");
  }
  if (!isTrustedAudioHost(parsed.hostname)) {
    throw new Error("Untrusted audio host");
  }

  const response = await fetch(audioUrl, { redirect: "error" });
  if (!response.ok) {
    throw new Error(`Failed to fetch uploaded audio: ${response.status}`);
  }

  const bytes = await readArrayBufferLimited(response, MAX_LISTENING_SESSION_AUDIO_BYTES);
  if (!bytes.byteLength) {
    throw new Error("Uploaded audio is empty");
  }

  const mimeType = response.headers.get("content-type") || "audio/webm";
  return { bytes, mimeType };
}

async function transcribeWithDeepgram(params: {
  apiKey: string;
  audioBytes: ArrayBuffer;
  mimeType: string;
}): Promise<TranscribeResponse> {
  const model = process.env.DEEPGRAM_STT_MODEL || "nova-3";
  const endpoint = new URL("https://api.deepgram.com/v1/listen");
  endpoint.searchParams.set("model", model);
  endpoint.searchParams.set("punctuate", "true");
  endpoint.searchParams.set("smart_format", "true");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Token ${params.apiKey}`,
      "Content-Type": params.mimeType,
    },
    body: params.audioBytes,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Deepgram transcription failed (${response.status}): ${errorText.slice(0, 220)}`,
    );
  }

  const payload = (await response.json()) as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{
          transcript?: string;
          confidence?: number;
        }>;
      }>;
    };
  };

  const alt = payload.results?.channels?.[0]?.alternatives?.[0];
  const transcript = cleanTranscript(alt?.transcript ?? "");
  if (!transcript) {
    throw new Error("Deepgram returned an empty transcript");
  }

  return {
    transcript,
    provider: "deepgram",
    confidence: alt?.confidence,
  };
}

async function transcribeWithElevenLabs(params: {
  apiKey: string;
  audioBytes: ArrayBuffer;
  mimeType: string;
}): Promise<TranscribeResponse> {
  const formData = new FormData();
  const blob = new Blob([params.audioBytes], { type: params.mimeType });
  formData.append("file", blob, "session-audio.webm");
  formData.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": params.apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ElevenLabs transcription failed (${response.status}): ${errorText.slice(0, 220)}`,
    );
  }

  const payload = (await response.json()) as {
    text?: string;
    language_probability?: number;
  };
  const transcript = cleanTranscript(payload.text ?? "");
  if (!transcript) {
    throw new Error("ElevenLabs returned an empty transcript");
  }

  return {
    transcript,
    provider: "elevenlabs",
  };
}

export const POST = withObservability(async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const { userId } = await auth();
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
    body = {
      audioUrl: parsed.audioUrl,
      mimeType: typeof parsed.mimeType === "string" ? parsed.mimeType : undefined,
    };
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

  try {
    const { bytes, mimeType: fetchedMimeType } = await readAudioFromUrl(body.audioUrl);
    const mimeType = body.mimeType || fetchedMimeType || "audio/webm";

    const providerErrors: string[] = [];
    let transcription: TranscribeResponse | null = null;

    if (deepgramKey) {
      try {
        transcription = await transcribeWithDeepgram({
          apiKey: deepgramKey,
          audioBytes: bytes,
          mimeType,
        });
      } catch (error) {
        providerErrors.push(`deepgram: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!transcription && elevenLabsKey) {
      try {
        transcription = await transcribeWithElevenLabs({
          apiKey: elevenLabsKey,
          audioBytes: bytes,
          mimeType,
        });
      } catch (error) {
        providerErrors.push(
          `elevenlabs: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (!transcription) {
      throw new Error(
        providerErrors.join(" | ") || "Transcription failed for all configured providers.",
      );
    }

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
    const status =
      message === "Invalid audio URL" || message === "Untrusted audio host"
        ? 400
        : message === "Uploaded audio is too large"
          ? 413
          : 500;
    return NextResponse.json(
      { error: message },
      { status, headers: { "x-request-id": requestId } },
    );
  }
}, "listening-session-transcribe");
