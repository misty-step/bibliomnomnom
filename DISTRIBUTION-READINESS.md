# bibliomnomnom Distribution Readiness Guide

**Current Status:** 77% ready (as of 2026-02-02)
**Target:** 100% production-ready

## 🎯 What's Blocking Distribution

According to the product readiness audit, bibliomnomnom needs:

1. **Stripe configuration** (~30 min)
   - Create products/prices in Stripe dashboard
   - Configure webhook endpoint
   - Add environment variables

2. **PostHog configuration** (~15 min)
   - Create PostHog project
   - Add API key to environment

## 📋 Complete Setup Checklist

### Phase 1: Account Creation (30 minutes)

#### Stripe
- [ ] **Create Stripe account** at https://stripe.com
  - Use: phaedrus@mistystep.io or kaylee@mistystep.io
  - Enable test mode
- [ ] **Create product**: "bibliomnomnom Pro"
  - Description: "AI-powered reading companion with personalized insights"
- [ ] **Create prices**:
  - Monthly: $15/month (price ID: `price_monthly_xxx`)
  - Annual: $129/year (price ID: `price_annual_xxx`) - shows as $10.75/month
- [ ] **Configure webhook**:
  - Endpoint: `https://www.bibliomnomnom.com/api/stripe/webhook`
  - Events: `checkout.session.completed`, `customer.subscription.*`
- [ ] **Get API keys**:
  - Secret key: `sk_live_xxx` (production) / `sk_test_xxx` (test)
  - Publishable key: `pk_live_xxx` / `pk_test_xxx`
  - Webhook secret: `whsec_xxx`

#### PostHog
- [ ] **Create account** at https://posthog.com
  - Use Misty Step organization
- [ ] **Create project**: "bibliomnomnom"
- [ ] **Get project API key**: `phc_xxx`

#### Clerk
- [ ] **Create account** at https://clerk.com
- [ ] **Create application**: "bibliomnomnom"
- [ ] **Configure JWT template**: "convex"
- [ ] **Get API keys**

#### Convex
- [ ] **Create account** at https://convex.dev
- [ ] **Create deployment**
- [ ] **Get deployment URL**

### Phase 2: Environment Configuration (15 minutes)

#### Update `.env.local` (development)
```bash
# Copy template
cp .env.example .env.local

# Fill in values:
# Clerk keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx

# Convex
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud
CONVEX_DEPLOYMENT=dev:xxx

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_MONTHLY=price_monthly_test_xxx
STRIPE_PRICE_ANNUAL=price_annual_test_xxx

# Convex webhook token (already generated)
CONVEX_WEBHOOK_TOKEN=xxx

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

#### Set Convex environment variables
```bash
# For development
npx convex env set STRIPE_SECRET_KEY "sk_test_xxx"
npx convex env set STRIPE_WEBHOOK_SECRET "whsec_xxx"
npx convex env set CONVEX_WEBHOOK_TOKEN "49cf9d6f4cca9a421af6d9c75cfd3e61a9d3b41e614611dd9d54835ccd0544ca"
npx convex env set STRIPE_PRICE_MONTHLY "price_monthly_test_xxx"
npx convex env set STRIPE_PRICE_ANNUAL "price_annual_test_xxx"

# For production (when ready)
CONVEX_DEPLOYMENT=prod:xxx npx convex env set STRIPE_SECRET_KEY "sk_live_xxx"
CONVEX_DEPLOYMENT=prod:xxx npx convex env set STRIPE_WEBHOOK_SECRET "whsec_xxx"
# ... etc
```

#### Vercel deployment
```bash
# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
# All NEXT_PUBLIC_* variables
# CONVEX_WEBHOOK_TOKEN (must match Convex!)
```

### Phase 3: Local Development Testing

#### Start development server
```bash
# Install dependencies
pnpm install

# Start all services
pnpm dev

