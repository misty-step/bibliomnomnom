import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveProviderFlags, createAdapter } from "@/lib/stt/registry";
import { ElevenLabsAdapter } from "@/lib/stt/adapters/elevenlabs";
import { DeepgramAdapter } from "@/lib/stt/adapters/deepgram";
import { AssemblyAIAdapter } from "@/lib/stt/adapters/assemblyai";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveProviderFlags", () => {
  it("defaults: elevenlabs on, deepgram on, assemblyai off", () => {
    vi.stubEnv("STT_ELEVENLABS_ENABLED", "");
    vi.stubEnv("STT_DEEPGRAM_ENABLED", "");
    vi.stubEnv("STT_ASSEMBLYAI_ENABLED", "");

    const flags = resolveProviderFlags();
    expect(flags.elevenlabs).toBe(true);
    expect(flags.deepgram).toBe(true);
    expect(flags.assemblyai).toBe(false);
  });

  it("STT_ELEVENLABS_ENABLED=false disables elevenlabs", () => {
    vi.stubEnv("STT_ELEVENLABS_ENABLED", "false");
    expect(resolveProviderFlags().elevenlabs).toBe(false);
  });

  it("STT_DEEPGRAM_ENABLED=false disables deepgram", () => {
    vi.stubEnv("STT_DEEPGRAM_ENABLED", "false");
    expect(resolveProviderFlags().deepgram).toBe(false);
  });

  it("STT_ASSEMBLYAI_ENABLED=true enables assemblyai", () => {
    vi.stubEnv("STT_ASSEMBLYAI_ENABLED", "true");
    expect(resolveProviderFlags().assemblyai).toBe(true);
  });
});

describe("createAdapter", () => {
  it("returns ElevenLabsAdapter when key is set", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "el-key");
    const adapter = createAdapter("elevenlabs");
    expect(adapter).toBeInstanceOf(ElevenLabsAdapter);
  });

  it("returns null when elevenlabs key is absent", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    expect(createAdapter("elevenlabs")).toBeNull();
  });

  it("returns DeepgramAdapter when key is set", () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "dg-key");
    const adapter = createAdapter("deepgram");
    expect(adapter).toBeInstanceOf(DeepgramAdapter);
  });

  it("returns null when deepgram key is absent", () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "");
    expect(createAdapter("deepgram")).toBeNull();
  });

  it("returns AssemblyAIAdapter when key is set", () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "aai-key");
    const adapter = createAdapter("assemblyai");
    expect(adapter).toBeInstanceOf(AssemblyAIAdapter);
  });

  it("returns null when assemblyai key is absent", () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "");
    expect(createAdapter("assemblyai")).toBeNull();
  });

  it("trims whitespace from keys", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "  el-key  ");
    const adapter = createAdapter("elevenlabs");
    expect(adapter).toBeInstanceOf(ElevenLabsAdapter);
  });
});
