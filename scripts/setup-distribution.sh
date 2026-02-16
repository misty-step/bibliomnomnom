#!/usr/bin/env bash
set -eo pipefail

# bibliomnomnom Distribution Setup Assistant
# Guides you through making bibliomnomnom production-ready

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.local"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

echo "📚 bibliomnomnom Distribution Setup"
echo "=================================="
echo "This script will guide you through making bibliomnomnom production-ready."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_step() {
  echo -e "\n${BLUE}▶ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

ask_yes_no() {
  while true; do
    read -p "$1 [y/n]: " yn
    case $yn in
      [Yy]* ) return 0;;
      [Nn]* ) return 1;;
      * ) echo "Please answer yes or no.";;
    esac
  done
}

check_env_file() {
  print_step "Checking environment configuration"
  
  if [[ ! -f "$ENV_FILE" ]]; then
    print_warning ".env.local not found"
    if ask_yes_no "Create .env.local from template?"; then
      cp "$ENV_EXAMPLE" "$ENV_FILE"
      print_success "Created .env.local"
    else
      print_error "Cannot proceed without .env.local"
      exit 1
    fi
  else
    print_success ".env.local exists"
  fi
  
  # Check for Convex webhook token
  if grep -q "^CONVEX_WEBHOOK_TOKEN=$" "$ENV_FILE" || ! grep -q "^CONVEX_WEBHOOK_TOKEN=" "$ENV_FILE"; then
    print_warning "CONVEX_WEBHOOK_TOKEN is not set"
    echo "Generating Convex webhook token..."
    TOKEN=$(openssl rand -hex 32)
    if grep -q "^CONVEX_WEBHOOK_TOKEN=" "$ENV_FILE"; then
      sed -i '' "s|^CONVEX_WEBHOOK_TOKEN=.*|CONVEX_WEBHOOK_TOKEN=$TOKEN|" "$ENV_FILE"
    else
      echo "CONVEX_WEBHOOK_TOKEN=$TOKEN" >> "$ENV_FILE"
    fi
    print_success "Generated CONVEX_WEBHOOK_TOKEN: $TOKEN"
  else
    print_success "CONVEX_WEBHOOK_TOKEN is set"
  fi
}

check_dependencies() {
  print_step "Checking dependencies"
  
  # Check Node.js
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION"
  else
    print_error "Node.js not installed"
    echo "Install Node.js from https://nodejs.org/"
    exit 1
  fi
  
  # Check Bun
  if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version)
    print_success "bun $BUN_VERSION"
  else
    print_warning "bun not installed"
    echo "Install bun from https://bun.sh"
    exit 1
  fi
  
  # Check Stripe CLI
  if command -v stripe &> /dev/null; then
    STRIPE_VERSION=$(stripe --version)
    print_success "Stripe CLI $STRIPE_VERSION"
  else
    print_warning "Stripe CLI not installed"
    if ask_yes_no "Install Stripe CLI? (Required for webhook testing)"; then
      echo "Installing Stripe CLI..."
      brew install stripe/stripe-cli/stripe
      print_success "Installed Stripe CLI"
      print_warning "Run 'stripe login' after setup to authenticate"
    fi
  fi
}

check_accounts() {
  print_step "Checking required accounts"
  
  echo "You need accounts on these services:"
  echo ""
  echo "1. ${BLUE}Stripe${NC} - Payment processing"
  echo "   • Create product: 'bibliomnomnom Pro'"
  echo "   • Create prices: \$15/month, \$129/year"
  echo "   • Configure webhook"
  echo ""
  echo "2. ${BLUE}PostHog${NC} - Analytics"
  echo "   • Create project: 'bibliomnomnom'"
  echo "   • Get API key"
  echo ""
  echo "3. ${BLUE}Clerk${NC} - Authentication"
  echo "   • Create application: 'bibliomnomnom'"
  echo "   • Configure JWT template: 'convex'"
  echo ""
  echo "4. ${BLUE}Convex${NC} - Backend database"
  echo "   • Create deployment"
  echo "   • Get deployment URL"
  echo ""
  
  echo "Accounts to create:"
  echo -e "${YELLOW}[ ] Stripe${NC}"
  echo -e "${YELLOW}[ ] PostHog${NC}"
  echo -e "${YELLOW}[ ] Clerk${NC}"
  echo -e "${YELLOW}[ ] Convex${NC}"
  echo ""
  
  if ask_yes_no "Open account creation pages in browser?"; then
    open "https://stripe.com"
    open "https://posthog.com"
    open "https://clerk.com"
    open "https://convex.dev"
    echo ""
    echo "Create accounts, then return here to continue."
  fi
  
  read -p "Press Enter when you have created the accounts..."
}

