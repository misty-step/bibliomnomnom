# Production Deployment Checklist

Use this checklist when deploying to production. See [DEPLOYMENT.md](../DEPLOYMENT.md) for detailed instructions.

## Pre-Deployment

### Convex Setup

- [ ] Created Convex production deployment
  - Deployment URL: `_______________________________`
- [ ] Generated production deploy key
  - Format: `prod:deployment-name|token`
  - Saved securely: [ ] Yes
- [ ] Generated preview deploy key
  - Format: `preview:username:project|token`
  - Saved securely: [ ] Yes
- [ ] Pushed schema to production
  - Ran: `export CONVEX_DEPLOY_KEY="prod:..." && npx convex deploy`
  - Verified in dashboard: [ ] Yes

### Clerk Setup

- [ ] Created Clerk production application
  - Application name: `_______________________________`
- [ ] Configured production domains
  - Production domain: `_______________________________`
  - Preview pattern: `*.vercel.app`
- [ ] Created JWT template named `convex`
  - Template enabled: [ ] Yes
  - Convex claim added: [ ] Yes
- [ ] Copied production keys
  - Publishable key: `pk_live_...`
  - Secret key: `sk_live_...`
  - Both saved securely: [ ] Yes

### Vercel Setup

- [ ] Project linked to GitHub repository
  - Project name: `_______________________________`
- [ ] Domain configured (if custom)
  - Domain: `_______________________________`
  - DNS configured: [ ] Yes
- [ ] Vercel Blob integration added
  - BLOB_READ_WRITE_TOKEN auto-configured: [ ] Yes

## Environment Variables Configuration

### Production Environment (Vercel Dashboard)

Environment: **Production only**

- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_...`
- [ ] `CLERK_SECRET_KEY` = `sk_live_...`
- [ ] `NEXT_PUBLIC_CLERK_SIGN_IN_URL` = `/sign-in`
- [ ] `NEXT_PUBLIC_CLERK_SIGN_UP_URL` = `/sign-up`
- [ ] `NEXT_PUBLIC_CONVEX_URL` = `https://your-prod.convex.cloud`
- [ ] `CONVEX_DEPLOY_KEY` = `prod:deployment|token`
- [ ] `BLOB_READ_WRITE_TOKEN` = (auto-configured) ✅
- [ ] `OPENAI_API_KEY` = `sk-...` (optional - for imports)
- [ ] `GEMINI_API_KEY` = `AI...` (optional - for imports)
- [ ] `NEXT_PUBLIC_IMPORT_ENABLED` = `true` (if using imports)

### Preview Environment (Vercel Dashboard)

Environment: **Preview only**

- [ ] `CONVEX_DEPLOY_KEY` = `preview:username:project|token`
- [ ] Other env vars (reuse production or use test keys)

## First Deployment

- [ ] Pushed to main branch: `git push origin main`
- [ ] Deployment triggered in Vercel dashboard
- [ ] Build logs show Convex deploy step completed successfully
- [ ] Build logs show Next.js build completed successfully
- [ ] Deployment succeeded
  - Production URL: `_______________________________`

## Post-Deployment Configuration

### Clerk Webhook (Must be done AFTER first deploy)

- [ ] Created webhook in Clerk dashboard
  - Endpoint URL: `https://your-domain.com/api/webhooks/clerk`
- [ ] Subscribed to events:
  - [ ] `user.created`
  - [ ] `user.updated`
  - [ ] `user.deleted`
- [ ] Copied webhook signing secret
- [ ] Added `CLERK_WEBHOOK_SECRET` to Vercel env vars (Production)
- [ ] Redeployed after adding webhook secret

## Post-Deployment Verification

### Health Check

- [ ] Accessed `/api/health` endpoint
  ```bash
  curl https://your-domain.com/api/health
  ```
- [ ] Response shows `"status": "healthy"`
- [ ] All services show `true`:
  - [ ] `convex: true`
  - [ ] `clerk: true`
  - [ ] `blob: true`

### Authentication Flow

- [ ] Visited production URL
- [ ] Clicked "Sign Up"
- [ ] Created test account: `_______________________________`
- [ ] Email confirmation worked (if enabled)
- [ ] Signed in successfully
- [ ] Checked Convex Dashboard → Data → users table
  - [ ] Test user exists (confirms webhook working)
  - [ ] User has correct email
  - [ ] User has `clerkId` field

