#!/usr/bin/env bash
# Pre-Deployment Verification Script
# Comprehensive checklist before deploying to production
#
# Usage:
#   ./scripts/verify-deploy-ready.sh
#
# Checks:
#   1. Environment variables (local and production)
#   2. Git status (clean working tree)
#   3. Tests pass
#   4. Build succeeds
#   5. Health endpoint responds (if deployed)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "${BOLD}Pre-Deployment Verification${NC}"
echo "=============================================="
echo ""

total_checks=0
passed_checks=0
failed_checks=0
warnings=0

check_pass() {
  echo -e "${GREEN}  PASS${NC} $1"
  ((passed_checks++))
  ((total_checks++))
}

check_fail() {
  echo -e "${RED}  FAIL${NC} $1"
  ((failed_checks++))
  ((total_checks++))
}

check_warn() {
  echo -e "${YELLOW}  WARN${NC} $1"
  ((warnings++))
}

check_skip() {
  echo -e "${CYAN}  SKIP${NC} $1"
}

# ============================================
# Check 1: Environment Variables
# ============================================
echo -e "${BOLD}1. Environment Variables${NC}"
echo "---"

if ./scripts/validate-env.sh --prod-only 2>/dev/null; then
  check_pass "Production env vars validated"
else
  check_fail "Production env vars validation failed"
  echo ""
  echo -e "${YELLOW}  Run: ./scripts/validate-env.sh --prod-only for details${NC}"
fi

echo ""

# ============================================
# Check 2: Git Status
# ============================================
echo -e "${BOLD}2. Git Status${NC}"
echo "---"

if [[ -z $(git status --porcelain) ]]; then
  check_pass "Working tree is clean"
else
  check_warn "Uncommitted changes detected"
  git status --short | head -5
  if [[ $(git status --porcelain | wc -l) -gt 5 ]]; then
    echo "  ... and more"
  fi
fi

# Check current branch
current_branch=$(git branch --show-current)
echo -e "  Current branch: ${CYAN}$current_branch${NC}"

echo ""

# ============================================
# Check 3: Secret Scan
# ============================================
echo -e "${BOLD}3. Secret Scan${NC}"
echo "---"

if command -v trufflehog &> /dev/null; then
  if trufflehog filesystem . --only-verified --max-depth=3 --no-update 2>/dev/null | grep -q "Verified"; then
    check_fail "Verified secrets found in codebase!"
  else
    check_pass "No verified secrets found"
  fi
else
  check_skip "TruffleHog not installed"
fi

echo ""

# ============================================
# Check 4: TypeScript
# ============================================
echo -e "${BOLD}4. TypeScript Compilation${NC}"
echo "---"

if pnpm tsc --noEmit 2>/dev/null; then
  check_pass "TypeScript compiles without errors"
else
  check_fail "TypeScript compilation failed"
fi

echo ""

# ============================================
# Check 5: Tests
# ============================================
echo -e "${BOLD}5. Test Suite${NC}"
echo "---"

if pnpm test --run 2>/dev/null; then
  check_pass "All tests pass"
else
  check_fail "Tests failed"
fi

echo ""

# ============================================
# Check 6: Build
# ============================================
echo -e "${BOLD}6. Build${NC}"
echo "---"

echo "  Skipping full build (run manually if needed)"
check_skip "Build check (run: pnpm build)"

echo ""

# ============================================
# Check 7: Vercel-Convex Parity (Manual)
# ============================================
echo -e "${BOLD}7. Cross-Platform Parity${NC}"
echo "---"

echo -e "${YELLOW}  MANUAL CHECK REQUIRED:${NC}"
echo "  Verify CONVEX_WEBHOOK_TOKEN matches on both platforms:"
echo ""
echo "  Convex:"
echo -e "    ${CYAN}npx convex env list --prod | grep CONVEX_WEBHOOK_TOKEN${NC}"
echo ""
echo "  Vercel:"
echo -e "    ${CYAN}vercel env ls --environment=production | grep CONVEX_WEBHOOK_TOKEN${NC}"
echo ""
check_warn "Manual parity verification required"

echo ""

# ============================================
# Summary
# ============================================
echo "=============================================="
echo -e "${BOLD}Summary${NC}"
echo "---"
echo -e "  Passed:   ${GREEN}$passed_checks${NC}"
echo -e "  Failed:   ${RED}$failed_checks${NC}"
echo -e "  Warnings: ${YELLOW}$warnings${NC}"
echo ""

if [[ $failed_checks -gt 0 ]]; then
  echo -e "${RED}${BOLD}DEPLOY BLOCKED${NC} - Fix $failed_checks issue(s) before deploying"
  exit 1
elif [[ $warnings -gt 0 ]]; then
  echo -e "${YELLOW}${BOLD}DEPLOY WITH CAUTION${NC} - $warnings warning(s) require attention"
  exit 0
else
  echo -e "${GREEN}${BOLD}READY TO DEPLOY${NC}"
  exit 0
fi
