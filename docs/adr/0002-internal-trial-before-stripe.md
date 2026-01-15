# ADR 0002: Internal Trial Subscription Before Stripe

## Status

Accepted

## Date

2025-12 (extracted from commits ecf4fde, 9557b2f)

## Context

The application offers a 14-day free trial. We needed to decide when to create a Stripe customer and how to track trial status.

Options considered:

1. **Stripe-first** - Create Stripe customer on signup, use Stripe's trial
2. **Internal-first** - Track trial internally, create Stripe customer on conversion
3. **No trial tracking** - Just let users access everything, paywall after 14 days

### Problem with Stripe-First

- Every free user becomes a Stripe customer (cost, complexity)
- Most users won't convert (wasted Stripe objects)
- Requires Stripe API call during signup flow (latency)

### Problem with No Tracking

- Can't show "X days remaining" in UI
- Can't prevent double-dipping (signup, exhaust trial, signup again)

## Decision

**Track trial internally in Convex, create Stripe customer only when user initiates checkout.**

### Implementation

1. **Internal Trial Creation** (`users.createOrUpdateUser`):
   - On Clerk webhook `user.created`, create subscription record
   - Status: `trialing`, duration: `TRIAL_DURATION_MS` (14 days)
   - No Stripe customer ID yet

2. **Paywall Enforcement** (`subscriptions.checkAccess`):
   - Query checks `trialEndsAt` timestamp
   - Returns access status + days remaining
   - UI shows banner when trial ending

3. **Double-Dip Prevention** (`checkout/route.ts`):
   - Before creating Stripe session, check existing `trialEndsAt`
   - If user already had trial, set `trial_period_days: 0`
   - Prevents: signup -> trial -> cancel -> signup -> another trial

4. **Stripe Conversion** (`webhook/route.ts`):
   - On `checkout.session.completed`, upsert subscription
   - Links Stripe customer ID to existing internal subscription
   - Overwrites status from internal trial to Stripe-managed

## Consequences

### Positive

- **No Stripe bloat** - Only paying/converting users in Stripe
- **Instant trial** - No Stripe API call during signup
- **Fraud prevention** - Internal tracking catches trial abuse
- **Smooth conversion** - One subscription record, status changes in place

### Negative

- **Two trial sources** - Internal vs Stripe trial periods
- **Status mapping complexity** - Must map between internal and Stripe states

### Key Invariant

**`trialEndsAt` is set once and never reset.** This is the canonical "has had trial" flag:

- Internal trial sets it on user creation
- Stripe trial sets it on checkout completion
- Checkout route checks it to prevent double-dipping

## Alternatives Rejected

1. **Stripe trial for everyone** - Wasteful, adds latency to signup
2. **Cookie-based trial tracking** - Trivially bypassed (incognito)
3. **IP-based trial tracking** - False positives (shared networks), GDPR concerns