### Core Functionality

- [ ] Library page loads without errors
- [ ] Added a test book
  - Title: `_______________________________`
  - Book appears in library
- [ ] Opened book detail page
- [ ] Uploaded book cover (if blob configured)
  - Cover displays correctly
- [ ] Created a test note
  - Note appears in book detail
- [ ] Toggled book privacy
  - Privacy change persists
- [ ] Tested import (if enabled)
  - Uploaded test CSV/text file
  - Import preview appeared
  - Import committed successfully
- [ ] Signed out
- [ ] Signed back in
  - All data still present

### Error Monitoring

- [ ] Checked Vercel logs for errors
  - Path: Vercel Dashboard → Logs
  - No critical errors: [ ] Yes
- [ ] Checked browser console for errors
  - No CSP violations: [ ] Yes
  - No JavaScript errors: [ ] Yes
- [ ] Checked Convex logs for errors
  - Path: Convex Dashboard → Logs
  - No function errors: [ ] Yes

## Preview Deployments

### Test Preview Deploy

- [ ] Created test branch: `test/preview-deployment`
- [ ] Pushed to GitHub
- [ ] Vercel created preview deployment
  - Preview URL: `_______________________________`
- [ ] Convex created preview deployment
  - Visible in Convex Dashboard: [ ] Yes
- [ ] Tested preview URL works
- [ ] Preview has isolated data (not production)

## Optional: Monitoring Setup

### Vercel Analytics (Built-in)

- [ ] Enabled Vercel Analytics
  - Path: Vercel Dashboard → Analytics tab
- [ ] Enabled Web Vitals tracking

### External Monitoring (Recommended)

- [ ] Set up uptime monitoring
  - Service: `_______________________________`
  - Monitoring: `https://your-domain.com/api/health`
  - Alert email/Slack: `_______________________________`

### Error Tracking (Optional)

- [ ] Installed Sentry via Vercel Integration
  - Vercel Dashboard → Integrations → Sentry
- [ ] Configured PII redaction
- [ ] Set up error alerts

## Documentation

- [ ] Updated `.env.production` with actual values (local backup)
  - **DO NOT COMMIT** - verify `.gitignore` blocks this
- [ ] Documented production URLs in team docs
  - Production: `_______________________________`
  - Convex Dashboard: `https://dashboard.convex.dev`
  - Clerk Dashboard: `https://dashboard.clerk.com`
  - Vercel Dashboard: `https://vercel.com/dashboard`

## Rollback Plan

- [ ] Documented last known good deployment
  - Deployment URL: `_______________________________`
  - Git commit SHA: `_______________________________`
  - Timestamp: `_______________________________`

## Security Final Check

- [ ] `.env.local` in `.gitignore` ✅
- [ ] `.env.production` in `.gitignore` ✅
- [ ] No secrets committed to Git
  - Ran: `git log -p | grep -i "sk_live\|pk_live\|whsec" | wc -l`
  - Result should be 0: [ ] Yes
- [ ] All secrets stored only in Vercel env vars
- [ ] CSP headers configured in `next.config.ts`
- [ ] Security headers configured in `vercel.json`
- [ ] Clerk webhook signature verification enabled (in code)

## Next Steps

- [ ] Monitor error logs for first 24 hours
- [ ] Set up weekly error review process
- [ ] Plan for next deployment (staging environment?)
- [ ] Document lessons learned

## Troubleshooting Reference

If issues occur, see:
- **[DEPLOYMENT.md](../DEPLOYMENT.md)** - Complete deployment guide with troubleshooting section
- **[CLAUDE.md](../CLAUDE.md)** - Architecture and patterns
- **Vercel Logs** - Real-time deployment and runtime logs
- **Convex Dashboard → Logs** - Backend function logs
- **Clerk Dashboard → Webhooks** - Webhook delivery status

---

**Deployment Completed**: `_____ / _____ / _____`

**Deployed By**: `_______________________________`

**Notes**:
```text
___________________________________________________________________
___________________________________________________________________
___________________________________________________________________
```
