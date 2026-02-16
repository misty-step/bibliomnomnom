import { DEFAULT_MODEL } from "@/lib/ai/models";

export type ListeningSynthesisConfig = {
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  seed?: number;
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

export function getListeningSynthesisConfig(): ListeningSynthesisConfig {
  const model = process.env.OPENROUTER_LISTENING_MODEL?.trim() || DEFAULT_MODEL;
  const temperature = clamp(parseNumberEnv("OPENROUTER_LISTENING_TEMPERATURE") ?? 0.35, 0, 1.5);
  const maxTokens = clamp(parseIntEnv("OPENROUTER_LISTENING_MAX_TOKENS") ?? 4096, 512, 8192);
  const topPValue = parseNumberEnv("OPENROUTER_LISTENING_TOP_P");
  const topP = topPValue === undefined ? undefined : clamp(topPValue, 0, 1);
  const seed = parseIntEnv("OPENROUTER_LISTENING_SEED");

  return {
    model,
    temperature,
    maxTokens,
    topP,
    seed,
  };
}
