# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**bibliomnomnom** is a private-first book tracking application for voracious readers. Built with Next.js 15, React 19, Convex (backend), and Clerk (authentication). The architecture follows a "Convex-First with Actions" pattern where Convex is the single source of truth, providing real-time updates, type safety, and clean module boundaries.

## Essential Commands

### Development

```bash
# Start Next.js dev server (with Turbopack)
pnpm dev

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

- **Framework**: Next.js 15.1.0 with App Router and Turbopack
- **React**: 19.0.0
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
│   │   └── webhooks/clerk/     # Clerk user sync webhook
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
├── middleware.ts               # Next.js middleware (Clerk route protection)
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

- **Architecture details**: `DESIGN.md` (2182 lines of detailed module design)
- **Implementation tasks**: `TODO.md` (MVP checklist with work logs)
- **Getting started**: `README.md` (setup instructions)
- **Backlog**: `BACKLOG.md` (future features)

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

---

**Last Updated**: 2025-11-10
**Architecture Version**: 1.0 (Complete)
**Status**: MVP in active development
