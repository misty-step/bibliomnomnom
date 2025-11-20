# bibliomnomnom

A digital garden for voracious readers—a beautiful, private-first book tracking application.

**Why bibliomnomnom?** Track your reading journey with a privacy-first approach. Unlike Goodreads or StoryGraph, your data stays yours. Built for readers who want a beautiful, intentional way to catalog books, notes, quotes, and reflections without algorithms or social pressure.

## Prerequisites

- **Node.js** >=20.0.0
- **pnpm** >=9.0.0 (enforced)

### Installing pnpm

```bash
# Via npm (one-time)
npm install -g pnpm

# OR via Corepack (recommended)
corepack enable
```

## Before You Start: Create Service Accounts

You'll need free accounts on these services:

1. **[Clerk](https://clerk.com)** - User authentication (free tier: 10,000 monthly active users)
2. **[Convex](https://convex.dev)** - Real-time backend database (free tier: unlimited dev deployments)
3. **[Vercel Blob](https://vercel.com/docs/storage/vercel-blob)** - File storage for book covers (free tier: 100 GB bandwidth/month)

Sign up for all three before proceeding with installation.

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
pnpm convex:push
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
pnpm install
```

## Getting Started

Now that services and configuration are complete:

```bash
# Start both Next.js and Convex dev servers
pnpm dev
```

This runs two servers concurrently:
- **Next.js**: http://localhost:3000 (frontend)
- **Convex**: Live backend with real-time logs

### Verify Your Setup

After running `pnpm dev`, you should see:
- ✅ Next.js running at http://localhost:3000
- ✅ Convex dev server logs showing function calls
- ✅ No errors in either terminal

Visit http://localhost:3000 and click "Sign In". If the Clerk modal opens, you're ready!

## Production Build

```bash
# Build for production
pnpm build

# Start production server (after build)
pnpm start
```

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
  status: "currently-reading"
});

// Add a book
const addBook = useMutation(api.books.create);
await addBook({
  title: "The Hobbit",
  author: "J.R.R. Tolkien",
  status: "want-to-read"
});

// Update book status (auto-sets dateStarted/dateFinished)
const updateStatus = useMutation(api.books.updateStatus);
await updateStatus({ id: bookId, status: "read" });

// Add a note
const createNote = useMutation(api.notes.create);
await createNote({
  bookId,
  type: "note", // or "quote", "reflection"
  content: "This is my note in markdown",
});
```

See [CLAUDE.md](./CLAUDE.md) for complete API reference and architecture details.

## Package Manager Enforcement

This project **exclusively uses pnpm**. Attempts to use npm, yarn, or bun will be blocked:

- `package.json` includes `"packageManager": "pnpm@9.15.0"` for Corepack enforcement
- `preinstall` script blocks other package managers
- `.npmrc` enforces engine-strict mode

### Why pnpm?

- **Production-stable**: Battle-tested, reliable, predictable
- **Fast**: Significantly faster than npm/yarn via hard links
- **Disk-efficient**: No duplicate dependencies across projects
- **Vercel-native**: Auto-detected on deployment
- **Future-proof**: Excellent monorepo support when needed

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev servers (Next.js + Convex concurrently) |
| `pnpm convex:push` | Sync schema to Convex (run once after pull/schema changes) |
| `pnpm convex:dev` | Run Convex dev server standalone (for live logs) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server (after build) |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript compiler check |
| `pnpm tokens:build` | Regenerate design tokens from source |

## Tech Stack

### Frontend
- **Framework**: Next.js 15.1 (App Router, Turbopack)
- **React**: 19.0 (with Server Components)
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
├── CLAUDE.md                   # Architecture & patterns (internal docs)
├── DESIGN-SYSTEM.md            # Design tokens & components
├── BACKLOG.md                  # Feature roadmap
└── TODO.md                     # Implementation tasks
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Architecture, patterns, conventions, troubleshooting
- **[DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)** - Design tokens, colors, typography
- **[BACKLOG.md](./BACKLOG.md)** - Strategic roadmap with 8-perspective analysis
- **[TODO.md](./TODO.md)** - Implementation tasks and work logs
