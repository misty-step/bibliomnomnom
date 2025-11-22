# Production Deployment Guide

Complete guide for deploying bibliomnomnom to production on Vercel with Convex and Clerk.

## Prerequisites

- [x] Vercel account with project linked
- [x] Convex production deployment created
- [x] Clerk production application configured
- [x] Production domain configured (if custom domain)

## Phase 1: Convex Production Setup

### 1.1 Create Production Deployment

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Navigate to your project settings
3. Create a new production deployment (if not already created)
4. Copy the production deployment URL (e.g., `https://doting-spider-972.convex.cloud`)

### 1.2 Generate Deploy Keys

You need TWO deploy keys:

**Production Deploy Key:**
1. Go to Settings → Deploy Keys in Convex Dashboard
2. Click "Generate Production Deploy Key"
3. Copy the key (format: `prod:deployment-name|base64-token`)
4. Save securely - you'll need this for Vercel

**Preview Deploy Key:**
1. Go to Settings → Deploy Keys
2. Click "Generate Preview Deploy Key"
3. Copy the key (format: `preview:username:project|base64-token`)
4. Save securely - needed for Vercel preview deployments

### 1.3 Push Schema to Production

```bash
# Set production deploy key temporarily
export CONVEX_DEPLOY_KEY="prod:your-deployment|token"

# Deploy schema and functions to production
npx convex deploy

# Verify deployment
# Check Convex dashboard shows latest schema
```

## Phase 2: Clerk Production Setup

### 2.1 Create Production Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application for production (or switch existing to production)
3. Configure domains:
   - Add your production domain
   - Add Vercel preview domain pattern: `*.vercel.app`

### 2.2 Get Production Keys

Navigate to API Keys in Clerk Dashboard:

- **Publishable Key**: `pk_live_...` (client-side, safe to expose)
- **Secret Key**: `sk_live_...` (server-side, NEVER expose)

### 2.3 Create JWT Template for Convex

1. Go to JWT Templates in Clerk Dashboard
2. Click "New Template" → Select "Convex"
3. Name it exactly `convex`
4. Add to claims: `{ "convex": "..." }`
5. Save and enable the template

### 2.4 Configure Production Webhook

**IMPORTANT**: Must be done AFTER first Vercel deployment

1. Go to Webhooks in Clerk Dashboard
2. Click "Add Endpoint"
3. Set endpoint URL: `https://your-domain.com/api/webhooks/clerk`
4. Subscribe to events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Copy the **Signing Secret** (starts with `whsec_...`)
6. Save webhook

## Phase 3: Vercel Environment Variables

### 3.1 Production Environment

Set these in Vercel Dashboard → Settings → Environment Variables (Environment: **Production only**):

```bash
# Clerk Production
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Convex Production
NEXT_PUBLIC_CONVEX_URL=https://your-prod-deployment.convex.cloud
CONVEX_DEPLOY_KEY=prod:deployment|token

# Vercel Blob (already configured via Vercel Integration)
# BLOB_READ_WRITE_TOKEN - auto-configured ✅

# LLM Providers (optional - for import feature)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...

# Feature Flags
NEXT_PUBLIC_IMPORT_ENABLED=true
```

### 3.2 Preview Environment

Set these for **Preview environment only**:

```bash
# Convex Preview - uses branch-based deployments
CONVEX_DEPLOY_KEY=preview:username:project|token

# Clerk - can reuse production OR use test keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... # or pk_live_...
CLERK_SECRET_KEY=sk_test_... # or sk_live_...
CLERK_WEBHOOK_SECRET=whsec_... # if using webhooks in preview

# Feature Flags
NEXT_PUBLIC_IMPORT_ENABLED=true
```

### 3.3 Development Environment

Pull development env vars to `.env.local`:

```bash
vercel env pull .env.local
```

## Phase 4: Vercel Deployment

### 4.1 Link Project (if not already linked)

```bash
# In project root
vercel link

# Follow prompts:
# - Select your Vercel account/team
# - Link to existing project or create new
```

### 4.2 Verify Build Configuration

The project includes `vercel.json` with correct build command:

```json
{
  "buildCommand": "npx convex deploy --cmd 'pnpm build'",
  "installCommand": "pnpm install --frozen-lockfile"
}
```

