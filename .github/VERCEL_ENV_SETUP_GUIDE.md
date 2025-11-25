# Vercel Environment Variables Setup Guide

**Status**: ⚠️ **ACTION REQUIRED** - Manual configuration needed in Vercel Dashboard

## Background

Preview deployments are failing because `NEXT_PUBLIC_CONVEX_URL` is missing. The build command has been reverted to the official Convex recommendation: `npx convex deploy --cmd 'next build'`, which will automatically inject the Convex URL during build.

However, this requires the `CONVEX_DEPLOY_KEY` environment variable to be configured in Vercel.

---

## Required Actions

### Step 1: Configure Preview Environment Variables

1. **Go to Vercel Dashboard**:
   - Navigate to: https://vercel.com/misty-step/bibliomnomnom/settings/environment-variables
   - (Or: Project → Settings → Environment Variables)

2. **Add `CONVEX_DEPLOY_KEY` for Preview**:
   - Click "Add New" button
   - **Key**: `CONVEX_DEPLOY_KEY`
   - **Value**: `preview:phaedrus:bibliomnomnom|eyJ2MiI6IjVlNGRlYzY0ZjQ4ZTQ5MDM4MGZlMDFmNjUzOGM5ODAyIn0=`
     (This is your preview deploy key from .env.production)
   - **Environment**: Select **Preview** only (NOT Production or Development)
   - Click "Save"

3. **Verify Other Preview Variables Exist**:

   Check that these are already configured for Preview environment:

   | Variable                            | Expected Value                 | Source                  |
   | ----------------------------------- | ------------------------------ | ----------------------- |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` or `pk_test_...` | Clerk dashboard         |
   | `CLERK_SECRET_KEY`                  | `sk_live_...` or `sk_test_...` | Clerk dashboard         |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL`     | `/sign-in`                     | Static                  |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL`     | `/sign-up`                     | Static                  |
   | `BLOB_READ_WRITE_TOKEN`             | (auto-configured)              | Vercel Blob integration |
   | `NEXT_PUBLIC_IMPORT_ENABLED`        | `true`                         | Feature flag            |

   **Optional (for import feature):**
   - `OPENAI_API_KEY` - OpenAI API key for LLM extraction
   - `GEMINI_API_KEY` - Gemini API key for LLM extraction fallback

4. **DO NOT Set `NEXT_PUBLIC_CONVEX_URL` for Preview**:

   ⚠️ **IMPORTANT**: Do NOT manually set `NEXT_PUBLIC_CONVEX_URL` in the Preview environment.

   The `npx convex deploy` command will automatically inject this variable during the build process with the correct preview deployment URL.

---

### Step 2: Verify Production Environment Variables

Confirm these are configured for **Production** environment:

| Variable                            | Expected Value                           | Notes              |
| ----------------------------------- | ---------------------------------------- | ------------------ |
| `CONVEX_DEPLOY_KEY`                 | `prod:doting-spider-972\|{token}`        | **Required**       |
| `NEXT_PUBLIC_CONVEX_URL`            | `https://doting-spider-972.convex.cloud` | **Set explicitly** |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...`                            | Production key     |
| `CLERK_SECRET_KEY`                  | `sk_live_...`                            | Production key     |
| `CLERK_WEBHOOK_SECRET`              | `whsec_...`                              | Production webhook |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`     | `/sign-in`                               | Static             |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`     | `/sign-up`                               | Static             |
| `BLOB_READ_WRITE_TOKEN`             | (auto-configured)                        | Vercel integration |
| `NEXT_PUBLIC_IMPORT_ENABLED`        | `true`                                   | Feature flag       |

---

## How It Works

### Preview Deployment Flow:

1. **Developer pushes** to feature branch (e.g., `feature/import-llm-spec`)
2. **Vercel triggers** preview build using Preview environment variables
3. **Build command runs**: `npx convex deploy --cmd 'next build'`
4. **`npx convex deploy` reads** `CONVEX_DEPLOY_KEY=preview:...` from environment
5. **Convex creates** isolated deployment: `https://feature-import-llm-spec-{hash}.convex.site`
6. **This URL is auto-injected** as `NEXT_PUBLIC_CONVEX_URL` during `next build`
7. **Next.js builds** against this isolated backend
8. **Result**: Preview URL with isolated Convex backend

### Production Deployment Flow:

1. **Developer merges** to main branch
2. **Vercel triggers** production build using Production environment variables
3. **Build command runs**: `npx convex deploy --cmd 'next build'`
4. **`npx convex deploy` reads** `CONVEX_DEPLOY_KEY=prod:...` from environment
5. **Deploys to production** Convex deployment: `https://doting-spider-972.convex.cloud`
6. **Next.js builds** with explicitly configured `NEXT_PUBLIC_CONVEX_URL`
7. **Result**: Production deployment with stable Convex backend

---

## After Configuration

Once environment variables are configured:

1. **Commit the vercel.json change** (already done)
2. **Push to your feature branch**:
   ```bash
   git add vercel.json
   git commit -m "chore: restore coupled Convex deployment for preview environments"
   git push origin feature/import-llm-spec
   ```
3. **Monitor Vercel deployment**:
   - Go to: https://vercel.com/misty-step/bibliomnomnom/deployments
   - Watch build logs for successful `npx convex deploy` step
4. **Test preview URL**:
   - Visit the preview URL
   - Verify app loads (not empty)
   - Test login, library view, Convex queries

---

## Troubleshooting

### If preview deployment still fails:

**Check build logs for:**

- ❌ "Missing CONVEX_DEPLOY_KEY" → Variable not configured correctly
- ❌ "Invalid deploy key" → Wrong key format or type
- ❌ "Deployment failed" → Check Convex dashboard for errors

**Common issues:**

1. **Used wrong key type**: Production key in Preview environment (or vice versa)
2. **Key not scoped correctly**: Must select "Preview" environment when adding variable
3. **Typo in variable name**: Must be exactly `CONVEX_DEPLOY_KEY`

### If app loads but shows "Backend not configured":

This means `NEXT_PUBLIC_CONVEX_URL` is not being injected. Verify:

1. Build command is `npx convex deploy --cmd 'next build'`
2. `CONVEX_DEPLOY_KEY` is set for Preview environment
3. No manually-set `NEXT_PUBLIC_CONVEX_URL` in Preview (conflicts with auto-injection)

---

## Cleanup: Resolve Duplicate Vercel Projects

After preview deployments are working, clean up the duplicate project:

**Investigation findings** (from VERCEL_INVESTIGATION.md):

- Two projects exist: `bibliomnomnom` (double 'n') and `biblomnomnom` (single 'n')
- Both are triggering deployment checks

**Action:**

1. Identify which project has custom domain `www.bibliomnomnom.com`
2. In the OTHER project:
   - Go to Settings → Git
   - Click "Disconnect" to remove GitHub integration
3. (Optional) Delete the duplicate project entirely

---

## References

- [Official Convex + Vercel Guide](https://docs.convex.dev/production/hosting/vercel)
- [Preview Deployments Documentation](https://docs.convex.dev/production/hosting/preview-deployments)
- Project `DEPLOYMENT.md` (comprehensive deployment guide)
- `.github/VERCEL_INVESTIGATION.md` (investigation notes)

---

**Last Updated**: 2025-11-23
**Status**: Awaiting manual Vercel dashboard configuration
