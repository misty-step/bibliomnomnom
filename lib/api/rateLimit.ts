/**
 * Simple in-memory rate limiter for API routes.
 *
 * Note: This is a basic implementation that works within a single serverless instance.
 * For production at scale, consider using Upstash Redis or similar distributed solution.
 *
 * The limiter uses a sliding window approach with automatic cleanup.
 */

type RateLimitEntry = {
  timestamps: number[];
};

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

  lastCleanup = now;
  const cutoff = now - windowMs;

  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetMs: number;
};

export type RateLimitOptions = {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window size in milliseconds (default: 1 hour) */
  windowMs?: number;
};

/**
 * Check rate limit for a given key.
 *
 * @param key - Unique identifier (e.g., "checkout:user_123")
 * @param options - Rate limit configuration
 * @returns Result with success status and remaining requests
 *
 * @example
 * const result = rateLimit("checkout:" + userId, { limit: 5, windowMs: 60 * 60 * 1000 });
 * if (!result.success) {
 *   return new Response("Too many requests", { status: 429 });
 * }
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { limit, windowMs = 60 * 60 * 1000 } = options;
  const now = Date.now();

  // Periodic cleanup
  cleanup(windowMs);

  // Get or create entry
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  const cutoff = now - windowMs;
  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

  // Check limit
  if (entry.timestamps.length >= limit) {
    const oldestInWindow = Math.min(...entry.timestamps);
    const resetMs = oldestInWindow + windowMs - now;
    return {
      success: false,
      remaining: 0,
      resetMs: Math.max(0, resetMs),
    };
  }

  // Add current timestamp
  entry.timestamps.push(now);

  return {
    success: true,
    remaining: limit - entry.timestamps.length,
    resetMs: windowMs,
  };
}
