/**
 * Typed pipeline stages for listening session error attribution.
 *
 * Used by the client hook, API routes, and Convex mutations to track
 * which stage failed during session processing. Extracted to prevent
 * magic string drift across call sites.
 */

export const PIPELINE_STAGES = [
  "recording",
  "uploading",
  "transcribing",
  "synthesizing",
  "completing",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
