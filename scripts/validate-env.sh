#!/usr/bin/env bash
# Environment Variables Validation Script
# Ensures critical env vars are set before pushing to prevent deployment failures
#
# Usage:
#   ./scripts/validate-env.sh              # Check local env only
#   ./scripts/validate-env.sh --prod       # Also check production Convex env
#   ./scripts/validate-env.sh --prod-only  # Only check production Convex env

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
CHECK_PROD=false
PROD_ONLY=false
for arg in "$@"; do
  case $arg in
    --prod)
      CHECK_PROD=true
      ;;
    --prod-only)
      PROD_ONLY=true
      CHECK_PROD=true
      ;;
  esac
done

# Load .env.local if it exists
if [[ -f .env.local ]]; then
  set -a  # automatically export all variables
  source .env.local
  set +a
fi

# Load .env.production.local for prod deployment info
if [[ -f .env.production.local ]]; then
  # Try CONVEX_PROD_DEPLOYMENT first, then fall back to CONVEX_DEPLOYMENT
  prod_deploy=$(grep "^CONVEX_PROD_DEPLOYMENT=" .env.production.local 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'" || true)
  if [[ -z "$prod_deploy" ]]; then
    prod_deploy=$(grep "^CONVEX_DEPLOYMENT=" .env.production.local 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'" || true)
  fi
  if [[ -n "$prod_deploy" ]] && [[ "$prod_deploy" == prod:* ]]; then
    export CONVEX_PROD_DEPLOYMENT="$prod_deploy"
  fi
fi

# Critical env vars required for the app to function
REQUIRED_VARS=(
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
  "NEXT_PUBLIC_CONVEX_URL"
)

# Stripe vars - critical for subscription features
STRIPE_VARS=(
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "STRIPE_PRICE_MONTHLY"
  "STRIPE_PRICE_ANNUAL"
)

# Optional but recommended vars (warnings only)
RECOMMENDED_VARS=(
  "CLERK_SECRET_KEY"
  "CONVEX_DEPLOYMENT"
  "BLOB_READ_WRITE_TOKEN"
  "STRIPE_PUBLISHABLE_KEY"
)

# Convex production env vars that must exist
CONVEX_PROD_REQUIRED=(
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "STRIPE_PRICE_MONTHLY"
  "STRIPE_PRICE_ANNUAL"
  "STRIPE_PUBLISHABLE_KEY"
  "CONVEX_WEBHOOK_TOKEN"
)

missing_required=()
missing_stripe=()
missing_recommended=()

check_local_env() {
  echo -e "${CYAN}Checking local environment variables...${NC}"
  echo ""

  # Check required vars
  for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
      missing_required+=("$var")
    fi
  done

  # Check Stripe vars
  for var in "${STRIPE_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
      missing_stripe+=("$var")
    fi
  done

  # Check recommended vars
  for var in "${RECOMMENDED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
      missing_recommended+=("$var")
    fi
  done

  # Report results
  if [[ ${#missing_required[@]} -gt 0 ]]; then
    echo -e "${RED}  Missing required environment variables:${NC}"
    for var in "${missing_required[@]}"; do
      echo -e "    ${RED}- $var${NC}"
    done
    echo ""
    echo -e "${YELLOW}  These variables are required for the app to function.${NC}"
    echo -e "${YELLOW}  Add them to .env.local or your environment before pushing.${NC}"
    return 1
  fi

  if [[ ${#missing_stripe[@]} -gt 0 ]]; then
    echo -e "${YELLOW}  Missing Stripe environment variables:${NC}"
    for var in "${missing_stripe[@]}"; do
      echo -e "    ${YELLOW}- $var${NC}"
    done
    echo ""
    echo -e "${YELLOW}  Subscription features will not work without these.${NC}"
    # Don't fail for Stripe, just warn (might be testing non-Stripe features)
  fi

  if [[ ${#missing_recommended[@]} -gt 0 ]]; then
    echo -e "${YELLOW}  Missing recommended environment variables:${NC}"
    for var in "${missing_recommended[@]}"; do
      echo -e "    ${YELLOW}- $var${NC}"
    done
    echo ""
    echo -e "${YELLOW}  The app will work but some features may be limited.${NC}"
  fi

  if [[ ${#missing_required[@]} -eq 0 ]] && [[ ${#missing_stripe[@]} -eq 0 ]] && [[ ${#missing_recommended[@]} -eq 0 ]]; then
    echo -e "${GREEN}  All local environment variables are set${NC}"
  elif [[ ${#missing_required[@]} -eq 0 ]]; then
    echo -e "${GREEN}  Required local environment variables are set${NC}"
  fi

  return 0
}

check_convex_prod_env() {
  echo ""
  echo -e "${CYAN}Checking Convex production environment variables...${NC}"
  echo ""

  # Find production deployment
  local prod_deployment=""

  # Try CONVEX_PROD_DEPLOYMENT first
  if [[ -n "${CONVEX_PROD_DEPLOYMENT}" ]]; then
    prod_deployment="${CONVEX_PROD_DEPLOYMENT}"
  else
    # Try to find it from convex deployment list
    if command -v npx &> /dev/null; then
      prod_deployment=$(npx convex deployment list 2>/dev/null | grep "^prod:" | head -1 || true)
    fi
  fi

  if [[ -z "$prod_deployment" ]]; then
    echo -e "${YELLOW}  Could not determine production deployment.${NC}"
    echo -e "${YELLOW}  Set CONVEX_PROD_DEPLOYMENT in .env.production.local${NC}"
    echo -e "${YELLOW}  Example: CONVEX_PROD_DEPLOYMENT=prod:doting-spider-972${NC}"
    return 1
  fi

  echo -e "  Production deployment: ${CYAN}${prod_deployment}${NC}"
  echo ""

  # Get current prod env vars
  local prod_env=""
  prod_env=$(CONVEX_DEPLOYMENT="$prod_deployment" npx convex env list 2>/dev/null || echo "")

  if [[ -z "$prod_env" ]]; then
    echo -e "${RED}  Failed to fetch production environment variables.${NC}"
    echo -e "${YELLOW}  Check your Convex authentication.${NC}"
    return 1
  fi

  # Check each required var
  local missing_prod=()
  for var in "${CONVEX_PROD_REQUIRED[@]}"; do
    if ! echo "$prod_env" | grep -q "^$var="; then
      missing_prod+=("$var")
    fi
  done

  if [[ ${#missing_prod[@]} -gt 0 ]]; then
    echo -e "${RED}  Missing production Convex environment variables:${NC}"
    for var in "${missing_prod[@]}"; do
      echo -e "    ${RED}- $var${NC}"
    done
    echo ""
    echo -e "${YELLOW}  Set these with:${NC}"
    echo -e "    ${CYAN}CONVEX_DEPLOYMENT=\"$prod_deployment\" npx convex env set <VAR_NAME>${NC}"
    return 1
  fi

  echo -e "${GREEN}  All production Convex environment variables are set${NC}"
  return 0
}

# Main execution
exit_code=0

if [[ "$PROD_ONLY" == "false" ]]; then
  check_local_env || exit_code=1
fi

if [[ "$CHECK_PROD" == "true" ]]; then
  check_convex_prod_env || exit_code=1
fi

echo ""
if [[ $exit_code -eq 0 ]]; then
  echo -e "${GREEN}Environment validation passed${NC}"
else
  echo -e "${RED}Environment validation failed${NC}"
fi

exit $exit_code
