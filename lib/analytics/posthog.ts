/**
 * PostHog analytics configuration and event definitions.
 *
 * This module provides type-safe event tracking for user behavior analytics.
 * Events are designed to answer key product questions:
 * - Where do users drop off in the funnel?
 * - Which features get used most?
 * - What patterns predict retention?
 */

import posthog from "posthog-js";

// Event type definitions for type-safe tracking
export type AnalyticsEvent =
  | { name: "book_added"; properties: { source: "manual" | "import" | "search" } }
  | { name: "book_status_changed"; properties: { from: string; to: string } }
  | { name: "note_created"; properties: { type: "note" | "quote" | "reflection" } }
  | { name: "privacy_toggled"; properties: { value: "private" | "public" } }
  | { name: "cover_uploaded"; properties: { method: "file" | "url" | "search" } }
  | { name: "import_started"; properties: { format: "goodreads" | "csv" | "other" } }
  | { name: "import_completed"; properties: { book_count: number; duplicates_skipped: number } }
  | { name: "search_used"; properties: { query_length: number; results_count: number } }
  | { name: "profile_made_public"; properties: Record<string, never> }
  | { name: "signup_completed"; properties: Record<string, never> };

/**
 * Initialize PostHog with project configuration.
 * Called once on app load in the provider.
 */
export function initPostHog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Analytics] PostHog key not configured - tracking disabled");
    }
    return;
  }

  try {
    posthog.init(key, {
      // Use first-party proxy to bypass ad blockers (configured in next.config.ts rewrites)
      api_host: "/ingest",
      // Keep ui_host for PostHog toolbar and session replay playback
      ui_host: "https://us.posthog.com",
      capture_pageview: true, // Auto-capture page views
      capture_pageleave: true, // Capture when users leave
      persistence: "localStorage+cookie",
      autocapture: false, // Disable autocapture - we track explicitly
      // Respect user privacy preferences
      respect_dnt: true,
      // Debug mode in development
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") {
          ph.debug();
        }
      },
      // Graceful error handling for blocked requests
      on_xhr_error: (failedRequest) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[PostHog] Request failed:", failedRequest);
        }
      },
    });
  } catch (e) {
    // Prevent PostHog errors from breaking the app
    if (process.env.NODE_ENV === "development") {
      console.error("[PostHog] Init failed:", e);
    }
  }
}

/**
 * Identify a user with their Clerk user ID.
 * Called when user signs in to link anonymous events to their profile.
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!isPostHogReady()) return;

  posthog.identify(userId, properties);
}

/**
 * Reset user identity on sign out.
 * Creates new anonymous ID for privacy.
 */
export function resetUser() {
  if (!isPostHogReady()) return;

  posthog.reset();
}

/**
 * Type-safe event tracking.
 * Use this instead of posthog.capture directly.
 */
export function trackEvent<T extends AnalyticsEvent>(
  event: T["name"],
  properties: T["properties"],
) {
  if (!isPostHogReady()) return;

  posthog.capture(event, properties);
}

/**
 * Check if PostHog is initialized and ready.
 */
function isPostHogReady(): boolean {
  return typeof window !== "undefined" && posthog.__loaded;
}

/**
 * Get the PostHog instance for advanced use cases.
 * Prefer using trackEvent for standard tracking.
 */
export function getPostHog() {
  return posthog;
}
