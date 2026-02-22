import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeWithGateway } from "@/lib/stt/gateway";
import { STTError } from "@/lib/stt/types";
import type { FallbackPolicy, ProviderFlags, STTProvider } from "@/lib/stt/types";

const AUDIO_BYTES = new Uint8Array([1, 2, 3]).buffer;
const MIME = "audio/webm";

// Fully enable both providers in tests by default.
const ALL_ON: ProviderFlags = { elevenlabs: true, deepgram: true, assemblyai: false };
const POLICY: FallbackPolicy = { primary: "elevenlabs", secondary: "deepgram" };

// We mock at the adapter level so gateway routing logic is tested in isolation.
vi.mock("@/lib/stt/registry", () => ({
  resolveProviderFlags: vi.fn(() => ALL_ON),
  createAdapter: vi.fn(),
}));

import { createAdapter } from "@/lib/stt/registry";

const mockCreateAdapter = vi.mocked(createAdapter);

function makeAdapter(provider: STTProvider, result: "ok" | Error) {
  return {
    provider,
    transcribe: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return { provider, transcript: "hello" };
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("transcribeWithGateway", () => {
  it("returns primary result when primary succeeds", async () => {
    mockCreateAdapter.mockImplementation((p) =>
      p === "elevenlabs" ? makeAdapter("elevenlabs", "ok") : null,
    );

    const result = await transcribeWithGateway({
      audioBytes: AUDIO_BYTES,
      mimeType: MIME,
      policy: POLICY,
      flags: ALL_ON,
    });

    expect(result.provider).toBe("elevenlabs");
    expect(result.transcript).toBe("hello");
  });

  it("falls back to secondary when primary throws", async () => {
    const primaryErr = new STTError({
      code: "provider_error",
      provider: "elevenlabs",
      message: "ElevenLabs is down",
      retryable: true,
    });

    mockCreateAdapter.mockImplementation((p) => {
      if (p === "elevenlabs") return makeAdapter("elevenlabs", primaryErr);
      if (p === "deepgram") return makeAdapter("deepgram", "ok");
      return null;
    });

    const result = await transcribeWithGateway({
      audioBytes: AUDIO_BYTES,
      mimeType: MIME,
      policy: POLICY,
      flags: ALL_ON,
    });

    expect(result.provider).toBe("deepgram");
  });

  it("throws when all providers fail", async () => {
    const err = new STTError({
      code: "provider_error",
      provider: "elevenlabs",
      message: "down",
      retryable: false,
    });

    mockCreateAdapter.mockImplementation(() => makeAdapter("elevenlabs", err));

    await expect(
      transcribeWithGateway({
        audioBytes: AUDIO_BYTES,
        mimeType: MIME,
        policy: POLICY,
        flags: ALL_ON,
      }),
    ).rejects.toBeInstanceOf(STTError);
  });

  it("skips primary when kill-switched; uses secondary", async () => {
    const flags: ProviderFlags = { elevenlabs: false, deepgram: true };

    mockCreateAdapter.mockImplementation((p) =>
      p === "deepgram" ? makeAdapter("deepgram", "ok") : null,
    );

    const result = await transcribeWithGateway({
      audioBytes: AUDIO_BYTES,
      mimeType: MIME,
      policy: POLICY,
      flags,
    });

    expect(result.provider).toBe("deepgram");
    // elevenlabs adapter should never have been created
    const createdProviders = mockCreateAdapter.mock.calls.map(([p]) => p);
    expect(createdProviders).not.toContain("elevenlabs");
  });

  it("skips provider when adapter returns null (no key)", async () => {
    // elevenlabs returns null (key absent), deepgram succeeds
    mockCreateAdapter.mockImplementation((p) =>
      p === "deepgram" ? makeAdapter("deepgram", "ok") : null,
    );

    const result = await transcribeWithGateway({
      audioBytes: AUDIO_BYTES,
      mimeType: MIME,
      policy: POLICY,
      flags: ALL_ON,
    });

    expect(result.provider).toBe("deepgram");
  });

  it("throws when both providers are kill-switched", async () => {
    const flags: ProviderFlags = { elevenlabs: false, deepgram: false };
    mockCreateAdapter.mockReturnValue(null);

    await expect(
      transcribeWithGateway({
        audioBytes: AUDIO_BYTES,
        mimeType: MIME,
        policy: POLICY,
        flags,
      }),
    ).rejects.toBeInstanceOf(STTError);
  });

  it("does not duplicate secondary when secondary === primary", async () => {
    mockCreateAdapter.mockImplementation((p) =>
      p === "elevenlabs" ? makeAdapter("elevenlabs", "ok") : null,
    );

    const policy: FallbackPolicy = { primary: "elevenlabs", secondary: "elevenlabs" };
    const result = await transcribeWithGateway({
      audioBytes: AUDIO_BYTES,
      mimeType: MIME,
      policy,
      flags: ALL_ON,
    });

    expect(result.provider).toBe("elevenlabs");
    // createAdapter should only be called once
    expect(mockCreateAdapter).toHaveBeenCalledTimes(1);
  });
});
