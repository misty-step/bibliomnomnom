# Repository Guidelines

## Project Structure & Module Organization
`app/` holds the Next.js App Router; route groups like `app/(auth)` and `app/(dashboard)` own their screens plus server actions. Shared React components ship from `components/`, while reusable hooks live in `hooks/` and pure helpers in `lib/`. Convex backend logic—schema, queries, mutations—sits in `convex/`; sync it before running UI work. Cross-cutting config such as `next.config.ts`, `tailwind.config.ts`, and `middleware.ts` stay at repo root for fast discovery.

## Build, Test, and Development Commands
`pnpm install` respects the enforced package manager; other clients fail `preinstall`. `pnpm dev` starts Next.js with Turbopack plus live Convex client reloads, and `pnpm build` runs the production compiler. `pnpm start` serves the compiled app; only run after `pnpm build`. `pnpm lint` gates merges through Next+ESLint rules. Backend helpers: `pnpm convex:dev` keeps Convex hot-reloading; `pnpm convex:push` deploys schema/functions once per branch.

## Coding Style & Naming Conventions
TypeScript strict mode everywhere; no `any` unless documented with a TODO. Components, providers, and hooks use PascalCase filenames (`LibraryShelf.tsx`, `useUploadCover.ts`). Utility modules use kebab-case (`lib/markdown.ts`). Tailwind classes stay inline, but extract variants with `class-variance-authority` when props explode. Prefer early returns, pure helpers, deep modules; hide Convex/client specifics behind thin adapters.

## Testing Guidelines
Automated tests are not yet wired; treat `pnpm lint` plus critical user journeys (sign-in → library → book detail) as the minimum review gate. When adding tests, colocate `*.test.ts` next to the source and reach for Vitest + Testing Library to exercise complex hooks or server actions. Mock Clerk and Convex via their official client fakes; never hit production deployments.

## Commit & Pull Request Guidelines
History follows Conventional Commits (`feat:`, `fix:`, `chore:`). Use the imperative mood, ≤72 char subject, body only when extra context reduces reviewer lookup. PRs must describe the user-facing change, list env or schema migrations, link BACKLOG items, and add screenshots/GIFs for UI shifts. Keep diffs focused; split feature work from follow-up refactors to avoid reviewer thrash.

## Security & Configuration Tips
Copy `.env.example` to `.env.local`; never commit secrets. Clerk keys, Convex deployment IDs, and `BLOB_READ_WRITE_TOKEN` are required for uploads and book CRUD. After environment edits, restart `pnpm dev` so Next.js reloads variables. Use the `convex` JWT template inside Clerk or API calls will 404; verify via the Convex dashboard before filing issues.
