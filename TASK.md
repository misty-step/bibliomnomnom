# Feature: Fetch Cover Image for Single Book

## Executive Summary

Add a "Fetch Cover" button to books without cover images that automatically searches Open Library and Google Books APIs for the book's cover. This enables users to quickly find official cover art for manually-added books or imports missing covers. Free to operate, simple implementation, immediate user value.

**User Value**: Users can find professional cover images with one click instead of manually searching and uploading
**Success Criteria**: 80%+ of books with ISBNs successfully fetch covers; <2 second response time

## User Context

**Who**: Users managing their book library who want professional cover art
**Problem**: Manually searching for and uploading book covers is tedious and time-consuming
**Current State**: Users can upload covers manually, but many books lack cover images
**Desired State**: One-click cover fetching for books without covers

## Requirements

### Functional Requirements

1. **Single Book Cover Fetch**
   - "Fetch Cover" button visible only on books without `coverUrl`
   - Button triggers search across Open Library → Google Books APIs
   - Success: Cover image saved to Vercel Blob, `coverUrl` updated
   - Failure: User-friendly error message with reason (no ISBN, not found, API error)

2. **Search Strategy**
   - **Priority 1**: Open Library Covers API (unlimited, free)
     - Fetch by ISBN if available
     - Fall back to title+author search if no ISBN
   - **Priority 2**: Google Books API (1000/day free tier)
     - Fetch by ISBN if available
     - Fall back to title+author search if no ISBN
   - **Fallback**: Show error message if both APIs fail

3. **Cover Storage**
   - Upload fetched cover to Vercel Blob
   - Update book's `coverUrl` field
   - Set `apiSource` to "open-library" or "google-books"
   - Store original API URL in `apiCoverUrl` for reference

4. **User Feedback**
   - Loading state: "Fetching cover..." (max 2 seconds)
   - Success toast: "Cover found and saved"
   - Error toast: "Cover not found. Try uploading manually."
   - Optimistic UI: Show fetched cover immediately

### Non-Functional Requirements

