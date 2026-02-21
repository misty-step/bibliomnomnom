/**
 * Cost estimation helpers for listening session synthesis.
 * Pure functions — no side effects, no imports.
 */

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "google/gemini": { input: 1.25, output: 10.0 },
  "anthropic/claude": { input: 15.0, output: 75.0 },
  "openai/gpt": { input: 10.0, output: 30.0 },
};

/** Estimate synthesis cost in USD from model name and token counts. */
export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const family = Object.keys(COST_PER_1M).find((key) => model.startsWith(key)) ?? "google/gemini";
  const rates = COST_PER_1M[family]!;
  return (promptTokens * rates.input + completionTokens * rates.output) / 1_000_000;
}

/**
 * Normalize provider-specific usage objects into canonical token counts.
 * Handles OpenAI (prompt_tokens/completion_tokens), Anthropic (input_tokens/output_tokens),
 * and Google (total_tokens only). When only total_tokens is present, derives
 * promptTokens as max(total - completion, 0) to avoid double-counting.
 */
export function getUsageTokens(usage: unknown): { promptTokens: number; completionTokens: number } {
  const asRecord =
    usage && typeof usage === "object"
      ? (usage as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const promptTokensRaw = asRecord.prompt_tokens ?? asRecord.input_tokens;
  const completionTokensRaw = asRecord.completion_tokens ?? asRecord.output_tokens;
  const totalTokensRaw = asRecord.total_tokens;

  const completionTokens =
    typeof completionTokensRaw === "number" && Number.isFinite(completionTokensRaw)
      ? Math.max(0, Math.floor(completionTokensRaw))
      : 0;

  const promptTokens =
    typeof promptTokensRaw === "number" && Number.isFinite(promptTokensRaw)
      ? Math.max(0, Math.floor(promptTokensRaw))
      : typeof totalTokensRaw === "number" && Number.isFinite(totalTokensRaw)
        ? Math.max(0, Math.floor(totalTokensRaw) - completionTokens)
        : 0;

  return { promptTokens, completionTokens };
}
