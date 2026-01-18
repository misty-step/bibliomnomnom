/**
 * Client-safe Sentry error capture utilities.
 * Use in client components where pino (Node.js only) cannot be imported.
 */
import * as Sentry from "@sentry/nextjs";

/**
 * Capture an error to Sentry with context.
 * Use in catch blocks to report errors for monitoring.
 * This is safe to use in both client and server components.
 */
export function captureError(
  error: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.error("[Sentry] Error captured:", error, context);
  }

  // Report to Sentry
  Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
  });
}

/**
 * Capture a message to Sentry for non-exception events.
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
  Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
  });
}
