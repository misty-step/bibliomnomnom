import { STTAdapter, STTError, FinalTranscript, STTProvider } from "../types";

const PROVIDER: STTProvider = "elevenlabs";
const TIMEOUT_MS = 25_000;
const ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";

function classifyStatus(status: number): STTError["code"] {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status === 413) return "audio_too_large";
  if (status === 415) return "unsupported_format";
  return "provider_error";
}

export class ElevenLabsAdapter implements STTAdapter {
  readonly provider = PROVIDER;

  constructor(private readonly apiKey: string) {}

  async transcribe(params: {
    audioBytes: ArrayBuffer;
    mimeType: string;
  }): Promise<FinalTranscript> {
    const model = process.env.ELEVENLABS_STT_MODEL || "scribe_v2";
    const formData = new FormData();
    formData.append("file", new Blob([params.audioBytes], { type: params.mimeType }), "audio.webm");
    formData.append("model_id", model);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "xi-api-key": this.apiKey },
        body: formData,
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new STTError({
        code: isAbort ? "timeout" : "network_error",
        provider: PROVIDER,
        message: isAbort
          ? `ElevenLabs timed out after ${TIMEOUT_MS}ms`
          : `ElevenLabs network error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new STTError({
        code: classifyStatus(response.status),
        provider: PROVIDER,
        message: `ElevenLabs ${response.status}: ${body.slice(0, 200)}`,
        retryable: response.status === 429 || response.status >= 500,
      });
    }

    const payload = (await response.json()) as { text?: string };
    const transcript = (payload.text ?? "").trim();
    if (!transcript) {
      throw new STTError({
        code: "empty_transcript",
        provider: PROVIDER,
        message: "ElevenLabs returned an empty transcript",
        retryable: false,
      });
    }

    return { provider: PROVIDER, transcript };
  }
}