# This runs:
# - Convex dev backend
# - Next.js dev server (localhost:3000)
# - Stripe webhook listener (stripe listen)
```

#### Test the flow
1. **Sign up** at http://localhost:3000/sign-up
2. **View pricing** at http://localhost:3000/pricing
3. **Start trial** (no credit card required)
4. **Test checkout** with Stripe test card:
   - Card: 4242 4242 4242 4242
   - Exp: Any future date
   - CVC: Any 3 digits
5. **Verify subscription** updates in Convex

### Phase 4: Production Deployment

#### Pre-deployment checks
```bash
# Run automated checks
./scripts/check-readiness.sh

# Validate environment
./scripts/validate-env.sh --prod-only
```

#### Deploy
```bash
# Build and deploy
pnpm convex:deploy  # Deploy Convex functions
vercel --prod       # Deploy frontend
```

#### Post-deployment verification
1. **Health check**: `curl https://www.bibliomnomnom.com/api/health?mode=deep`
2. **Test checkout** with real domain
3. **Monitor webhooks** in Stripe dashboard
4. **Verify analytics** in PostHog

## 🚀 Quick Start Script

I've created an automated setup script to streamline configuration:

```bash
# Run setup assistant
./scripts/setup-distribution.sh
```

The script will:
1. Validate current configuration
2. Guide you through missing steps
3. Generate configuration files
4. Test the setup

## 📊 Monitoring & Analytics

Once live, monitor:

### Key Metrics
- **Signup conversion rate**: Trial → Paid
- **MRR growth**: Monthly Recurring Revenue
- **Churn rate**: Subscription cancellations
- **User engagement**: Books added, notes created

### PostHog Setup
```javascript
// Already integrated in the app
// Track: User signups, book additions, subscription conversions
```

### Stripe Analytics
- **Dashboard**: Revenue, MRR, churn
- **Webhook reliability**: 200 status codes
- **Trial conversion**: 14-day trial → paid

## 🔧 Troubleshooting

### Common Issues

#### Webhook Failures
**Symptom**: Subscriptions not updating after payment
**Fix**: 
1. Check `CONVEX_WEBHOOK_TOKEN` matches on Vercel and Convex
2. Verify webhook URL in Stripe dashboard
3. Check Stripe logs for 200/500 responses

#### Environment Variable Issues
**Symptom**: "Invalid API key" or similar errors
**Fix**:
```bash
# Re-set with printf (no trailing newlines)
printf '%s' 'sk_test_xxx' | vercel env add STRIPE_SECRET_KEY production
```

#### Convex Development vs Production
**Symptom**: Development data in production queries
**Fix**: Always use `--prod` flag:
```bash
npx convex env list --prod
npx convex run --prod subscriptions:checkAccess
```

## 📈 Growth Strategy

### Launch Sequence
1. **Soft launch**: Friends & family (Week 1)
2. **Content marketing**: Reading blogs, book communities (Week 2-3)
3. **Paid acquisition**: Google/Facebook ads (Week 4+)
4. **Partnerships**: Book clubs, authors (Ongoing)

### Pricing Experiments
Test different price points:
- **Option A**: $15/month, $129/year (current)
- **Option B**: $12/month, $99/year (test conversion)
- **Option C**: $19/month, $159/year (premium positioning)

### Feature Roadmap
Post-launch features to increase retention:
1. **Social features**: Share shelves, reading stats
2. **Reading challenges**: Monthly goals, badges
3. **Author integrations**: Direct Q&A sessions
4. **Book club management**: Group reading features

## 🎁 What I've Done Tonight

1. **Convex webhook token generation** documented in setup script (run `./scripts/setup-distribution.sh`)
2. **Created .env.local template** with all required variables
3. **Created this comprehensive guide** with step-by-step instructions
4. **Verified codebase is production-ready** (architecture, tests, deployment scripts)

## 🎯 Next Steps for Phaedrus

1. **Morning (30 min)**: Create Stripe, PostHog, Clerk, Convex accounts
2. **Afternoon (15 min)**: Configure environment variables
3. **Evening (15 min)**: Test local development flow
4. **Tomorrow**: Deploy to production and share with early users

**Time to distribution-ready**: ~60 minutes of focused work

---

*Last updated: 2026-02-02 3:30 AM PST by Kaylee (overnight-builder)*
*Status: Guide complete, accounts pending creation*