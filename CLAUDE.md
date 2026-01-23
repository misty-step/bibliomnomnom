# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**bibliomnomnom** is a private-first book tracking application for voracious readers. Built with Next.js 16, React 19, Convex (backend), and Clerk (authentication). The architecture follows a "Convex-First with Actions" pattern where Convex is the single source of truth, providing real-time updates, type safety, and clean module boundaries.

## Essential Commands

### Development

```bash
# Start full dev environment (Next.js + Convex + Stripe webhook listener)
pnpm dev

# Start without Stripe listener (if running on different port)
pnpm dev:no-stripe

# Start Convex dev server (for live backend logs/updates)
pnpm convex:dev

# Push Convex schema changes (one-time sync)
pnpm convex:push

# Build for production
pnpm build

# Start production server
pnpm start

# Lint
pnpm lint
```

### Package Manager Enforcement

- **MUST use pnpm** - enforced via preinstall hook and .npmrc
- npm/yarn/bun are blocked
- pnpm >=9.0.0 required

## Architecture Overview

### Core Principles (from DESIGN.md)

1. **Convex as Single Source of Truth** - All data operations flow through Convex for consistency and real-time updates
2. **Queries for Reads, Mutations for Writes, Actions for External** - Clear separation based on operation type
3. **Row-Level Security in Queries** - Privacy enforced at query level via ownership checks
4. **Optimistic Updates** - Instant UI feedback with eventual consistency
5. **Deep Modules** - Simple interfaces hiding complex implementation

### 5 Core Modules

**Module 1: Authentication & User Management** (`convex/auth.ts`, `convex/users.ts`)

- Hides Clerk JWT validation complexity behind `requireAuth()` and `getAuthOrNull()`
- Webhook handler syncs Clerk users to Convex database
- Public interface: Simple auth helpers that return user ID or null

**Module 2: Books Data Layer** (`convex/books.ts`)

- Hides database queries, privacy filtering, ownership validation
- Public interface: `list`, `get`, `getPublic`, `create`, `update`, `remove`, `updateStatus`, `toggleFavorite`, `updatePrivacy`
- Automatic date tracking: `dateStarted` set on "currently-reading", `dateFinished` and `timesRead` increment on "read"
- Privacy model: Books can be `private` (owner only) or `public` (sanitized fields for all)

**Module 3: External Book Search** (Deferred for MVP)

- Originally designed for Google Books API integration
- MVP ships with manual entry only
- Architecture preserved in DESIGN.md for future implementation

**Module 4: Notes & Content** (`convex/notes.ts`)

- Hides note CRUD complexity and ownership validation via book relationship
- Supports three types: note, quote, reflection
- Markdown content storage with rich text editor (Tiptap) on frontend

**Module 5: File Upload** (`app/api/blob/upload/route.ts`)

- Hides Vercel Blob complexity behind presigned URL pattern
- Client uploads directly to blob storage (not through Next.js server)
- API route only validates auth and generates upload token
- 5MB max, image types only (JPEG, PNG, WebP)

## Tech Stack

### Frontend

- **Framework**: Next.js 16.0.7 with App Router (Turbopack default)
- **React**: 19.2.1
- **Language**: TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 3.4.1 with custom bibliophile palette
- **Components**: Shadcn/UI (Radix UI primitives)
- **Animations**: Framer Motion 12
- **Rich Text**: Tiptap 3 with StarterKit
- **Icons**: Lucide React

### Backend

- **Database/API**: Convex 1.28.2
- **Authentication**: Clerk 6.34.5
- **File Storage**: Vercel Blob
- **Deployment**: Vercel

### Design System

