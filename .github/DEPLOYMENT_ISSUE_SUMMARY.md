# Vercel Preview Deployment Issue - Investigation Summary

**Date**: 2025-11-23
**Status**: ⚠️ BLOCKED - Environment variables not being passed to build

---

## Problem Statement

Preview deployments show empty page after login. Investigation revealed the root cause is **`CONVEX_DEPLOY_KEY` environment variable not being passed to the Vercel build process**, despite being correctly configured in Vercel Dashboard.

---

## Investigation Timeline

### ✅ Steps Completed Successfully

1. **Reverted build command** to official Convex recommendation:
   - Changed from: `pnpm build:local` (decoupled)
   - Changed to: `npx convex deploy --cmd 'next build'` (coupled, official)

2. **Configured ALL environment variables** via Vercel CLI:
   - Preview environment: 8 variables
   - Production environment: 9 variables
   - Development environment: 1 variable (CONVEX_DEPLOY_KEY)

3. **Verified configuration**:

   ```bash
   vercel env ls
   # Shows 17 environment variables configured correctly
   ```

4. **Deep research conducted**:
   - Official Convex documentation
   - 50+ production Convex+Vercel applications (via Exa)
   - Gemini AI synthesis
   - Convex Discord community (2025 discussions)

### ❌ Current Blocker

**Environment variables not being injected into build process.**

**Evidence from build logs:**

```bash
# Debug output from build (commit 7a4a2b1):
CONVEX_DEPLOY_KEY is:
NEXT_PUBLIC_CONVEX_URL=https://groovy-roadrunne-224.convex.cloud
CONVEX_DEPLOYMENT=dev:groovy-roadrunner-224
# ^^^ CONVEX_DEPLOY_KEY is MISSING from environment!
```

**Expected:**

```bash
CONVEX_DEPLOY_KEY=preview:phaedrus:bibliomnomnom|...
# Should be present in build environment
```

**Actual Result:**

- `CONVEX_DEPLOY_KEY` not found in build environment
- `npx convex deploy` tries to use dev deployment `groovy-roadrunner-224`
- Gets 401 Unauthorized: MissingAccessToken error
- Build fails after 10-14 seconds

---

## Environment Variable Configuration

### Verified in Vercel Dashboard

**Preview Environment:**

- ✅ `CONVEX_DEPLOY_KEY` = `preview:phaedrus:bibliomnomnom|eyJ2MiI6IjVlNGRlYzY0ZjQ4ZTQ5MDM4MGZlMDFmNjUzOGM5ODAyIn0=`
- ✅ `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_...`
- ✅ `CLERK_SECRET_KEY` = `sk_live_...`
- ✅ `NEXT_PUBLIC_CLERK_SIGN_IN_URL` = `/sign-in`
- ✅ `NEXT_PUBLIC_CLERK_SIGN_UP_URL` = `/sign-up`
- ✅ `NEXT_PUBLIC_IMPORT_ENABLED` = `true`
- ✅ `GEMINI_API_KEY` = `AIza...`
- ✅ `OPENAI_API_KEY` = `sk-proj-...`

**Production Environment:**

- ✅ `CONVEX_DEPLOY_KEY` = `prod:doting-spider-972|eyJ2MiI6ImVmZDE1ZmFkODg5NzRlMmNiZWE5YTZmNmQ3OTFhYTkxIn0=`
- ✅ `NEXT_PUBLIC_CONVEX_URL` = `https://doting-spider-972.convex.cloud`
- ✅ All other vars same as Preview

**Development Environment:**

- ✅ `CONVEX_DEPLOY_KEY` = `preview:phaedrus:bibliomnomnom|...` (added as test)

---

## Attempted Solutions

### 1. Reconfigured Environment Variables (3 attempts)

- First attempt: Configured on wrong project (`biblomnomnom` single 'n')
- Second attempt: Realized only one project exists (`biblomnomnom` single 'n')
- Third attempt: Removed and re-added to all environments

**Result:** Variables show in `vercel env ls` but NOT in build environment

### 2. Added Debug Output to Build Command

```json
"buildCommand": "echo 'CONVEX_DEPLOY_KEY is:' && env | grep CONVEX && npx convex deploy --cmd 'next build'"
```

**Result:** Confirmed `CONVEX_DEPLOY_KEY` is missing from build environment

### 3. Checked for Conflicting Configuration

- ✅ No `.env` files in git (only `.env.example` tracked)
- ✅ No `convex.json` config file
- ✅ No hardcoded deployment URLs in codebase

**Result:** No obvious conflicts found

---

## Current Hypotheses

### Hypothesis 1: Vercel Bug or Cache Issue

