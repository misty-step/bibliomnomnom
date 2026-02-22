# CLAUDE.md

## What This Is

**bibliomnomnom** — private-first book tracking for voracious readers. Track reading, capture notes via text/audio/photo, import from Goodreads/CSV, share public reader profiles. Built on Next.js 16, React 19, Convex, Clerk, Stripe.

## Essential Commands

```bash
bun run dev              # Next.js + Convex + Stripe listener
bun run dev:no-stripe    # Without Stripe listener
bun run build            # Production build (convex deploy → next build)
bun run build:local      # Next.js build only (CI)
bun run lint             # ESLint
bun run typecheck        # tsc --noEmit
bun run test             # Vitest
bun run test:coverage    # Vitest with coverage
bun run validate         # lint + typecheck + test:coverage + build (full gate)
bun run validate:fast    # lint + typecheck + test (no build)
bun run convex:push      # Sync schema to dev deployment
bun run e2e              # Playwright E2E tests
bun run session-guardrails # Listening session cost/safety checks
```

**bun only** — npm/yarn/pnpm blocked via preinstall hook.

## Architecture

Convex-first with actions pattern. Convex is single source of truth for all data.

| Layer | Role | Location |
|-------|------|----------|
| **Auth** | Clerk JWT → `requireAuth(ctx)` | `convex/auth.ts` |
| **Data** | Queries (read), Mutations (write), Actions (external) | `convex/*.ts` |
| **API Routes** | Webhooks, file upload, listening sessions, OCR | `app/api/` |
| **UI** | React components, Convex hooks for data | `components/`, `app/` |
| **Observability** | Sentry errors, pino logs, PostHog analytics | See `docs/OBSERVABILITY.md` |

**Core modules:** books, notes, imports, listening sessions, subscriptions, profiles, users

**Key invariants:**
- All mutations validate ownership via `requireAuth()` + userId check
- Books default to `private`; `public` books expose sanitized fields only
- Status changes auto-set dates (`dateStarted`, `dateFinished`, `timesRead`)
- Notes ownership validated via book relationship, not direct user check

For detailed architecture, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).

**Navigation shortcut:** Every directory has a `.glance.md` with pre-computed context (purpose, key files, gotchas). Read it before scanning the directory — saves tokens and orients faster. Regenerate with `/cartographer` after significant structural changes.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 3.4, Shadcn/UI, Framer Motion 12 |
| Backend | Convex 1.28, Clerk 6.35, Stripe 20 |
| Rich Text | Tiptap 3 |
| Storage | Vercel Blob (covers, audio) |
| Monitoring | Sentry 10, PostHog, pino |
| Testing | Vitest, Playwright |
| Deploy | Vercel |

**Design system:** Warm sepia aesthetic — Paper (#FDFBF7), Ink (#1A1A1A), Leather (#8B4513). Crimson Text (serif headers), Inter (body), JetBrains Mono (code).

## Quality Gates

**CI (`.github/workflows/ci.yml`):** lint → typecheck → test:coverage → trufflehog → build → e2e

**Git hooks (lefthook):**
- pre-commit: trufflehog, eslint --fix, prettier --write, tsc --noEmit
- pre-push: env validation (local + prod), test, build
- commit-msg: commitlint (conventional commits)

**Conventions:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `ci:` with scope. Imperative mood, ≤72 char subject.

## Gotchas

**Convex build order:** `bunx convex deploy && next build` — types depend on schema. Wrong order = deploy failure. The `build` script handles this correctly.

**Convex schema sync:** After editing `convex/schema.ts`, run `bun run convex:push`. "Could not find public function" = schema not synced.

**Stripe webhook secret:** Stripe CLI generates a new ephemeral secret each session. `scripts/dev-stripe.sh` auto-syncs to `.env.local`, but if Next.js was already running, restart it. Symptom: all webhooks return 400.

**Clerk JWT template:** Must exist as `convex` in Clerk dashboard. Missing = 404 on `/tokens/convex`.

**Next.js image domains:** External image hostnames must be in `next.config.ts` `images.remotePatterns`.

**Listening sessions cost:** LLM synthesis uses OpenRouter. Cost guardrails in `scripts/session-guardrails.ts` run in CI. Max context items capped at 4.

## Environment

```bash
# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET

# Backend
NEXT_PUBLIC_CONVEX_URL
CONVEX_DEPLOYMENT
CONVEX_DEPLOY_KEY          # Production deploy
CONVEX_WEBHOOK_TOKEN       # Webhook auth between Next.js ↔ Convex

# Storage
BLOB_READ_WRITE_TOKEN

# Payments
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_ID_MONTHLY
STRIPE_PRICE_ID_YEARLY

# Monitoring
NEXT_PUBLIC_SENTRY_DSN
SENTRY_AUTH_TOKEN           # CLI/deploy only
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST

# AI (listening sessions)
OPENROUTER_API_KEY
ELEVENLABS_API_KEY          # Primary STT
DEEPGRAM_API_KEY            # Fallback STT
```

Copy `.env.example` → `.env.local`. Never commit secrets. Restart dev server after changes.

## Deployment

Vercel auto-deploys from `master`. Build command: `bunx convex deploy --cmd 'next build'`.

**Release:** semantic-release on merge to master. Conventional commits drive versioning.

**Health check:** `GET /api/health` (shallow) or `?mode=deep` (probes Convex, Clerk, Stripe).

## Module Boundaries

Respect these interfaces when modifying code:

1. **Auth** (`convex/auth.ts`) — Expose `requireAuth()` and `getAuthOrNull()` only
2. **Books** (`convex/books.ts`) — All book ops through exported queries/mutations
3. **Notes** (`convex/notes.ts`) — Ownership via book relationship
4. **Imports** (`convex/imports.ts`, `lib/import/`) — Repository pattern, LLM extraction in actions
5. **Listening Sessions** (`convex/listeningSessions.ts`) — State machine: idle → recording → uploading → transcribing → synthesizing → complete
6. **Subscriptions** (`convex/subscriptions.ts`) — Stripe status mapped to internal tiers
7. **Upload** (`app/api/blob/`) — Server generates tokens, client uploads direct to blob

## References

| Doc | Content |
|-----|---------|
| `docs/CODEBASE_MAP.md` | Full architecture map |
| `docs/OBSERVABILITY.md` | Monitoring, logging, alerting detail |
| `docs/adr/` | 15 architectural decision records |
| `docs/flows/` | User journey diagrams |
| `ARCHITECTURE.md` | System architecture overview |
| `DESIGN.md` | Feature design specs |
| `AGENTS.md` | Agent operational playbook |