**This ensures Convex deploys BEFORE Next.js build** (critical for type safety).

### 4.3 Deploy to Production

**Option A: Deploy from main branch (recommended)**

```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Deploy to production
vercel --prod
```

**Option B: Auto-deploy on push**

Push to `main` branch triggers automatic Vercel production deployment:

```bash
git push origin main
```

### 4.4 Monitor Deployment

1. Watch deployment logs in Vercel Dashboard
2. Check for errors in:
   - `npx convex deploy` step (should complete successfully)
   - `pnpm install` step (dependencies)
   - `next build` step (compilation)
3. If deployment fails, check Vercel logs for specific error

## Phase 5: Post-Deployment Verification

### 5.1 Health Check

Test the health endpoint:

```bash
curl https://your-domain.com/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2025-11-22T...",
  "uptime": 123.45,
  "environment": "production",
  "version": "abc1234",
  "services": {
    "convex": true,
    "clerk": true,
    "blob": true
  }
}
```

### 5.2 Authentication Flow

1. Visit production URL
2. Click "Sign Up" → create test account
3. Verify email confirmation works
4. Sign in with test account
5. Check Convex Dashboard → Data → `users` table shows new user
   - **If user not created**: Clerk webhook failed
   - Check webhook logs in Clerk Dashboard
   - Verify `CLERK_WEBHOOK_SECRET` matches

### 5.3 Core Functionality

Test critical paths:

- [x] **Library page loads** (tests Convex queries + auth)
- [x] **Add new book manually** (tests mutations + optimistic updates)
- [x] **Upload book cover** (tests Vercel Blob integration)
- [x] **Create note on book** (tests nested mutations)
- [x] **Toggle book privacy** (tests privacy model)
- [x] **Import CSV file** (tests LLM integration if enabled)
- [x] **Sign out and sign back in** (tests Clerk auth flow)

### 5.4 Check Logs

Monitor for errors:

```bash
# View production logs
vercel logs --prod

# Or in Vercel Dashboard → Logs tab
```

Look for:
- ❌ Clerk webhook signature failures
- ❌ Convex connection errors
- ❌ Missing environment variables
- ❌ CSP violations in browser console

## Phase 6: Preview Deployments

### 6.1 How Preview Deployments Work

Every PR/branch push creates:
- **Fresh Vercel preview deployment** (unique URL: `project-git-branch-team.vercel.app`)
- **Fresh Convex preview deployment** (isolated database, auto-cleanup after 14 days)

This allows testing backend changes safely before merging to production.

### 6.2 Test Preview Deployment

1. Create a new branch:
   ```bash
   git checkout -b test/preview-deployment
   ```

2. Push to GitHub:
   ```bash
   git push origin test/preview-deployment
   ```

