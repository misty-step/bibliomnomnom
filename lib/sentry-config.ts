/**
 * Shared Sentry configuration.
 * Used by client, server, and edge configs to avoid duplication.
 */
import type { ErrorEvent, Exception, Breadcrumb } from "@sentry/nextjs";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const REDACTED = "[EMAIL_REDACTED]";

/** Redact email addresses from a string. */
function redactEmails(text: string): string {
  return text.replace(EMAIL_REGEX, REDACTED);
}

/** Scrub PII from Sentry events for GDPR compliance. */
export function scrubPii(event: ErrorEvent): ErrorEvent | null {
  // Redact user email
  if (event.user?.email) {
    event.user.email = REDACTED;
  }

  // Scrub exception messages
  event.exception?.values?.forEach((ex: Exception) => {
    if (ex.value) {
      ex.value = redactEmails(ex.value);
    }
  });

  // Scrub breadcrumbs (client-side only, but harmless on server)
  event.breadcrumbs?.forEach((breadcrumb: Breadcrumb) => {
    if (breadcrumb.message) {
      breadcrumb.message = redactEmails(breadcrumb.message);
    }
  });

  return event;
}

/** Base configuration shared across all Sentry runtimes. */
export const baseConfig = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  enabled: process.env.NODE_ENV === "production" || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend: scrubPii,
} as const;
