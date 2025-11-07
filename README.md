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
