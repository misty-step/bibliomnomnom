# ADR 0003: Webhook Token Validation for Convex Actions

## Status

Accepted

## Date

2025-12 (extracted from commit 4ffeda4)

## Context

Stripe webhook events must update Convex subscription data. The flow is:

```
Stripe -> Next.js webhook route -> Convex mutation/action
```

Convex mutations can be called by anyone with the deployment URL. Without protection, an attacker could:

- Call `updateByStripeCustomer` with arbitrary status
- Grant themselves permanent "active" subscription
- Modify other users' subscription data

### Original Pattern (Vulnerable)

```typescript
// Stripe webhook verifies signature, then calls:
await convex.mutation(api.subscriptions.updateFromStripe, {
  stripeCustomerId: "...",
  status: "active",
});
```

Problem: `api.subscriptions.updateFromStripe` is public. Anyone can call it directly.

### Considered Approaches

1. **Internal mutations only** - Use `internalMutation` (only callable from Convex)
2. **Bearer token validation** - Webhook includes secret token
3. **HMAC signature on payload** - Webhook signs each request

## Decision

**Wrap internal mutations with public actions that validate a shared token.**

### Implementation

1. **Environment Variable**: `CONVEX_WEBHOOK_TOKEN`
   - Random secret set in both Vercel and Convex dashboards
   - Must match for webhook to succeed

2. **Public Action Entry Points** (`subscriptions.ts`):

   ```typescript
   export const upsertFromWebhook = action({
     args: { webhookToken: v.string(), clerkId: v.string(), ... },
     handler: async (ctx, args) => {
       validateWebhookToken(args.webhookToken);
       return await ctx.runMutation(internal.subscriptions.upsertFromWebhookInternal, ...);
     },
   });
   ```

3. **Internal Mutations** (restricted):
   - `upsertFromWebhookInternal`, `updateByStripeCustomerInternal`
   - Only callable via `ctx.runMutation()` from actions
   - Cannot be called directly from outside Convex

4. **Webhook Route**:
   - Verifies Stripe signature (authenticity)
   - Passes `CONVEX_WEBHOOK_TOKEN` to Convex action
   - Double validation: Stripe signature + our token

## Consequences

### Positive

- **Defense in depth** - Even if Stripe signature bypassed, token required
- **Auditable** - Token validation is explicit in code
- **Simple rotation** - Change env var to rotate token

### Negative

- **Token management** - Another secret to sync across environments
- **Action overhead** - Extra hop (action -> internal mutation)

### Why Not Internal-Only?

Convex actions can't use `ctx.runMutation(internal.foo)` from HTTP handlers. We need a callable entry point (`action`), then that action calls internal mutation.

Alternative: HTTP Actions with headers. But Convex HTTP handlers are more complex and don't integrate as cleanly with our existing patterns.

## Alternatives Rejected

1. **Rely on Stripe signature only** - Protects webhook route, not Convex endpoint
2. **IP allowlist** - Stripe IPs change, complex to maintain
3. **HTTP Actions with headers** - More boilerplate, less type-safe
4. **No protection (internal only)** - Internal mutations can't be called from HTTP actions
