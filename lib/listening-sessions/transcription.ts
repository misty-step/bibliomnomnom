import { MAX_LISTENING_SESSION_AUDIO_BYTES } from "@/lib/constants";
import { DEFAULT_AUDIO_MIME_TYPE, normalizeAudioMimeType } from "@/lib/listening-sessions/mime";
import { ElevenLabsAdapter } from "@/lib/stt/adapters/elevenlabs";
import { DeepgramAdapter } from "@/lib/stt/adapters/deepgram";

export type TranscriptionResponse = {
  transcript: string;
  provider: "deepgram" | "elevenlabs";
  confidence?: number;
};

export class TranscribeHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TranscribeHttpError";
    this.status = status;
  }
}

function cleanTranscript(input: string): string {
  return input
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isTrustedAudioHost(hostname: string): boolean {
  return hostname === "blob.vercel-storage.com" || hostname.endsWith(".blob.vercel-storage.com");
}

async function readArrayBufferLimited(response: Response, maxBytes: number): Promise<ArrayBuffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new TranscribeHttpError(413, "Uploaded audio is too large");
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > maxBytes) {
      throw new TranscribeHttpError(413, "Uploaded audio is too large");
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
      throw new TranscribeHttpError(413, "Uploaded audio is too large");
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

export async function readAudioFromUrl(
  audioUrl: string,
): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  const parsed = new URL(audioUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new TranscribeHttpError(400, "Invalid audio URL");
  }
  if (!isTrustedAudioHost(parsed.hostname)) {
    throw new TranscribeHttpError(400, "Untrusted audio host");
  }

  // Vercel Blob is same-infra; 10s is generous. Keeps total budget
  // (10s fetch + 25s ElevenLabs + 25s Deepgram) within 60s maxDuration.
  const response = await fetchWithTimeout(audioUrl, { redirect: "error" }, 10_000);
  if (!response.ok) {
    throw new Error(`Failed to fetch uploaded audio: ${response.status}`);
  }

  const bytes = await readArrayBufferLimited(response, MAX_LISTENING_SESSION_AUDIO_BYTES);
  if (!bytes.byteLength) {
    throw new Error("Uploaded audio is empty");
  }

  const mimeType =
    normalizeAudioMimeType(response.headers.get("content-type")) ?? DEFAULT_AUDIO_MIME_TYPE;
  return { bytes, mimeType };
}

export async function transcribeAudio(
  audioUrl: string,
  elevenLabsKey: string | undefined,
  deepgramKey: string | undefined,
): Promise<TranscriptionResponse> {
  const elevenLabsApiKey = elevenLabsKey?.trim();
  const deepgramApiKey = deepgramKey?.trim();
  if (!deepgramApiKey && !elevenLabsApiKey) {
    throw new Error("No STT provider is configured. Set DEEPGRAM_API_KEY or ELEVENLABS_API_KEY.");
  }

  const { bytes, mimeType } = await readAudioFromUrl(audioUrl);

  // Build ordered adapter list (ElevenLabs primary, Deepgram fallback).
  // Adapters are constructed with the explicit keys passed by the caller so
  // this function works even when env vars are not set (e.g. in tests).
  const adapters = [
    elevenLabsApiKey ? new ElevenLabsAdapter(elevenLabsApiKey) : null,
    deepgramApiKey ? new DeepgramAdapter(deepgramApiKey) : null,
  ].filter((a): a is ElevenLabsAdapter | DeepgramAdapter => a !== null);

  const errors: string[] = [];
  for (const adapter of adapters) {
    try {
      const result = await adapter.transcribe({ audioBytes: bytes, mimeType });
      return {
        transcript: cleanTranscript(result.transcript),
        provider: result.provider as "elevenlabs" | "deepgram",
        confidence: result.confidence,
      };
    } catch (err) {
      errors.push(`${adapter.provider}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(errors.join(" | ") || "Transcription failed for all configured providers.");
}
