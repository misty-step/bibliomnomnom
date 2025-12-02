# DESIGN.md — Search + Cover Backfill Architectures

> This file now holds two designs: (A) existing Open Library search, (B) new Cover Backfill.

---

## Cover Backfill Architecture Overview (New)

**Selected Approach**: Convex action `books.fetchMissingCovers` + internal query + three client triggers (import, create, manual bulk).

**Rationale**: Reuses proven `coverFetch` cascade, avoids schema change, keeps interface tiny (`apiCoverUrl` only), idempotent + retryable with cursorized batching.

**Core Modules**
- **listMissingCovers** (internal query): fetch IDs lacking `coverUrl` and `apiCoverUrl` for a user; supports pagination or explicit `bookIds`.
- **fetchMissingCovers** (action): orchestrates batch fetch + patch, returns counts, failures, nextCursor.
- **UI Triggers**:
  - Import hook: run backfill post-commit (scoped to created/merged IDs when available, otherwise scan).
  - AddBookSheet hook: if create saved without cover, fire one-shot backfill for that ID.
  - Manual “Fetch missing covers” control: tucked-away in Library toolbar overflow (or Settings → Tools) running batches until done.
- **Logging**: structured `coverBackfill.event` with counts/timing, no PII.

**Data Flow**
```
Trigger (import/create/manual) →
  fetchMissingCovers action →
    listMissingCovers (user-scoped, limit, cursor or bookIds) →
    for each: coverFetch.search (Open Library → Google Books → OL search) →
      on success: db.patch { apiCoverUrl, apiSource, updatedAt }
      on failure: record failure entry
→ return { processed, updated, failures[], nextCursor? } → UI toast/progress
```

**Key Decisions**
1. Write only `apiCoverUrl`/`apiSource`; never overwrite `coverUrl` → respects user uploads (simplicity, safety).
2. Sequential batch (default 20, max 50) → predictable runtime, avoids API thrash; cursor to continue.
3. Optional scoped run via `bookIds` → faster for imports/creates; fallback to scan to keep UX resilient.
4. Feature-flag capable (`NEXT_PUBLIC_COVER_BACKFILL_ENABLED`, default on) → controlled rollout.

---

## Modules (Cover Backfill)

### Module: internal.books.listMissingCovers (new)
Responsibility: hide DB selection of books missing covers, with pagination or explicit IDs.

Public Interface (internal query):
```typescript
args:
  userId: Id<"users">
  limit?: number  // default 20, cap 50
  cursor?: string // opaque pagination cursor
  bookIds?: Id<"books">[] // optional hard scope; ignores cursor/limit when provided (still caps at 50)
returns:
  items: Array<Pick<Doc<"books">, "_id" | "title" | "author" | "isbn" | "apiId">>
  nextCursor?: string
```

Internal Implementation:
- If `bookIds` supplied: fetch by IDs, filter ownership + missing cover fields, slice to 50.
- Else: `ctx.db.query("books").withIndex("by_user", q => q.eq("userId", userId)).filter` missing covers; use `paginate` with `limit`; emit `nextCursor`.
- Missing cover definition: `!coverUrl && !apiCoverUrl`.

Dependencies:
- Convex DB, `books` table indexes.

Error Handling:
- Reject non-owner IDs.
- If cursor invalid → return empty set, no throw (defensive).

### Module: actions.books.fetchMissingCovers (new)
Responsibility: orchestrate batch fetch + patch for missing covers.

Public Interface (action):
```typescript
args:
  limit?: number // default 20, max 50
  cursor?: string
  bookIds?: Id<"books">[]
returns:
  {
    processed: number;
    updated: number;
    failures: { bookId: Id<"books">; reason: string }[];
    nextCursor?: string;
  }
```

