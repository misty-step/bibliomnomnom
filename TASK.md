# PRD: Complete Quality Infrastructure for bibliomnomnom

**Status**: Ready for Implementation
**Created**: 2025-11-24
**Author**: Claude Code (via /spec)
**Estimated Effort**: 6-8 hours initial setup, 2-4 hours incremental refinement

---

## Executive Summary

Implement comprehensive CI/CD and local git hook infrastructure to enable "supremely confident deployments"—the ability to merge to production Friday afternoon and turn your phone off. Establishes quality gates that catch secrets, type errors, test failures, and build breakage before they reach production. Designed for solo developer working with multiple AI coding agents, where automation enforces consistency across different agent personalities and capabilities.

**Success Criteria**: All checks green = production ready, zero manual verification needed.

---

## Problem Statement

### Current Pain Points

1. **No local quality gates**: Commits with type errors, secrets, or broken tests reach CI
2. **Incomplete CI validation**: Missing type-check and build verification (7 type errors currently exist)
3. **CI branch mismatch**: Configured for `main`, repo uses `master`
4. **No coverage tracking**: Can't measure test quality or detect regressions
5. **Inconsistent formatting**: Manual formatting across AI agents with different styles
6. **No commit conventions**: Future changelog automation impossible
7. **Documentation drift**: ARCHITECTURE.md says "no tests" but 54 tests exist

### User Context: AI Agent Team Dynamic

Working solo but with multiple AI coding agents (Claude, Gemini, GPT, etc.) that act like junior developers:

- ✅ Follow explicit rules perfectly
- ✅ Can maintain high code quality with automation
- ❌ Have different "personalities" and default styles
- ❌ Need enforcement to maintain consistency

**Insight**: Quality gates aren't overhead—they're how you scale a distributed AI team while maintaining coherent codebase.

### Business Impact

**Without this infrastructure:**

- ❌ Fear of Friday afternoon deploys (weekend on-call risk)
- ❌ Manual verification overhead (30+ min per deploy)
- ❌ Type errors/bugs slip to production
- ❌ Secrets accidentally committed
- ❌ AI agents drift toward inconsistent patterns
- ❌ Refactoring fear (no coverage metrics)

**With this infrastructure:**

- ✅ Deploy with confidence anytime (green CI = production ready)
- ✅ Automated verification (< 5 min feedback loop)
- ✅ Prevent secrets/errors before git push
- ✅ Consistent code style across all AI agents
- ✅ Measurable test quality
- ✅ Refactor fearlessly (coverage prevents regressions)

---

## Requirements

### Functional Requirements

**FR-1: Pre-commit Quality Gates**

- Gitleaks secret detection (< 1s)
- ESLint auto-fix on staged files (< 3s)
- Prettier auto-format on staged files (< 2s)
- TypeScript type-check on staged files (< 5s)
- Total pre-commit time: < 10s (fast feedback, no flow disruption)

**FR-2: Pre-push Quality Gates**

- Full test suite execution (< 30s)
- Full build verification with Convex deploy (< 2 min)
- Environment variable validation

**FR-3: CI Pipeline**

- Parallel execution: lint, typecheck, test, gitleaks (< 3 min)
- Sequential build after all checks pass (< 2 min)
- Branch: `master` (not `main`)
- Total CI time: < 5 min

**FR-4: Coverage Tracking**

- Vitest coverage with v8 provider
- Critical paths: `convex/books.ts`, `convex/auth.ts`, `convex/notes.ts`, `app/api/blob/upload/**`
- Initial thresholds: 50% (measure baseline)
- Target thresholds: 75% lines/functions, 70% branches (ratchet up over 2-4 weeks)
- PR comments with coverage diff (future enhancement)

**FR-5: Code Formatting**

- Prettier for TypeScript, JavaScript, JSON, Markdown, CSS
- Auto-format on save (VS Code config)
- Auto-format in pre-commit hook
- Consistent style across all AI agent contributions

**FR-6: Commit Conventions**

