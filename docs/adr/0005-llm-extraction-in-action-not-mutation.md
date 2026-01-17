# ADR 0005: LLM Extraction in Actions, Not Mutations

## Status

Accepted

## Date

2025-12 (inferred from codebase structure)

## Context

The import system supports multiple formats:

- **CSV** (Goodreads, generic) - Parsed client-side with PapaParse
- **TXT/MD** - Requires LLM extraction via OpenRouter

Convex has strict runtime constraints:

- **Mutations**: Deterministic, no `fetch`, no external calls
- **Actions**: Can use `fetch`, call external APIs

LLM extraction requires calling OpenRouter API, which uses `fetch`.

### Considered Approaches

1. **Client-side LLM** - Browser calls OpenRouter directly
2. **Next.js API route** - Server route calls OpenRouter
3. **Convex Action** - Action calls OpenRouter, passes results to mutation

## Decision

**LLM extraction happens in Convex action (`extractBooks`), then passes parsed books to mutation (`preparePreview`).**

### Implementation

1. **Client Flow**:

   ```
   User uploads TXT
   → Client detects non-CSV format
   → Client calls extractBooks action
   → Action returns ParsedBook[]
   → Client calls preparePreview mutation with parsed books
   ```

2. **Action** (`convex/imports.ts`):

   ```typescript
   export const extractBooks = action({
     args: { rawText: v.string(), sourceType: v.string(), importRunId: v.string() },
     handler: async (ctx, args) => {
       await requireAuthAction(ctx); // Validates auth
       const provider = createOpenRouterExtractionProvider({ apiKey, model });
       return await llmExtract(args.rawText, { provider });
     },
   });
   ```

3. **Mutation** (`preparePreview`):
   - Receives pre-parsed books (from CSV parser OR action)
   - Runs dedup matching against existing library
   - Stores preview for later commit
   - **Never calls `fetch`** - pure database operations

### Why Not Client-Side LLM?

- API key would be exposed in browser
- No rate limiting or auth validation
- Can't leverage Convex's existing auth context

### Why Not Next.js API Route?

- Duplicates auth validation (Clerk + Convex)
- Loses Convex's transactional guarantees
- Another endpoint to secure and maintain

## Consequences

### Positive

- **Secure** - API key stays server-side (Convex env vars)
- **Consistent** - All import logic flows through Convex
- **Auditable** - Auth validation in single place

### Negative

- **Two-step client flow** - Action then mutation (extra round-trip)
- **Action doesn't persist** - Must pass results to mutation

### Key Pattern

Actions are for side effects (API calls, file I/O). Results flow into mutations for persistence. This matches the pattern used for:

- Cover image fetching (`actions/coverFetch.ts`)
- Profile insights generation (`actions/profileInsights.ts`)

## Alternatives Rejected

1. **Mutation with `fetch`** - Convex doesn't allow
2. **Combined action + mutation** - Would require running mutation inside action (possible but couples concerns)
3. **Scheduled function** - Overkill for synchronous extraction