Internal Implementation:
- Auth via `requireAuthAction`.
- Resolve target books via `listMissingCovers` with same pagination semantics.
- For each book (sequential):
  1) Call `internal.actions.coverFetch.search` with `bookId`.
  2) If `result.error` → push failure (no throw).
  3) On success → `ctx.db.patch(bookId, { apiCoverUrl, apiSource, updatedAt: Date.now() })`.
- Accumulate counts, return `nextCursor` passthrough.
- Optional concurrency knob (keep 1 for MVP; allow 3-5 later if perf needed).

Dependencies:
- `internal.books.listMissingCovers`
- `internal.actions.coverFetch.search`
- `requireAuthAction`

Error Handling:
- Unauthorized → throw (Convex standard).
- Per-book failures isolated; action always returns summary unless auth fails.

### Module: UI Triggers
- **ImportFlow hook** (`components/import/ImportFlow.tsx`):
  - After commit success, call `fetchMissingCovers({ bookIds: summary.createdIds ?? undefined })`.
  - If IDs unavailable, call without bookIds to scan (one batch or loop until `nextCursor`).
  - Toast: “Fetching covers…”, completion counts; ignore PII in logs.
- **AddBookSheet** (`components/book/AddBookSheet.tsx`):
  - After `books.create` when no `coverUrl`/`apiCoverUrl` passed, fire `fetchMissingCovers({ bookIds: [id] })` fire-and-forget; optional subtle toast.
- **Manual bulk control** (`components/book/BookGrid.tsx` toolbar overflow or `app/(dashboard)/settings` Tools):
  - Label: “Fetch missing covers”.
  - On click: call action, loop while `nextCursor`, show progress (count up), surface failures count.

### Module: Logging (`lib/cover/metrics.ts` or extend `lib/import/metrics.ts`)
Structured log (no titles/authors):
```ts
logCoverEvent({
  phase: "backfill",
  processed,
  updated,
  failures: failures.length,
  durationMs,
  batchSize,
  source: "import" | "manual" | "create",
});
```

---

## Core Algorithms (Cover Backfill)

### fetchMissingCovers (action) — pseudocode
```
authUser = requireAuthAction(ctx)
limit = clamp(args.limit ?? 20, 1, 50)
targets = await ctx.runQuery(internal.books.listMissingCovers, {
  userId: authUser,
  limit,
  cursor: args.cursor,
  bookIds: args.bookIds,
})

processed = 0; updated = 0; failures = []
for book in targets.items:
  processed++
  res = await ctx.runAction(internal.actions.coverFetch.search, { bookId: book._id })
  if 'error' in res:
    failures.push({ bookId: book._id, reason: res.error })
    continue
  await ctx.db.patch(book._id, {
    apiCoverUrl: res.apiCoverUrl,
    apiSource: res.apiSource,
    updatedAt: Date.now(),
  })
  updated++

return { processed, updated, failures, nextCursor: targets.nextCursor }
```

### listMissingCovers (internal query) — pseudocode
```
if bookIds provided:
  books = await ctx.db.getMany(bookIds)
  ownedMissing = books.filter(b => b?.userId === userId && !b.coverUrl && !b.apiCoverUrl)
  return { items: ownedMissing.slice(0,50) }

page = ctx.db.query("books")
  .withIndex("by_user", q => q.eq("userId", userId))
  .filter(q => q.and(q.eq(q.field("coverUrl"), undefined), q.eq(q.field("apiCoverUrl"), undefined)))
  .paginate({ limit, cursor })
return { items: page.page, nextCursor: page.continueCursor }
```

### Manual bulk loop (client) — pseudocode
```
cursor = undefined
totalProcessed = totalUpdated = 0
do {
  res = await fetchMissingCovers({ cursor, limit: 20 })
  totalProcessed += res.processed; totalUpdated += res.updated
  cursor = res.nextCursor
} while (cursor)
toast(`Updated ${totalUpdated} of ${totalProcessed} books`)
```

---

