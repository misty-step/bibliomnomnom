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
