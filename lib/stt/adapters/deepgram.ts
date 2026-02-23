import { STTAdapter, STTError, FinalTranscript, STTProvider } from "../types";

const PROVIDER: STTProvider = "deepgram";
const TIMEOUT_MS = 25_000;
const ENDPOINT = "https://api.deepgram.com/v1/listen";

function classifyStatus(status: number): STTError["code"] {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status === 413) return "audio_too_large";
  if (status === 415) return "unsupported_format";
  return "provider_error";
}

export class DeepgramAdapter implements STTAdapter {
  readonly provider = PROVIDER;

  constructor(private readonly apiKey: string) {}

  async transcribe(params: {
    audioBytes: ArrayBuffer;
    mimeType: string;
  }): Promise<FinalTranscript> {
    const model = process.env.DEEPGRAM_STT_MODEL || "nova-3";
    const url = new URL(ENDPOINT);
    url.searchParams.set("model", model);
    url.searchParams.set("punctuate", "true");
    url.searchParams.set("smart_format", "true");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "Content-Type": params.mimeType,
        },
        body: params.audioBytes,
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new STTError({
        code: isAbort ? "timeout" : "network_error",
        provider: PROVIDER,
        message: isAbort
          ? `Deepgram timed out after ${TIMEOUT_MS}ms`
          : `Deepgram network error: ${err instanceof Error ? err.message : String(err)}`,
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
        message: `Deepgram ${response.status}: ${body.slice(0, 200)}`,
        retryable: response.status === 429 || response.status >= 500,
      });
    }

    type DeepgramPayload = {
      results?: {
        channels?: Array<{
          alternatives?: Array<{ transcript?: string; confidence?: number }>;
        }>;
      };
    };
    const payload = (await response.json()) as DeepgramPayload;
    const alt = payload.results?.channels?.[0]?.alternatives?.[0];
    const transcript = (alt?.transcript ?? "").trim();
    if (!transcript) {
      throw new STTError({
        code: "empty_transcript",
        provider: PROVIDER,
        message: "Deepgram returned an empty transcript",
        retryable: false,
      });
    }

    return { provider: PROVIDER, transcript, confidence: alt?.confidence };
  }
}