- Conventional commits enforced via commitlint
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`
- Enables future changelog automation (release-please or changesets)

### Non-Functional Requirements

**NFR-1: Performance**

- Pre-commit: < 10s (fast enough to not disrupt flow)
- Pre-push: < 2 min (acceptable for less frequent operation)
- CI: < 5 min (rapid feedback on PRs)

**NFR-2: Reliability**

- No false positives (gitleaks allowlist for test fixtures)
- Deterministic builds (`--frozen-lockfile`)
- Idempotent operations (re-running hooks safe)

**NFR-3: Maintainability**

- Single source of truth: `package.json` scripts reused by hooks and CI
- Configuration files co-located with project
- Clear error messages with fix instructions
- Escape hatches documented (rare but possible)

**NFR-4: Developer Experience**

- Automatic hook installation (`prepare` script)
- Parallel execution where possible
- Auto-fix instead of fail (ESLint, Prettier)
- Stage fixed files automatically

---

## Architecture Decision

### Selected Approach: Complete Quality Stack with Progressive Enforcement

**Core Principle**: _"Install all gates now, ratchet enforcement gradually"_

Start with low thresholds (measure baseline), increase aggressively over 2-4 weeks as coverage improves. This balances "foot in the door" with "supremely confident pipeline."

### Architecture Components

#### 1. Local Quality Gates (Lefthook)

**Module Interface**: Simple `lefthook.yml` configuration file

**Hidden Complexity**:

- Parallel command execution
- File filtering and glob patterns
- Staged file detection
- Auto-staging fixed files
- Environment variable handling
- Skip patterns for CI environments

**Module Value**: Prevents bad commits before they leave developer's machine

**Configuration**:

```yaml
# lefthook.yml
min_version: 2.0.0

pre-commit:
  parallel: true
  commands:
    gitleaks:
      run: gitleaks protect --staged --redact --verbose

    lint:
      glob: "*.{ts,tsx,js,jsx}"
      run: pnpm eslint --fix --max-warnings 0 {staged_files}
      stage_fixed: true

    format:
      glob: "*.{ts,tsx,js,jsx,json,md,css}"
      run: pnpm prettier --write {staged_files}
      stage_fixed: true

    typecheck:
      run: pnpm tsc --noEmit

pre-push:
  parallel: true
  commands:
    test:
      run: pnpm test --run

    build:
      run: pnpm build:local

    env-check:
      run: ./scripts/validate-env.sh

commit-msg:
  commands:
    commitlint:
      run: pnpm commitlint --edit {1}
```

#### 2. CI Pipeline (GitHub Actions)

**Module Interface**: Workflow triggers on push/PR, runs quality checks

**Hidden Complexity**:

- Job dependency orchestration
- Caching strategies (pnpm store, Next.js build)
- Secret management
- Convex deployment integration
- Branch protection enforcement

**Module Value**: Enforces quality even if local hooks bypassed, provides audit trail

**Configuration**:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: ["master", "feature/*", "feat/*"]
  pull_request:
    branches: ["master"]

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm test --coverage
      - name: Upload coverage reports
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          token: ${{ secrets.CODECOV_TOKEN }}

  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build:
    needs: [lint, typecheck, test, gitleaks]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - uses: actions/cache@v4
        with:
          path: ${{ github.workspace }}/.next/cache
          key: ${{ runner.os }}-nextjs-${{ hashFiles('**/pnpm-lock.yaml') }}-${{ hashFiles('**/*.ts', '**/*.tsx') }}
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

#### 3. Coverage Tracking (Vitest)

**Module Interface**: `pnpm test --coverage` generates reports

**Hidden Complexity**:

- v8 coverage provider integration
- Include/exclude path filtering
- Threshold enforcement
- Report generation (text, JSON, HTML)

**Module Value**: Measurable test quality, prevents coverage regressions

**Configuration**:

```typescript
// vitest.config.ts (enhancement)
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true,
    css: false,

    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: [
        "convex/books.ts",
        "convex/auth.ts",
        "convex/notes.ts",
        "convex/users.ts",
        "app/api/blob/upload/**/*.ts",
        "lib/**/*.ts",
      ],
      exclude: [
        "convex/_generated/**",
        "**/*.test.{ts,tsx}",
        "**/*.stories.{ts,tsx}",
        "components/ui/**", // shadcn components
        "node_modules/**",
      ],
      thresholds: {
        lines: 50, // Start low, increase to 75
        functions: 50, // Start low, increase to 75
        branches: 45, // Start low, increase to 70
        statements: 50, // Start low, increase to 75
      },
    },
  },
});
```

#### 4. Code Formatting (Prettier)

**Module Interface**: `.prettierrc` config file, `pnpm format` script

**Hidden Complexity**:

- AST parsing and reprinting
- Editor integration (VS Code)
- Ignore patterns
- Format-on-save configuration

**Module Value**: Zero cognitive load on formatting, consistent style across AI agents

**Configuration**:

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

#### 5. Commit Linting (Commitlint)

**Module Interface**: `commitlint.config.js`, validates commit messages

**Hidden Complexity**:

- Conventional commits parsing
- Custom rule configuration
- Integration with git hooks

**Module Value**: Enables automated changelog generation (future)

**Configuration**:

```javascript
// commitlint.config.js
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation
        "style", // Code style (formatting, etc.)
        "refactor", // Code refactoring
        "perf", // Performance improvement
        "test", // Test changes
        "chore", // Tooling, dependencies
      ],
    ],
    "subject-case": [0], // Allow any case
    "body-max-line-length": [0], // No line length limit
  },
};
```

#### 6. Secret Detection (Gitleaks)

**Module Interface**: `.gitleaks.toml` config, pre-commit + CI scanning

**Hidden Complexity**:

- Regex + entropy detection
- Allowlist management
- Baseline strategy for existing repos

**Module Value**: Prevents credential leaks (GDPR compliance, security)

**Configuration**:

```toml
# .gitleaks.toml
title = "bibliomnomnom gitleaks config"