## File Organization (Cover Backfill)
```
convex/
  books.ts                     # add fetchMissingCovers action export + handler
  internal/books/listMissingCovers.ts  # new internal query (or inline in books.ts internalQuery)
components/book/
  FetchMissingCoversButton.tsx # manual trigger (toolbar/Settings)
  AddBookSheet.tsx             # call backfill post-create when no cover
components/import/ImportFlow.tsx # invoke backfill after commit success
lib/cover/metrics.ts           # optional structured logging helper
```

---

## Integration Points
- **Convex**: new action + internal query; no schema change.
- **Env**: reuses optional `GOOGLE_BOOKS_API_KEY`; new flag `NEXT_PUBLIC_COVER_BACKFILL_ENABLED` (client gate).
- **Routing/UI**: add trigger button to Library toolbar overflow or Settings/Tools; minor UI copy + toast strings.
- **Observability**: reuse `withObservability` for any Next API wrapper (not strictly needed for Convex); structured console logs only; no titles/authors.
- **CI/Lefthook**: ensure new files pass eslint, typecheck, vitest; hook already runs `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test`, `pnpm build:local`.

---

## State Management
- Server state in Convex; client calls action and invalidates book list only if updated? (optional: refetch `api.books.list` after manual bulk or rely on live query updates if subscription active).
- Cursor maintained client-side for manual loop; one batch for create/import suffices.
- Idempotent: reruns skip books once `apiCoverUrl` set.

---

## Error Handling Strategy
- Auth errors bubble (Convex default).
- Per-book failures returned; UI surfaces count, not titles.
- Google Books missing key → `coverFetch` already logs/returns null; treated as failure entry if no OL cover.
- Timeouts (5s) handled inside `coverFetch`; action continues.
- Invalid cursor → treat as empty result (no throw) to avoid trapping users.

---

## Testing Strategy (Cover Backfill)
- **Unit (Convex)**:
  - fetchMissingCovers skips books with coverUrl/apiCoverUrl.
  - Updates apiCoverUrl/apiSource on success.
  - Returns failures when coverFetch returns error.
  - Respects limit cap and cursor passthrough.
  - bookIds scope filters out non-owner IDs.
  - listMissingCovers pagination behavior.
- **Integration**:
  - ImportFlow triggers backfill once; mock action and assert called with createdIds or without.
  - AddBookSheet fires backfill when no cover provided.
  - Manual button loops until no cursor; toasts counts.
- **E2E/UX** (manual/Playwright later):
  - Bulk run does not block UI; progress/toast visible; accessibility (aria-live).
- Coverage: 80%+ new code; branch focus on skip/overwrite rules.

---

## Performance & Security Notes
- Perf: default batch 20, sequential; target <15s; if slow, raise concurrency to 3–5 with per-call timeout unchanged.
- Rate limiting: rely on existing `coverFetch` 5s timeout + Open Library generous limits; monitor failures >10%.
- Security: enforce ownership in query and action; do not log titles/authors/ISBN; secrets untouched.
- Availability: action retry-safe; worst case no-op when already filled.

---

## Alternative Architectures Considered (Cover Backfill)
| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| Server batch writes apiCoverUrl (selected) | Small surface, reuses coverFetch, no schema change | Depends on remote URLs (not cached) | Chosen |
| Client batch uploads to Blob | Permanent copies, nicer caching | Huge bandwidth, exposes tokens client-side, slower | Rejected |
| Scheduler/queue with attempt tracking | Automatic retries, metrics | New infra, complexity not justified | Rejected |

Trigger to revisit: if Open Library reliability drops or users demand offline durability → consider Blob copy + attempt tracking field.

---

