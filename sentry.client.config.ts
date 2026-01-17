import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment detection from Vercel
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

  // Performance sampling - 10% of requests
  tracesSampleRate: 0.1,

  // Session replay for debugging UI issues (1% of sessions, 100% on error)
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  // Disable sending PII by default
  sendDefaultPii: false,

  // PII redaction for GDPR compliance
  beforeSend(event) {
    // Redact email addresses from user context
    if (event.user?.email) {
      event.user.email = "[EMAIL_REDACTED]";
    }

    // Scrub emails from exception messages
    if (event.exception?.values) {
      event.exception.values.forEach((ex) => {
        if (ex.value) {
          ex.value = ex.value.replace(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            "[EMAIL_REDACTED]"
          );
        }
      });
    }

    // Scrub emails from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs.forEach((breadcrumb) => {
        if (breadcrumb.message) {
          breadcrumb.message = breadcrumb.message.replace(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            "[EMAIL_REDACTED]"
          );
        }
      });
    }

    return event;
  },

  // Only enable in production or when DSN is explicitly set
  enabled:
    process.env.NODE_ENV === "production" ||
    !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text for privacy
      maskAllText: true,
      // Block all media for privacy
      blockAllMedia: true,
    }),
  ],
});
