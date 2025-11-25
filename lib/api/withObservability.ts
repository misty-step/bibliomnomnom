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
export function withObservability(
  handler: (req: Request) => Promise<Response>,
  operationName: string,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const start = Date.now();

    try {
      console.log(`[${operationName}] START`, {
        method: req.method,
        url: req.url,
      });

      const response = await handler(req);
      const duration = Date.now() - start;

      console.log(`[${operationName}] SUCCESS`, {
        status: response.status,
        duration,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - start;

      console.error(`[${operationName}] ERROR`, {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    }
  };
}