[extend]
useDefault = true

[allowlist]
description = "Global allowlist for false positives"
paths = [
  '''^\.git/''',
  '''^node_modules/''',
  '''^\.next/''',
  '''^coverage/''',
  '''^dist/''',
  '''pnpm-lock\.yaml$''',
]

regexes = [
  '''sk_test_[a-zA-Z0-9]{24}''', # Stripe test keys (safe)
  '''example@example\.com''',    # Example emails in docs
]
```

---

## Dependencies & Assumptions

### External Dependencies

**New npm packages:**

- `lefthook` ^2.0.0 (git hook manager)
- `prettier` ^3.0.0 (code formatter)
- `@commitlint/cli` ^18.0.0 (commit linting)
- `@commitlint/config-conventional` ^18.0.0 (conventional commits rules)
- `@vitest/coverage-v8` ^1.6.0 (coverage provider)

**System dependencies:**

- `gitleaks` (already installed via Homebrew: `/opt/homebrew/bin/gitleaks`)

**GitHub Actions:**

- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/cache@v4`
- `pnpm/action-setup@v4`
- `gitleaks/gitleaks-action@v2`
- `codecov/codecov-action@v4` (optional, for coverage tracking)

### Assumptions

1. **Solo developer + AI agents**: Configuration optimized for consistency across multiple "personalities"
2. **Branch strategy**: `master` is production branch (not `main`)
3. **Vercel auto-deployment**: GitHub pushes trigger Vercel deploys (CI validates before)
4. **Environment variables**: All secrets configured in GitHub repo settings and Vercel project settings
5. **Test suite speed**: Current 54 tests run in ~1.7s (fast enough for pre-push)
6. **CI concurrency**: GitHub Actions free tier supports parallel jobs
7. **Coverage baseline**: Current coverage ~40-50% (needs measurement)

### Environment Requirements

**Required GitHub Secrets:**

- `CONVEX_DEPLOY_KEY` (already exists)
- `CLERK_SECRET_KEY` (already exists)
- `BLOB_READ_WRITE_TOKEN` (already exists)
- `CODECOV_TOKEN` (new, optional for coverage tracking)

**Required Vercel Environment Variables:**

- Already configured (no changes needed)

**Local Development:**

- Node.js >=20.0.0
- pnpm >=9.0.0
- Git >=2.0.0

---

## Implementation Phases

### Phase 1: Core Infrastructure (3-4 hours)

**Goal**: Get quality gates operational with low thresholds

**Tasks:**

