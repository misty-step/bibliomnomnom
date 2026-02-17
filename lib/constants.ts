/**
 * Shared constants used across the application.
 * Keep this file free of external dependencies so it can be imported by Convex.
 */

/**
 * Trial duration in days.
 * Used by both Stripe checkout and internal trial creation.
 */
export const TRIAL_DAYS = 14;

/**
 * Trial duration in milliseconds.
 * Convenience constant for Convex functions.
 */
export const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Max bytes accepted for a single listening session audio upload/transcription.
 * Chosen to comfortably cover ~30+ minutes of `audio/webm;codecs=opus` while
 * protecting server memory (we currently buffer audio before sending to STT).
 */
export const MAX_LISTENING_SESSION_AUDIO_BYTES = 32 * 1024 * 1024; // 32 MiB
