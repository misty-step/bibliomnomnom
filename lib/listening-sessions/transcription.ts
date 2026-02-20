import { MAX_LISTENING_SESSION_AUDIO_BYTES } from "@/lib/constants";
import { DEFAULT_AUDIO_MIME_TYPE, normalizeAudioMimeType } from "@/lib/listening-sessions/mime";

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

function isTrustedAudioHost(hostname: string): boolean {
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

  const response = await fetch(audioUrl, { redirect: "error" });
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

async function transcribeWithDeepgram(params: {
  apiKey: string;
  audioBytes: ArrayBuffer;
  mimeType: string;
}): Promise<TranscriptionResponse> {
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
}): Promise<TranscriptionResponse> {
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

export async function transcribeAudio(
  audioUrl: string,
  deepgramKey: string | undefined,
  elevenLabsKey: string | undefined,
): Promise<TranscriptionResponse> {
  const deepgramApiKey = deepgramKey?.trim();
  const elevenLabsApiKey = elevenLabsKey?.trim();
  if (!deepgramApiKey && !elevenLabsApiKey) {
    throw new Error("No STT provider is configured. Set DEEPGRAM_API_KEY or ELEVENLABS_API_KEY.");
  }

  const { bytes, mimeType } = await readAudioFromUrl(audioUrl);

  const providerErrors: string[] = [];
  let transcription: TranscriptionResponse | null = null;

  if (deepgramApiKey) {
    try {
      transcription = await transcribeWithDeepgram({
        apiKey: deepgramApiKey,
        audioBytes: bytes,
        mimeType,
      });
    } catch (error) {
      providerErrors.push(`deepgram: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!transcription && elevenLabsApiKey) {
    try {
      transcription = await transcribeWithElevenLabs({
        apiKey: elevenLabsApiKey,
        audioBytes: bytes,
        mimeType,
      });
    } catch (error) {
      providerErrors.push(`elevenlabs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!transcription) {
    throw new Error(
      providerErrors.join(" | ") || "Transcription failed for all configured providers.",
    );
  }

  return transcription;
}