## Open Questions / Assumptions (carry from PRD)
- Bulk button placement: Library toolbar overflow vs Settings → Tools.
- Is apiCoverUrl-only acceptable, or must we copy to Blob for permanence?
- Import auto-run: is full scan acceptable, or must we target created IDs (would require commitImport to return IDs)?
- Add `lastCoverFetchAt/attempts` now for backoff, or defer to hardening?
- Expected max library size (sets batch size/progress UX)?
- Enable feature flag (`NEXT_PUBLIC_COVER_BACKFILL_ENABLED`) or always on?

Owners: Product/Eng to confirm before implementation.

---

## Book Search Architecture (Existing)

## Architecture Overview

**Selected Approach**: Convex Action + Client Hook + Integrated Search UI

**Rationale**: Follows existing patterns (`coverFetch.ts`, `useImportJob.ts`), minimal schema changes (none!), clean module boundaries. Open Library API chosen for simplicity (no API key, unlimited, already used for cover fetching).

**Core Modules**:
- **BookSearchAction**: Convex action that calls Open Library API (server-side)
- **useBookSearch Hook**: Client-side state management with debouncing
- **BookSearchInput**: Search input with dropdown results
- **AddBookSheet Integration**: Pre-fills form from search selection

**Data Flow**:
```
User types query → useBookSearch (debounce 300ms)
    → searchBooks action (Convex server)
    → Open Library API (external)
    → Results mapped to BookSearchResult[]
    → UI displays dropdown
    → User selects result
    → Form fields populated
    → books.create mutation (existing)
```

**Key Design Decisions**:
1. **Public action, no auth**: Search is public; anyone can search Open Library
2. **No schema changes**: All needed fields already exist in books table
3. **Direct Open Library cover URLs**: For MVP, store apiCoverUrl directly (vs uploading to Vercel Blob)

---

## Module Design

### Module 1: BookSearchAction (`convex/actions/bookSearch.ts`)

**Responsibility**: Hide Open Library API complexity—URL construction, field mapping, timeout handling, error normalization.

**Public Interface**:
```typescript
// Client-callable action (no auth required)
export const searchBooks = action({
  args: { query: v.string() },
  handler: async (_, { query }): Promise<BookSearchResult[]>
});

// Return type shared with client
export type BookSearchResult = {
  apiId: string;      // "/works/OL893415W"
  title: string;
  author: string;     // Multiple authors joined with ", "
  isbn?: string;      // ISBN-13 preferred
  publishedYear?: number;
  pageCount?: number;
  coverUrl?: string;  // Medium-sized cover URL
};
```

**Internal Implementation** (hidden complexity):
- URL construction with proper query encoding
- Field selection (minimize response size)
- ISBN extraction (prefer 13-digit over 10-digit)
- Cover URL construction from cover_i
- 5-second timeout with AbortSignal
- Error normalization (network errors → user-friendly messages)

**Dependencies**:
- None (standalone action, no database access)

**Data Structures**:
```typescript
// Open Library API response shape (internal)
type OpenLibraryDoc = {
  key: string;
  title?: string;
  author_name?: string[];
  isbn?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
};
```

**Error Handling**:
| Error | Cause | Recovery |
|-------|-------|----------|
| Empty array | Query < 2 chars | No API call, immediate return |
| "Search timed out" | Network delay > 5s | User retries with new query |
| "Search failed" | API error (500, etc) | User retries or falls back to manual |

---

### Module 2: useBookSearch Hook (`hooks/useBookSearch.ts`)

**Responsibility**: Hide state management complexity—debouncing, loading states, error handling, abort on unmount.

**Public Interface**:
```typescript
export function useBookSearch(): UseBookSearchReturn;

export type UseBookSearchReturn = {
  query: string;
  setQuery: (query: string) => void;
  results: BookSearchResult[];
  isLoading: boolean;
  error: string | null;
  clear: () => void;
  isQueryValid: boolean;  // True if query >= 2 chars
};

// Re-export for consumers
export type { BookSearchResult };
```

**Internal Implementation** (hidden complexity):
- Custom `useDebounce` hook (300ms delay)
- Effect cleanup on unmount/query change
- Loading state transitions
- Error state management
- Query validation (minimum length)

