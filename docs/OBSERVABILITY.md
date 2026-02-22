# Observability

Production monitoring: Sentry (errors), pino (logs via Vercel), PostHog (analytics).

## CLI Access (`./scripts/obs`)

```bash
./scripts/obs status                              # Full overview
./scripts/obs issues [--limit N] [--env ENV]      # Sentry issues
./scripts/obs issue BIBLIOMNOMNOM-123             # Issue details
./scripts/obs health [--deep] [--prod]            # Health endpoint
./scripts/obs alerts                              # Alert rules
./scripts/obs resolve BIBLIOMNOMNOM-123           # Resolve issue
./scripts/obs logs [--follow]                     # Vercel logs
```

Requires `SENTRY_AUTH_TOKEN` in shell environment.

## Sentry

- **Org/Project:** `misty-step` / `bibliomnomnom`
- **Tunnel:** `/monitoring` route bypasses ad blockers
- **Config:** `.sentryclirc` (gitignored, uses env token)

**Alert Rules:**

| Rule                   | Trigger                               |
| ---------------------- | ------------------------------------- |
| New Error              | First occurrence of any new issue     |
| Regression             | Resolved issue resurfaces             |
| High-Frequency         | Same error 10+ times in 1 hour        |
| Critical: Auth/Payment | Errors in stripe/clerk/webhook routes |

## Key Files

| File                           | Purpose                                        |
| ------------------------------ | ---------------------------------------------- |
| `sentry.client.config.ts`      | Client-side init + session replay              |
| `sentry.server.config.ts`      | Server-side init                               |
| `lib/sentry-config.ts`         | Shared config + PII scrubbing                  |
| `lib/sentry.ts`                | `captureError`/`captureMessage` utilities      |
| `lib/logger.ts`                | pino logger (JSON prod, pretty dev)            |
| `lib/api/withObservability.ts` | API route wrapper with logging + error capture |
| `app/api/health/route.ts`      | Health endpoint with service probes            |

## Usage

```typescript
// Client components
import { captureError } from "@/lib/sentry";
captureError(error, { tags: { feature: "book-import" } });

// API routes (automatic via wrapper)
export const POST = withObservability(async (req) => {
  // errors auto-captured
}, "operation-name");

// Server-side logging
import { logger } from "@/lib/logger";
logger.info({ msg: "book_created", bookId, userId });
```

## Health Endpoint

```bash
curl https://bibliomnomnom.com/api/health          # Shallow
curl https://bibliomnomnom.com/api/health?mode=deep # Probes Convex, Clerk, Stripe
```
