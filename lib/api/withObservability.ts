/**
 * Observability wrapper for API routes
 *
 * Wraps Next.js API route handlers with consistent logging and error handling.
 * Currently uses console logging as foundation for future Sentry integration.
 *
 * @example
 * ```typescript
 * export const GET = withObservability(async (req) => {
 *   // handler logic
 *   return NextResponse.json({ data });
 * }, "blob-upload");
 * ```
 */
type ObservabilityOptions = {
  metadata?: Record<string, unknown>;
  skipErrorCapture?: boolean;
};

export function withObservability(
  handler: (req: Request) => Promise<Response>,
  operationName: string,
  options: ObservabilityOptions = {},
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const start = Date.now();

    try {
      console.log(`[${operationName}] START`, {
        method: req.method,
        url: req.url,
        ...options.metadata,
      });

      const response = await handler(req);
      const duration = Date.now() - start;

      console.log(`[${operationName}] SUCCESS`, {
        status: response.status,
        duration,
        ...options.metadata,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - start;

      if (!options.skipErrorCapture) {
        console.error(`[${operationName}] ERROR`, {
          error: error instanceof Error ? error.message : String(error),
          duration,
          ...options.metadata,
        });
      }

      throw error;
    }
  };
}
