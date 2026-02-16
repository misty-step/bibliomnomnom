# Stripe Subscription Flow

The subscription system (`convex/subscriptions.ts`, `app/api/stripe/*`, `lib/hooks/useSubscriptionState.ts`) handles the full lifecycle of paid subscriptions including trials, payments, cancellations, and expiration.

## Subscription State Machine

```mermaid
stateDiagram-v2
    [*] --> no_subscription: First sign-in

    no_subscription --> trialing: ensureTrialExists()

    trialing --> active: Checkout completed (no trial)
    trialing --> trialing: Checkout completed (with trial)
    trialing --> expired: Trial ends without payment

    active --> canceled: User cancels
    active --> past_due: Payment fails

    canceled --> active: Resubscribe before period ends
    canceled --> expired: Period ends without reactivation

    past_due --> active: Payment retried successfully
    past_due --> expired: Grace period (7 days) ends

    expired --> active: New subscription
    expired --> trialing: N/A (trial already used)

    note right of trialing
        Internal trial created by app.
        14-day period from first sign-in.
        No credit card required.
    end note

    note right of past_due
        7-day grace period.
        User retains access.
        Stripe retries payment.
    end note
```

## Access Control Logic

```typescript
function hasAccess(subscription: Subscription | null): boolean {
  if (!subscription) return false;

  switch (subscription.status) {
    case "trialing":
      return subscription.trialEndsAt >= Date.now();
    case "active":
      return true;
    case "canceled":
      return subscription.currentPeriodEnd >= Date.now();
    case "past_due":
      // 7-day grace period from last update
      const gracePeriodEnd = subscription.updatedAt + 7 * 24 * 60 * 60 * 1000;
      return Date.now() < gracePeriodEnd && subscription.currentPeriodEnd >= Date.now();
    case "expired":
      return false;
  }
}
```

## Checkout Flow

```mermaid
sequenceDiagram
    participant User
    participant Pricing as /pricing
    participant Checkout as /api/stripe/checkout
    participant Confirm as /api/stripe/checkout/confirm
    participant Convex
    participant Stripe

    User->>Pricing: Click "Become a Member"
    Pricing->>Checkout: POST { priceType: "annual" }
    Checkout->>Convex: Check rate limit
    Checkout->>Convex: Get existing subscription
    Checkout->>Convex: Billing preflight (assertWebhookConfiguration)
    Note over Checkout: Determine trial eligibility

    alt First-time subscriber
        Checkout->>Stripe: Create session with trial_period_days
    else Had previous trial
        Checkout->>Stripe: Create session (no trial)
    end

    Stripe-->>Checkout: session.url
    Checkout-->>Pricing: { url }
    Pricing->>User: Redirect to Stripe Checkout

    User->>Stripe: Complete payment
    Stripe->>Stripe: Create subscription

    Stripe->>Webhook: checkout.session.completed
    Webhook->>Convex: upsertFromWebhook()
    Convex->>Convex: Update subscription record

    Stripe-->>User: Redirect to /library?checkout=success&session_id=...
    User->>Confirm: POST { sessionId }
    Confirm->>Convex: upsertFromWebhook()
    Confirm-->>User: { hasAccess }
```

## Webhook Event Flow

```mermaid
flowchart TD
    subgraph "Stripe Events"
        A[checkout.session.completed]
        B[customer.subscription.updated]
        C[customer.subscription.deleted]
        D[invoice.payment_succeeded]
        E[invoice.payment_failed]
    end

    subgraph "Handlers"
        A --> F[handleCheckoutCompleted]
        B --> G[handleSubscriptionUpdate]
        C --> H[handleSubscriptionDeleted]
        D --> I[Log only]
        E --> J[Log only - handled by B]
    end

    subgraph "Convex Mutations"
        F --> K[upsertFromWebhook]
        G --> L[updateByStripeCustomer]
        H --> M[updateByStripeCustomer status=expired]
    end

    subgraph "Security"
        N[Signature verification] --> A
        N --> B
        N --> C
        N --> D
        N --> E
        O[Webhook token validation] --> K
        O --> L
        O --> M
        P[Idempotency check] --> N
    end
```

## Client State Hook

The `useSubscriptionState()` hook provides a discriminated union for UI rendering:

```typescript
type SubscriptionState =
  | { state: "loading" }
  | { state: "unauthenticated" }
  | { state: "trialing"; daysRemaining: number; isUrgent: boolean }
  | { state: "trial_expired" }
  | { state: "active" }
  | { state: "canceled"; daysRemaining: number };
```

## State Transitions by Event

| Event                             | From State      | To State | Side Effects                   |
| --------------------------------- | --------------- | -------- | ------------------------------ |
| `ensureTrialExists()` mutation    | no_subscription | trialing | Creates internal trial         |
| `checkout.session.completed`      | trialing        | active   | Links Stripe customer ID       |
| `subscription.updated` (active)   | any             | active   | Updates period end             |
| `subscription.updated` (canceled) | active          | canceled | Sets cancelAtPeriodEnd         |
| `subscription.updated` (past_due) | active          | past_due | Payment failed                 |
| `subscription.deleted`            | any             | expired  | Full access revoked            |
| Trial period ends                 | trialing        | expired  | Detected by query, not webhook |
| Current period ends               | canceled        | expired  | Detected by query, not webhook |

## Race Condition Handling

### Duplicate Subscription Prevention

```typescript
// In ensureTrialExists
const existing = await ctx.db
  .query("subscriptions")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .first(); // Use .first() not .unique()

if (existing) {
  // Clean up any duplicates from race conditions
  const allMatches = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  if (allMatches.length > 1) {
    const sorted = allMatches.sort((a, b) => a._creationTime - b._creationTime);
    for (const dupe of sorted.slice(1)) {
      await ctx.db.delete(dupe._id);
    }
  }
}
```

### Webhook Idempotency

```typescript
// In webhook handler
const isProcessed = await convex.query(api.webhookEvents.isProcessed, {
  eventId: event.id,
});

if (isProcessed) {
  return NextResponse.json({ received: true, skipped: true });
}

// After processing
await convex.mutation(api.webhookEvents.markProcessed, {
  eventId: event.id,
  eventType: event.type,
});
```

## Error Recovery

| Error                     | Recovery Path                                 |
| ------------------------- | --------------------------------------------- |
| Checkout rate limited     | Wait 1 hour, retry                            |
| Webhook signature invalid | Return 400, Stripe won't retry                |
| Webhook processing fails  | Return 500, Stripe retries with backoff       |
| User not found in upsert  | Throw error, triggers Stripe retry            |
| Subscription lookup fails | Log error, return null (graceful degradation) |
