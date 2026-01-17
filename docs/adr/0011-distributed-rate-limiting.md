# ADR 0011: Distributed Rate Limiting via Convex

## Status

Accepted

## Date

2025-12 (extracted from commit d9ab9c4)

## Context

The application needs rate limiting for sensitive endpoints (Stripe checkout, import). In a serverless environment like Vercel, requests may hit different instances, making in-memory rate limiting unreliable.

### Two Implementations Exist

1. **In-memory** (`lib/api/rateLimit.ts`):

   ```typescript
   const store = new Map<string, RateLimitEntry>();
   export function rateLimit(key, { limit, windowMs }) { ... }
   ```

2. **Distributed** (`convex/rateLimit.ts`):
   ```typescript
   // Uses Convex rateLimits table with sliding window
   export const check = mutation({ ... });
   ```

### Problem with In-Memory

Vercel serverless functions are ephemeral. Each request may hit a different instance:

```text
Request 1 → Instance A → Map has 1 entry
Request 2 → Instance B → Map is empty → Bypass limit!
```

In-memory works for development but fails in production at scale.

## Decision

**Use Convex-based distributed rate limiting for production endpoints. Keep in-memory implementation for backward compatibility and development convenience.**

### When to Use Which

| Context         | Implementation                              | Reason                     |
| --------------- | ------------------------------------------- | -------------------------- |
| Stripe checkout | Convex (`rateLimit.check`)                  | Must work across instances |
| Import preview  | Import-specific (`lib/import/rateLimit.ts`) | Uses repository pattern    |
| Local dev only  | In-memory (`lib/api/rateLimit.ts`)          | Fast, no DB overhead       |

### Implementation Pattern

```typescript
// app/api/stripe/checkout/route.ts
const rateLimitResult = await convex.mutation(api.rateLimit.check, {
  key: `checkout:${userId}`,
  limit: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
});

if (!rateLimitResult.success) {
  return new Response("Too many requests", { status: 429 });
}
```

### Why Convex, Not Redis?

- **Already have Convex** - No new infrastructure
- **Transactional** - Rate check and increment are atomic
- **Real-time sync** - Convex handles consistency
- **Schema typed** - `rateLimits` table in `schema.ts`

### Cleanup

Stale rate limit entries accumulate. The `rateLimit.cleanup` internal mutation removes entries not updated in 24 hours. Can be called via cron or manually.

## Consequences

### Positive

- **Reliable** - Works across serverless instances
- **Consistent** - Single source of truth
- **No new infrastructure** - Uses existing Convex backend

### Negative

- **Latency** - Mutation call vs in-memory lookup (~50ms overhead)
- **Table bloat** - Requires periodic cleanup
- **Cost** - Database operations have Convex compute cost

### Migration Path

Existing in-memory implementation kept for:

- Backward compatibility with existing code
- Development environments where distributed isn't needed
- Reference implementation for testing

## Alternatives Rejected

1. **Upstash Redis** - Another service to manage and pay for
2. **Vercel KV** - Vendor lock-in, additional cost
3. **Pure in-memory** - Doesn't work across instances
4. **Remove in-memory entirely** - Breaks existing dev workflows