**Dependencies**:
- `convex/react` → `useAction`
- `api.actions.bookSearch.searchBooks`

**State Transitions**:
```
idle → typing → (debounce) → loading → results/error → idle
       ↑                                ↓
       ←───────── setQuery ────────────←
       ↑                                ↓
       ←───────── clear() ─────────────←
```

---

### Module 3: BookSearchInput (`components/book/BookSearchInput.tsx`)

**Responsibility**: Hide dropdown/keyboard interaction complexity—focus management, click-outside, ARIA attributes.

**Public Interface**:
```typescript
type BookSearchInputProps = {
  onSelect: (result: BookSearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
};
```

**Internal Implementation** (hidden complexity):
- Keyboard navigation (↑/↓/Enter/Escape)
- Click-outside detection
- Focus management
- ARIA listbox pattern
- Loading/error/empty state rendering

**Dependencies**:
- `useBookSearch` hook
- `BookSearchResultItem` component
- Design tokens (canvas-bone, text-ink, line-ghost)

**Keyboard Bindings**:
| Key | Action |
|-----|--------|
| `↓` | Move highlight down |
| `↑` | Move highlight up |
| `Enter` | Select highlighted |
| `Escape` | Close dropdown |

---

### Module 4: BookSearchResultItem (`components/book/BookSearchResultItem.tsx`)

**Responsibility**: Single result row rendering with consistent layout.

**Public Interface**:
```typescript
type BookSearchResultItemProps = {
  result: BookSearchResult;
  onSelect: (result: BookSearchResult) => void;
  isHighlighted?: boolean;
  index: number;
};
```

**Internal Implementation**:
- Cover thumbnail with placeholder
- Title/author truncation
- Hover/highlight states
- ARIA option attributes

---

### Module 5: AddBookSheet Integration

**Responsibility**: Integrate search into existing form flow.

**Changes Required** (NOT new module, extends existing):

1. **New State Variables**:
```typescript
const [apiId, setApiId] = useState<string | undefined>();
const [apiSource, setApiSource] = useState<"open-library" | "manual">("manual");
const [isbn, setIsbn] = useState("");
const [publishedYear, setPublishedYear] = useState("");
const [pageCount, setPageCount] = useState("");
const [apiCoverUrl, setApiCoverUrl] = useState<string | undefined>();
```

2. **New Handler**:
```typescript
const handleBookSelected = (result: BookSearchResult) => {
  setTitle(result.title);
  setAuthor(result.author);
  setIsbn(result.isbn ?? "");
  setPublishedYear(result.publishedYear?.toString() ?? "");
  setPageCount(result.pageCount?.toString() ?? "");
  setApiId(result.apiId);
  setApiSource("open-library");
  if (result.coverUrl) {
    setCoverPreview(result.coverUrl);
    setApiCoverUrl(result.coverUrl);
  }
};
```

3. **Form Layout Change**: Add search input at top of form, before cover upload.

4. **Submit Update**: Pass new fields to `books.create` mutation.

---

## File Organization

```
convex/
  actions/
    bookSearch.ts          # NEW: Open Library search action (~100 lines)
    coverFetch.ts          # EXISTING: No changes needed

hooks/
  useBookSearch.ts         # NEW: Search hook with debounce (~80 lines)
  use-toast.ts             # EXISTING
  useImportJob.ts          # EXISTING

components/
  book/
    BookSearchInput.tsx       # NEW: Search input + dropdown (~180 lines)
    BookSearchResultItem.tsx  # NEW: Result row component (~60 lines)
    AddBookSheet.tsx          # MODIFY: Add search, ISBN fields
    BookDetail.tsx            # EXISTING
    ...
```

