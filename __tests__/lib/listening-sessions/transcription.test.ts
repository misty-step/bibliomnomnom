import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  transcribeAudio,
  readAudioFromUrl,
  TranscribeHttpError,
} from "@/lib/listening-sessions/transcription";

const TRUSTED_URL = "https://blob.vercel-storage.com/audio/test.webm";
const AUDIO_BYTES = new Uint8Array([1, 2, 3, 4]).buffer;

function makeResponse(
  opts: {
    ok?: boolean;
    status?: number;
    body?: ArrayBuffer | null;
    contentLength?: number;
    contentType?: string;
    useReader?: boolean;
  } = {},
): Response {
  const {
    ok = true,
    status = 200,
    body = AUDIO_BYTES,
    contentLength,
    contentType = "audio/webm",
    useReader = false,
  } = opts;

  const headers = new Headers();
  if (contentLength !== undefined) headers.set("content-length", String(contentLength));
  if (contentType) headers.set("content-type", contentType);

  let bodyObj: BodyInit | null = null;
  let bodyReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  if (body !== null && !useReader) {
    bodyObj = body;
  }

  const response = {
    ok,
    status,
    headers,
    body: useReader
      ? {
          getReader: () => {
            const chunk = new Uint8Array(body as ArrayBuffer);
            let sent = false;
            return {
              read: async () => {
                if (!sent) {
                  sent = true;
                  return { done: false, value: chunk };
                }
                return { done: true, value: undefined };
              },
              cancel: async () => {},
            };
          },
        }
      : null,
    arrayBuffer: async () => body ?? new ArrayBuffer(0),
    text: async () => "error text",
    json: async () => ({}),
  } as unknown as Response;

  return response;
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  delete process.env.DEEPGRAM_STT_MODEL;
  delete process.env.ELEVENLABS_STT_MODEL;
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.DEEPGRAM_API_KEY;
});

describe("readAudioFromUrl", () => {
  it("throws on non-http protocol", async () => {
    await expect(readAudioFromUrl("ftp://blob.vercel-storage.com/audio.webm")).rejects.toThrow(
      TranscribeHttpError,
    );
  });

  it("throws on untrusted host", async () => {
    await expect(readAudioFromUrl("https://evil.example.com/audio.webm")).rejects.toThrow(
      TranscribeHttpError,
    );
  });

  it("accepts *.blob.vercel-storage.com subdomain", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse());
    const result = await readAudioFromUrl("https://sub.blob.vercel-storage.com/audio.webm");
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  });

  it("throws when fetch response is not ok", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: false, status: 503 }));
    await expect(readAudioFromUrl(TRUSTED_URL)).rejects.toThrow("Failed to fetch uploaded audio");
  });

  it("throws TranscribeHttpError when content-length declares oversized file", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ contentLength: 999_999_999 }));
    await expect(readAudioFromUrl(TRUSTED_URL)).rejects.toThrow(TranscribeHttpError);
  });

  it("reads body via arrayBuffer when no reader available", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ useReader: false }));
    const result = await readAudioFromUrl(TRUSTED_URL);
    expect(result.bytes.byteLength).toBe(AUDIO_BYTES.byteLength);
  });

  it("reads body via reader when available", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ useReader: true }));
    const result = await readAudioFromUrl(TRUSTED_URL);
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  });

  it("uses DEFAULT_AUDIO_MIME_TYPE when content-type missing", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ contentType: "" }));
    const result = await readAudioFromUrl(TRUSTED_URL);
    expect(typeof result.mimeType).toBe("string");
    expect(result.mimeType.length).toBeGreaterThan(0);
  });
});

