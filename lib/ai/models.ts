// Centralized defaults for OpenRouter model selection (override via env vars).

// OCR (Photo Quote Capture): multimodal, fast, cheap.
export const DEFAULT_OCR_MODEL = "google/gemini-2.5-flash";

// Import text extraction: higher-quality reasoning than Flash; still 1M ctx.
export const DEFAULT_IMPORT_MODEL = "google/gemini-3-pro-preview";

// Import fallback: strong instruction-following + structured outputs (used only if primary fails/returns empty).
export const DEFAULT_IMPORT_FALLBACK_MODEL = "anthropic/claude-4.5-sonnet";
