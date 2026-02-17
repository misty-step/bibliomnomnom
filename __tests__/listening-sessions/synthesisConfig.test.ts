import { afterEach, describe, expect, it } from "vitest";
import { getListeningSynthesisConfig } from "@/lib/listening-sessions/synthesisConfig";

const KEYS = [
  "OPENROUTER_LISTENING_MODEL",
  "OPENROUTER_LISTENING_FALLBACK_MODELS",
  "OPENROUTER_LISTENING_TEMPERATURE",
  "OPENROUTER_LISTENING_MAX_TOKENS",
  "OPENROUTER_LISTENING_TOP_P",
  "OPENROUTER_LISTENING_SEED",
  "OPENROUTER_LISTENING_REASONING_EFFORT",
];

const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

function resetEnv() {
  for (const key of KEYS) {
    const value = original[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("listening sessions synthesis config", () => {
  it("uses defaults when env is unset", () => {
    for (const key of KEYS) delete process.env[key];

    const config = getListeningSynthesisConfig();
    expect(config.model).toBe("google/gemini-3-pro-preview");
    expect(config.fallbackModels).toEqual([
      "google/gemini-3-flash-preview",
      "anthropic/claude-opus-4.6",
    ]);
    expect(config.temperature).toBe(0.35);
    expect(config.maxTokens).toBe(4096);
    expect(config.topP).toBeUndefined();
    expect(config.seed).toBeUndefined();
    expect(config.reasoningEffort).toBeUndefined();
  });

  it("omits temperature by default for OpenAI GPT-5 models", () => {
    for (const key of KEYS) delete process.env[key];
    process.env.OPENROUTER_LISTENING_MODEL = "openai/gpt-5-mini";

    const config = getListeningSynthesisConfig();
    expect(config.model).toBe("openai/gpt-5-mini");
    expect(config.temperature).toBeUndefined();
    expect(config.fallbackModels).toEqual([
      "google/gemini-3-pro-preview",
      "anthropic/claude-opus-4.6",
    ]);
  });

  it("respects a user-supplied temperature even for GPT-5 models", () => {
    for (const key of KEYS) delete process.env[key];
    process.env.OPENROUTER_LISTENING_MODEL = "openai/gpt-5-mini";
    process.env.OPENROUTER_LISTENING_TEMPERATURE = "2.5";

    const config = getListeningSynthesisConfig();
    expect(config.temperature).toBe(1.5);
  });

  it("deduplicates and filters fallback models from env", () => {
    for (const key of KEYS) delete process.env[key];
    process.env.OPENROUTER_LISTENING_MODEL = "anthropic/claude-opus-4.6";
    process.env.OPENROUTER_LISTENING_FALLBACK_MODELS =
      "anthropic/claude-opus-4.6, google/gemini-3-flash-preview, google/gemini-3-flash-preview";

    const config = getListeningSynthesisConfig();
    expect(config.fallbackModels).toEqual(["google/gemini-3-flash-preview"]);
  });

  it("clamps maxTokens and parses additional knobs", () => {
    for (const key of KEYS) delete process.env[key];
    process.env.OPENROUTER_LISTENING_MODEL = "mystery/model";
    process.env.OPENROUTER_LISTENING_MAX_TOKENS = "999999";
    process.env.OPENROUTER_LISTENING_TOP_P = "1.7";
    process.env.OPENROUTER_LISTENING_SEED = "42";
    process.env.OPENROUTER_LISTENING_REASONING_EFFORT = "medium";

    const config = getListeningSynthesisConfig();
    expect(config.model).toBe("mystery/model");
    expect(config.fallbackModels).toEqual([
      "google/gemini-3-pro-preview",
      "google/gemini-3-flash-preview",
    ]);
    expect(config.maxTokens).toBe(16384);
    expect(config.topP).toBe(1);
    expect(config.seed).toBe(42);
    expect(config.reasoningEffort).toBe("medium");
  });
});

afterEach(() => {
  resetEnv();
});