describe("transcribeAudio", () => {
  it("throws when no provider keys configured", async () => {
    await expect(transcribeAudio(TRUSTED_URL)).rejects.toThrow("No STT provider is configured");
  });

  it("throws when only whitespace keys set", async () => {
    process.env.ELEVENLABS_API_KEY = "  ";
    process.env.DEEPGRAM_API_KEY = "  ";
    await expect(transcribeAudio(TRUSTED_URL)).rejects.toThrow("No STT provider is configured");
  });

  it("transcribes using Deepgram when key provided", async () => {
    process.env.DEEPGRAM_API_KEY = "dg-key";
    mockFetch
      .mockResolvedValueOnce(makeResponse()) // readAudioFromUrl
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            channels: [{ alternatives: [{ transcript: "Hello world", confidence: 0.99 }] }],
          },
        }),
      } as unknown as Response);

    const result = await transcribeAudio(TRUSTED_URL);
    expect(result.transcript).toBe("Hello world");
    expect(result.provider).toBe("deepgram");
    expect(result.confidence).toBe(0.99);
  });

  it("falls back to Deepgram when ElevenLabs fails", async () => {
    process.env.ELEVENLABS_API_KEY = "el-key";
    process.env.DEEPGRAM_API_KEY = "dg-key";
    mockFetch
      .mockResolvedValueOnce(makeResponse()) // readAudioFromUrl
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "bad",
      } as unknown as Response) // ElevenLabs fails (primary)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            channels: [{ alternatives: [{ transcript: "Deepgram fallback result" }] }],
          },
        }),
      } as unknown as Response);

    const result = await transcribeAudio(TRUSTED_URL);
    expect(result.transcript).toBe("Deepgram fallback result");
    expect(result.provider).toBe("deepgram");
  });

  it("falls back to Deepgram when ElevenLabs times out (AbortError)", async () => {
    process.env.ELEVENLABS_API_KEY = "el-key";
    process.env.DEEPGRAM_API_KEY = "dg-key";
    mockFetch
      .mockResolvedValueOnce(makeResponse()) // readAudioFromUrl
      .mockRejectedValueOnce(new DOMException("The operation was aborted.", "AbortError")) // ElevenLabs timeout
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            channels: [{ alternatives: [{ transcript: "Deepgram after timeout" }] }],
          },
        }),
      } as unknown as Response);

    const result = await transcribeAudio(TRUSTED_URL);
    expect(result.transcript).toBe("Deepgram after timeout");
    expect(result.provider).toBe("deepgram");
  });

  it("transcribes using ElevenLabs when only that key provided", async () => {
    process.env.ELEVENLABS_API_KEY = "el-key";
    mockFetch.mockResolvedValueOnce(makeResponse()).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "ElevenLabs only" }),
    } as unknown as Response);

    const result = await transcribeAudio(TRUSTED_URL);
    expect(result.provider).toBe("elevenlabs");
  });

  it("throws when all providers fail", async () => {
    process.env.ELEVENLABS_API_KEY = "el-key";
    process.env.DEEPGRAM_API_KEY = "dg-key";
    mockFetch
      .mockResolvedValueOnce(makeResponse())
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "el error",
      } as unknown as Response) // ElevenLabs fails (primary)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "dg error",
      } as unknown as Response); // Deepgram fails (fallback)

    await expect(transcribeAudio(TRUSTED_URL)).rejects.toThrow("elevenlabs");
  });

  it("throws when Deepgram returns empty transcript", async () => {
    process.env.DEEPGRAM_API_KEY = "dg-key";
    mockFetch.mockResolvedValueOnce(makeResponse()).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: { channels: [{ alternatives: [{ transcript: "   " }] }] } }),
    } as unknown as Response);

    await expect(transcribeAudio(TRUSTED_URL)).rejects.toThrow(
      "Deepgram returned an empty transcript",
    );
  });

  it("throws when ElevenLabs returns empty transcript", async () => {
    process.env.ELEVENLABS_API_KEY = "el-key";
    mockFetch.mockResolvedValueOnce(makeResponse()).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "" }),
    } as unknown as Response);

    await expect(transcribeAudio(TRUSTED_URL)).rejects.toThrow(
      "ElevenLabs returned an empty transcript",
    );
  });

  it("uses DEEPGRAM_STT_MODEL env var when set", async () => {
    process.env.DEEPGRAM_API_KEY = "dg-key";
    process.env.DEEPGRAM_STT_MODEL = "nova-2";
    mockFetch.mockResolvedValueOnce(makeResponse()).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: { channels: [{ alternatives: [{ transcript: "test" }] }] },
      }),
    } as unknown as Response);

    const result = await transcribeAudio(TRUSTED_URL);
    expect(result.transcript).toBe("test");
    // Verify model param was sent in the URL
    const callUrl = String(mockFetch.mock.calls[1]?.[0]);
    expect(callUrl).toContain("nova-2");
  });
});
