# TODO: Open Library Book Search

## Context

- **Architecture**: DESIGN.md — Convex Action + Client Hook + Integrated Search UI
- **Branch**: `feature/open-library-search`
- **Patterns**: `coverFetch.ts` (action), `useImportJob.ts` (hook), `AddBookSheet.tsx` (form)
- **No schema changes required** — all fields already exist

## Implementation Tasks

Tasks are ordered by dependency chain. Tasks 1-4 can be parallelized after task 1 completes.

---

### Task 1: Create Book Search Action ✅

Implement Open Library search API wrapper with testable helper pattern.

```
Files: convex/actions/bookSearch.ts (new), __tests__/convex/actions/bookSearch.test.ts (new)

Architecture: DESIGN.md Module 1 — BookSearchAction
- Public action with no auth (search is public)
- Export BookSearchResult type for client
- Testable helper function pattern (see coverFetch.ts:209-241)

Interface:
  searchBooks(query: string) → BookSearchResult[]

Internal Functions:
  extractBestIsbn(isbns: string[]) → string | undefined
  buildCoverUrl(coverId: number) → string | undefined
  mapToSearchResult(doc: OpenLibraryDoc) → BookSearchResult

Test Cases (from DESIGN.md):
  - Valid query returns results
  - Empty/short/whitespace query returns []
  - ISBN-13 preferred over ISBN-10
  - Cover URL constructed from cover_i
  - Authors joined with ", "
  - Timeout returns user-friendly error
  - API error returns user-friendly error

Success: Action callable from client, returns typed results, tests pass
Dependencies: None
Time: 45min
```

---

### Task 2: Create Book Search Hook ✅

Client-side state management with debouncing.

```
Files: hooks/useBookSearch.ts (new)

Architecture: DESIGN.md Module 2 — useBookSearch Hook
- Custom useDebounce internal (300ms)
- Re-export BookSearchResult type
- Stable function refs with useCallback

Interface:
  useBookSearch() → {
    query, setQuery, results, isLoading, error, clear, isQueryValid
  }

State Transitions (from DESIGN.md):
  idle → typing → (debounce) → loading → results/error → idle

Success: Hook manages search state, debouncing prevents API spam
Test: Manual — type "dune", see results after 300ms delay
Dependencies: Task 1 (searchBooks action)
Time: 30min
```

---

### Task 3: Create Book Search Result Item ✅

Single result row with cover thumbnail, title, author, year.

```
Files: components/book/BookSearchResultItem.tsx (new)

Architecture: DESIGN.md Module 4 — BookSearchResultItem
- Cover thumbnail 40x60px with SVG placeholder
- Title/author truncation
- ARIA option attributes
- Highlight state for keyboard nav

Props:
  result: BookSearchResult
  onSelect: (result) => void
  isHighlighted?: boolean
  index: number

Design Tokens: canvas-boneMuted (hover), text-ink, text-inkMuted, font-display

Success: Renders result with proper layout, hover/highlight states work
Test: Visual QA + keyboard selection
Dependencies: Task 1 (BookSearchResult type)
Time: 30min
```

---

### Task 4: Create Book Search Input ✅

Search input with dropdown, keyboard navigation, accessibility.

```
Files: components/book/BookSearchInput.tsx (new)

Architecture: DESIGN.md Module 3 — BookSearchInput
- Consumes useBookSearch hook
- Keyboard: ↑/↓/Enter/Escape
- Click outside closes dropdown
- ARIA listbox pattern (aria-expanded, aria-activedescendant)
- Loading/error/empty states in dropdown

Props:
  onSelect: (result: BookSearchResult) => void
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean

Icons: Search, X, Loader2 from lucide-react

Success: Full keyboard navigation, accessible dropdown, states render correctly
Test: Manual QA — arrows, enter, escape, click outside, loading spinner
Dependencies: Task 2 (useBookSearch), Task 3 (BookSearchResultItem)
Time: 1hr
```

---

### Task 5: Integrate Search into AddBookSheet ✅

Add search input, new fields, and form handler updates.

```
Files: components/book/AddBookSheet.tsx (modify)

Architecture: DESIGN.md Module 5 — AddBookSheet Integration

Changes:
1. Add import: BookSearchInput, BookSearchResult
2. Add state variables (line ~85):
   - apiId, apiSource, isbn, publishedYear, pageCount, apiCoverUrl
3. Add handleBookSelected handler (line ~160):
   - Set title, author from result
   - Set isbn, publishedYear, pageCount
   - Set apiId, apiSource ("open-library")
   - Set coverPreview from result.coverUrl
4. Add BookSearchInput to form (line ~240):
   - Before cover upload section
   - With "or enter manually" divider
5. Add ISBN field (line ~332):
   - After author field
   - Font mono, placeholder "9780441013593"
6. Update handleSubmit (line ~192):
   - Pass apiSource, apiId, apiCoverUrl, isbn, publishedYear, pageCount
7. Update handleClose (line ~93):
   - Reset all new state variables

Success: Search pre-fills form, all fields save to database correctly
Test: Manual — search "Dune", select, verify all fields populated, save book
Dependencies: Task 4 (BookSearchInput)
Time: 45min
```

---

### Task 6: End-to-End QA

Manual testing of complete flow.

```
Test Scenarios:
  - [ ] Search "Dune" → results with covers appear
  - [ ] Select result → all fields pre-filled
  - [ ] Cover preview shows Open Library image
  - [ ] Can edit title/author after selection
  - [ ] Can change cover after selection
  - [ ] Save book → apiSource is "open-library", apiId saved
  - [ ] Search "xyzabc123" → "no results" message
  - [ ] Manual entry still works (ignore search)
  - [ ] Form resets completely on close
  - [ ] Keyboard navigation works (↑/↓/Enter/Escape)
  - [ ] Screen reader announces dropdown correctly
  - [ ] Mobile viewport renders correctly

Success: All scenarios pass
Dependencies: Task 5
Time: 30min
```

---

## Verification Commands

```bash
# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Run action tests
pnpm vitest run __tests__/convex/actions/bookSearch.test.ts

# Dev server for manual QA
pnpm dev
```

---

## Notes

- **No schema changes** — `isbn`, `publishedYear`, `pageCount`, `apiId`, `apiSource`, `apiCoverUrl` already exist in books table
- **No mutation changes** — `books.create` already accepts all fields via `baseBookFields`
- **Cover URL strategy** — Store Open Library URLs directly in `apiCoverUrl` (not uploading to Blob for MVP)
- **Pattern reference** — `coverFetch.ts` for action structure, `useImportJob.ts` for hook patterns
