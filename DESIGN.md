# DESIGN.md — Open Library Book Search Architecture

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