1. Install dependencies (`lefthook`, `prettier`, `@commitlint/*`, `@vitest/coverage-v8`)
2. Create configuration files:
   - `lefthook.yml`
   - `.prettierrc`
   - `.prettierignore`
   - `commitlint.config.js`
   - `.gitleaks.toml`
3. Enhance `vitest.config.ts` with coverage config (50% thresholds)
4. Update `.github/workflows/ci.yml`:
   - Fix branch to `master`
   - Add typecheck job
   - Add gitleaks job
   - Add build job
   - Add coverage upload
5. Add package.json scripts:
   - `"prepare": "lefthook install"`
   - `"format": "prettier --write ."`
   - `"format:check": "prettier --check ."`
6. Create `scripts/validate-env.sh` for environment validation
7. Run initial format: `pnpm format` to establish baseline
8. Test hooks locally: `git commit` (should run pre-commit checks)
9. Test CI: Push to feature branch, verify all jobs pass

**Acceptance Criteria:**

- ✅ Pre-commit runs in < 10s
- ✅ Pre-push runs tests + build in < 2 min
- ✅ CI passes on push to `master`
- ✅ Coverage report generated (HTML + JSON)
- ✅ Gitleaks scans prevent secret commits
- ✅ Conventional commit format enforced

**Deliverables:**

- All config files committed
- CI green on feature branch
- Documentation updated (README.md)

---

### Phase 2: Hardening & Documentation (2-3 hours)

**Goal**: Fix edge cases, document escape hatches, update project docs

**Tasks:**

1. Fix 7 existing type errors in test files
2. Run coverage report, document baseline (e.g., "Current: 47%, Target: 75%")
3. Update ARCHITECTURE.md:
   - Remove "no tests" statement
   - Add "Quality Infrastructure" section
   - Document coverage targets
4. Create CONTRIBUTING.md:
   - Commit message format examples
   - How to skip hooks (rare cases)
   - How to run checks locally
5. Add VS Code settings for format-on-save:
   ```json
   // .vscode/settings.json
   {
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     }
   }
   ```
6. Update `.gitignore`:
   - Add `coverage/`
   - Add `lefthook-local.yml`
7. Test escape hatches:
   - `LEFTHOOK=0 git commit` (skip all hooks)
   - `SKIP=gitleaks git commit` (skip specific hook)
   - `git commit --no-verify` (emergency bypass)

**Acceptance Criteria:**

- ✅ All TypeScript errors resolved
- ✅ Coverage baseline documented
- ✅ CONTRIBUTING.md exists with examples
- ✅ VS Code auto-formats on save
- ✅ Escape hatches documented and tested

**Deliverables:**

- Updated documentation
- Clean TypeScript build
- VS Code config committed

---

### Phase 3: Incremental Enforcement (2-4 weeks, async)

**Goal**: Ratchet up coverage thresholds as tests improve

**Week 1: Measure Baseline**

- Generate coverage report: `pnpm test --coverage`
- Document baseline in BACKLOG.md (e.g., "Current: 47%")
- Identify untested critical paths:
  - `convex/books.ts` - mutations (create, update, remove)
  - `convex/auth.ts` - ownership validation
  - `convex/notes.ts` - CRUD operations
  - `app/api/blob/upload/route.ts` - presigned URL generation

**Week 2: Add Critical Path Tests**

- Write tests for untested mutations
- Target: 60% coverage on critical modules
- Update `vitest.config.ts` thresholds to 55%

**Week 3: Expand Coverage**

- Add edge case tests (error handling, validation)
- Target: 70% coverage on critical modules
- Update `vitest.config.ts` thresholds to 65%

**Week 4: Reach Target**

- Add integration tests (happy path + error flows)
- Target: 75% coverage on critical modules
- Update `vitest.config.ts` thresholds to 75%

**Acceptance Criteria:**

- ✅ Coverage >=75% on `convex/books.ts`, `convex/auth.ts`, `convex/notes.ts`
- ✅ Coverage >=70% on `app/api/blob/upload/**`
- ✅ CI fails if coverage drops below threshold
- ✅ High confidence in refactoring safety

---

## Risks & Mitigation

