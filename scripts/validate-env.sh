#!/usr/bin/env bash
# Environment Variables Validation Script
# Ensures critical env vars are set before pushing to prevent deployment failures
#
# Usage:
#   ./scripts/validate-env.sh              # Check local env only
#   ./scripts/validate-env.sh --dev        # Also check Convex DEV for live key contamination
#   ./scripts/validate-env.sh --prod       # Also check production Convex env
#   ./scripts/validate-env.sh --all        # Check local, dev, and prod
#   ./scripts/validate-env.sh --dev-only   # Only check Convex DEV
#   ./scripts/validate-env.sh --prod-only  # Only check Convex PROD

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
CHECK_PROD=false
CHECK_DEV=false
PROD_ONLY=false
DEV_ONLY=false
for arg in "$@"; do
  case $arg in
    --prod)
      CHECK_PROD=true
      ;;
    --prod-only)
      PROD_ONLY=true
      CHECK_PROD=true
      ;;
    --dev)
      CHECK_DEV=true
      ;;
    --dev-only)
      DEV_ONLY=true
      CHECK_DEV=true
      ;;
    --all)
      CHECK_PROD=true
      CHECK_DEV=true
      ;;
  esac
done

# Load .env.local if it exists
if [[ -f .env.local ]]; then
  set -a  # automatically export all variables
  source .env.local
  set +a
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
format_errors=()

# Check for trailing whitespace or newlines in a variable
# Returns 0 if clean, 1 if has issues
check_whitespace() {
  local var_name=$1
  local value="${!var_name}"

  # Check for trailing whitespace (space, tab, newline)
  if [[ "$value" =~ [[:space:]]$ ]]; then
    format_errors+=("$var_name has trailing whitespace")
    return 1
  fi

  # Check for literal \n sequence (sometimes gets stored this way)
  if [[ "$value" == *'\n'* ]] || [[ "$value" == *$'\n'* ]]; then
    format_errors+=("$var_name contains newline character")
    return 1
  fi

  # Check for empty value (var set but no content)
  if [[ -z "$value" ]] || [[ "$value" == '""' ]] || [[ "$value" == "''" ]]; then
    format_errors+=("$var_name is empty")
    return 1
  fi

  return 0
}

# Validate Stripe key format
# Args: var_name, expected_prefix, [value] (optional, uses indirect expansion if not provided)
# Returns 0 if valid, 1 if invalid
# Appends to format_errors array on failure
check_stripe_key_format() {
  local var_name=$1
  local expected_prefix=$2  # e.g., "sk" or "pk" or "whsec" or "price"
  local value="${3:-${!var_name}}"  # Use 3rd arg if provided, else indirect expansion

  if [[ -z "$value" ]]; then
    return 0  # Missing handled elsewhere
  fi

  case "$expected_prefix" in
    sk)
      # Allow underscores in suffix (some Stripe keys have them)
      if ! [[ "$value" =~ ^sk_(test|live)_[A-Za-z0-9_]+$ ]]; then
        format_errors+=("$var_name has invalid format (expected: sk_test_... or sk_live_...)")
        return 1
      fi
      ;;
    pk)
      if ! [[ "$value" =~ ^pk_(test|live)_[A-Za-z0-9_]+$ ]]; then
        format_errors+=("$var_name has invalid format (expected: pk_test_... or pk_live_...)")
        return 1
      fi
      ;;
    whsec)
      if ! [[ "$value" =~ ^whsec_[A-Za-z0-9_]+$ ]]; then
        format_errors+=("$var_name has invalid format (expected: whsec_...)")
        return 1
      fi
      ;;
    price)
      if ! [[ "$value" =~ ^price_[A-Za-z0-9_]+$ ]]; then
        format_errors+=("$var_name has invalid format (expected: price_...)")
        return 1
      fi
      ;;
  esac

  return 0
}

