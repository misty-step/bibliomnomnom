# Pre-Production Deployment Checklist

A comprehensive checklist before deploying bibliomnomnom to production.

## Quick Start

```bash
# Run automated checks
./scripts/verify-deploy-ready.sh

# Or just env validation
./scripts/validate-env.sh --prod-only
```

## Manual Checklist

### 1. Environment Variables

#### Local Development

- [ ] `.env.local` exists with all required vars
- [ ] No secrets committed to git

#### Convex Production

```bash
npx convex env list --prod
```

Required variables:

- [ ] `STRIPE_SECRET_KEY` - Format: `sk_live_xxx`
- [ ] `STRIPE_WEBHOOK_SECRET` - Format: `whsec_xxx`
- [ ] `STRIPE_PRICE_MONTHLY` - Format: `price_xxx`
- [ ] `STRIPE_PRICE_ANNUAL` - Format: `price_xxx`
- [ ] `STRIPE_PUBLISHABLE_KEY` - Format: `pk_live_xxx`
- [ ] `CONVEX_WEBHOOK_TOKEN` - Format: 64 hex chars

#### Vercel Production

```bash
vercel env ls --environment=production
```

Required variables:

- [ ] All `NEXT_PUBLIC_*` vars for frontend
- [ ] `CONVEX_WEBHOOK_TOKEN` (must match Convex)
- [ ] Stripe vars (if using API routes)

### 2. Cross-Platform Parity

**Critical:** `CONVEX_WEBHOOK_TOKEN` must be identical on both Vercel and Convex.

```bash
# Check both exist
npx convex env list --prod | grep CONVEX_WEBHOOK_TOKEN
vercel env ls --environment=production | grep CONVEX_WEBHOOK_TOKEN
```

If they differ, webhooks will silently fail.

### 3. Format Validation

No trailing whitespace or newlines in env vars.

**Symptoms of whitespace issues:**

- "Invalid character in header content"
- Webhook signature verification fails
- Silent authentication errors

**How to set vars safely:**

```bash
# ✅ Use printf (no trailing newline)
npx convex env set --prod KEY "$(printf '%s' 'value')"
printf '%s' 'value' | vercel env add KEY production

# ❌ Don't use echo directly
echo "value" | vercel env add KEY production  # May add \n
```

### 4. Stripe Configuration

#### Dashboard Checks

- [ ] Webhook URL is correct: `https://www.bibliomnomnom.com/api/stripe/webhook`
- [ ] Webhook events enabled: `checkout.session.completed`, `customer.subscription.*`
- [ ] Price IDs match env vars

#### CLI Check

```bash
# If Stripe CLI installed
stripe webhook_endpoints list --limit 5
```

### 5. Git Status

- [ ] Working tree is clean (`git status`)
- [ ] On correct branch
- [ ] Up to date with remote

### 6. Quality Checks

- [ ] TypeScript compiles: `pnpm tsc --noEmit`
- [ ] Tests pass: `pnpm test`
- [ ] Lint clean: `pnpm lint`

### 7. Build

- [ ] Local build succeeds: `pnpm build:local`

## CLI Gotchas

### Convex Environment Confusion

**Warning:** `CONVEX_DEPLOYMENT=prod:xxx npx convex data` may return dev data!

Always use the `--prod` flag:

```bash
# ✅ Reliable
npx convex env list --prod
npx convex run --prod subscriptions:checkAccess

# ❌ Unreliable
CONVEX_DEPLOYMENT=prod:xxx npx convex data subscriptions
```

When in doubt, verify via Convex Dashboard.

## Post-Deployment Verification

After deploying:

1. **Health check:**

   ```bash
   curl https://www.bibliomnomnom.com/api/health?mode=deep | jq .
   ```

2. **Test checkout flow:**
   - Log in as test user
   - Navigate to pricing
   - Complete checkout (use test card in Stripe test mode)
   - Verify subscription status updates

3. **Check webhook delivery:**
   - Stripe Dashboard → Developers → Webhooks
   - Verify recent events show 200 status

## Common Issues

| Issue                | Symptom                       | Fix                        |
| -------------------- | ----------------------------- | -------------------------- |
| Trailing `\n` in key | "Invalid character in header" | Re-set with `printf`       |
| Token on Vercel only | Webhook 500s, no data sync    | Set on Convex too          |
| Wrong webhook URL    | Events never arrive           | Update in Stripe Dashboard |
| Test key in prod     | "Invalid API key"             | Use `sk_live_` key         |
| CLI returns dev data | Investigation confusion       | Use `--prod` flag          |

## Related Documentation

- [Investigation: 2026-01-17](/docs/investigations/2026-01-17-trial-banner-bug.md)
- [Postmortem: Webhook Failure](/docs/postmortems/2026-01-17-stripe-webhook-failure.md)

---

_Last updated: 2026-01-17_
