import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "@/lib/listening-sessions/transcription";

const TRUSTED_URL = "https://blob.vercel-storage.com/audio/test.webm";
const AUDIO_BYTES = new Uint8Array([1, 2, 3, 4]).buffer;

function makeAudioResponse(): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({
      "content-type": "audio/webm",
      "content-length": String(AUDIO_BYTES.byteLength),
    }),
    body: null,
    arrayBuffer: async () => AUDIO_BYTES,
    text: async () => "",
    json: async () => ({}),
  } as unknown as Response;
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("transcription provider fallback reliability", () => {
  it("falls back to Deepgram when ElevenLabs returns 503", async () => {
    mockFetch
      .mockResolvedValueOnce(makeAudioResponse())
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "Service unavailable",
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            channels: [{ alternatives: [{ transcript: "Deepgram recovered transcript" }] }],
          },
        }),
      } as unknown as Response);

    const result = await transcribeAudio(TRUSTED_URL, "el-key", "dg-key");
    expect(result.provider).toBe("deepgram");
    expect(result.transcript).toBe("Deepgram recovered transcript");
  });

  it("throws when both providers fail", async () => {
    mockFetch
      .mockResolvedValueOnce(makeAudioResponse())
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "ElevenLabs down",
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Deepgram down",
      } as unknown as Response);

    await expect(transcribeAudio(TRUSTED_URL, "el-key", "dg-key")).rejects.toThrow("deepgram");
  });

  it("returns transcript even if confidence is undefined", async () => {
    mockFetch.mockResolvedValueOnce(makeAudioResponse()).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: {
          channels: [{ alternatives: [{ transcript: "Transcript without confidence" }] }],
        },
      }),
    } as unknown as Response);

    const result = await transcribeAudio(TRUSTED_URL, undefined, "dg-key");
    expect(result.provider).toBe("deepgram");
    expect(result.transcript).toBe("Transcript without confidence");
    expect(result.confidence).toBeUndefined();
  });

  it("cleans up timeout on provider success", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    mockFetch.mockResolvedValueOnce(makeAudioResponse()).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: {
          channels: [{ alternatives: [{ transcript: "Successful transcription" }] }],
        },
      }),
    } as unknown as Response);

    await transcribeAudio(TRUSTED_URL, undefined, "dg-key");
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
