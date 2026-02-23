import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssemblyAIAdapter } from "@/lib/stt/adapters/assemblyai";
import { STTError } from "@/lib/stt/types";

const AUDIO_BYTES = new Uint8Array([1, 2, 3]).buffer;
const MIME = "audio/webm";
const API_KEY = "aai-test-key";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function makeResponse(body: unknown, status = 200): Response {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** Drive a complete upload → submit → poll cycle via mockFetch. */
function mockHappyPath(transcript: string): void {
  // 1. upload → upload_url
  mockFetch.mockResolvedValueOnce(
    makeResponse({ upload_url: "https://cdn.assemblyai.com/audio/123" }),
  );
  // 2. submit → job id
  mockFetch.mockResolvedValueOnce(makeResponse({ id: "job-abc" }));
  // 3. first poll → processing
  mockFetch.mockResolvedValueOnce(makeResponse({ status: "processing" }));
  // 4. second poll → completed
  mockFetch.mockResolvedValueOnce(makeResponse({ status: "completed", text: transcript }));
}

describe("AssemblyAIAdapter", () => {
  it("should return transcript when polling completes", async () => {
    mockHappyPath("Hello world");
    const adapter = new AssemblyAIAdapter(API_KEY);

    const promise = adapter.transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME });
    // Advance past poll intervals
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.provider).toBe("assemblyai");
    expect(result.transcript).toBe("Hello world");
  });

  it("should map to unauthorized when upload returns 401", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 401));
    const adapter = new AssemblyAIAdapter(API_KEY);

    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("unauthorized");
  });

  it("should map to provider_error when job status is error", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ upload_url: "https://cdn.assemblyai.com/audio/123" }),
    );
    mockFetch.mockResolvedValueOnce(makeResponse({ id: "job-abc" }));
    mockFetch.mockResolvedValueOnce(makeResponse({ status: "error", error: "bad audio" }));

    const adapter = new AssemblyAIAdapter(API_KEY);
    // Attach catch BEFORE advancing timers to avoid unhandled rejection
    const errPromise = adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5_000);
    const err = await errPromise;

    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("provider_error");
    expect((err as STTError).retryable).toBe(false);
  });

  it("should map to empty_transcript when completed transcript is empty", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ upload_url: "https://cdn.assemblyai.com/audio/123" }),
    );
    mockFetch.mockResolvedValueOnce(makeResponse({ id: "job-abc" }));
    mockFetch.mockResolvedValueOnce(makeResponse({ status: "completed", text: "   " }));

    const adapter = new AssemblyAIAdapter(API_KEY);
    // Attach catch BEFORE advancing timers to avoid unhandled rejection
    const errPromise = adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5_000);
    const err = await errPromise;

    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("empty_transcript");
  });

  it("should map to network_error when upload fails with a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const adapter = new AssemblyAIAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("network_error");
  });

  it("should map to timeout when upload aborts", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abort);
    const adapter = new AssemblyAIAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("timeout");
  });
});
