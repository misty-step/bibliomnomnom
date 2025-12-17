#!/usr/bin/env bash
# Environment Variables Validation Script
# Ensures critical env vars are set before pushing to prevent deployment failures

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
  "OPENROUTER_API_KEY"
)

# Optional but recommended vars (warnings only)
RECOMMENDED_VARS=(
  "CLERK_SECRET_KEY"
  "CONVEX_DEPLOYMENT"
  "BLOB_READ_WRITE_TOKEN"
)

missing_required=()
missing_recommended=()

# Check required vars
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var}" ]]; then
    missing_required+=("$var")
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
  echo -e "${RED}✗ Missing required environment variables:${NC}"
  for var in "${missing_required[@]}"; do
    echo -e "  ${RED}- $var${NC}"
  done
  echo ""
  echo -e "${YELLOW}These variables are required for the app to function.${NC}"
  echo -e "${YELLOW}Add them to .env.local or your environment before pushing.${NC}"
  exit 1
fi

if [[ ${#missing_recommended[@]} -gt 0 ]]; then
  echo -e "${YELLOW}⚠ Missing recommended environment variables:${NC}"
  for var in "${missing_recommended[@]}"; do
    echo -e "  ${YELLOW}- $var${NC}"
  done
  echo ""
  echo -e "${YELLOW}The app will work but some features may be limited.${NC}"
  # Don't fail, just warn
fi

if [[ ${#missing_required[@]} -eq 0 ]] && [[ ${#missing_recommended[@]} -eq 0 ]]; then
  echo -e "${GREEN}✓ All environment variables are set${NC}"
fi

exit 0
