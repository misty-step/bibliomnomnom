// Centralized defaults for OpenRouter model selection (override via env vars).
// Standardized on Gemini 3 Flash Preview: near-Pro quality, 1M context, cost-effective.

export const DEFAULT_MODEL = "google/gemini-3-flash-preview";

// OCR (Photo Quote Capture)
export const DEFAULT_OCR_MODEL = DEFAULT_MODEL;

// Import text extraction
export const DEFAULT_IMPORT_MODEL = DEFAULT_MODEL;

// Reader Profile
export const DEFAULT_PROFILE_MODEL = DEFAULT_MODEL;

// Fallback models for profile generation (used if primary fails with 429).
export const PROFILE_FALLBACK_MODELS = [
  "deepseek/deepseek-chat", // DeepSeek V3, 10x cheaper
  "qwen/qwen3-235b-a22b", // Qwen3 235B, extremely cheap
];
