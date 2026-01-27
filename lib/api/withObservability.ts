/**
 * Observability wrapper for API routes
 *
 * Wraps Next.js API route handlers with:
 * - Structured JSON logging (captured by Vercel)
 * - Error capture to Sentry
 * - Request/response timing
 * - PII scrubbing for sensitive query parameters
 *
 * Note: Uses console.log with JSON for compatibility with Next.js edge bundling.
 * Pino is available for server-only code but causes bundling issues in API routes.
 *
 * @example
 * ```typescript
 * export const GET = withObservability(async (req) => {
 *   // handler logic
 *   return NextResponse.json({ data });
 * }, "blob-upload");
 * ```
 */
import * as Sentry from "@sentry/nextjs";

/** Query parameter keys that should be redacted from logs */
const SENSITIVE_PARAMS = new Set([
  "token",
  "key",
  "secret",
  "password",
  "email",
  "code",
  "session",
  "signature",
]);

/**
 * Scrub sensitive query parameters from a URL for safe logging.
 * Returns URL path + sanitized query string.
 */
function scrubUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    let hasSensitive = false;

    for (const key of params.keys()) {
      if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
        params.set(key, "[REDACTED]");
        hasSensitive = true;
      }
    }

    if (hasSensitive) {
      return `${parsed.pathname}?${params.toString()}`;
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    // If URL parsing fails, return a safe placeholder
    return "[invalid-url]";
  }
}

type ObservabilityOptions = {
  metadata?: Record<string, unknown>;
  skipErrorCapture?: boolean;
};

type LogLevel = "info" | "warn" | "error";

/** Structured log output for Vercel to capture */
export function log(level: LogLevel, data: Record<string, unknown>): void;
export function log(level: LogLevel, msg: string, data?: Record<string, unknown>): void;
export function log(
  level: LogLevel,
  msgOrData: string | Record<string, unknown>,
  data?: Record<string, unknown>,
): void {
  const payload = typeof msgOrData === "string" ? { msg: msgOrData, ...(data ?? {}) } : msgOrData;
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  // JSON output captured by Vercel logs
  if (level === "error") {
    console.error(JSON.stringify(entry));
    return;
  }
  console.log(JSON.stringify(entry));
}

export function withObservability(
  handler: (req: Request) => Promise<Response>,
  operationName: string,
  options: ObservabilityOptions = {},
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const start = Date.now();
    const requestId = crypto.randomUUID().slice(0, 8);

    const context = {
      operation: operationName,
      requestId,
      ...options.metadata,
    };

    try {
      log("info", {
        ...context,
        msg: "request_start",
        method: req.method,
        url: scrubUrl(req.url),
      });

      const response = await handler(req);
      const duration = Date.now() - start;

      log("info", {
        ...context,
        msg: "request_success",
        status: response.status,
        duration_ms: duration,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - start;

      if (!options.skipErrorCapture) {
        log("error", {
          ...context,
          msg: "request_error",
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          duration_ms: duration,
        });

        // Send to Sentry with context
        Sentry.captureException(error, {
          tags: {
            operation: operationName,
          },
          extra: {
            requestId,
            duration_ms: duration,
            ...options.metadata,
          },
        });
      }

      throw error;
    }
  };
}