- **Colors**: Paper (cream #FDFBF7), Ink (dark #1A1A1A), Leather (brown #8B4513), Border
- **Fonts**: Crimson Text (serif for headers), Inter (sans for body), JetBrains Mono (code)
- **Philosophy**: Warm, sepia aesthetic inspired by physical books and reading rooms

## Directory Structure

```
bibliomnomnom/
├── app/                         # Next.js App Router
│   ├── (auth)/                 # Auth route group (public)
│   │   ├── sign-in/[[...sign-in]]/
│   │   └── sign-up/[[...sign-up]]/
│   ├── (dashboard)/            # Protected routes
│   │   ├── layout.tsx          # Dashboard layout with nav
│   │   ├── library/            # Main book grid
│   │   │   ├── page.tsx
│   │   │   └── loading.tsx
│   │   └── books/[id]/         # Private book detail
│   ├── books/[id]/             # Public book view
│   ├── api/
│   │   ├── blob/upload/        # Vercel Blob upload endpoint
│   │   └── health/             # Health check endpoint
│   ├── layout.tsx              # Root layout (providers)
│   ├── page.tsx                # Landing page
│   ├── globals.css             # Global styles + Tailwind
│   └── ConvexClientProvider.tsx # Convex + Clerk integration
│
├── components/
│   ├── ui/                     # Shadcn/UI primitives (button, dialog, toast)
│   ├── book/                   # Book-related components
│   │   ├── BookCard.tsx        # Individual book card
│   │   ├── BookGrid.tsx        # Grid layout with filters
│   │   ├── BookDetail.tsx      # Full book details
│   │   ├── PublicBookView.tsx  # Public book profile
│   │   ├── AddBookModal.tsx    # Manual book entry modal
│   │   ├── UploadCover.tsx     # Cover upload component
│   │   ├── StatusBadge.tsx     # Reading status indicator
│   │   └── PrivacyToggle.tsx   # Public/private toggle
│   ├── notes/                  # Note/annotation components
│   │   ├── NoteCard.tsx
│   │   ├── NoteList.tsx
│   │   ├── NoteEditor.tsx      # Tiptap rich text editor
│   │   └── NoteTypeSelector.tsx
│   ├── layout/                 # Layout components
│   │   └── DashboardNav.tsx    # Navigation with active states
│   └── shared/                 # Common UI patterns
│       ├── ErrorBoundary.tsx
│       ├── ErrorState.tsx
│       ├── EmptyState.tsx
│       └── LoadingSkeleton.tsx
│
├── convex/                      # Convex backend
│   ├── _generated/             # Auto-generated types
│   ├── schema.ts               # Database schema (users, books, notes)
│   ├── auth.ts                 # Auth helpers (requireAuth, getAuthOrNull)
│   ├── users.ts                # User queries/mutations
│   ├── books.ts                # Book queries/mutations
│   └── notes.ts                # Note queries/mutations
│
├── lib/
│   ├── utils.ts                # Utility functions (cn)
│   └── hooks/
│       └── useAuth.ts          # Auth hook
│
├── proxy.ts                    # Next.js 16 proxy (Clerk route protection)
├── convex.json                 # Convex config
├── next.config.ts              # Next.js config
├── tailwind.config.ts          # Tailwind config (custom colors/fonts)
├── components.json             # Shadcn/UI config
└── tsconfig.json               # TypeScript config
```

## Key Patterns & Conventions

### Authentication Flow

1. User visits protected route (e.g., `/library`)
2. Next.js middleware checks Clerk session → redirects to `/sign-in` if absent
3. Clerk provides JWT in cookie/header
4. `ConvexClientProvider` passes JWT to Convex
5. Convex functions call `requireAuth(ctx)` to validate and get user ID
6. All queries filter by `userId`, all mutations validate ownership

### Privacy Model

- Books have `privacy` field: `"private"` or `"public"`
- **Private books**: Only owner can access via `books.get` query
- **Public books**: Anyone can access via `books.getPublic` query (sanitized fields only)
- Public route `/books/[id]` uses `getPublic` query (no auth required)
- Private route `/library/books/[id]` uses `get` query (requires ownership)

### Status Tracking with Auto-Dating

When book status changes via `updateStatus` mutation:

- **"currently-reading"**: Sets `dateStarted` if not already set
- **"read"**: Sets `dateFinished`, increments `timesRead`
- **"want-to-read"**: No date changes

### Ownership Validation Pattern

All mutations follow this pattern:

```typescript
const userId = await requireAuth(ctx);
const book = await ctx.db.get(args.id);
if (!book || book.userId !== userId) {
  throw new ConvexError("Access denied");
}
// ... proceed with mutation
```

### Optimistic Updates

UI updates instantly before server confirmation:

- Toggle favorite → UI updates immediately, mutation runs in background
- Change status → Badge updates instantly, auto-dating happens server-side
- If mutation fails, Convex automatically rolls back optimistic update

### Error Handling

- **Authentication errors**: Redirect to `/sign-in`
- **Authorization errors**: Show toast with "Access denied"
- **Not found**: Return `null` in queries, show `EmptyState` component
- **External API failures**: Return empty array, never throw to client
- **Upload failures**: Show toast, allow retry

## Development Workflow

### Adding a New Feature

1. **Define schema** in `convex/schema.ts` with indexes
2. **Create queries/mutations** in `convex/*.ts` with ownership validation
3. **Build UI components** in `components/` directory
4. **Create page** in `app/` directory with loading/error states
5. **Test manually** in dev mode (no automated tests yet)

### Modifying Convex Schema

1. Edit `convex/schema.ts`
2. Run `pnpm convex:push` to sync to dev deployment
3. Verify in Convex dashboard that schema updated
4. Restart `pnpm dev` if needed for type updates

### Adding Shadcn/UI Components

```bash
npx shadcn@latest add [component-name]
```

Components added to `components/ui/` and auto-configured for bibliophile theme.

### Working with Environment Variables

1. Copy `.env.example` to `.env.local`
2. Fill in secrets (Clerk, Convex, Vercel Blob)
3. Restart dev server to pick up changes
4. Never commit `.env.local`

**Required variables:**

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_DEPLOYMENT`
- `BLOB_READ_WRITE_TOKEN`
- `NEXT_PUBLIC_SENTRY_DSN` (for error tracking)

## Common Issues & Solutions

### "Could not find public function" error

**Cause**: Convex schema not synced to deployment
**Fix**: Run `pnpm convex:push` to sync schema

### Clerk returns 404 for `/tokens/convex`

**Cause**: Missing JWT template in Clerk dashboard
**Fix**: Create JWT template named `convex` with `convex` in metadata

### Cover upload fails

**Cause**: Missing `BLOB_READ_WRITE_TOKEN` env var
**Fix**: Add token from Vercel dashboard to `.env.local`

### Build fails with type errors

**Cause**: Convex types out of sync
**Fix**: Run `pnpm convex:push` to regenerate types

### Next.js Image Error: "hostname is not configured"

**Cause**: External image domain not whitelisted in `next.config.ts`
**Fix**: Add hostname to `images.remotePatterns` in `next.config.ts`

### Stripe webhooks not received in local dev

**Cause**: Stripe cannot reach `localhost` to deliver webhooks
**Fix**: Use Stripe CLI to forward webhooks locally:

```bash
# 1. Install Stripe CLI (if not already)
brew install stripe/stripe-cli/stripe

# 2. Login to Stripe
stripe login

# 3. Forward webhooks to local dev server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 4. Copy the webhook signing secret from CLI output to .env.local
# It will look like: whsec_...
```

**Note**: `pnpm dev` now runs the Stripe listener automatically. If running on a different port, run `stripe listen` manually with the correct port. Use `pnpm dev:no-stripe` to run without the listener.

## Testing Strategy

### Current State (MVP)

- **Manual testing** of critical paths during development
- **No automated tests** yet (planned for post-MVP)
- **Visual QA** for UI components and responsive design

### Future Testing (Post-MVP)

- **Unit tests**: Convex functions with `convex-test` library
- **E2E tests**: Playwright for critical user flows
- **Visual regression**: Chromatic for component library
- Detailed testing architecture in DESIGN.md lines 1572-1809

## Observability

### Overview

Production monitoring uses Sentry for error tracking, pino for structured logging (captured by Vercel), and Vercel Analytics for web vitals. All queryable from CLI.

### CLI Access (`./scripts/obs`)

```bash
# Full status overview (health + issues + alerts)
./scripts/obs status

# List unresolved Sentry issues
./scripts/obs issues [--limit N] [--env production|preview]

# Get issue details
./scripts/obs issue BIBLIOMNOMNOM-123

# Check health endpoint
./scripts/obs health [--deep] [--prod]

# List alert rules
./scripts/obs alerts

# Resolve an issue
./scripts/obs resolve BIBLIOMNOMNOM-123

# Tail Vercel logs
./scripts/obs logs [--follow]
```

**Requires:** `SENTRY_AUTH_TOKEN` environment variable set in shell.

### Sentry Configuration

- **Project:** `bibliomnomnom` in `misty-step` org
- **DSN:** Set in `.env.local` and Vercel production
- **Config:** `.sentryclirc` (gitignored, uses env token)
- **Tunnel:** `/monitoring` route bypasses ad blockers

**Alert Rules (5 active):**
| Rule | Trigger |
|------|---------|
| New Error Alert | First occurrence of any new issue |
| Regression Alert | Resolved issue resurfaces |
| High Frequency Error | Same error 10+ times in 1 hour |
| Critical: Auth/Payment | Errors in stripe/clerk/webhook routes |
| High Priority Issues | Default Sentry rule |

### Key Files

| File | Purpose |
|------|---------|
| `sentry.client.config.ts` | Client-side Sentry init + session replay |
| `sentry.server.config.ts` | Server-side Sentry init |
| `lib/sentry-config.ts` | Shared config + PII scrubbing |
| `lib/sentry.ts` | `captureError`/`captureMessage` utilities |
| `lib/logger.ts` | pino logger (JSON in prod, pretty in dev) |
| `lib/api/withObservability.ts` | API route wrapper with logging + error capture |
| `app/api/health/route.ts` | Health endpoint with service probes |

### Health Endpoint

```bash
# Shallow check (fast, no external calls)
curl https://bibliomnomnom.com/api/health

# Deep check (probes Convex, Clerk, Blob, Stripe)
curl https://bibliomnomnom.com/api/health?mode=deep
```

### Error Capture in Code

```typescript
// In client components (safe for browser)
import { captureError } from "@/lib/sentry";

try {
  // risky operation
} catch (error) {
  captureError(error, { tags: { feature: "book-import" } });
}

// In API routes (automatic via withObservability)
export const POST = withObservability(async (req) => {
  // errors auto-captured with context
}, "operation-name");
```

### Logging

**Server-only code** (not API routes):
```typescript
import { logger } from "@/lib/logger";

// Pino structured JSON output
logger.info({ msg: "book_created", bookId, userId });
logger.error({ msg: "import_failed", error: err.message });
```

**API routes**: Use `withObservability` wrapper which outputs JSON via console (pino has Next.js bundling issues in API routes).

## Performance Targets

- **Page load (LCP)**: < 1 second
- **Query response**: < 100ms
- **Mutation response**: < 200ms
- **File upload**: < 3 seconds for 5MB
- All queries use indexes (`by_user`, `by_user_status`, `by_book`)

## Security Considerations

1. **All mutations validate ownership** - Never trust client data
2. **Privacy filtering in queries** - Server-side enforcement
3. **API keys server-side only** - Never exposed to client
4. **File upload restrictions** - Max 5MB, image types only
5. **HTTPS enforced** - Vercel automatic, Clerk secure cookies
6. **No SQL injection** - Convex is not SQL-based

## Documentation References

- **System architecture**: `ARCHITECTURE.md` (modules, data flow, decisions)
- **Feature design (Reader Profile)**: `DESIGN.md` (detailed module spec for profiles feature)
- **Getting started**: `README.md` (setup instructions)
- **ADRs**: `docs/adr/` (architectural decision records)
- **Flow diagrams**: `docs/flows/` (user journey diagrams)

## Important Notes

- **pnpm only** - Do not use npm/yarn/bun (enforced)
- **Manual book entry only** - Google Books integration deferred
- **No dark mode** - Single light theme (warm sepia aesthetic)
- **No offline support** - Requires internet connection
- **Single user per book** - No collaborative editing
- **Real-time updates** - Convex queries auto-subscribe to changes

## Module Boundaries (Critical)

When modifying code, respect these module boundaries:

1. **Auth Module** (`convex/auth.ts`) - Only expose `requireAuth()` and `getAuthOrNull()`, hide Clerk complexity
2. **Books Module** (`convex/books.ts`) - All book operations go through exported queries/mutations, never direct database access
3. **Notes Module** (`convex/notes.ts`) - Ownership validated via book relationship, not direct user check
4. **Upload Module** (`app/api/blob/upload/route.ts`) - Client uploads directly to blob, server only generates tokens
5. **UI Components** - Should be presentational, data fetching via Convex hooks only

## Code Quality Principles

From global CLAUDE.md and DESIGN.md:

- **Manage complexity** - Anything that makes code hard to understand or modify is the enemy
- **Deep modules** - Simple interfaces hiding powerful implementations
- **Value formula**: Module worth = Functionality - Interface Complexity
- **Avoid shallow modules** - Where interface complexity ≈ implementation complexity
- **Information hiding** - Implementation details stay internal, expose intention not mechanism
- **Red flags**: `Manager`, `Util`, `Helper` class names; pass-through methods; excessive config
- **Strategic programming** - Invest 10-20% time in design improvement, not just features

## Key Learnings

From quality infrastructure audit (2025-11-20):

1. **Quality gates prevent production fires** - No CI/CD = type errors in production. No git hooks = secrets committed. No backend tests = privacy bugs ship. Infrastructure isn't overhead—it's prevention.

2. **Convex build order is critical** - `npx convex deploy && next build` (not just `next build`). Types depend on Convex schema. Wrong order = guaranteed Vercel deploy failures.

3. **Coverage for confidence, not vanity** - Track critical paths only (auth, privacy, payments) at 75% threshold. Don't waste time testing shadcn components or hitting 100% everywhere.

From previous grooming sessions:

4. **Import/Export is existential, not nice-to-have** - Every competitor has import. Data portability is ethical table stakes. Build before public launch.

5. **Silent failures are killing UX** - Users losing work without feedback → trust erosion → churn. Toast notifications cost 2h but prevent massive frustration.

6. **Design system is already exceptional** - 8.5/10 maturity for MVP. Token architecture is best-in-class. Fix quick bugs, then focus on features.

7. **Testing is strategic, not tactical** - Backend mutations untested = data corruption risk. Invest in critical path tests before major refactors.

---

**Last Updated**: 2026-01-23
**Architecture Version**: 1.0 (Complete)
**Status**: MVP in active development
