# ADR-0015: Bun as Sole Package Manager

**Status**: Accepted

**Date**: 2025-12-15

## Context

Project originally used pnpm. As the team evaluated alternatives for speed and DX, Bun emerged as significantly faster for install, dev server startup, and test execution. The project also uses Bun's built-in test runner compatibility with Vitest.

## Decision

Migrate from pnpm to Bun as the sole package manager. Enforce via:

1. `preinstall` script that rejects non-bun invocations
2. `packageManager` field in package.json set to `bun@1.2.17`
3. `engines.bun` requirement of `>=1.2.17`
4. CI uses `oven-sh/setup-bun@v2`

All documentation and scripts reference `bun run` exclusively.

## Consequences

**Good:**

- ~3x faster installs than pnpm
- Single lockfile format (`bun.lock`)
- Native TypeScript execution for scripts
- Consistent toolchain across dev and CI

**Bad:**

- Contributors must install Bun (minor friction)
- Some npm ecosystem tools assume npm/yarn (rare, not yet encountered)
- Bun compatibility gaps occasionally surface with Node.js APIs (none currently blocking)