check_local_env() {
  echo -e "${CYAN}Checking local environment variables...${NC}"
  echo ""

  # Check required vars
  for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
      missing_required+=("$var")
    else
      check_whitespace "$var"
    fi
  done

  # Check Stripe vars with format validation
  for var in "${STRIPE_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
      missing_stripe+=("$var")
    else
      check_whitespace "$var"
      # Validate format based on var name
      case "$var" in
        STRIPE_SECRET_KEY)
          check_stripe_key_format "$var" "sk"
          ;;
        STRIPE_WEBHOOK_SECRET)
          check_stripe_key_format "$var" "whsec"
          ;;
        STRIPE_PRICE_*)
          check_stripe_key_format "$var" "price"
          ;;
        # Note: STRIPE_PUBLISHABLE_KEY is in RECOMMENDED_VARS, not STRIPE_VARS
      esac
    fi
  done

  # Check recommended vars
  for var in "${RECOMMENDED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
      missing_recommended+=("$var")
    else
      check_whitespace "$var"
      # Format check for publishable key
      if [[ "$var" == "STRIPE_PUBLISHABLE_KEY" ]]; then
        check_stripe_key_format "$var" "pk"
      fi
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

  # Report format errors
  if [[ ${#format_errors[@]} -gt 0 ]]; then
    echo -e "${RED}  Environment variable format errors:${NC}"
    for err in "${format_errors[@]}"; do
      echo -e "    ${RED}- $err${NC}"
    done
    echo ""
    echo -e "${YELLOW}  Fix: Use 'printf \"%s\" \"value\"' instead of 'echo' when setting env vars${NC}"
    echo -e "${YELLOW}  This prevents trailing newlines that cause cryptic errors.${NC}"
    return 1
  fi

  if [[ ${#missing_required[@]} -eq 0 ]] && [[ ${#missing_stripe[@]} -eq 0 ]] && [[ ${#missing_recommended[@]} -eq 0 ]]; then
    echo -e "${GREEN}  All local environment variables are set${NC}"
  elif [[ ${#missing_required[@]} -eq 0 ]]; then
    echo -e "${GREEN}  Required local environment variables are set${NC}"
  fi

  return 0
}

check_convex_dev_env() {
  echo ""
  echo -e "${CYAN}Checking Convex DEV environment variables...${NC}"
  echo ""

  # Get current dev env vars (default, no --prod flag)
  local dev_env=""
  dev_env=$(npx convex env list 2>/dev/null || echo "")

  if [[ -z "$dev_env" ]]; then
    echo -e "${RED}  Failed to fetch dev environment variables.${NC}"
    echo -e "${YELLOW}  Check your Convex authentication.${NC}"
    return 1
  fi

  echo -e "  ${GREEN}Connected to dev deployment${NC}"
  echo ""

  local dev_errors=()

  # Check Stripe keys are TEST mode (not LIVE)
  local stripe_secret
  stripe_secret=$(echo "$dev_env" | grep "^STRIPE_SECRET_KEY=" | cut -d= -f2-)
  # Strip surrounding quotes (convex env list may quote values)
  stripe_secret="${stripe_secret%\"}"
  stripe_secret="${stripe_secret#\"}"
  stripe_secret="${stripe_secret%\'}"
  stripe_secret="${stripe_secret#\'}"
  if [[ -n "$stripe_secret" ]]; then
    if [[ "$stripe_secret" =~ ^sk_live_ ]]; then
      dev_errors+=("STRIPE_SECRET_KEY is LIVE key (sk_live_) - dev should use TEST key (sk_test_)")
    elif [[ "$stripe_secret" =~ ^sk_test_ ]]; then
      echo -e "  ${GREEN}✓ STRIPE_SECRET_KEY is TEST mode${NC}"
    fi
  fi

  local stripe_pub
  stripe_pub=$(echo "$dev_env" | grep "^STRIPE_PUBLISHABLE_KEY=" | cut -d= -f2-)
  # Strip surrounding quotes (convex env list may quote values)
  stripe_pub="${stripe_pub%\"}"
  stripe_pub="${stripe_pub#\"}"
  stripe_pub="${stripe_pub%\'}"
  stripe_pub="${stripe_pub#\'}"
  if [[ -n "$stripe_pub" ]]; then
    if [[ "$stripe_pub" =~ ^pk_live_ ]]; then
      dev_errors+=("STRIPE_PUBLISHABLE_KEY is LIVE key (pk_live_) - dev should use TEST key (pk_test_)")
    elif [[ "$stripe_pub" =~ ^pk_test_ ]]; then
      echo -e "  ${GREEN}✓ STRIPE_PUBLISHABLE_KEY is TEST mode${NC}"
    fi
  fi

  # Check Clerk issuer domain is dev (not production custom domain)
  local clerk_issuer
  clerk_issuer=$(echo "$dev_env" | grep "^CLERK_JWT_ISSUER_DOMAIN=" | cut -d= -f2-)
  # Strip surrounding quotes (convex env list may quote values)
  clerk_issuer="${clerk_issuer%\"}"
  clerk_issuer="${clerk_issuer#\"}"
  clerk_issuer="${clerk_issuer%\'}"
  clerk_issuer="${clerk_issuer#\'}"
  if [[ -n "$clerk_issuer" ]]; then
    if [[ "$clerk_issuer" =~ \.clerk\.accounts\.dev ]]; then
      echo -e "  ${GREEN}✓ CLERK_JWT_ISSUER_DOMAIN is dev mode (.clerk.accounts.dev)${NC}"
    elif [[ "$clerk_issuer" =~ clerk\. ]]; then
      # Custom domain like clerk.bibliomnomnom.com - likely production
      dev_errors+=("CLERK_JWT_ISSUER_DOMAIN appears to be production ($clerk_issuer) - dev should use .clerk.accounts.dev domain")
    fi
  fi

  if [[ ${#dev_errors[@]} -gt 0 ]]; then
    echo ""
    echo -e "${RED}  ❌ DEV environment has PRODUCTION credentials:${NC}"
    for err in "${dev_errors[@]}"; do
      echo -e "    ${RED}- $err${NC}"
    done
    echo ""
    echo -e "${YELLOW}  This is dangerous! Dev operations will affect production services.${NC}"
    echo -e "${YELLOW}  Fix with: npx convex env set <VAR_NAME> \"<test_value>\"${NC}"
    return 1
  fi

  echo ""
  echo -e "${GREEN}  ✓ DEV environment uses test/dev credentials${NC}"
  return 0
}

check_convex_prod_env() {
  echo ""
  echo -e "${CYAN}Checking Convex production environment variables...${NC}"
  echo ""

  # Get current prod env vars using --prod flag (more reliable than env var)
  local prod_env=""
  prod_env=$(npx convex env list --prod 2>/dev/null || echo "")

  if [[ -z "$prod_env" ]]; then
    echo -e "${RED}  Failed to fetch production environment variables.${NC}"
    echo -e "${YELLOW}  Check your Convex authentication and that a prod deployment exists.${NC}"
    return 1
  fi

  echo -e "  ${GREEN}Connected to production deployment${NC}"
  echo ""

  # Check each required var
  local missing_prod=()
  local prod_format_errors=()

  for var in "${CONVEX_PROD_REQUIRED[@]}"; do
    # Separate declaration and assignment per ShellCheck SC2155
    local value
    value=$(echo "$prod_env" | grep "^$var=" | cut -d= -f2-)

    # Strip surrounding quotes (convex env list may quote values)
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"

    if [[ -z "$value" ]]; then
      missing_prod+=("$var")
    else
      # Check for trailing whitespace or newlines
      if [[ "$value" =~ [[:space:]]$ ]] || [[ "$value" == *'\n'* ]]; then
        prod_format_errors+=("$var has trailing whitespace or newline")
      fi

      # Use shared format validation, passing value directly
      # Temporarily use prod_format_errors as format_errors for the function
      local old_errors=("${format_errors[@]}")
      format_errors=()

      case "$var" in
        STRIPE_SECRET_KEY)
          check_stripe_key_format "$var" "sk" "$value"
          # Additional prod check: warn if test key
          if [[ "$value" =~ ^sk_test_ ]]; then
            format_errors+=("$var is a TEST key - use sk_live_ for production")
          fi
          ;;
        STRIPE_WEBHOOK_SECRET)
          check_stripe_key_format "$var" "whsec" "$value"
          ;;
        STRIPE_PRICE_*)
          check_stripe_key_format "$var" "price" "$value"
          ;;
        STRIPE_PUBLISHABLE_KEY)
          check_stripe_key_format "$var" "pk" "$value"
          # Additional prod check: warn if test key
          if [[ "$value" =~ ^pk_test_ ]]; then
            format_errors+=("$var is a TEST key - use pk_live_ for production")
          fi
          ;;
      esac

      # Move any new errors to prod_format_errors
      prod_format_errors+=("${format_errors[@]}")
      format_errors=("${old_errors[@]}")
    fi
  done

  local has_errors=false

  if [[ ${#missing_prod[@]} -gt 0 ]]; then
    echo -e "${RED}  Missing production Convex environment variables:${NC}"
    for var in "${missing_prod[@]}"; do
      echo -e "    ${RED}- $var${NC}"
    done
    echo ""
    echo -e "${YELLOW}  Set these with:${NC}"
    echo -e "    ${CYAN}npx convex env set --prod <VAR_NAME> \"value\"${NC}"
    has_errors=true
  fi

  if [[ ${#prod_format_errors[@]} -gt 0 ]]; then
    echo -e "${RED}  Production environment variable format errors:${NC}"
    for err in "${prod_format_errors[@]}"; do
      echo -e "    ${RED}- $err${NC}"
    done
    echo ""
    echo -e "${YELLOW}  Fix: Re-set the variable without trailing whitespace:${NC}"
    echo -e "    ${CYAN}npx convex env set --prod <VAR_NAME> \"\$(printf '%s' 'value')\"${NC}"
    has_errors=true
  fi

  if [[ "$has_errors" == "true" ]]; then
    return 1
  fi

  echo -e "${GREEN}  All production Convex environment variables are set and valid${NC}"
  echo ""

  # Parity warning for shared tokens
  echo -e "${YELLOW}  IMPORTANT: Verify Vercel-Convex parity for shared tokens${NC}"
  echo -e "${YELLOW}  CONVEX_WEBHOOK_TOKEN must be identical on both platforms.${NC}"
  echo -e "${YELLOW}  Run: vercel env ls --environment=production | grep CONVEX_WEBHOOK_TOKEN${NC}"
  echo ""

  return 0
}

# Main execution
exit_code=0

if [[ "$PROD_ONLY" == "false" ]] && [[ "$DEV_ONLY" == "false" ]]; then
  check_local_env || exit_code=1
fi

if [[ "$CHECK_DEV" == "true" ]]; then
  check_convex_dev_env || exit_code=1
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