generate_setup_summary() {
  print_step "Generating setup summary"
  
  SUMMARY_FILE="$PROJECT_ROOT/SETUP-SUMMARY.md"
  
  cat > "$SUMMARY_FILE" << EOF
# bibliomnomnom Setup Summary

Generated: $(date)

## Next Steps

### 1. Get API Keys
Get these keys from your service dashboards:

#### Stripe
- Secret key: \`sk_test_xxx\`
- Publishable key: \`pk_test_xxx\`
- Webhook secret: \`whsec_xxx\`
- Price IDs: \`price_monthly_test_xxx\`, \`price_annual_test_xxx\`

#### PostHog
- Project API key: \`phc_xxx\`

#### Clerk
- Publishable key: \`pk_test_xxx\`
- Secret key: \`sk_test_xxx\`
- Webhook secret: \`whsec_xxx\`

#### Convex
- Deployment URL: \`https://xxx.convex.cloud\`
- Deployment slug: \`dev:xxx\`

### 2. Update .env.local
Edit \`.env.local\` with your keys:

\`\`\`bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx

# Convex
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud
CONVEX_DEPLOYMENT=dev:xxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_MONTHLY=price_monthly_test_xxx
STRIPE_PRICE_ANNUAL=price_annual_test_xxx

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx

# Convex webhook token (already set)
CONVEX_WEBHOOK_TOKEN=$(grep "^CONVEX_WEBHOOK_TOKEN=" "$ENV_FILE" | cut -d'=' -f2)
\`\`\`

### 3. Set Convex Environment
\`\`\`bash
cd "$PROJECT_ROOT"

# Set Stripe keys
bunx convex env set STRIPE_SECRET_KEY "sk_test_xxx"
bunx convex env set STRIPE_WEBHOOK_SECRET "whsec_xxx"
bunx convex env set CONVEX_WEBHOOK_TOKEN "$(grep "^CONVEX_WEBHOOK_TOKEN=" "$ENV_FILE" | cut -d'=' -f2)"
bunx convex env set STRIPE_PRICE_MONTHLY "price_monthly_test_xxx"
bunx convex env set STRIPE_PRICE_ANNUAL "price_annual_test_xxx"
\`\`\`

### 4. Run Development Server
\`\`\`bash
# Install dependencies
bun install

# Start development
bun run dev
\`\`\`

### 5. Test
1. Visit http://localhost:3000
2. Sign up for an account
3. Start 14-day trial
4. Test checkout with card: 4242 4242 4242 4242

## Useful Commands

\`\`\`bash
# Validate environment
./scripts/validate-env.sh

# Run tests
bun run test

# Deploy to production
bun run convex:deploy
vercel --prod
\`\`\`

## Need Help?

- Check \`DISTRIBUTION-READINESS.md\` for detailed guide
- Review \`docs/deployment/pre-production-checklist.md\`
- Open issues on GitHub: https://github.com/misty-step/bibliomnomnom

EOF
  
  print_success "Created setup summary: $SUMMARY_FILE"
}

run_validation() {
  print_step "Running validation checks"
  
  cd "$PROJECT_ROOT"
  
  # Check if validate-env.sh exists
  if [[ -f "./scripts/validate-env.sh" ]]; then
    echo "Running environment validation..."
    if ./scripts/validate-env.sh; then
      print_success "Environment validation passed"
    else
      print_warning "Environment validation failed (expected without keys)"
    fi
  else
    print_warning "validate-env.sh not found, skipping validation"
  fi
  
  # Check TypeScript
  echo "Checking TypeScript compilation..."
  if bun run typecheck &> /dev/null; then
    print_success "TypeScript compilation passes"
  else
    print_error "TypeScript compilation failed"
    bun run typecheck
  fi
}

main() {
  echo "bibliomnomnom Distribution Setup Assistant"
  echo "=========================================="
  
  check_dependencies
  check_env_file
  check_accounts
  generate_setup_summary
  run_validation
  
  echo ""
  echo "=========================================="
  echo -e "${GREEN}Setup assistant complete!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Read SETUP-SUMMARY.md for detailed instructions"
  echo "2. Read DISTRIBUTION-READINESS.md for complete guide"
  echo "3. Get API keys from service dashboards"
  echo "4. Update .env.local with your keys"
  echo "5. Run 'bun run dev' to start development"
  echo ""
  echo "Estimated time to production-ready: 60 minutes"
}

# Run main function
main
