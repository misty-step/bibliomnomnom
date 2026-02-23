import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeepgramAdapter } from "@/lib/stt/adapters/deepgram";
import { STTError } from "@/lib/stt/types";

const AUDIO_BYTES = new Uint8Array([1, 2, 3]).buffer;
const MIME = "audio/webm";
const API_KEY = "dg-test-key";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeOk(transcript: string, confidence?: number): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      results: {
        channels: [
          { alternatives: [{ transcript, ...(confidence !== undefined ? { confidence } : {}) }] },
        ],
      },
    }),
    text: async () => "",
  } as unknown as Response;
}

function makeError(status: number, body = "error"): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
  } as unknown as Response;
}

describe("DeepgramAdapter", () => {
  it("should return transcript when request succeeds", async () => {
    mockFetch.mockResolvedValueOnce(makeOk("Hello world", 0.99));
    const adapter = new DeepgramAdapter(API_KEY);
    const result = await adapter.transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME });
    expect(result.provider).toBe("deepgram");
    expect(result.transcript).toBe("Hello world");
    expect(result.confidence).toBe(0.99);
  });

  it("should map to unauthorized when response is 401", async () => {
    mockFetch.mockResolvedValueOnce(makeError(401));
    const adapter = new DeepgramAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("unauthorized");
  });

  it("should map to rate_limited and be retryable when response is 429", async () => {
    mockFetch.mockResolvedValueOnce(makeError(429));
    const adapter = new DeepgramAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(STTError);
    const sttErr = err as STTError;
    expect(sttErr.code).toBe("rate_limited");
    expect(sttErr.retryable).toBe(true);
  });

  it("should map to audio_too_large when response is 413", async () => {
    mockFetch.mockResolvedValueOnce(makeError(413));
    const adapter = new DeepgramAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("audio_too_large");
  });

  it("should map to empty_transcript when transcript is empty", async () => {
    mockFetch.mockResolvedValueOnce(makeOk("   "));
    const adapter = new DeepgramAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("empty_transcript");
  });

  it("should map to timeout when request aborts", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abort);
    const adapter = new DeepgramAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("timeout");
  });

  it("should map to network_error when request fails with a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const adapter = new DeepgramAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("network_error");
  });
});