**Theory:** Vercel may be caching old environment configuration or have a bug preventing new env vars from being injected

**Evidence:**

- Build environment shows dev deployment vars (`CONVEX_DEPLOYMENT=dev:groovy-roadrunner-224`)
- These vars are NOT configured in Vercel Dashboard
- Must be coming from cache or previous configuration

**Next Steps to Test:**

- Clear Vercel build cache manually
- Contact Vercel support
- Try creating a fresh deployment from scratch

### Hypothesis 2: Convex Pro Plan Required

**Theory:** Preview deployments may require Convex Pro plan (mentioned in documentation)

**Evidence from research:**

> "Convex preview deployments require a Convex Pro plan" - Official docs

**Next Steps to Test:**

- Check current Convex plan in dashboard
- Upgrade to Pro if needed
- Verify if that's blocking preview deploy key usage

### Hypothesis 3: Environment Variable Targeting Issue

**Theory:** Vercel preview deployments may not be matching the "Preview" environment targeting

**Evidence:**

- Variables configured for "Preview" environment
- But build might be using different environment name
- `vercel env pull` only pulls "development" by default

**Next Steps to Test:**

- Try setting env vars for specific branch patterns
- Check Vercel documentation for preview environment targeting
- Try using `development` environment instead of `preview`

### Hypothesis 4: Missing Vercel Integration

**Theory:** May need to install official Convex integration from Vercel marketplace

**Evidence:**

- Some research mentioned "Vercel's official Convex integration"
- Might provide automatic env var management

**Next Steps to Test:**

- Check Vercel integrations marketplace
- Install Convex integration if available
- Reconfigure after integration installed

---

## Recommended Next Steps

### Immediate Actions:

1. **Clear Vercel Cache:**

   ```bash
   # Via Vercel dashboard or CLI
   vercel --force
   ```

2. **Check Convex Plan:**
   - Go to Convex dashboard
   - Verify current plan (Free vs Pro)
   - Upgrade if needed for preview deployments

3. **Install Convex Integration:**
   - Check Vercel marketplace for official Convex integration
   - Install and reconfigure

4. **Contact Support:**
   - Vercel support (if cache/env var issue)
   - Convex support (if plan/config issue)

### Alternative Approaches:

### Option A: Manual Preview Deployment

- Create dedicated Convex preview deployment manually
- Set `NEXT_PUBLIC_CONVEX_URL` explicitly for preview
- Lose branch-based isolation but get working previews

### Option B: Development-Only Workflow

- Skip Vercel preview deployments
- Test locally before merging to main
- Only deploy production on merge

### Option C: Different Hosting

- Consider if Convex + Vercel integration issues persist
- Research alternative hosting (Netlify, Railway, etc.)

---

## Deployment Logs Reference

**Latest Failed Deployment:**

- URL: `https://bibliomnomnom-u4s3b021s-misty-step.vercel.app`
- Time: 2025-11-24 13:56:42 UTC
- Duration: 11 seconds
- Error: `401 Unauthorized: MissingAccessToken`

**Log Excerpt:**

```bash
Running "npx convex deploy --cmd 'next build'"
✖ Error fetching GET https://api.convex.dev/api/deployment/groovy-roadrunner-224/team_and_project 401 Unauthorized: MissingAccessToken
Authenticate with `npx convex dev`
Error: Command "npx convex deploy --cmd 'next build'" exited with 1
```

---

## Files Modified During Investigation

1. `vercel.json` - Reverted build command to official recommendation
2. `.github/VERCEL_ENV_SETUP_GUIDE.md` - Created comprehensive setup guide
3. `.github/VERCEL_INVESTIGATION.md` - Updated with resolution attempt
4. `.vercel/project.json` - Project link updated multiple times

**All files committed:** Commits `f52ef4b`, `4bb88f0`, `7a4a2b1`, `9bb5c50`

---

## Key Learnings

1. **Coupled deployment is official best practice** - Confirmed by all research sources
2. **Environment variables must be available to build** - Current blocker
3. **Preview deploy keys different from production** - Correctly configured
4. **Branch-based isolation is powerful** - If we can get it working

---

## Resources

- [Official Convex + Vercel Guide](https://docs.convex.dev/production/hosting/vercel)
- [Preview Deployments Documentation](https://docs.convex.dev/production/hosting/preview-deployments)
- Vercel CLI: `vercel --help`
- Convex CLI: `npx convex --help`

---

**Status**: Blocked pending resolution of environment variable injection issue.

**Recommendation**: Contact Vercel and/or Convex support for guidance on why `CONVEX_DEPLOY_KEY` is not being passed to build environment despite being configured in Vercel Dashboard.
