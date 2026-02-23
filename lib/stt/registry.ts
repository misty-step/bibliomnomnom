import type { STTAdapter, STTProvider, ProviderFlags } from "./types";
import { ElevenLabsAdapter } from "./adapters/elevenlabs";
import { DeepgramAdapter } from "./adapters/deepgram";
import { AssemblyAIAdapter } from "./adapters/assemblyai";

/** Read provider kill-switch flags from environment. */
export function resolveProviderFlags(): ProviderFlags {
  return {
    elevenlabs: process.env.STT_ELEVENLABS_ENABLED !== "false",
    deepgram: process.env.STT_DEEPGRAM_ENABLED !== "false",
    assemblyai: process.env.STT_ASSEMBLYAI_ENABLED === "true",
  };
}

/**
 * Construct a provider adapter using the API key from environment.
 * Returns null if the key is absent (provider not configured).
 */
export function createAdapter(provider: STTProvider): STTAdapter | null {
  switch (provider) {
    case "elevenlabs": {
      const key = process.env.ELEVENLABS_API_KEY?.trim();
      return key ? new ElevenLabsAdapter(key) : null;
    }
    case "deepgram": {
      const key = process.env.DEEPGRAM_API_KEY?.trim();
      return key ? new DeepgramAdapter(key) : null;
    }
    case "assemblyai": {
      const key = process.env.ASSEMBLYAI_API_KEY?.trim();
      return key ? new AssemblyAIAdapter(key) : null;
    }
    default: {
      const _exhaustive: never = provider;
      return null;
    }
  }
}
