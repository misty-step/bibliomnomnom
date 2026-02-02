#!/usr/bin/env bash
set -eo pipefail

# Quick bibliomnomnom readiness check
# Checks current distribution readiness status

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.local"

echo "📊 bibliomnomnom Readiness Check"
echo "================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
  if [[ "$1" == "OK" ]]; then
    echo -e "${GREEN}✓ $2${NC}"
  elif [[ "$1" == "WARN" ]]; then
    echo -e "${YELLOW}⚠ $2${NC}"
  else
    echo -e "${RED}✗ $2${NC}"
  fi
}

# Check 1: Environment file
if [[ -f "$ENV_FILE" ]]; then
  print_status "OK" "Environment file (.env.local) exists"
else
  print_status "FAIL" "Missing .env.local (copy from .env.example)"
fi

# Check 2: Convex webhook token
if [[ -f "$ENV_FILE" ]] && grep -q "^CONVEX_WEBHOOK_TOKEN=[a-f0-9]\{64\}" "$ENV_FILE"; then
  print_status "OK" "CONVEX_WEBHOOK_TOKEN is set (64 hex chars)"
else
  print_status "WARN" "CONVEX_WEBHOOK_TOKEN missing or invalid"
fi

# Check 3: Required services configuration
echo ""
echo "Required Services Status:"

check_env_var() {
  local var_name="$1"
  local description="$2"
  
  if [[ -f "$ENV_FILE" ]] && grep -q "^${var_name}=" "$ENV_FILE"; then
    local value=$(grep "^${var_name}=" "$ENV_FILE" | cut -d'=' -f2)
    if [[ "$value" =~ ^(pk_test_|sk_test_|whsec_|price_|phc_|https://) ]] || [[ "$value" != "your_"* ]]; then
      print_status "OK" "$description: Configured"
    else
      print_status "WARN" "$description: Placeholder value"
    fi
  else
    print_status "FAIL" "$description: Not set"
  fi
}

check_env_var "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "Clerk Publishable Key"
check_env_var "CLERK_SECRET_KEY" "Clerk Secret Key"
check_env_var "NEXT_PUBLIC_CONVEX_URL" "Convex URL"
check_env_var "STRIPE_SECRET_KEY" "Stripe Secret Key"
check_env_var "STRIPE_PRICE_MONTHLY" "Stripe Monthly Price"
check_env_var "STRIPE_PRICE_ANNUAL" "Stripe Annual Price"
check_env_var "NEXT_PUBLIC_POSTHOG_KEY" "PostHog API Key"

# Check 4: Dependencies
echo ""
echo "Dependencies:"

if command -v node &> /dev/null; then
  print_status "OK" "Node.js $(node --version)"
else
  print_status "FAIL" "Node.js not installed"
fi

if command -v pnpm &> /dev/null; then
  print_status "OK" "pnpm $(pnpm --version)"
else
  print_status "WARN" "pnpm not installed (run: npm install -g pnpm)"
fi

# Check 5: Build status
echo ""
echo "Build Status:"

cd "$PROJECT_ROOT"

if [[ -f "package.json" ]]; then
  print_status "OK" "package.json exists"
  
  # Check if dependencies are installed
  if [[ -d "node_modules" ]] || [[ -f "pnpm-lock.yaml" ]]; then
    print_status "OK" "Dependencies appear installed"
  else
    print_status "WARN" "Dependencies not installed (run: pnpm install)"
  fi
else
  print_status "FAIL" "Missing package.json"
fi

# Summary
echo ""
echo "📈 Readiness Summary"
echo "==================="

TOTAL_CHECKS=13
OK_CHECKS=$(grep -c "✓" <<< "$(echo -e "$output")")
WARN_CHECKS=$(grep -c "⚠" <<< "$(echo -e "$output")")
FAIL_CHECKS=$(grep -c "✗" <<< "$(echo -e "$output")")

echo "Passing: $OK_CHECKS/$TOTAL_CHECKS"
echo "Warnings: $WARN_CHECKS"
echo "Failures: $FAIL_CHECKS"

READINESS_PERCENT=$(( (OK_CHECKS * 100) / TOTAL_CHECKS ))

echo ""
echo "Overall Readiness: $READINESS_PERCENT%"

if [[ $READINESS_PERCENT -ge 90 ]]; then
  echo -e "${GREEN}✅ Ready for distribution!${NC}"
  echo "Just deploy and start acquiring users."
elif [[ $READINESS_PERCENT -ge 70 ]]; then
  echo -e "${YELLOW}🟡 Mostly ready - needs some configuration${NC}"
  echo "Run: ./scripts/setup-distribution.sh"
elif [[ $READINESS_PERCENT -ge 50 ]]; then
  echo -e "${YELLOW}🟡 Halfway there - needs account setup${NC}"
  echo "Follow DISTRIBUTION-READINESS.md guide"
else
  echo -e "${RED}🔴 Needs significant setup${NC}"
  echo "Start with: ./scripts/setup-distribution.sh"
fi

echo ""
echo "Next steps:"
echo "1. Read DISTRIBUTION-READINESS.md for complete guide"
echo "2. Run ./scripts/setup-distribution.sh for interactive setup"
echo "3. Check docs/deployment/pre-production-checklist.md"