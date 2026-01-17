/**
 * Webhook token validation utilities.
 *
 * These functions are used by Convex actions to validate webhook tokens,
 * providing defense-in-depth security on top of Stripe signature verification.
 *
 * Security:
 * - Uses timing-safe comparison to prevent timing attacks
 * - Returns generic error message to prevent information disclosure
 * - Rejects empty strings to prevent bypass on misconfiguration
 */

// Generic error message prevents probing for configuration state
const AUTH_FAILED = "Webhook authentication failed";

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Compares all characters even if mismatch is found early.
 *
 * Security: Rejects empty strings to prevent bypass when env var is misconfigured.
 *
 * @internal Exported for testing. Use validateWebhookToken for production code.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validates webhook token from environment variable.
 * This prevents unauthorized calls to webhook handlers.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 * Returns generic error message to prevent information disclosure.
 *
 * @param providedToken - Token provided in webhook request
 * @param expectedToken - Expected token from environment (defaults to CONVEX_WEBHOOK_TOKEN)
 * @throws Error with generic message if validation fails
 */
export function validateWebhookToken(
  providedToken: string,
  expectedToken: string | undefined = process.env.CONVEX_WEBHOOK_TOKEN,
): void {
  // Use same error for all failure cases to prevent probing
  if (!expectedToken || expectedToken.length === 0) {
    throw new Error(AUTH_FAILED);
  }

  if (!providedToken || providedToken.length === 0) {
    throw new Error(AUTH_FAILED);
  }

  if (!timingSafeCompare(providedToken, expectedToken)) {
    throw new Error(AUTH_FAILED);
  }
}
