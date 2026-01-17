/**
 * Shared Sentry configuration with comprehensive PII scrubbing.
 * Used by client, server, and edge configs to avoid duplication.
 *
 * Deep module: Simple interface (scrubPii) hiding recursive scrubbing complexity.
 * Handles: user data, exceptions, breadcrumbs, request URLs/headers, tags, extra, contexts.
 */
import type { ErrorEvent, Exception, Breadcrumb } from "@sentry/nextjs";

// Permissive email regex - for GDPR, over-matching is safer than under-matching.
// Catches: standard emails, IP domains, plus signs, international TLDs.
const EMAIL_REGEX =
  /[a-zA-Z0-9._%+'-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9]{2,}|[a-zA-Z0-9._%+-]+@\[[^\]]+\]/g;
const REDACTED = "[EMAIL_REDACTED]";

// Headers that might contain sensitive data (case-insensitive matching)
const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "x-api-key", "x-auth-token"]);

/** Redact email addresses from a string. */
function redactEmails(text: string): string {
  return text.replace(EMAIL_REGEX, REDACTED);
}

/**
 * Recursively scrub PII from any value (string, object, array).
 * This is the core abstraction - one function that handles all data shapes.
 */
function scrubValue(value: unknown, depth = 0): unknown {
  // Prevent infinite recursion on deeply nested objects
  if (depth > 10) return value;

  if (typeof value === "string") {
    return redactEmails(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }

  if (value !== null && typeof value === "object") {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      scrubbed[key] = scrubValue(val, depth + 1);
    }
    return scrubbed;
  }

  return value;
}

/**
 * Scrub PII from Sentry events for GDPR compliance.
 *
 * Interface: Single function, same signature as Sentry's beforeSend.
 * Implementation: Comprehensive recursive scrubbing of all PII vectors.
 */
export function scrubPii(event: ErrorEvent): ErrorEvent | null {
  // 1. User data - always redact email, username could contain email
  if (event.user) {
    if (event.user.email) event.user.email = REDACTED;
    if (event.user.username) event.user.username = redactEmails(event.user.username);
    if (event.user.ip_address) event.user.ip_address = "[IP_REDACTED]";
  }

  // 2. Exception messages - primary source of accidental PII
  event.exception?.values?.forEach((ex: Exception) => {
    if (ex.value) ex.value = redactEmails(ex.value);
    if (ex.type) ex.type = redactEmails(ex.type);
  });

  // 3. Breadcrumbs - UI interactions, console logs, network requests
  event.breadcrumbs?.forEach((breadcrumb: Breadcrumb) => {
    if (breadcrumb.message) breadcrumb.message = redactEmails(breadcrumb.message);
    if (breadcrumb.category) breadcrumb.category = redactEmails(breadcrumb.category);
    if (breadcrumb.data) breadcrumb.data = scrubValue(breadcrumb.data) as Record<string, unknown>;
  });

  // 4. Request data - URLs, query strings, headers
  if (event.request) {
    if (event.request.url) event.request.url = redactEmails(event.request.url);
    if (event.request.query_string) {
      if (typeof event.request.query_string === "string") {
        event.request.query_string = redactEmails(event.request.query_string);
      } else {
        event.request.query_string = scrubValue(event.request.query_string) as Record<
          string,
          string
        >;
      }
    }

    // Scrub headers - both values and remove sensitive headers entirely
    if (event.request.headers) {
      const scrubbedHeaders: Record<string, string> = {};
      for (const [key, val] of Object.entries(event.request.headers)) {
        if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
          scrubbedHeaders[key] = "[REDACTED]";
        } else if (typeof val === "string") {
          scrubbedHeaders[key] = redactEmails(val);
        }
      }
      event.request.headers = scrubbedHeaders;
    }

    // Request body/data
    if (event.request.data) {
      event.request.data = scrubValue(event.request.data) as string | Record<string, unknown>;
    }
  }

  // 5. Tags - often contain user-provided context
  if (event.tags) {
    event.tags = scrubValue(event.tags) as Record<string, string>;
  }

  // 6. Extra context - developers may accidentally include PII
  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>;
  }

  // 7. Contexts - device, OS, browser info (usually safe, but scrub anyway)
  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as Record<string, Record<string, unknown>>;
  }

  // 8. Message (for captureMessage calls)
  if (event.message) {
    event.message = redactEmails(event.message);
  }

  return event;
}

/** Base configuration shared across all Sentry runtimes. */
export const baseConfig = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  // MVP: Higher sample rates while traffic is low, reduce as scale increases
  tracesSampleRate: 1.0,
  sendDefaultPii: false,
  enabled: process.env.NODE_ENV === "production" || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend: scrubPii,
} as const;
