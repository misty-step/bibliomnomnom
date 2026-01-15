# ADR 0008: Simplified Stripe Status Mapping

## Status

Accepted

## Date

2025-12 (inferred from codebase)

## Context

Stripe subscriptions have many statuses:

```
trialing, active, canceled, past_due, unpaid,
incomplete, incomplete_expired, paused
```

Our UI only needs to answer:

1. Does user have access?
2. What should we show them?

Mapping 8 Stripe statuses to 8 internal statuses would:

- Complicate UI logic
- Require handling edge cases users never encounter
- Create maintenance burden as Stripe adds statuses

### Considered Approaches

1. **Mirror Stripe exactly** - Store all 8 statuses
2. **Boolean only** - Just `hasAccess: true/false`
3. **Reduced set** - Map to 5 meaningful states

## Decision

**Map Stripe's 8 statuses to 5 internal statuses focused on user-facing behavior.**

### Implementation

```typescript
// lib/stripe-utils.ts
export function mapStripeStatus(
  status: Stripe.Subscription.Status,
): "trialing" | "active" | "canceled" | "past_due" | "expired" {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "canceled":
      return "canceled";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "expired";
    case "incomplete":
    case "incomplete_expired":
      return "expired";
    case "paused":
      return "canceled";
    default:
      return "expired";
  }
}
```

### Status Semantics

| Internal Status | Access?          | UI Message                    |
| --------------- | ---------------- | ----------------------------- |
| `trialing`      | Yes              | "X days left in trial"        |
| `active`        | Yes              | (none, happy path)            |
| `canceled`      | Until period end | "Subscription ends [date]"    |
| `past_due`      | Grace period     | "Payment failed, update card" |
| `expired`       | No               | "Subscribe to continue"       |

### Why These Mappings?

- **`unpaid` -> `expired`**: Multiple failed payments, no grace period left
- **`incomplete` -> `expired`**: Initial payment failed, never started
- **`paused` -> `canceled`**: Functionally similar UX (access until period end)
- **Unknown -> `expired`**: Fail secure, prompt to resubscribe

## Consequences

### Positive

- **Simpler UI** - Only 5 states to handle
- **Fail-secure** - Unknown states deny access
- **Future-proof** - New Stripe statuses map to `expired` by default

### Negative

- **Information loss** - Can't distinguish `incomplete` vs `unpaid` in logs
- **Stripe coupling** - Must update if Stripe changes semantics

### Mitigation

Log original Stripe status before mapping (for debugging). Review mapping when upgrading Stripe SDK.

## Alternatives Rejected

1. **Store both** - Original + mapped status (complexity, sync issues)
2. **Raw Stripe status** - Every UI component handles 8+ cases
3. **Enum with all cases** - Maintenance burden, unused branches
