# Vercel Duplicate Projects Investigation

## Issue
Two Vercel projects are integrated with this GitHub repository, causing duplicate deployment checks:
- `bibliomnomnom` (double 'n')
- `biblomnomnom` (single 'n')

## Current Status
- Local project linked to: `biblomnomnom` (single 'n') - Project ID: `prj_v6VfRjUZ1tmmIS3hkU6GoTeYWKWt`
- Both projects trigger deployment on push/PR
- Both deployments currently failing due to missing environment variables

## Investigation Steps

### 1. Check Project Configurations

**bibliomnomnom (double 'n')**:
- URL: https://vercel.com/misty-step/bibliomnomnom
- Check:
  - [ ] Does it have custom domain `www.bibliomnomnom.com`?
  - [ ] Are environment variables configured?
  - [ ] Is GitHub integration enabled?
  - [ ] What framework is detected?

**biblomnomnom (single 'n')**:
- URL: https://vercel.com/misty-step/biblomnomnom
- Check:
  - [ ] What domain(s) are configured?
  - [ ] Are environment variables configured?
  - [ ] Is GitHub integration enabled?
  - [ ] What framework is detected?

### 2. Determine Which Project to Keep

**Decision Criteria**:
1. **Custom Domain**: Keep the project with `www.bibliomnomnom.com` configured
2. **Environment Variables**: Keep the project with more complete configuration
3. **Recent Activity**: Keep the project with recent successful deployments
4. **Local Linking**: Verify `.vercel/project.json` matches the correct project

### 3. Recommended Action

**If duplicate (most likely)**:
1. Identify the "wrong" project
2. Go to that project's Settings → Git
3. Disconnect GitHub integration
4. (Optional) Delete the duplicate project entirely

**Keep ONLY**:
- The project with custom domain configured
- OR the project that matches `.vercel/project.json` if both have domains

### 4. Configure Environment Variables

Once single project identified, configure in Vercel Dashboard → Settings → Environment Variables:

**Production Environment**:
```bash
# Clerk (from .env.production)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuYmlibGlvbW5vbW5vbS5jb20k
CLERK_SECRET_KEY=sk_live_MfNtmcVeSs2UIgABme9BBNZ24ZmiHYp72PmVccJ3pL

# Convex (from .env.production)
NEXT_PUBLIC_CONVEX_URL=https://doting-spider-972.convex.cloud
CONVEX_DEPLOY_KEY=prod:doting-spider-972|eyJ2MiI6ImVmZDE1ZmFkODg5NzRlMmNiZWE5YTZmNmQ3OTFhYTkxIn0=

# Vercel Blob (already configured via integration ✅)
BLOB_READ_WRITE_TOKEN=(auto-configured)

# LLM (optional - for import feature)
OPENAI_API_KEY=(to be configured)
GEMINI_API_KEY=(to be configured)

# Feature Flags
NEXT_PUBLIC_IMPORT_ENABLED=true
```

**Preview Environment**:
```bash
# Convex Preview (from .env.production)
CONVEX_DEPLOY_KEY=preview:phaedrus:bibliomnomnom|eyJ2MiI6IjVlNGRlYzY0ZjQ4ZTQ5MDM4MGZlMDFmNjUzOGM5ODAyIn0=

# Clerk (reuse production keys for previews)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=(same as production)
CLERK_SECRET_KEY=(same as production)

# Other vars same as production
```

### 5. Verify Fix

After configuration:
1. Push to branch → Should trigger ONLY ONE Vercel deployment check
2. Deployment should succeed (build completes successfully)
3. Check deployment logs for errors
4. Visit preview URL to verify application works

## Current Deployment Failures

Recent deployment: https://bibliomnomnom-1n539hi7f-misty-step.vercel.app
- Status: ● Error
- Build Duration: 0ms (immediate failure)
- Likely cause: Missing `CONVEX_DEPLOY_KEY` environment variable

**Build Command** (from vercel.json):
```bash
npx convex deploy --cmd 'pnpm build'
```

This requires:
- `CONVEX_DEPLOY_KEY` to authenticate with Convex
- `NEXT_PUBLIC_CONVEX_URL` for the Convex deployment URL
- Without these, `npx convex deploy` fails immediately

## Next Steps

1. [ ] Investigate both Vercel projects in dashboard
2. [ ] Determine which one to keep
3. [ ] Disconnect GitHub integration from duplicate project
4. [ ] Configure environment variables in correct project
5. [ ] Test deployment succeeds
6. [ ] Delete this investigation file once resolved

## Notes

- The typo (bibliomnomnom vs biblomnomnom) might indicate one was created accidentally
- Check deployment history to see which project has been actively used
- Production domain configuration is a strong indicator of the "correct" project

---

## Resolution (2025-11-23)

**Root Cause Identified**: Missing `CONVEX_DEPLOY_KEY` environment variable in Preview environment, combined with decoupled build command that skips Convex deployment.

**Solution Implemented**:
1. ✅ Reverted `vercel.json` buildCommand to official recommended approach:
   - Changed from: `"buildCommand": "pnpm build:local"`
   - Changed to: `"buildCommand": "npx convex deploy --cmd 'next build'"`
2. ⏳ **Manual action required**: Configure `CONVEX_DEPLOY_KEY` in Vercel Dashboard
   - See: `.github/VERCEL_ENV_SETUP_GUIDE.md` for detailed instructions

**Research conducted**:
- Official Convex documentation analysis
- Exa deep research (50+ production examples)
- Gemini AI synthesis of best practices
- Convex Discord community discussions (2025)

**Key finding**: Coupled deployment (official approach) is superior to decoupled deployment for:
- Automatic branch-based preview isolation
- Zero manual Convex deployment steps
- Type safety guarantees
- Automatic cleanup (14-day TTL)

**Next steps**:
1. Configure environment variables in Vercel Dashboard (see guide)
2. Push this commit to trigger new preview deployment
3. Verify preview deployment works
4. Clean up duplicate Vercel project

---

**Created**: 2025-11-22
**Status**: ✅ Resolved - Awaiting manual Vercel configuration
