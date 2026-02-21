import { describe, expect, it } from "vitest";
import { estimateCostUsd, getUsageTokens } from "@/lib/listening-sessions/cost-estimation";

describe("estimateCostUsd", () => {
  it("computes Gemini cost from google/gemini prefix", () => {
    // 1M prompt @ $1.25 + 1M completion @ $10 = $11.25
    expect(estimateCostUsd("google/gemini-2.0-flash", 1_000_000, 1_000_000)).toBeCloseTo(11.25);
  });

  it("computes Claude cost from anthropic/claude prefix", () => {
    // 1M prompt @ $15 + 1M completion @ $75 = $90
    expect(estimateCostUsd("anthropic/claude-3-5-sonnet", 1_000_000, 1_000_000)).toBeCloseTo(90);
  });

  it("computes GPT cost from openai/gpt prefix", () => {
    // 1M prompt @ $10 + 1M completion @ $30 = $40
    expect(estimateCostUsd("openai/gpt-4o", 1_000_000, 1_000_000)).toBeCloseTo(40);
  });

  it("falls back to gemini rates for unknown model prefix", () => {
    const unknown = estimateCostUsd("unknown/model-x", 1_000_000, 1_000_000);
    const gemini = estimateCostUsd("google/gemini-2.0-flash", 1_000_000, 1_000_000);
    expect(unknown).toBeCloseTo(gemini);
  });

  it("returns 0 for zero tokens", () => {
    expect(estimateCostUsd("google/gemini-2.0-flash", 0, 0)).toBe(0);
  });

  it("clamps negative token inputs to non-negative cost", () => {
    expect(estimateCostUsd("google/gemini-2.0-flash", -100, -50)).toBe(0);
  });

  it("handles one negative and one positive token input", () => {
    // Negative prompt + positive completion: net could go negative, must clamp
    const cost = estimateCostUsd("google/gemini-2.0-flash", -1_000_000, 100);
    expect(cost).toBeGreaterThanOrEqual(0);
  });

  it("handles realistic small session (1k prompt, 500 completion tokens)", () => {
    // google/gemini: (1000 * 1.25 + 500 * 10) / 1_000_000 = 0.000006250
    const cost = estimateCostUsd("google/gemini-2.0-flash", 1_000, 500);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.01); // sanity check — far under any cap
  });
});

describe("getUsageTokens", () => {
  it("reads OpenAI-style prompt_tokens / completion_tokens", () => {
    expect(
      getUsageTokens({ prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 }),
    ).toEqual({ promptTokens: 1000, completionTokens: 500 });
  });

  it("reads Anthropic-style input_tokens / output_tokens", () => {
    expect(getUsageTokens({ input_tokens: 800, output_tokens: 200 })).toEqual({
      promptTokens: 800,
      completionTokens: 200,
    });
  });

  it("derives promptTokens from total_tokens when prompt field absent", () => {
    // total=1500, completion=400 → prompt = 1500-400 = 1100 (no double-count)
    expect(getUsageTokens({ completion_tokens: 400, total_tokens: 1500 })).toEqual({
      promptTokens: 1100,
      completionTokens: 400,
    });
  });

  it("clamps derived promptTokens to 0 when completion > total", () => {
    // Malformed response: completion_tokens=1600 > total_tokens=1500
    expect(getUsageTokens({ completion_tokens: 1600, total_tokens: 1500 })).toEqual({
      promptTokens: 0,
      completionTokens: 1600,
    });
  });

  it("returns zeros for null/undefined usage", () => {
    expect(getUsageTokens(null)).toEqual({ promptTokens: 0, completionTokens: 0 });
    expect(getUsageTokens(undefined)).toEqual({ promptTokens: 0, completionTokens: 0 });
  });

  it("returns zeros for non-finite values (NaN, Infinity)", () => {
    expect(getUsageTokens({ prompt_tokens: NaN, completion_tokens: Infinity })).toEqual({
      promptTokens: 0,
      completionTokens: 0,
    });
  });

  it("floors fractional token counts", () => {
    expect(getUsageTokens({ prompt_tokens: 100.9, completion_tokens: 50.1 })).toEqual({
      promptTokens: 100,
      completionTokens: 50,
    });
  });

  it("prefers explicit prompt_tokens over total fallback", () => {
    // When both are present, use the explicit field, not derived
    expect(
      getUsageTokens({ prompt_tokens: 300, completion_tokens: 200, total_tokens: 9999 }),
    ).toEqual({ promptTokens: 300, completionTokens: 200 });
  });

  it("prefers prompt_tokens over input_tokens when both present", () => {
    // OpenAI-style takes precedence via ?? operator
    expect(
      getUsageTokens({ prompt_tokens: 500, input_tokens: 999, completion_tokens: 100 }),
    ).toEqual({ promptTokens: 500, completionTokens: 100 });
  });

  it("prefers completion_tokens over output_tokens when both present", () => {
    expect(
      getUsageTokens({ prompt_tokens: 100, completion_tokens: 200, output_tokens: 999 }),
    ).toEqual({ promptTokens: 100, completionTokens: 200 });
  });

  it("clamps negative token values to zero", () => {
    expect(getUsageTokens({ prompt_tokens: -100, completion_tokens: -50 })).toEqual({
      promptTokens: 0,
      completionTokens: 0,
    });
  });

  it("returns zeros for empty object", () => {
    expect(getUsageTokens({})).toEqual({ promptTokens: 0, completionTokens: 0 });
  });
});
