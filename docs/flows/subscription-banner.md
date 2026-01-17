# Subscription Banner State Machine

The TrialBanner component (`components/subscription/TrialBanner.tsx`) displays subscription status with context-aware messaging.

## State Machine

```mermaid
stateDiagram-v2
    [*] --> loading: Component mounts

    loading --> hidden: Active subscription
    loading --> no_subscription: No subscription
    loading --> trialing: In trial period
    loading --> expired: Trial/subscription expired

    no_subscription --> hidden: User dismisses
    trialing --> hidden: User dismisses (days > 3)

    state trialing {
        [*] --> normal: days > 3
        [*] --> urgent: days <= 3
    }

    note right of expired
        Non-dismissible.
        Must subscribe to clear.
    end note

    note right of urgent
        Dismiss button hidden.
        Warning colors applied.
    end note
```

## Query Response Shape

```typescript
type AccessCheck = {
  hasAccess: boolean;
  status: "active" | "trialing" | null;
  daysRemaining?: number;
  reason: "no_subscription" | "trial_expired" | "subscription_expired" | null;
};
```

## Display Logic

```mermaid
flowchart TD
    A{accessCheck loaded?} -->|No| B[Render null]
    A -->|Yes| C{hasAccess && status === 'active'?}
    C -->|Yes| B
    C -->|No| D{dismissed?}
    D -->|Yes| E{expired?}
    E -->|Yes| F[Show expired banner]
    E -->|No| B
    D -->|No| G{reason}
    G -->|no_subscription| H[Show trial prompt]
    G -->|trialing| I{days <= 3?}
    I -->|Yes| J[Show urgent trial]
    I -->|No| K[Show normal trial]
    G -->|expired| F
```

## Banner Variants

| State               | Background   | CTA                             | Dismissible |
| ------------------- | ------------ | ------------------------------- | ----------- |
| no_subscription     | surface-dawn | "Start Free Trial"              | Yes         |
| trialing (>3 days)  | surface-dawn | "Subscribe Now"                 | Yes         |
| trialing (<=3 days) | warning/5    | "Subscribe Now" (warning color) | No          |
| expired             | error/5      | "Subscribe Now" (error color)   | No          |

## Local State

Only one piece of local state:

```typescript
const [dismissed, setDismissed] = useState(false);
```

This resets on page navigation (component unmount).

## Expiration Non-Dismissibility

The expired state is intentionally non-dismissible to ensure users see the subscription prompt. The banner persists until:

1. User subscribes (status changes)
2. Page navigation (component remounts)