| Risk                                        | Likelihood | Impact | Mitigation                                                                                 |
| ------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------ |
| **Pre-commit hooks too slow** (> 15s)       | Medium     | High   | Use `parallel: true`, only check staged files, profile with `time lefthook run pre-commit` |
| **False positive secret detection**         | Medium     | Medium | Tune `.gitleaks.toml` allowlist, use `--redact` flag to hide actual secrets                |
| **CI flakiness** (network, Convex timeouts) | Low        | High   | Add retry logic, use `concurrency: cancel-in-progress`, monitor job duration trends        |
| **Coverage thresholds block PRs**           | Medium     | Medium | Start at 50%, increase gradually, allow temporary decreases with justification             |
| **AI agents ignore commit conventions**     | Low        | Low    | Commitlint blocks non-conforming commits, agents learn from error messages                 |
| **Type errors in existing code**            | High       | Low    | Known issue (7 errors in tests), fix in Phase 2 before enforcing in CI                     |
| **Build fails with coverage enabled**       | Low        | High   | Test locally first (`pnpm test --coverage`), add exclusions if needed                      |

---

## Key Decisions

### Decision 1: Lefthook over Husky

**Alternatives Considered:**

- Husky (popular, mature)
- pre-commit (Python-based)
- lint-staged + Husky

**Rationale:**

- Lefthook: Fast (parallel execution), minimal config, no Node.js scripts
- Husky: Slower (sequential), requires separate scripts for each hook
- pre-commit: Python dependency (not native to Node.js ecosystem)

**Tradeoffs:** Lefthook is newer (less mature), but performance and simplicity win for this use case

---

### Decision 2: Coverage at 50% Initially, Ratchet to 75%

**Alternatives Considered:**

- No coverage tracking (measure-only)
- High threshold immediately (75%)
- No thresholds (advisory)

**Rationale:**

- Measure baseline first (avoid blocking existing workflow)
- Incrementally increase creates habit without disruption
- 75% is achievable for critical paths, 100% is perfectionism

**Tradeoffs:** Initial weeks have lower enforcement, but learning curve is gentler

---

### Decision 3: Prettier Auto-format (No Manual Control)

**Alternatives Considered:**

- No formatter (manual style)
- ESLint-only formatting
- Format-on-save but no pre-commit enforcement

**Rationale:**

- AI agents need consistent enforcement (different default styles)
- Auto-format removes cognitive load (zero decisions)
- `stage_fixed: true` means formatting never blocks commits

**Tradeoffs:** Loss of formatting control, but consistency across agents is more valuable

---

### Decision 4: Conventional Commits Enforced, Not Advisory

**Alternatives Considered:**

- No commit format rules
- Advisory (warning, not error)
- Custom format (not conventional commits)

**Rationale:**

- Enables future changelog automation (release-please, changesets)
- AI agents follow rules when enforced
- Industry standard (easy for future contributors)

**Tradeoffs:** Slight friction on first commits, but muscle memory develops quickly

---

### Decision 5: Gitleaks in Pre-commit AND CI

**Alternatives Considered:**

- CI-only (no local check)
- Pre-push only (slower feedback)
- Manual audits (unreliable)

**Rationale:**