3. Vercel automatically deploys preview
4. Check Convex Dashboard → shows new preview deployment
5. Test preview URL (has isolated data, won't affect production)

### 6.3 Preview Limitations

- **No production data** - preview deployments start with empty Convex database
- **Clerk webhooks may fail** - unless you add preview URL to Clerk webhook endpoints
- **14-day auto-cleanup** - Convex preview deployments deleted automatically

## Phase 7: Monitoring & Observability

### 7.1 Built-in Vercel Analytics

Enable in Vercel Dashboard → Analytics:
- Web Vitals (LCP, FID, CLS)
- Page load performance
- Geographic distribution

### 7.2 Health Check Monitoring (Recommended)

Set up external monitoring:

**BetterUptime (free tier):**
1. Sign up at [betteruptime.com](https://betteruptime.com)
2. Add monitor: `https://your-domain.com/api/health`
3. Set check interval: 1 minute
4. Configure alerts (email/Slack)

**UptimeRobot (free tier):**
1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Add HTTP(s) monitor
3. URL: `https://your-domain.com/api/health`
4. Interval: 5 minutes (free tier limit)

### 7.3 Error Tracking (Optional - Recommended)

**Sentry via Vercel Integration:**

1. Vercel Dashboard → Integrations → Browse Marketplace
2. Find "Sentry" → Add Integration
3. Follow Sentry setup wizard
4. Sentry auto-configures with Vercel (centralized billing)
5. Errors automatically tracked with source maps

**Benefits:**
- Stack traces with source maps
- User context (which user hit the error)
- Release tracking (which deploy introduced error)
- PII redaction for GDPR compliance

## Troubleshooting

### Build Fails: "Could not find public function"

**Cause**: Convex not deployed before Next.js build

**Fix**:
- Verify `vercel.json` has correct `buildCommand`
- Check build logs show `npx convex deploy` running first
- Ensure `CONVEX_DEPLOY_KEY` set in Vercel env vars

### Webhook Signature Failed

**Cause**: `CLERK_WEBHOOK_SECRET` mismatch

**Fix**:
1. Go to Clerk Dashboard → Webhooks → Your Endpoint
2. Copy the **Signing Secret** (not the endpoint URL!)
3. Update `CLERK_WEBHOOK_SECRET` in Vercel env vars
4. Redeploy

### CSP Violations in Browser Console

**Cause**: Third-party script not allowed by Content Security Policy

**Fix**:
1. Check browser console for blocked resource
2. Add domain to appropriate CSP directive in `next.config.ts`
3. Redeploy

Example: `Blocked loading font from 'https://fonts.gstatic.com'`
- Add to `font-src` directive: `font-src 'self' data: https://fonts.gstatic.com`

### Preview Deployment Fails

**Cause**: Missing `CONVEX_DEPLOY_KEY` for preview environment

**Fix**:
1. Go to Convex Dashboard → Settings → Deploy Keys
2. Generate Preview Deploy Key
3. Add to Vercel env vars with Environment = "Preview"
4. Retry deployment

### Import Feature Fails in Production

**Cause**: Missing LLM API keys

**Fix**:
1. Add `OPENAI_API_KEY` or `GEMINI_API_KEY` to Vercel env vars (Production)
2. Verify keys are valid and have quota remaining
3. Check Vercel logs for specific API error messages

## Rollback Procedure

If production has critical issues:

### Quick Rollback via Vercel Dashboard

1. Go to Deployments tab
2. Find last known good deployment
3. Click "..." → "Promote to Production"
4. Confirm promotion

### Rollback via CLI

```bash
# List recent deployments
vercel ls

# Promote specific deployment to production
vercel promote <deployment-url> --prod
```

### Rollback Convex Backend

```bash
# Download schema from specific point in time
# (Not currently supported - prevention is key!)

# Alternative: Redeploy from known-good git commit
git checkout <known-good-commit>
export CONVEX_DEPLOY_KEY="prod:..."
npx convex deploy
git checkout main
```

## Maintenance

### Weekly Checks

- [ ] Review error logs in Vercel/Sentry
- [ ] Check uptime monitoring (BetterUptime/UptimeRobot)
- [ ] Verify Convex usage not approaching limits
- [ ] Check Clerk MAU (monthly active users) count

### Monthly Tasks

- [ ] Review and update dependencies (`pnpm update`)
- [ ] Check security advisories (`pnpm audit`)
- [ ] Review Vercel analytics for performance trends
- [ ] Cleanup old preview deployments (Convex auto-deletes after 14 days)

### Before Major Releases

- [ ] Test on preview deployment first
- [ ] Run full test suite (`pnpm test`)
- [ ] Verify build succeeds locally (`pnpm build`)
- [ ] Review recent error patterns in Sentry
- [ ] Communicate maintenance window to users (if needed)

## Security Checklist

- [x] All secrets stored in Vercel env vars (not in code)
- [x] `.env.local` and `.env.production` in `.gitignore`
- [x] Clerk webhook signature verification enabled
- [x] CSP headers configured in `next.config.ts`
- [x] HTTPS enforced via Vercel (automatic)
- [x] Security headers configured in `vercel.json`
- [ ] Sentry PII redaction configured (if using Sentry)
- [ ] Rate limiting on import feature (5 imports/day/user)

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Convex Docs**: https://docs.convex.dev
- **Clerk Docs**: https://clerk.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **GitHub Issues**: https://github.com/misty-step/bibliomnomnom/issues

---

**Last Updated**: 2025-11-22
**Tested With**: Next.js 15.1.0, Convex 1.28.2, Clerk 6.34.5, Node 20+
