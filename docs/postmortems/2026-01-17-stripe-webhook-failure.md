# Postmortem: Stripe Webhook Integration Failure

**Date**: 2026-01-17
**Severity**: P1 (Paid customer saw wrong state)
**Duration**: ~2.5 hours total (discovery to resolution)
**Author**: Claude + phaedrus

## Summary

After deploying the Stripe billing integration (commit d9ab9c4), production checkout worked but subscription data never synced to Convex. A paying customer completed checkout and saw "14 days left in your free trial" instead of their active subscription.

## Impact

- **Users affected**: 1 (the only production user at the time)
- **Revenue impact**: None (payment processed correctly)
- **Trust impact**: High (paid customer saw confusing/incorrect state)
- **Duration of impact**: ~1 hour from checkout to fix

## Timeline

| Time   | Event                                                             |
| ------ | ----------------------------------------------------------------- |
| ~09:00 | Billing feature merged and deployed to production                 |
| ~09:15 | First checkout attempt fails - "Invalid character in header"      |
| ~09:20 | Identified malformed `STRIPE_SECRET_KEY` env var (literal `\n`)   |
| ~09:25 | Fixed Stripe keys, checkout fails again - "url_invalid"           |
| ~09:30 | Identified `NEXT_PUBLIC_APP_URL` had wrong domain + trailing `\n` |
| ~09:35 | Fixed URL env var, checkout succeeds                              |
| ~09:40 | User reports trial banner still showing despite payment           |
| ~10:00 | Investigation begins - initially queries wrong environment (dev)  |
| ~10:45 | User provides screenshots proving CLI was returning dev data      |
| ~10:50 | Identified actual prod state: subscription has no Stripe IDs      |
| ~11:00 | Discovered webhook URL pointing to non-existent domain            |
| ~11:05 | Discovered `CONVEX_WEBHOOK_TOKEN` not set on Convex prod          |
| ~11:10 | Fixed webhook URL, set token on Convex, fixed Vercel token        |
| ~11:15 | Synced subscription data via Convex action                        |
| ~11:20 | User confirms trial banner gone, issue resolved                   |

## Root Cause Analysis (5 Whys)

### Why did the user see "trial" despite paying?

The subscription record in Convex had `status: "trialing"` with no `stripeSubscriptionId`.

### Why wasn't the subscription updated?

The Stripe webhook never reached Convex to update it.

### Why didn't the webhook reach Convex?

Three compounding failures:

1. **Webhook URL wrong**: Stripe was sending to `https://bibliomnomnom.app/api/stripe/webhook` but our domain is `https://www.bibliomnomnom.com`

2. **Token not set on Convex**: `CONVEX_WEBHOOK_TOKEN` was set on Vercel but NOT on Convex production deployment

3. **Token corrupted on Vercel**: The token had a trailing `\n` character causing validation mismatch

### Why were these configurations wrong?

- Webhook URL was set during initial Stripe setup when domain was uncertain
- Env vars were set inconsistently between Vercel and Convex
- No validation that webhook integration was working end-to-end

### Why wasn't this caught before production?

- No integration test verifying the full checkout → webhook → database flow
- Dev environment used different webhook endpoints
- No monitoring/alerting on webhook delivery failures

## Contributing Factors

### Investigation Delays

**CLI Environment Confusion**: Using `CONVEX_DEPLOYMENT=prod:... npx convex data` returned development data, not production. This caused ~45 minutes of investigating a non-existent clerkId mismatch.

**Lesson**: Use `npx convex run --prod` flag instead of environment variables. Always verify environment by checking dashboard directly.

### Configuration Complexity

**Multiple Deployment Targets**: Vercel (Next.js) and Convex (backend) require separate environment variable configuration. Easy to set one and forget the other.

**Trailing Newlines**: Copy-pasting env vars can introduce invisible `\n` characters that cause cryptic failures like "Invalid character in header content."

## What Went Well

- User reported the issue quickly with clear description
- Once correct environment was identified, root causes found rapidly
- Fix was straightforward configuration changes, no code bugs
- Manual data sync restored correct state immediately

## What Went Poorly

- Investigation wasted ~45 minutes on wrong environment
- Multiple env var issues compounded (Stripe keys, app URL, webhook token)
- No early warning that webhooks were failing silently
- Paid customer experienced confusion

## Action Items

### Immediate (P0)

| Item                                    | Owner    | Status  |
| --------------------------------------- | -------- | ------- |
| Fix webhook URL in Stripe               | phaedrus | ✅ Done |
| Set CONVEX_WEBHOOK_TOKEN on Convex prod | phaedrus | ✅ Done |
| Fix Vercel token (remove `\n`)          | phaedrus | ✅ Done |
| Sync user subscription data             | phaedrus | ✅ Done |

### Short-term (P1)

| Item                                                       | Owner | Status  |
| ---------------------------------------------------------- | ----- | ------- |
| Add API key format validation in `lib/stripe.ts`           | -     | Pending |
| Add env var format validation to `scripts/validate-env.sh` | -     | Pending |
| Document webhook URL in deployment checklist               | -     | Pending |
| Add Stripe webhook failure alerting                        | -     | Pending |

### Medium-term (P2)

| Item                                                | Owner | Status  |
| --------------------------------------------------- | ----- | ------- |
| Integration test: checkout → webhook → database     | -     | Backlog |
| Environment comparison script (Vercel vs Convex)    | -     | Backlog |
| Health check endpoint verifies webhook token parity | -     | Backlog |

## Lessons Learned

1. **Verify environment before trusting CLI output.** The `CONVEX_DEPLOYMENT` env var approach is unreliable. Use `--prod` flag and cross-check with dashboard.

2. **Webhook integrations need end-to-end testing.** Unit tests on individual functions don't catch configuration mismatches.

3. **Env var hygiene matters.** Use `printf '%s'` instead of `echo` when setting secrets. Always trim whitespace. Validate format before use.

4. **Silent failures are dangerous.** Webhooks failing silently meant we had no idea payments weren't syncing. Add monitoring.

5. **Trace data flow from source to destination.** When data is wrong, follow the path: Stripe → webhook → Vercel → Convex. Don't assume the destination code is broken.

## Related Documents

- [Investigation Log](/docs/investigations/2026-01-17-trial-banner-bug.md)
- [Billing Feature PR](d9ab9c4)
- [CLAUDE.md Third-Party API Checklist](/CLAUDE.md#third-party-api-integration-checklist)

---

_This is a blameless postmortem. The goal is to learn and prevent recurrence, not to assign blame._