- Pre-commit: Fast feedback (< 1s), prevents leaks before push
- CI: Enforcement (can't bypass), audit trail
- Layered defense (local + remote)

**Tradeoffs:** Tiny pre-commit overhead (< 1s), but secret prevention is critical

---

## Success Metrics

### Immediate (Phase 1 Complete)

- ✅ Pre-commit hooks run on every commit (< 10s)
- ✅ Pre-push hooks run on every push (< 2 min)
- ✅ CI passes on push to `master` (< 5 min)
- ✅ Zero secrets in git history (gitleaks clean)
- ✅ All commits follow conventional format
- ✅ Code auto-formatted consistently

### Short-term (Phase 2 Complete)

- ✅ Zero TypeScript errors in codebase
- ✅ Coverage baseline documented
- ✅ CONTRIBUTING.md guides new contributors
- ✅ VS Code auto-formats on save
- ✅ Documentation accurate (no "no tests" claims)

### Long-term (Phase 3 Complete, 4 weeks)

- ✅ Coverage >=75% on critical paths
- ✅ Coverage >=70% on all included modules
- ✅ CI enforces coverage thresholds
- ✅ Zero coverage regressions (CI blocks drops)
- ✅ "Friday afternoon deploy" confidence achieved

### Ultimate Goal

**"Supremely Confident Pipeline"**:

- All checks green = production ready
- No manual verification needed
- No fear of weekend deploys
- AI agents maintain quality autonomously

---

## Next Steps

After implementation, track these enhancements in BACKLOG.md:

### Post-MVP Enhancements (4-8 hours each)

1. **Codecov Integration** (2h)
   - PR comments with coverage diff
   - Coverage badges in README.md
   - Trend tracking over time

2. **Branch Protection Rules** (1h)
   - Require CI passing before merge
   - Require 1 approval (future, when team grows)
   - Restrict force-push to `master`

3. **Storybook CI** (3h)
   - Build Storybook in CI
   - Deploy to GitHub Pages
   - Visual regression testing (Chromatic)

4. **E2E Testing** (8h)
   - Playwright setup
   - Critical user flows (sign-up, add book, create note)
   - Run in CI (separate job)

5. **Release Automation** (4h)
   - release-please workflow
   - Auto-generate CHANGELOG.md
   - Git tags on releases

6. **Performance Budgets** (2h)
   - Lighthouse CI
   - Bundle size tracking
   - Core Web Vitals monitoring

7. **Dependency Updates** (2h)
   - Dependabot configuration
   - Auto-merge patch updates
   - Weekly security scans

---

## Appendix: Configuration Files

### A. Package.json Scripts (Complete)

```json
{
  "scripts": {
    "preinstall": "npx only-allow pnpm",
    "prepare": "lefthook install",

    "dev": "concurrently \"pnpm:convex:dev\" \"pnpm:next:dev\"",
    "next:dev": "next dev --turbopack",
    "build": "npx convex deploy --cmd 'next build'",
    "build:local": "next build",
    "start": "next start",

    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "typecheck": "tsc --noEmit",

    "format": "prettier --write .",
    "format:check": "prettier --check .",

    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",

    "convex:dev": "convex dev",
    "convex:push": "convex dev --once",
    "convex:deploy": "npx convex deploy",

    "validate": "run-p lint typecheck test:coverage build:local",
    "validate:fast": "run-p lint typecheck test",

    "hooks:install": "lefthook install",
    "hooks:uninstall": "lefthook uninstall"
  }
}
```

### B. Environment Validation Script

```bash
#!/usr/bin/env bash
# scripts/validate-env.sh

set -e

required=(
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
  "CLERK_SECRET_KEY"
  "CLERK_WEBHOOK_SECRET"
  "NEXT_PUBLIC_CONVEX_URL"
  "CONVEX_DEPLOYMENT"
  "BLOB_READ_WRITE_TOKEN"
)

missing=()

for var in "${required[@]}"; do
  if [[ -z "${!var}" ]]; then
    missing+=("$var")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "❌ Missing required environment variables:"
  printf '  - %s\n' "${missing[@]}"
  echo ""
  echo "Copy .env.example to .env.local and fill in values:"
  echo "  cp .env.example .env.local"
  exit 1
fi

echo "✅ All required environment variables are set"
```

### C. VS Code Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

---

## Timeline & Effort Estimate

**Phase 1 (Core Infrastructure)**: 3-4 hours

- Install & configure: 1h
- Update CI workflow: 1h
- Test locally: 30m
- Fix initial issues: 30-60m
- Documentation: 30m

**Phase 2 (Hardening)**: 2-3 hours

- Fix type errors: 1h
- Update docs: 1h
- VS Code setup: 30m
- Testing: 30m

**Phase 3 (Incremental Enforcement)**: 2-4 weeks, async

- Week 1: Measure baseline (30m)
- Week 2: Add tests (2-3h)
- Week 3: Expand coverage (2-3h)
- Week 4: Reach target (2-3h)

**Total upfront effort**: 6-8 hours
**Total sustained effort**: 8-12 hours over 4 weeks

**ROI**: First prevented production bug saves 2+ hours debugging. Confidence enables faster iteration. Infrastructure pays for itself within first week.

---

**Ready for implementation. Run `/architect` to break down into tasks.**
