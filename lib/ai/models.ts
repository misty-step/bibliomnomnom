// Centralized defaults for OpenRouter model selection (override via env vars).

// OCR (Photo Quote Capture): multimodal, fast, cheap.
export const DEFAULT_OCR_MODEL = "google/gemini-2.5-flash";

// Import text extraction: higher-quality reasoning than Flash; still 1M ctx.
export const DEFAULT_IMPORT_MODEL = "google/gemini-3-pro-preview";

// Reader Profile: literary analysis requiring good reasoning, 1M ctx for large libraries.
// Gemini 3 Flash Preview: near-Pro quality at 1/4 cost, excellent for literary analysis.
export const DEFAULT_PROFILE_MODEL = "google/gemini-3-flash-preview";

// Fallback models for profile generation (used if primary fails with 429).
export const PROFILE_FALLBACK_MODELS = [
  "google/gemini-3-flash-preview",
  "deepseek/deepseek-chat", // DeepSeek V3, 10x cheaper
  "qwen/qwen3-235b-a22b", // Qwen3 235B, extremely cheap
];
