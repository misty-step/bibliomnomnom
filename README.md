# bibliomnomnom

A digital garden for voracious readers—a beautiful, private-first book tracking application.

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

## Getting Started

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Environment Setup

1. Duplicate `.env.example` to `.env.local`.
2. Fill in the required secrets (never commit `.env.local`).

Required variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` / `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_URL` (defaults already set)
- `NEXT_PUBLIC_CONVEX_URL` / `CONVEX_DEPLOYMENT` (and optional `CONVEX_DEPLOYMENT_URL` for webhooks)
- `GOOGLE_BOOKS_API_KEY` (used for the search modal)
- `BLOB_READ_WRITE_TOKEN` (used by `/api/blob/upload` + `UploadCover`)

After populating the values, restart `pnpm dev` so Next.js can pick up the new environment.

## Using The App Locally

- The landing page CTA is currently decorative; visit `/sign-in` to start the Clerk auth flow.
- After signing in, you are redirected to `/library`, which hosts the private dashboard experience.
- Public book details live under `/books/[id]`; private, editable book details are under `/library/books/[id]`.
- If you need to test uploads, ensure `BLOB_READ_WRITE_TOKEN` is present; otherwise the cover uploader will fail.

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

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Database**: Convex (planned)
- **Auth**: Clerk (planned)
- **Storage**: Vercel Blob (planned)
- **Deployment**: Vercel

## Project Structure

```
bibliomnomnom/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components (planned)
├── convex/                # Convex backend (planned)
├── lib/                   # Utilities (planned)
├── public/                # Static assets (planned)
└── DESIGN.md              # Architecture documentation
```

## Development

See [DESIGN.md](./DESIGN.md) for architecture details and [TODO.md](./TODO.md) for implementation tasks.

## License

MIT
