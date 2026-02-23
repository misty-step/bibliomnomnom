import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsAdapter } from "@/lib/stt/adapters/elevenlabs";
import { STTError } from "@/lib/stt/types";

const AUDIO_BYTES = new Uint8Array([1, 2, 3]).buffer;
const MIME = "audio/webm";
const API_KEY = "el-test-key";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeOk(text: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ text }),
    text: async () => text,
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

describe("ElevenLabsAdapter", () => {
  it("returns transcript on success", async () => {
    mockFetch.mockResolvedValueOnce(makeOk("Hello world"));
    const adapter = new ElevenLabsAdapter(API_KEY);
    const result = await adapter.transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME });
    expect(result.provider).toBe("elevenlabs");
    expect(result.transcript).toBe("Hello world");
  });

  it("maps 401 to unauthorized", async () => {
    mockFetch.mockResolvedValueOnce(makeError(401));
    const adapter = new ElevenLabsAdapter(API_KEY);
    await expect(adapter.transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })).rejects.toSatisfy(
      (e: unknown) => e instanceof STTError && e.code === "unauthorized",
    );
  });

  it("maps 429 to rate_limited and retryable", async () => {
    mockFetch.mockResolvedValueOnce(makeError(429));
    const adapter = new ElevenLabsAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(STTError);
    const sttErr = err as STTError;
    expect(sttErr.code).toBe("rate_limited");
    expect(sttErr.retryable).toBe(true);
  });

  it("maps 413 to audio_too_large", async () => {
    mockFetch.mockResolvedValueOnce(makeError(413));
    const adapter = new ElevenLabsAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("audio_too_large");
  });

  it("maps empty text to empty_transcript", async () => {
    mockFetch.mockResolvedValueOnce(makeOk("  "));
    const adapter = new ElevenLabsAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("empty_transcript");
  });

  it("maps AbortError to timeout", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abort);
    const adapter = new ElevenLabsAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("timeout");
  });

  it("maps network errors to network_error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const adapter = new ElevenLabsAdapter(API_KEY);
    const err = await adapter
      .transcribe({ audioBytes: AUDIO_BYTES, mimeType: MIME })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(STTError);
    expect((err as STTError).code).toBe("network_error");
  });
});