**No Schema Changes**: The books table already has all required fields:
- `isbn: v.optional(v.string())`
- `publishedYear: v.optional(v.number())`
- `pageCount: v.optional(v.number())`
- `apiId: v.optional(v.string())`
- `apiSource: v.optional(v.union(...))`
- `apiCoverUrl: v.optional(v.string())`

---

## Integration Points

### Open Library API

**Search Endpoint**:
```
GET https://openlibrary.org/search.json
  ?q={query}
  &fields=key,title,author_name,isbn,first_publish_year,number_of_pages_median,cover_i
  &limit=10
```

**Cover URL Construction**:
```
https://covers.openlibrary.org/b/id/{cover_i}-M.jpg
```

**Required Header**:
```
User-Agent: bibliomnomnom/1.0 (book tracking app)
```

### Existing Convex Mutations

**books.create** (no changes needed):
```typescript
// Already accepts these fields via baseBookFields:
await createBook({
  title,
  author,
  status,
  coverUrl,          // User-uploaded cover
  apiCoverUrl,       // Open Library cover URL
  apiId,             // "/works/OL893415W"
  apiSource,         // "open-library" | "manual"
  isbn,
  publishedYear,
  pageCount,
  isAudiobook,
  isFavorite,
  dateFinished,
});
```

---

## State Management

**Client State** (React):
- Search query and results (transient, in useBookSearch)
- Form fields (transient, in AddBookSheet)
- Loading/error states

**Server State** (Convex):
- No new state—search results are ephemeral
- Books saved with existing mutation

**State Update Flow**:
```
1. User types "dune" → setQuery("dune")
2. Debounce 300ms → searchBooks action called
3. Results returned → results state updated
4. User clicks result → handleBookSelected
5. Form fields populated → title, author, etc. updated
6. User clicks "Add Book" → books.create mutation
7. Book saved to Convex → UI updates via subscription
```

---

## Error Handling Strategy

**Error Categories**:

| Category | Example | Handling |
|----------|---------|----------|
| Network | Timeout, DNS failure | Show error in dropdown, suggest retry |
| API | 500, rate limit | Show error in dropdown, suggest retry |
| No Results | Query matches nothing | Show "no results" with manual hint |
| Validation | Query too short | Don't search, wait for more input |

**Error Response Format** (from action):
```typescript
// Success: return results array
return results;

// Empty: return empty array (not an error)
return [];

// Failure: throw Error with user-friendly message
throw new Error("Search timed out. Please try again.");
```

---

## Testing Strategy

**Unit Tests** (`convex/actions/bookSearch.test.ts`):
- `extractBestIsbn`: ISBN-13 preferred over ISBN-10
- `buildCoverUrl`: Constructs valid URL from cover_i
- `mapToSearchResult`: Maps OL doc to our type
- Query validation: Empty, short, whitespace queries

**Hook Tests** (`hooks/useBookSearch.test.ts`):
- Debounce behavior: API called once after delay
- Loading states: Transitions correctly
- Error handling: Error state set on failure
- Clear function: Resets all state

**Component Tests** (`components/book/BookSearchInput.test.tsx`):
- Keyboard navigation: ↑/↓/Enter/Escape
- Click handling: Select and close
- Loading/error states: Render correctly
- ARIA attributes: Present and correct

**Integration Tests** (manual QA):
- End-to-end search → select → save flow
- Cover preview from API
- Edit pre-filled fields before save
- Manual entry fallback

---

## Performance Considerations

**Target Metrics**:
- Search response: < 1 second P95
- Debounce delay: 300ms (prevents API spam)
- Results limit: 10 (minimize payload)
- Timeout: 5 seconds (fail fast)

**Optimizations Applied**:
1. **Field Selection**: Only request needed fields from API
2. **Debouncing**: Don't call API on every keystroke
3. **Limit Results**: Max 10 results per search
4. **Lazy Cover Loading**: Next.js Image handles lazy loading
5. **No Caching**: Fresh results each search (API is fast)

---

## Security Considerations

