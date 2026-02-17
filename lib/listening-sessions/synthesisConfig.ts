export type ListeningSynthesisConfig = {
  model: string;
  fallbackModels: string[];
  temperature?: number;
  maxTokens: number;
  topP?: number;
  seed?: number;
  reasoningEffort?: "low" | "medium" | "high";
};

function parseNumberEnv(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseIntEnv(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseCsvEnv(name: string): string[] {
  const raw = process.env[name]?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    output.push(item);
  }
  return output;
}

function defaultFallbackModelsFor(model: string): string[] {
  if (model === "google/gemini-3-pro-preview") {
    return ["google/gemini-3-flash-preview", "anthropic/claude-opus-4.6"];
  }
  if (model === "google/gemini-3-flash-preview") {
    return ["google/gemini-3-pro-preview", "anthropic/claude-opus-4.6"];
  }
  if (model === "anthropic/claude-opus-4.6") {
    return ["google/gemini-3-pro-preview", "google/gemini-3-flash-preview"];
  }
  if (model.startsWith("openai/gpt-5")) {
    return ["google/gemini-3-pro-preview", "anthropic/claude-opus-4.6"];
  }
  return ["google/gemini-3-pro-preview", "google/gemini-3-flash-preview"];
}

export function getListeningSynthesisConfig(): ListeningSynthesisConfig {
  const model = process.env.OPENROUTER_LISTENING_MODEL?.trim() || "google/gemini-3-pro-preview";
  const fallbackFromEnv = parseCsvEnv("OPENROUTER_LISTENING_FALLBACK_MODELS");
  const fallbackModels = uniqStrings(
    (fallbackFromEnv.length > 0 ? fallbackFromEnv : defaultFallbackModelsFor(model)).filter(
      (item) => item !== model,
    ),
  );
  const temperatureValue = parseNumberEnv("OPENROUTER_LISTENING_TEMPERATURE");
  const omitTemperature = model.startsWith("openai/gpt-5");
  const temperature =
    temperatureValue === undefined
      ? omitTemperature
        ? undefined
        : 0.35
      : clamp(temperatureValue, 0, 1.5);
  const maxTokens = clamp(parseIntEnv("OPENROUTER_LISTENING_MAX_TOKENS") ?? 4096, 512, 16_384);
  const topPValue = parseNumberEnv("OPENROUTER_LISTENING_TOP_P");
  const topP = topPValue === undefined ? undefined : clamp(topPValue, 0, 1);
  const seed = parseIntEnv("OPENROUTER_LISTENING_SEED");
  const reasoningEffortRaw = process.env.OPENROUTER_LISTENING_REASONING_EFFORT?.trim();
  const reasoningEffort =
    reasoningEffortRaw === "low" || reasoningEffortRaw === "medium" || reasoningEffortRaw === "high"
      ? reasoningEffortRaw
      : undefined;

  return {
    model,
    fallbackModels,
    temperature,
    maxTokens,
    topP,
    seed,
    reasoningEffort,
  };
}