- **Performance**: <2 second fetch time (parallel API calls)
- **Reliability**: Graceful fallback if APIs fail (don't break book display)
- **Cost**: $0 (Open Library unlimited, Google Books 1000/day free)
- **Rate Limiting**: No user-facing limits (APIs are generous)

## Architecture Decision

### Selected Approach: Convex Action with Cascading API Fallback

**Rationale**:
- **Convex Actions** handle external API calls (Open Library, Google Books)
- **Cascading fallback** maximizes success rate (try multiple APIs sequentially)
- **Vercel Blob storage** for permanent hosting (avoid external URL dependencies)
- **Client-side upload** pattern already established (reuse existing blob upload route)

**Why This Approach**:
- **Simplicity**: Reuses existing Vercel Blob upload pattern from AddBookSheet
- **User Value**: 80%+ success rate with dual API fallback
- **Explicitness**: Clear separation (Convex action fetches, client uploads to blob)
- **Cost**: Free for expected usage (<1000 fetches/day)

### Alternatives Considered

| Approach | User Value | Simplicity | Cost | Why Not Chosen |
|----------|-----------|-----------|------|----------------|
| **Open Library Only** | Medium (60% success) | High | Free | Lower success rate, no fallback |
| **Google Books Only** | Medium (70% success) | High | Free | Rate limits more restrictive |
| **Store External URLs** | High | Very High | Free | External dependency, broken links over time |
| **Next.js API Route** | High | Medium | Free | Less elegant than Convex actions, duplicate auth logic |

### Module Boundaries

**Module 1: Cover Fetch Action** (`convex/actions/coverFetch.ts`)
- **Interface**: `fetchBookCover(bookId)` → returns cover data URL or error
- **Responsibility**: Query Open Library → Google Books, return best cover
- **Hidden Complexity**: API error handling, retry logic, timeout management

**Module 2: Cover Upload Mutation** (`convex/books.ts`)
- **Interface**: `updateCoverFromBlob(bookId, blobUrl)` → updates book
- **Responsibility**: Validate ownership, update coverUrl + apiSource fields
- **Hidden Complexity**: Ownership validation, optimistic update rollback

**Module 3: UI Component** (`components/book/FetchCoverButton.tsx`)
- **Interface**: `<FetchCoverButton bookId={...} />` → button with loading state
- **Responsibility**: Trigger action, upload to blob, show toast feedback
- **Hidden Complexity**: Loading states, error handling, optimistic updates

**Abstraction Layers**:
- **Layer 1 (UI)**: "Fetch Cover" button → user intent
- **Layer 2 (Convex)**: Book data operations → mutations + actions
- **Layer 3 (External)**: Cover image APIs → HTTP calls

Each layer changes vocabulary: UI speaks "fetch cover", Convex speaks "search APIs", HTTP speaks "GET /covers/{isbn}"

## Dependencies & Assumptions

**External Dependencies**:
- Open Library Covers API (free, unlimited via Cover ID)
- Google Books API (free, 1000 requests/day)
- Vercel Blob (existing, already configured)

**Assumptions**:
- Users own books they're fetching covers for (enforced by `requireAuth`)
- Most books have ISBN or accurate title+author (80% match rate)
- External APIs remain available (graceful degradation if down)
- 1000 fetches/day is sufficient for single-user operations

**Environment Requirements**:
- `GOOGLE_BOOKS_API_KEY` in Convex environment variables (optional, fallback only)
- `BLOB_READ_WRITE_TOKEN` already configured for Vercel Blob uploads

## Implementation Phases

### Phase 1: MVP (This Feature)
**Scope**: Single book cover fetch with manual trigger
**Deliverables**:
- Convex action for Open Library + Google Books search
- Mutation to update book with blob URL
- "Fetch Cover" button on book detail page
- Toast notifications for success/error
**Timeline**: 4-6 hours
**Success Metric**: User can fetch cover for book with ISBN in <2 seconds

### Phase 2: Bulk Fetch (Future Feature)
**Scope**: "Fetch All Missing Covers" button for entire library
**Deferred**: Not in this spec, separate feature after MVP proven

### Phase 3: Import Integration (Future Feature)
**Scope**: Automatically fetch covers during book import flow
**Deferred**: Not in this spec, integrate after bulk fetch working

### Phase 4: AI Generation (Future Feature)
**Scope**: Gemini-powered cover generation for books without API matches
**Deferred**: Not in this spec, much larger feature

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **API rate limits hit** | Low | Medium | Open Library unlimited, Google Books 1000/day sufficient for MVP |
| **Cover not found** | Medium | Low | Clear error message, suggest manual upload |
| **API timeout** | Low | Medium | 5-second timeout, fall back to next API |
| **Vercel Blob upload fails** | Low | High | Show error toast, allow retry |
| **Wrong cover matched** | Medium | Medium | Store original API URL in `apiCoverUrl` for manual review |

## Key Decisions

### Decision 1: Convex Action vs Next.js API Route
**Choice**: Convex Action
**Alternatives**: Next.js API route, client-side fetch (CORS issues)
**Rationale**:
- Convex actions already used for external APIs (imports)
- Built-in auth context, no duplicate JWT validation
- Simpler error handling and retry logic
**Tradeoffs**: Slight learning curve if team unfamiliar with actions

### Decision 2: Store Blob URL vs External API URL
**Choice**: Upload to Vercel Blob, store blob URL
**Alternatives**: Store external Open Library/Google Books URLs directly
**Rationale**:
- Permanent hosting (external URLs may break)
- Consistent with user uploads (all covers in same storage)
- Next.js Image optimization works better with Vercel Blob
**Tradeoffs**: Slight storage cost (~$0.01/month per 100 covers), extra upload step

### Decision 3: Button Placement
**Choice**: Book detail page only (not on grid tiles)
**Alternatives**: Grid tiles, library page bulk action
**Rationale**:
- Reduces UI clutter on grid (tiles are compact)
- Detail page has space for button + loading state
- Bulk operation is separate future feature
**Tradeoffs**: Requires navigating to book detail to fetch cover

## Test Scenarios

### Happy Path
1. User views book without cover (no `coverUrl`)
2. User clicks "Fetch Cover" button
3. Action searches Open Library by ISBN
4. Cover found, uploaded to Vercel Blob
5. Book updated with `coverUrl` + `apiSource: "open-library"`
6. Success toast shown, cover displays immediately

### Edge Cases
1. **No ISBN**: Search by title+author, may have lower accuracy
2. **ISBN not found on Open Library**: Fall back to Google Books
3. **Both APIs fail**: Show error toast with suggestion to upload manually
4. **API timeout**: 5-second timeout, show error message
5. **Vercel Blob upload fails**: Show error toast, allow retry
6. **User doesn't own book**: Mutation fails with "Access denied"

### Error Conditions
1. **Rate limit exceeded**: Show "Try again later" message (unlikely with 1000/day)
2. **Network error**: Show generic error, suggest checking connection
3. **Invalid ISBN format**: Clean and retry, fall back to title+author
4. **Duplicate fetch**: Optimistic update prevents double-fetch

## Quality Validation

### Deep Modules Check
✅ **Cover Fetch Action**: Simple interface (`fetchBookCover(bookId)`), hides API complexity, retry logic, timeout handling
✅ **Cover Update Mutation**: Simple interface (`updateCoverFromBlob(bookId, url)`), hides ownership validation
✅ **UI Component**: Simple props (`bookId`), hides loading states, error handling, blob upload

### Information Hiding Check
✅ **API details hidden**: Callers don't know about Open Library vs Google Books
✅ **Storage hidden**: Callers don't know covers stored in Vercel Blob vs direct URLs
✅ **Auth hidden**: Component doesn't handle ownership validation, mutation does

### Abstraction Layers Check
✅ **Layer 1 (UI)**: User clicks "Fetch Cover" button
✅ **Layer 2 (Convex)**: Action searches APIs, mutation updates database
✅ **Layer 3 (External)**: HTTP calls to Open Library/Google Books

Each layer transforms concepts: UI = user action, Convex = data operation, HTTP = API request

## Implementation Notes

### API Integration Pattern

**Open Library Cover Fetch** (ISBN):
```
GET https://covers.openlibrary.org/b/isbn/{ISBN}-L.jpg
```

**Open Library Cover Fetch** (via Book API for unlimited access):
```
GET https://openlibrary.org/api/books?bibkeys=ISBN:{ISBN}&format=json&jscmd=data
→ Extract cover ID → https://covers.openlibrary.org/b/id/{COVER_ID}-L.jpg
```

**Google Books API** (fallback):
```
GET https://www.googleapis.com/books/v1/volumes?q=isbn:{ISBN}&key={API_KEY}
→ Extract imageLinks.thumbnail or imageLinks.large
```

### Data Flow
1. User clicks "Fetch Cover" → `useMutation(api.books.fetchCover)`
2. Mutation calls `ctx.scheduler.runAfter(0, internal.actions.coverFetch.search, { bookId })`
3. Action searches Open Library by ISBN
4. If found: Return data URL (base64)
5. If not found: Search Google Books by ISBN
6. If found: Return data URL
7. If not found: Return error
8. Client receives data URL → uploads to Vercel Blob via `/api/blob/upload`
9. Client calls `updateCoverFromBlob(bookId, blobUrl)`
10. Book updated, UI refreshes

### Existing Code to Reuse
- Vercel Blob upload route: `app/api/blob/upload/route.ts`
- Book ownership validation: `convex/books.ts` (requireAuth pattern)
- Toast notifications: `useToast` hook
- Image display: `Next.js Image` component with Vercel Blob domains

---

## Next Steps

After writing this spec, run `/architect` to break down into implementation tasks:
1. Create Convex action for API search
2. Add mutation for updating book with blob URL
3. Build FetchCoverButton component
4. Wire up to book detail page
5. Test with various ISBNs (found, not found, no ISBN)
6. Document API key setup in README

**Future Features** (separate specs):
- Feature #2: Bulk fetch all missing covers
- Feature #3: Auto-fetch during import
- Feature #4: AI cover generation with Gemini
