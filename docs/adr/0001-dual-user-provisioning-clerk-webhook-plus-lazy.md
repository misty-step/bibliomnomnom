# ADR 0001: Dual User Provisioning - Clerk Webhook + Lazy Creation

## Status

Accepted

## Date

2025-12 (extracted from commits d7faf7d, 948193c)

## Context

Users must exist in Convex before any authenticated operation can succeed. When a user first signs up via Clerk, there's a race condition: the UI immediately navigates to protected pages while the user record may not exist yet.

We considered three approaches:

1. **Lazy creation only** - Create user on first authenticated Convex call
2. **Webhook only** - Clerk webhook creates user synchronously
3. **Belt and suspenders** - Webhook creates eagerly, lazy creates as fallback

### Problem with Lazy-Only

Convex queries are read-only; they cannot create users. This means:

- First query after signup fails with "User not found"
- UI must call a mutation before queries work
- Race condition between query and mutation

### Problem with Webhook-Only

Webhooks are asynchronous. User could:

- Complete Clerk signup
- Navigate to dashboard
- Query fires before webhook arrives
- "User not found" error

## Decision

**Implement dual provisioning**: Clerk webhook for eager creation + lazy creation in mutations as fallback.

### Implementation

1. **Clerk Webhook** (`/api/webhooks/clerk`):
   - Handles `user.created`, `user.updated`, `user.deleted`
   - Creates Convex user record on Clerk signup
   - Auto-creates trial subscription for new users

2. **Lazy Creation** (`convex/auth.ts`):
   - `requireAuth()` attempts to find existing user
   - If missing (in mutation context), creates user from JWT identity
   - De-duplicates if race condition causes multiple inserts

3. **Client Provisioning** (`ConvexClientProvider.tsx`):
   - `UserProvisioningProvider` calls `ensureUser` mutation on auth
   - Tracks `isProvisioned` state
   - Prevents queries from firing until user exists

4. **Stripe Checkout Guards**:
   - Checkout route verifies user exists in Convex before creating Stripe session
   - Prevents orphaned Stripe customers

## Consequences

### Positive

- **No race conditions** - User always exists before queries run
- **Resilient to webhook delays** - Lazy creation catches edge cases
- **Clean Stripe integration** - Checkout never orphans customers
- **Idempotent** - Multiple creation attempts safely de-duplicate

### Negative

- **Complexity** - Three places manage user creation (webhook, auth.ts, provider)
- **Duplicate logic** - Email extraction duplicated in webhook and auth helpers

### Mitigation

Accept complexity as necessary evil. Document the three provisioning paths clearly. All paths are idempotent so worst case is wasted work, not data corruption.

## Alternatives Rejected

1. **Webhook-only with retry loop** - Would add latency, still race-prone
2. **Blocking signup until webhook** - Would break UX, Clerk doesn't support
3. **Separate "onboarding" flow** - Over-engineered for this use case
