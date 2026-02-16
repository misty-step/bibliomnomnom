# bibliomnomnom

A digital garden for voracious readers—a beautiful, private-first book tracking application.

**Why bibliomnomnom?** Track your reading journey with a privacy-first approach. Unlike Goodreads or StoryGraph, your data stays yours. Built for readers who want a beautiful, intentional way to catalog books, notes, and quotes without algorithms or social pressure.

## Prerequisites

- **Node.js** >=20.0.0
- **bun** >=1.2.17 (enforced)

### Installing bun

```bash
# One-time install
curl -fsSL https://bun.sh/install | bash
```

## Before You Start: Create Service Accounts

You'll need free accounts on these services:

1. **[Clerk](https://clerk.com)** - User authentication (free tier: 10,000 monthly active users)
2. **[Convex](https://convex.dev)** - Real-time backend database (free tier: unlimited dev deployments)
3. **[Vercel Blob](https://vercel.com/docs/storage/vercel-blob)** - File storage for book covers (free tier: 100 GB bandwidth/month)
4. **[OpenRouter](https://openrouter.ai)** - AI gateway for imports (TXT/MD) + photo OCR (pay-as-you-go)

Sign up before proceeding with installation.

## Environment Setup

1. **Copy environment template**:

   ```bash
   cp .env.example .env.local
   ```

2. **Fill in credentials** from your service dashboards:

   **Clerk** (Dashboard → API Keys):
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `CLERK_WEBHOOK_SECRET`

   **Convex** (Dashboard → Settings → URL & Deploy Key):
   - `NEXT_PUBLIC_CONVEX_URL`
   - `CONVEX_DEPLOYMENT`

   **Vercel Blob** (Dashboard → Storage → Create Store → Tokens):
   - `BLOB_READ_WRITE_TOKEN`

   Sign-in/sign-up URLs are pre-configured:
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`

3. **Never commit `.env.local`** - it's gitignored and contains secrets.

## Backend Configuration

### 1. Sync Convex Schema

Push the database schema to your Convex deployment:

```bash
bun run convex:push
```

This creates the `users`, `books`, and `notes` tables and makes queries like `api.books.list` available.

**Troubleshooting**: If you see `Could not find public function` errors, this step wasn't run or `NEXT_PUBLIC_CONVEX_URL` is misconfigured.

### 2. Create Clerk JWT Template

Convex authentication requires a Clerk JWT template:

1. Go to Clerk Dashboard → JWT Templates
2. Click "New Template" → Choose "Convex"
3. Name it `convex` (exact name required)
4. In "Claims", add `convex` to metadata
5. Save and enable the template

**Troubleshooting**: If you see `404` errors for `.../tokens/convex`, this step is missing.

### 3. Install Dependencies

```bash
bun install
```

### 4. Enable Imports (Goodreads/CSV/TXT/MD)

- Feature flag: `NEXT_PUBLIC_IMPORT_ENABLED=true` (defaults to true). Toggle to hide the import UI if needed.
- LLM (for TXT/MD/unknown CSV): set `OPENROUTER_API_KEY` (and optionally `OPENROUTER_IMPORT_MODEL`) in `.env.local` (or `~/.secrets`) **and** in Convex env vars (`bun run convex:env:sync` or `bunx convex env set OPENROUTER_API_KEY or_...`).
- Schema updates: run `bun run convex:push` after pulling to apply `importRuns` and `importPreviews` tables and regenerate Convex types.
- Rate limits: enforced per user (5 imports/day, 2 concurrent previews); adjust constants in `convex/imports.ts` if policy changes.
- File limits: accepts CSV/TXT/MD up to 10MB; previews paginate at 300 rows/page.
- Privacy: CSV stays client-side; TXT/MD data sent to LLM only; imported books default to `private`.

## Getting Started

Now that services and configuration are complete:

```bash
# Start Next.js + Convex + Stripe listener
bun run dev
```

`bun run dev` first syncs `CONVEX_WEBHOOK_TOKEN` between `.env.local` and Convex dev, then runs:

- **Next.js**: http://localhost:3000 (frontend)
- **Convex**: Live backend with real-time logs
- **Stripe CLI listener**: forwards webhooks to `/api/stripe/webhook`

### Verify Your Setup

After running `bun run dev`, you should see:

- ✅ Next.js running at http://localhost:3000
- ✅ Convex dev server logs showing function calls
- ✅ No errors in either terminal

Visit http://localhost:3000 and click "Sign In". If the Clerk modal opens, you're ready!

## Production Build

```bash
# Build for production (runs Convex deploy first)
bun run build

# Start production server (after build)
bun run start
```

**Note**: The build command automatically deploys Convex before building Next.js to ensure type safety.

## Production Deployment

This project is configured for deployment on **Vercel** with **Convex** and **Clerk**.

### Quick Deploy

1. **Push to GitHub** - Vercel auto-deploys from `main` branch
2. **Set Environment Variables** - Configure in Vercel Dashboard (see [DEPLOYMENT.md](./DEPLOYMENT.md))
3. **Verify Deployment** - Check `/api/health` endpoint

### Critical Setup Steps

Before deploying to production, you MUST:

- [x] Generate Convex production deploy key
- [x] Generate Convex preview deploy key (for PR previews)
- [x] Configure Clerk production application
- [x] Set up Clerk production webhook (after first deploy)
- [x] Set all environment variables in Vercel Dashboard

### Environment Variables Required

**Production Environment:**

```bash
# Clerk (production)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Convex (production)
# Use CONVEX_DEPLOY_KEY for CI/preview/production deploys; CONVEX_DEPLOYMENT is only for local dev.
NEXT_PUBLIC_CONVEX_URL=https://your-prod.convex.cloud
CONVEX_DEPLOY_KEY=prod:deployment|token

# Vercel Blob (auto-configured via integration)
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# AI (OpenRouter - optional for import + OCR)
OPENROUTER_API_KEY=or_...
OPENROUTER_IMPORT_MODEL=google/gemini-3-pro-preview
OPENROUTER_OCR_MODEL=google/gemini-2.5-flash
NEXT_PUBLIC_IMPORT_ENABLED=true
```

**Preview Environment:**

```bash
# Convex (preview - creates isolated deployments per branch)
CONVEX_DEPLOY_KEY=preview:username:project|token

# Clerk (can reuse production or use test keys)
# + other keys same as production
```

### Post-Deploy Verification

After deployment, verify:

```bash
# Shallow health (monitor-safe)
curl https://your-domain.com/api/health

# Should return 200 with services marked "unknown" (no external probes).

# Deep diagnostics (manual only)
curl "https://your-domain.com/api/health?mode=deep"

# Should return 200 when dependencies up; 503 when any are down.
# Response includes git SHA prefix in `version` and per-service status/latency.
```

Test critical flows:

- Sign up → creates user in Convex (tests Clerk webhook)
- Add book → saves to Convex (tests mutations + auth)
- Upload cover → uploads to Blob (tests file storage)

### Complete Guide

For detailed deployment instructions, see **[DEPLOYMENT.md](./DEPLOYMENT.md)** which covers:

- Convex production setup
- Clerk production configuration
- Vercel environment variables
- Preview deployments
- Monitoring & observability
- Troubleshooting common issues
- Rollback procedures

## Using The App

### Navigation

- **Landing page**: `/` → "Start Tracking" button routes to `/sign-in`
- **Sign in/up**: `/sign-in`, `/sign-up` → Clerk authentication modals
- **Library (private)**: `/library` → Your personal book grid with filters
- **Book detail (private)**: `/library/books/[id]` → Edit book, add notes, upload cover
- **Book detail (public)**: `/books/[id]` → Public view if privacy set to "public"

### Adding Books

**Manual entry** (MVP):

1. Click "Add Book" in library header
2. Fill in title, author, and optional fields
3. Select reading status (want-to-read, currently-reading, read)
4. Click "Add Book"

**Book covers**:

- Upload custom covers via "Upload Cover" button on book detail page
- Supports JPEG, PNG, WebP (max 5MB)
- Requires `BLOB_READ_WRITE_TOKEN` configured

### Privacy Model

Books can be **private** (default) or **public**:

- **Private**: Only you can view and edit
- **Public**: Anyone with the link can view (sanitized data, no personal dates)

Toggle privacy on the book detail page.

### API Examples

Books are managed through Convex queries and mutations:

```typescript
import { useAuthedQuery, useMutation } from "@/lib/hooks/useAuthedQuery";
import { api } from "@/convex/_generated/api";

// Fetch all books
const books = useAuthedQuery(api.books.list, {});

// Filter by status
const currentlyReading = useAuthedQuery(api.books.list, {
  status: "currently-reading",
});

// Add a book
const addBook = useMutation(api.books.create);
await addBook({
  title: "The Hobbit",
  author: "J.R.R. Tolkien",
  status: "want-to-read",
});

// Update book status (auto-sets dateStarted/dateFinished)
const updateStatus = useMutation(api.books.updateStatus);
await updateStatus({ id: bookId, status: "read" });

// Add a note
const createNote = useMutation(api.notes.create);
await createNote({
  bookId,
  type: "note", // or "quote"
  content: "This is my note in markdown",
});
```

See [CLAUDE.md](./CLAUDE.md) for complete API reference and architecture details.

## Package Manager Enforcement

This project **exclusively uses bun**. Attempts to use npm, yarn, or pnpm will be blocked:

- `package.json` includes `"packageManager": "bun@1.2.17"` for package-manager enforcement
- `preinstall` script blocks other package managers
- `.npmrc` enforces engine-strict mode

### Why bun?

- **Production-stable**: Battle-tested, reliable, predictable
- **Fast**: Significantly faster than npm/yarn via hard links
- **Disk-efficient**: No duplicate dependencies across projects
- **Vercel-native**: Auto-detected on deployment
- **Future-proof**: Excellent monorepo support when needed

## Common Commands

| Command             | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `bun run dev`          | Sync webhook token, then start Next.js + Convex + Stripe listener |
| `bun run convex:push`  | Sync schema to Convex (run once after pull/schema changes) |
| `bun run convex:dev`   | Run Convex dev server standalone (for live logs)           |
| `bun run build`        | Production build                                           |
| `bun run start`        | Start production server (after build)                      |
| `bun run lint`         | Run ESLint                                                 |
| `bun run typecheck`    | Run TypeScript compiler check                              |
| `bun run tokens:build` | Regenerate design tokens from source                    |
| `bun run test`         | Run test suite                                             |
| `bun run test:coverage`| Run tests with coverage report                             |
| `bun run validate`     | Run all quality checks (lint, typecheck, coverage, build)  |
| `bun run validate:fast`| Run quick checks (lint, typecheck, tests only)             |

## Quality Checks

This project uses automated quality gates to ensure code quality and prevent bugs.

### Running Quality Checks Locally

```bash
# Run all quality checks (recommended before pushing)
bun run validate

# Run quick checks (no coverage, no build) - faster feedback
bun run validate:fast

# Format code
bun run format

# Check code formatting
bun run format:check

# Type check
bun run typecheck

# Run tests
bun run test

# Run tests with coverage report
bun run test:coverage
```

### Git Hooks

Quality checks run automatically via [Lefthook](https://github.com/evilmartians/lefthook):

- **Pre-commit**: Secret detection, linting, formatting, type checking
- **Pre-push**: Environment validation, tests, build verification
- **Commit-msg**: Conventional commit format enforcement

Hooks are installed automatically via `bun install`.

### Skipping Hooks (Emergency Use Only)

**⚠️ Only skip hooks in emergencies.** All checks exist to prevent bugs and security issues.

```bash
# Skip all hooks (emergency hotfix)
LEFTHOOK=0 git commit -m "fix: critical bug"

# Skip specific hook
SKIP=trufflehog git commit -m "feat: add feature"

# Skip pre-commit only
git commit --no-verify -m "fix: urgent"
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for complete contributor guidelines and best practices.

## Tech Stack

### Frontend

- **Framework**: Next.js 16 (App Router, Turbopack)
- **React**: 19 (with Server Components)
- **Language**: TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 3.4 + custom bibliophile palette
- **Components**: shadcn/ui (Radix UI primitives)
- **Rich Text**: Tiptap 3 (for notes/quotes)
- **Icons**: Lucide React

### Backend

- **Database**: Convex 1.28 (real-time backend with type-safe queries)
- **Auth**: Clerk 6.34 (authentication + user management)
- **File Storage**: Vercel Blob (book cover uploads)
- **Deployment**: Vercel

### Design System

- **Colors**: Paper (cream), Ink (dark), Leather (brown), Border
- **Fonts**: Crimson Text (serif), Inter (sans), JetBrains Mono (code)
- **Philosophy**: Warm, sepia aesthetic inspired by physical books

See [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) for complete token documentation.

## Project Structure

```
bibliomnomnom/
├── app/                         # Next.js App Router
│   ├── (auth)/                 # Public auth routes
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── (dashboard)/            # Protected routes
│   │   ├── layout.tsx          # Dashboard layout with nav
│   │   └── library/            # Main library view
│   │       ├── page.tsx
│   │       └── books/[id]/     # Private book detail
│   ├── books/[id]/             # Public book view
│   ├── api/
│   │   ├── blob/upload/        # Vercel Blob presigned URLs
│   │   └── webhooks/clerk/     # Clerk user sync
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Landing page
│   └── globals.css             # Global styles + Tailwind
│
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   ├── book/                   # Book components
│   ├── notes/                  # Note/quote components
│   ├── navigation/             # Nav components
│   └── shared/                 # Error/loading states
│
├── convex/                      # Convex backend (5 core modules)
│   ├── _generated/             # Auto-generated types
│   ├── schema.ts               # Database schema
│   ├── auth.ts                 # Auth helpers
│   ├── users.ts                # User queries/mutations
│   ├── books.ts                # Book queries/mutations
│   └── notes.ts                # Note queries/mutations
│
├── lib/
│   ├── design/                 # Design tokens
│   ├── hooks/                  # Custom React hooks
│   └── utils.ts                # Utility functions
│
├── public/                     # Static assets
│
├── CLAUDE.md                   # AI assistant patterns & troubleshooting
├── DESIGN-SYSTEM.md            # Design tokens & components
└── docs/
    ├── adr/                    # Architecture Decision Records
    ├── flows/                  # User journey diagrams
    └── postmortems/            # Incident reports
```

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design, modules, data flow, key decisions
- **[CLAUDE.md](./CLAUDE.md)** - Patterns, conventions, troubleshooting
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide for Vercel/Convex/Clerk
- **[DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)** - Design tokens, colors, typography
- **[docs/adr/](./docs/adr/)** - Architecture Decision Records
- **[docs/flows/](./docs/flows/)** - User journey diagrams
