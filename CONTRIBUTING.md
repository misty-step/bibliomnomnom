# Contributing to bibliomnomnom

Thank you for your interest in contributing! This guide will help you understand our development workflow, quality standards, and best practices.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Message Format](#commit-message-format)
- [Quality Checks](#quality-checks)
- [Testing Requirements](#testing-requirements)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

- Node.js >=20.0.0
- pnpm >=9.0.0 (enforced - npm/yarn/bun will not work)
- Git configured with your name and email

### Initial Setup

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Copy environment template: `cp .env.example .env.local`
4. Fill in required credentials (see README.md)
5. Push Convex schema: `pnpm convex:push`
6. Start dev servers: `pnpm dev`

Git hooks will be installed automatically via the `prepare` script.

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates
- `chore/` - Maintenance tasks

Example: `feature/book-import`, `fix/cover-upload`, `docs/contributing`

### Making Changes

1. Create a new branch from `master`
2. Make your changes with atomic commits
3. Run quality checks locally (see below)
4. Push to your fork and open a pull request

### Atomic Commits

Keep commits focused and atomic:
- One logical change per commit
- All tests pass after each commit
- Commit message explains "why" not "what"

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint.

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, semicolons, etc.)
- `refactor` - Code refactoring without behavior change
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `build` - Build system changes (dependencies, scripts)
- `ci` - CI/CD configuration changes
- `chore` - Maintenance tasks (tooling, cleanup)
- `revert` - Revert previous commit

### Scope (Optional)

The scope should identify the module or feature:
- `auth` - Authentication/authorization
- `books` - Book management
- `notes` - Notes/annotations
- `import` - Import functionality
- `ui` - UI components
- `api` - API routes
- `db` - Database schema/queries

### Examples

```bash
# Good commit messages
feat(import): add Goodreads CSV import support
fix(auth): prevent duplicate user creation on webhook
docs: update setup instructions for Clerk JWT template
test(books): add coverage for privacy toggle
refactor(ui): extract BookCard into reusable component
perf(notes): optimize markdown rendering with memoization

# Bad commit messages (will be rejected)
Updated files                    # No type
feat: stuff                      # Vague subject
FIX: broken thing               # Type must be lowercase
feat(books) added new feature   # Missing colon after scope
```

### Subject Line Rules

- Use imperative mood ("add" not "added" or "adds")
- No period at the end
- Max 100 characters (including type and scope)
- Be specific and descriptive

### Body (Optional)

Use the body to explain "why" rather than "what":
- Wrap at 100 characters per line
- Reference issues: `Closes #123`, `Fixes #456`
- Explain breaking changes with `BREAKING CHANGE:` footer

## Quality Checks

All commits go through automated quality gates via git hooks.

### Pre-Commit Checks (runs on `git commit`)

1. **TruffleHog** - Scans for secrets/credentials
2. **ESLint** - Auto-fixes linting issues
3. **Prettier** - Auto-formats code
4. **TypeScript** - Type checking

Fixed files are automatically staged.

### Pre-Push Checks (runs on `git push`)

1. **Environment validation** - Checks required env vars
2. **Tests** - Runs full test suite
3. **Build** - Verifies production build succeeds

### Commit Message Check

**Commitlint** validates your commit message format on every commit.

### Running Checks Manually

```bash
# Quick validation (no coverage, no build)
pnpm validate:fast

# Full validation (includes coverage + build)
pnpm validate

# Individual checks
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build:local
```

**Recommendation**: Run `pnpm validate:fast` before committing to catch issues early.

## Testing Requirements

### When to Write Tests

Write tests for:
- ✅ New features with business logic
- ✅ Bug fixes (test should fail before fix, pass after)
- ✅ Complex algorithms or data transformations
- ✅ Utility functions with multiple code paths

Tests are optional for:
- ⚪ Simple UI components with no logic
- ⚪ Configuration files
- ⚪ Type definitions

### Coverage Standards

- **Target**: 80%+ patch coverage (new code only)
- **Baseline**: 88% statements, 75% branches (as of 2025-11-25)
- Coverage reports are generated on PRs via GitHub Actions
- Focus on meaningful coverage, not hitting percentages

### Test Commands

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

### Test File Location

Place test files next to source files:
```
lib/utils/dedup.ts
lib/utils/dedup.test.ts
```

## Pull Request Guidelines

### PR Size

Keep PRs focused and reviewable:
- **Target**: < 200 lines changed
- **Max**: 400 lines (larger PRs will be auto-labeled)
- Break large features into smaller PRs when possible

### PR Checklist

Before opening a PR:

- [ ] All tests pass locally
- [ ] New tests added for new features/fixes
- [ ] TypeScript types are correct (no `any`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional format
- [ ] Branch is up-to-date with `master`

### PR Description

Include:
1. **What** changed (brief summary)
2. **Why** it changed (motivation, problem solved)
3. **How** to test it (manual testing steps)
4. **Screenshots** (for UI changes)
5. **Related issues** (e.g., "Closes #123")

### Review Process

1. PRs require at least one approval
2. All CI checks must pass
3. Address reviewer feedback with new commits
4. Squashing commits on merge is optional

## Troubleshooting

### Skipping Git Hooks (RARE - Use with Caution)

**⚠️ Warning**: Only skip hooks when absolutely necessary. All checks exist for good reasons.

#### Skip All Hooks
```bash
LEFTHOOK=0 git commit -m "feat: emergency hotfix"
```

#### Skip Specific Hook
```bash
SKIP=trufflehog git commit -m "feat: add feature"
```

#### Skip Pre-Commit Only
```bash
git commit --no-verify -m "feat: skip pre-commit"
```

**When to skip**:
- ✅ Emergency production hotfix
- ✅ Fixing broken CI (when hooks block the fix)
- ✅ Working offline without access to external services

**When NOT to skip**:
- ❌ "Hooks are too slow" - Fix performance instead
- ❌ "I'll fix it later" - Fix it now
- ❌ "Tests are failing" - Fix the tests
- ❌ "Formatting looks fine to me" - Let tools decide

### Hook Installation Issues

If hooks aren't running:
```bash
# Reinstall hooks
pnpm hooks:install

# Verify installation
ls -la .git/hooks/
```

### TruffleHog False Positives

If trufflehog flags a false positive:
1. Review the detection carefully - verify it's not an actual secret
2. If truly a false positive, add the file path or pattern to `.trufflehogignore`
3. Document why it's safe in a comment within the ignore file
4. Example:
   ```bash
   # Safe test fixture with dummy credentials
   __tests__/fixtures/mock-auth.ts
   ```

### TypeScript Errors

```bash
# Check for type errors
pnpm typecheck

# Common fixes
pnpm install              # Update dependencies
pnpm convex:push          # Regenerate Convex types
rm -rf .next && pnpm dev  # Clear Next.js cache
```

### Test Failures

```bash
# Run specific test file
pnpm test path/to/file.test.ts

# Run tests in watch mode (auto-rerun on changes)
pnpm test:watch

# Update snapshots (if using snapshots)
pnpm test -- -u
```

### Slow Pre-Commit Hooks

Pre-commit hooks should complete in < 10 seconds. If they're slow:
1. Check staged file count: `git diff --cached --name-only | wc -l`
2. Stage fewer files per commit (prefer atomic commits)
3. Run `pnpm typecheck` separately while developing
4. Use `pnpm validate:fast` for quick feedback loop

### Build Failures

```bash
# Local build (no Convex deploy)
pnpm build:local

# Check for common issues
pnpm typecheck            # Type errors
pnpm lint                 # Linting errors
rm -rf .next && pnpm dev  # Clear cache
```

## Questions or Issues?

- **Setup issues**: See README.md and CLAUDE.md
- **Architecture questions**: See DESIGN.md and ARCHITECTURE.md
- **Bug reports**: Open a GitHub issue with reproduction steps
- **Feature requests**: Open a GitHub issue with use case description

---

**Remember**: Quality gates exist to prevent bugs, security issues, and broken builds. They save time by catching problems early. When in doubt, run `pnpm validate` before pushing.

Happy contributing! 📚✨
