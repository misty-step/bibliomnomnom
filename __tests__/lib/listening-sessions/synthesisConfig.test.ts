import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { getListeningSynthesisConfig } from "../../../lib/listening-sessions/synthesisConfig";

describe("listening session synthesis config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("defaults to Gemini 3 Pro Preview with sensible fallbacks", () => {
    delete process.env.OPENROUTER_LISTENING_MODEL;
    delete process.env.OPENROUTER_LISTENING_FALLBACK_MODELS;
    delete process.env.OPENROUTER_LISTENING_TEMPERATURE;
    delete process.env.OPENROUTER_LISTENING_MAX_TOKENS;

    const config = getListeningSynthesisConfig();
    expect(config.model).toBe("google/gemini-3-pro-preview");
    expect(config.fallbackModels).toEqual([
      "google/gemini-3-flash-preview",
      "anthropic/claude-opus-4.6",
    ]);
    expect(config.temperature).toBe(0.35);
    expect(config.maxTokens).toBe(4096);
  });

  it("defaults fallback models based on the chosen model", () => {
    process.env.OPENROUTER_LISTENING_MODEL = "google/gemini-3-flash-preview";
    delete process.env.OPENROUTER_LISTENING_FALLBACK_MODELS;

    const config = getListeningSynthesisConfig();
    expect(config.model).toBe("google/gemini-3-flash-preview");
    expect(config.fallbackModels).toEqual([
      "google/gemini-3-pro-preview",
      "anthropic/claude-opus-4.6",
    ]);
  });

  it("dedupes fallback models and removes the primary model", () => {
    process.env.OPENROUTER_LISTENING_MODEL = "google/gemini-3-pro-preview";
    process.env.OPENROUTER_LISTENING_FALLBACK_MODELS =
      " google/gemini-3-pro-preview,google/gemini-3-flash-preview,google/gemini-3-flash-preview , anthropic/claude-opus-4.6 ";

    const config = getListeningSynthesisConfig();
    expect(config.fallbackModels).toEqual([
      "google/gemini-3-flash-preview",
      "anthropic/claude-opus-4.6",
    ]);
  });

  it("omits temperature by default for OpenAI GPT-5 models", () => {
    process.env.OPENROUTER_LISTENING_MODEL = "openai/gpt-5.2";
    delete process.env.OPENROUTER_LISTENING_TEMPERATURE;

    const config = getListeningSynthesisConfig();
    expect(config.temperature).toBeUndefined();
  });

  it("parses reasoning effort when valid", () => {
    process.env.OPENROUTER_LISTENING_REASONING_EFFORT = "high";

    const config = getListeningSynthesisConfig();
    expect(config.reasoningEffort).toBe("high");
  });

  it("ignores invalid reasoning effort", () => {
    process.env.OPENROUTER_LISTENING_REASONING_EFFORT = "extreme";

    const config = getListeningSynthesisConfig();
    expect(config.reasoningEffort).toBeUndefined();
  });
});
