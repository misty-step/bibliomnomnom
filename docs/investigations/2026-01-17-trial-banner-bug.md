# Investigation: Trial Banner Shows Despite Active Subscription

**Date**: 2026-01-17
**Status**: RESOLVED
**Severity**: Critical (paid customer seeing wrong state)
**Duration**: ~2 hours (significant time wasted on wrong environment)

## Problem Statement

User completed Stripe checkout and paid for a monthly subscription. The UI displayed "14 days left in your free trial" instead of recognizing the active paid subscription.

## User Context

- **Logged in as**: [REDACTED] (confirmed via screenshot)
- **URL**: https://www.bibliomnomnom.com/library
- **Expected**: No trial banner (active subscription)
- **Actual**: Banner shows "14 days left in your free trial"

---

## Root Causes (Multiple)

### 1. Stripe Webhook URL Misconfigured

The Stripe webhook endpoint was pointing to a non-existent domain:

- **Wrong**: `https://bibliomnomnom.app/api/stripe/webhook`
- **Correct**: `https://www.bibliomnomnom.com/api/stripe/webhook`

**Impact**: All webhook events from Stripe were silently failing - no subscription data ever synced to Convex.

### 2. CONVEX_WEBHOOK_TOKEN Not Set on Convex Production

The `CONVEX_WEBHOOK_TOKEN` environment variable was:

- **Vercel production**: Set (but with trailing `\n` corruption)
- **Convex production**: **NOT SET AT ALL**

**Impact**: Even if webhooks reached the correct URL, the Convex action would reject them due to failed token validation.

### 3. Vercel Env Var Had Trailing `\n`

The `CONVEX_WEBHOOK_TOKEN` on Vercel was stored as:

```
<token-value>\n
```

The literal `\n` at the end would cause token mismatch even after fixing Convex.

---

## Actual Production State (Before Fix)

**Production Convex** (doting-spider-972):

- 1 user: `[REDACTED-convex-id]` ([REDACTED-email], clerkId: `[REDACTED-clerk-id]`)
- 1 subscription: `status: "trialing"`, **NO stripeCustomerId, NO stripeSubscriptionId**

**Stripe** (live):

- Subscription `[REDACTED-stripe-sub-id]` with `status: "active"`
- Customer `[REDACTED-stripe-cus-id]`
- metadata.clerkId: `[REDACTED-clerk-id]` (matches Convex user)

---

## Resolution

### Fixes Applied

1. **Stripe webhook URL**: Updated via Stripe API

   ```bash
   curl -X POST "https://api.stripe.com/v1/webhook_endpoints/we_1SqFFQDIyumDtWyU9B39k2gd" \
     -d "url=https://www.bibliomnomnom.com/api/stripe/webhook"
   ```

2. **CONVEX_WEBHOOK_TOKEN on Convex**: Set via CLI

   ```bash
   npx convex env set --prod CONVEX_WEBHOOK_TOKEN "<token-value>"
   ```

3. **CONVEX_WEBHOOK_TOKEN on Vercel**: Removed and re-added without trailing `\n`

   ```bash
   npx vercel env rm CONVEX_WEBHOOK_TOKEN production -y
   printf '%s' '<token-value>' | npx vercel env add CONVEX_WEBHOOK_TOKEN production
   ```

4. **User subscription data**: Synced via Convex action
   ```bash
   npx convex run --prod subscriptions:upsertFromWebhook '{
     "webhookToken": "<token>",
     "clerkId": "<clerk-id>",
     "stripeCustomerId": "<stripe-cus-id>",
     "stripeSubscriptionId": "<stripe-sub-id>",
     "status": "active",
     "priceId": "<price-id>",
     "currentPeriodEnd": <timestamp>,
     "cancelAtPeriodEnd": false
   }'
   ```

---

## Critical Investigation Errors

### 1. CLI Environment Confusion

**The `CONVEX_DEPLOYMENT=prod:... npx convex data` command was returning DEV data, not PROD.**

Despite explicitly setting the environment variable, the CLI was querying the development deployment (groovy-roadrunner-224) instead of production (doting-spider-972).

This caused massive confusion:

- DEV had 4 users with different clerkIds
- PROD had 1 user with the correct clerkId
- ~1 hour wasted investigating a clerkId mismatch that didn't exist in production
- Wild goose chase about Clerk environment mismatches

**Lesson**: Always verify environment by checking the Convex dashboard directly. Use `npx convex run --prod` flag instead of environment variables.

### 2. Not Reading CLI Help First

Wasted time trying to use HTTP API and environment variables when `npx convex run --help` clearly shows the `--prod` flag.

**Lesson**: RTFM before attempting workarounds.

### 3. Fixing Symptoms Instead of Root Cause

Initial focus was on "why is the status wrong in the database" instead of "why didn't the webhook update the database."

**Lesson**: When data is missing/wrong, trace the data flow from source (Stripe) to destination (Convex) rather than assuming the destination is broken.

---

## Prevention

### Immediate Actions

1. **Verify webhook URL after domain changes**: Add to deployment checklist
2. **Health check for webhook token**: The `/api/health` endpoint should verify `CONVEX_WEBHOOK_TOKEN` is set on both Vercel and Convex
3. **Stripe webhook monitoring**: Check Stripe dashboard for failed webhook deliveries after any deployment

### Longer-Term Improvements

1. **Infrastructure as Code**: Store Stripe webhook configuration in code/terraform to prevent manual misconfiguration
2. **Webhook delivery alerts**: Set up Stripe webhook failure notifications
3. **Environment verification script**: Script that compares Vercel and Convex env vars for required tokens
4. **Integration test**: Test that creates a Stripe checkout, completes it, and verifies Convex subscription updates

### CLI Usage Best Practices

1. **Always use `--prod` flag** instead of `CONVEX_DEPLOYMENT` env var
2. **Verify environment in dashboard** before trusting CLI output
3. **Read `--help`** before attempting complex workarounds

---

## Timeline

| Time  | Action                                                      |
| ----- | ----------------------------------------------------------- |
| 10:30 | User reports trial banner after checkout                    |
| 10:45 | Started investigating - queried "production" (actually dev) |
| 11:00 | Found "clerkId mismatch" (dev data, not real issue)         |
| 11:15 | Changed Convex CLERK_JWT_ISSUER_DOMAIN (unnecessary)        |
| 11:25 | User shows dashboard screenshot - only 1 user in prod       |
| 11:30 | Realized CLI was querying dev, not prod                     |
| 11:35 | Found actual prod state: subscription has no Stripe IDs     |
| 11:40 | Discovered Stripe webhook URL pointing to wrong domain      |
| 11:45 | Fixed webhook URL                                           |
| 11:50 | Discovered CONVEX_WEBHOOK_TOKEN not set on Convex           |
| 11:55 | Set token, fixed Vercel token (removed `\n`)                |
| 12:00 | Synced subscription data via action                         |
| 12:05 | User confirms fix - trial banner gone                       |

**Total time**: ~1.5 hours
**Time wasted on wrong environment**: ~45 minutes
