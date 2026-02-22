import { STTAdapter, STTError, FinalTranscript, STTProvider } from "../types";

const PROVIDER: STTProvider = "assemblyai";
const UPLOAD_ENDPOINT = "https://api.assemblyai.com/v2/upload";
const TRANSCRIPT_ENDPOINT = "https://api.assemblyai.com/v2/transcript";
const UPLOAD_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_MS = 60_000;

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: apiKey };
}

export class AssemblyAIAdapter implements STTAdapter {
  readonly provider = PROVIDER;

  constructor(private readonly apiKey: string) {}

  async transcribe(params: {
    audioBytes: ArrayBuffer;
    mimeType: string;
  }): Promise<FinalTranscript> {
    // Step 1: upload audio, get upload_url
    const uploadUrl = await this.upload(params.audioBytes, params.mimeType);

    // Step 2: submit transcript job
    const jobId = await this.submitJob(uploadUrl);

    // Step 3: poll until done
    return this.poll(jobId);
  }

  private async upload(audioBytes: ArrayBuffer, mimeType: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(UPLOAD_ENDPOINT, {
        method: "POST",
        headers: { ...authHeaders(this.apiKey), "Content-Type": mimeType },
        body: audioBytes,
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new STTError({
        code: isAbort ? "timeout" : "network_error",
        provider: PROVIDER,
        message: isAbort
          ? "AssemblyAI upload timed out"
          : `AssemblyAI upload failed: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new STTError({
        code:
          response.status === 401 || response.status === 403 ? "unauthorized" : "provider_error",
        provider: PROVIDER,
        message: `AssemblyAI upload ${response.status}: ${body.slice(0, 200)}`,
        retryable: response.status >= 500,
      });
    }

    const payload = (await response.json()) as { upload_url?: string };
    if (!payload.upload_url) {
      throw new STTError({
        code: "provider_error",
        provider: PROVIDER,
        message: "AssemblyAI upload did not return upload_url",
      });
    }
    return payload.upload_url;
  }

  private async submitJob(audioUrl: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(TRANSCRIPT_ENDPOINT, {
        method: "POST",
        headers: { ...authHeaders(this.apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: audioUrl }),
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new STTError({
        code: isAbort ? "timeout" : "network_error",
        provider: PROVIDER,
        message: isAbort
          ? "AssemblyAI job submit timed out"
          : `AssemblyAI submit failed: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new STTError({
        code:
          response.status === 401 || response.status === 403 ? "unauthorized" : "provider_error",
        provider: PROVIDER,
        message: `AssemblyAI submit ${response.status}: ${body.slice(0, 200)}`,
        retryable: response.status >= 500,
      });
    }

    const payload = (await response.json()) as { id?: string };
    if (!payload.id) {
      throw new STTError({
        code: "provider_error",
        provider: PROVIDER,
        message: "AssemblyAI submit did not return job id",
      });
    }
    return payload.id;
  }

  private async poll(jobId: string): Promise<FinalTranscript> {
    const deadline = Date.now() + POLL_MAX_MS;
    const url = `${TRANSCRIPT_ENDPOINT}/${jobId}`;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(url, {
          headers: authHeaders(this.apiKey),
          signal: controller.signal,
        });
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        throw new STTError({
          code: isAbort ? "timeout" : "network_error",
          provider: PROVIDER,
          message: isAbort
            ? "AssemblyAI poll timed out"
            : `AssemblyAI poll failed: ${err instanceof Error ? err.message : String(err)}`,
          retryable: true,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new STTError({
          code: "provider_error",
          provider: PROVIDER,
          message: `AssemblyAI poll ${response.status}: ${body.slice(0, 200)}`,
          retryable: response.status >= 500,
        });
      }

      type PollPayload = { status: string; text?: string; error?: string };
      const payload = (await response.json()) as PollPayload;

      if (payload.status === "completed") {
        const transcript = (payload.text ?? "").trim();
        if (!transcript) {
          throw new STTError({
            code: "empty_transcript",
            provider: PROVIDER,
            message: "AssemblyAI returned an empty transcript",
          });
        }
        return { provider: PROVIDER, transcript };
      }

      if (payload.status === "error") {
        throw new STTError({
          code: "provider_error",
          provider: PROVIDER,
          message: `AssemblyAI transcription error: ${payload.error ?? "unknown"}`,
          retryable: false,
        });
      }

      // status is "queued" or "processing" — keep polling
    }

    throw new STTError({
      code: "timeout",
      provider: PROVIDER,
      message: `AssemblyAI job ${jobId} did not complete within ${POLL_MAX_MS}ms`,
      retryable: true,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
