# ADR 0010: 7-Day Grace Period for Past-Due Subscriptions

## Status

Accepted

## Date

2025-12 (extracted from commit d9ab9c4)

## Context

When a user's payment fails, Stripe marks the subscription as `past_due`. We need to decide how to handle access during this period:

1. **Immediate lockout** - No access the moment payment fails
2. **Access until period end** - Full access until subscription period expires
3. **Limited grace period** - Short window to fix payment before lockout

### Problem with Option 2 (Access Until Period End)

For annual subscribers, `currentPeriodEnd` could be 364 days away. Granting nearly a year of free access for a failed payment is unacceptable.

```typescript
// Problematic: user keeps year of access for free
case "past_due":
  return subscription.currentPeriodEnd >= now; // Up to 364 days!
```

### Problem with Option 1 (Immediate Lockout)

Users may have legitimate payment issues (expired card, bank fraud flag). Locking them out immediately creates poor UX and support burden.

## Decision

**Grant 7-day grace period from the moment subscription becomes `past_due`, independent of the billing period.**

### Implementation

```typescript
// convex/subscriptions.ts
const PAST_DUE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

case "past_due": {
  // Limited grace period for payment retry (7 days max)
  if (!subscription.currentPeriodEnd) return false;
  const gracePeriodEnd = subscription.updatedAt + PAST_DUE_GRACE_PERIOD_MS;
  return now < gracePeriodEnd && subscription.currentPeriodEnd >= now;
}
```

### Why 7 Days?

- **Stripe retries**: Stripe attempts payment ~4 times over 7 days by default
- **User action window**: Enough time to receive email, update card, verify bank
- **Industry standard**: Common grace period length for SaaS subscriptions
- **Balance**: Long enough for legitimate issues, short enough to prevent abuse

### Edge Cases

- Grace period starts when `past_due` status is written (`updatedAt` timestamp)
- Must still be within `currentPeriodEnd` (can't grant access after period expires)
- Both conditions must be true: grace period AND period not ended

## Consequences

### Positive

- **Fair to users** - Time to fix legitimate payment issues
- **Bounded risk** - Maximum 7 days free access regardless of plan
- **Stripe-aligned** - Matches Stripe's default retry schedule

### Negative

- **Complexity** - Two time checks instead of one
- **State dependency** - Relies on `updatedAt` being set correctly on status change

### Key Invariant

**Grace period is measured from status change, not from period start.** This prevents users from accumulating grace periods across billing cycles.

## Alternatives Rejected

1. **Stripe setting only** - Doesn't cover our specific UX needs
2. **Per-plan grace periods** - Over-engineered for current needs
3. **Configurable via env var** - Unnecessary flexibility, adds complexity