**No Vulnerabilities Introduced**:
1. **No API Key**: Open Library is public
2. **Input Sanitization**: URLSearchParams handles encoding
3. **No PII Logged**: Search queries not stored
4. **XSS Prevention**: React escapes all rendered text
5. **User-Agent Header**: Non-sensitive identification

**Existing Security Maintained**:
- Auth required for book creation (via requireAuth)
- Ownership validation in mutations

---

## Alternative Architectures Considered

### Alternative A: Client-Side Direct API Call

**Description**: Call Open Library directly from browser, no Convex action.

**Pros**:
- One fewer network hop
- No server resources used

**Cons**:
- CORS issues (may require proxy anyway)
- No server-side logging/monitoring
- User-Agent header harder to set

**Verdict**: Rejected — Convex action provides consistent pattern, error handling, and monitoring.

---

### Alternative B: Upload Covers to Vercel Blob

**Description**: When user selects a book, download cover and upload to Vercel Blob (like existing fetchCover flow).

**Pros**:
- Cover URLs never break (we own the storage)
- Consistent with existing cover handling

**Cons**:
- Slower UX (extra upload step)
- More complex implementation
- Storage costs for covers

**Verdict**: Deferred — For MVP, use Open Library URLs directly. Can enhance later if URLs prove unreliable.

---

### Alternative C: Google Books Fallback

**Description**: If Open Library returns no results, try Google Books API.

**Pros**:
- Better coverage for some titles

**Cons**:
- API key required
- Rate limits (1000/day free)
- Adds complexity (two API sources)
- Marginal benefit for MVP

**Verdict**: Rejected for MVP — Revisit if users report coverage issues.

---

## Cover URL Strategy Decision

**Selected**: Store Open Library cover URLs directly in `apiCoverUrl`

**Rationale**:
1. **Simplicity**: No additional upload step
2. **Speed**: Instant preview, no upload delay
3. **Storage**: No Vercel Blob costs for API covers
4. **Existing Field**: `apiCoverUrl` already in schema for this purpose

**Tradeoff**:
- If Open Library changes/removes covers, they break
- Mitigation: `coverUrl` field available if user uploads replacement

**Future Enhancement** (post-MVP):
- Background job to download and re-upload covers to Blob
- Graceful fallback if apiCoverUrl 404s

---

## Implementation Phases

### Phase 1: Backend Action (30 min)
1. Create `convex/actions/bookSearch.ts`
2. Test via Convex dashboard
3. Verify field mapping

### Phase 2: Client Hook (30 min)
1. Create `hooks/useBookSearch.ts`
2. Test debounce in isolation
3. Verify error handling

### Phase 3: UI Components (2 hours)
1. Create `BookSearchResultItem.tsx`
2. Create `BookSearchInput.tsx`
3. Test keyboard navigation
4. Verify accessibility

### Phase 4: Form Integration (1 hour)
1. Add imports to `AddBookSheet.tsx`
2. Add state variables
3. Add `handleBookSelected`
4. Add search input + ISBN field
5. Update submit handler
6. Update reset handler

### Phase 5: QA (1 hour)
1. Manual test all scenarios
2. Screen reader test
3. Mobile viewport test
4. Fix any issues

---

## Appendix: Open Library Field Mapping

| Open Library | BookSearchResult | Notes |
|--------------|------------------|-------|
| `key` | `apiId` | e.g., "/works/OL893415W" |
| `title` | `title` | Fallback: "Unknown Title" |
| `author_name[]` | `author` | Joined with ", " |
| `isbn[]` | `isbn` | ISBN-13 preferred |
| `first_publish_year` | `publishedYear` | Optional |
| `number_of_pages_median` | `pageCount` | Median across editions |
| `cover_i` | `coverUrl` | Transformed to URL |

---

**Last Updated**: 2025-11-29
**Architecture Version**: 1.0
**Status**: Ready for implementation
