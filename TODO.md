# TODO: Fetch Cover Image for Single Book

## Context
- **Architecture**: Convex Action with cascading API fallback (Open Library → Google Books)
- **Key Files**: `convex/actions/coverFetch.ts` (new), `convex/books.ts` (modify), `components/book/FetchCoverButton.tsx` (new)
- **Patterns**: Follow `convex/imports.ts` action pattern, reuse `app/api/blob/upload/route.ts` for blob storage
- **Reference**: TASK.md lines 82-102 (Module Boundaries), lines 229-264 (Implementation Notes)

## Implementation Tasks

### Module 1: Cover Fetch Action

- [x] Create Convex action to search book cover APIs
  ```
  Files: convex/actions/coverFetch.ts (new)
  Architecture: Action calls Open Library → Google Books with cascading fallback
  Interface: internal.actions.coverFetch.search({ bookId }) → { coverDataUrl, apiSource } | { error }

  Pseudocode:
    1. Get book from database by bookId
    2. Extract ISBN, title, author from book
    3. Try Open Library:
       - Fetch https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data
       - Extract cover.large or cover.medium URL
       - If found: fetch image, convert to data URL, return { coverDataUrl, apiSource: "open-library" }
    4. If Open Library fails, try Google Books (if GOOGLE_BOOKS_API_KEY set):
       - Fetch https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}&key={apiKey}
       - Extract volumeInfo.imageLinks.large or .thumbnail
       - If found: fetch image, convert to data URL, return { coverDataUrl, apiSource: "google-books" }
    5. If both fail: return { error: "Cover not found" }
    6. Handle timeouts (5 second max per API)

  Success: Action returns cover data URL for books with valid ISBN
  Test:
    - Unit: Mock fetch calls, verify cascading fallback logic
    - Integration: Real API calls with known ISBNs (978-0-547-92822-7 LOTR, 978-0-7432-7356-5 1984)
    - Edge: No ISBN → error, invalid ISBN → error, both APIs down → error

  Dependencies: None (first task - enables cover fetching)
  Time: 90min

  Module Value: High functionality (handles 2 APIs, timeouts, conversions) - Simple interface (one function, clean return type)
  Information Hiding: Caller doesn't know about API endpoints, retry logic, image format conversion
  ```

### Module 2: Cover Update Mutation

- [x] Add mutation to update book with fetched cover
  ```
  Files: convex/books.ts (modify - add new mutation)
  Architecture: Mutation validates ownership, updates coverUrl + apiSource + apiCoverUrl
  Interface: books.updateCoverFromBlob({ bookId, blobUrl, apiSource, apiCoverUrl }) → void

  Pseudocode:
    1. userId = await requireAuth(ctx)
    2. book = await ctx.db.get(bookId)
    3. if (!book || book.userId !== userId) throw "Access denied"
    4. await ctx.db.patch(bookId, {
         coverUrl: blobUrl,
         apiSource: apiSource,
         apiCoverUrl: apiCoverUrl,
         updatedAt: Date.now()
       })

  Success: Book updated with blob URL, ownership validated
  Test:
    - Unit: Verify ownership validation, field updates
    - Integration: Update real book, verify Convex reactivity updates UI
    - Edge: Non-owner tries update → error, book doesn't exist → error

  Dependencies: None (independent mutation)
  Time: 30min

  Module Value: High functionality (ownership, validation, reactivity) - Simple interface (4 args, void return)
  Information Hiding: Caller doesn't know about ownership checks, database patching, timestamp updates
  ```

### Module 3: Orchestration Mutation

- [x] Add mutation to orchestrate cover fetch flow
  ```
  Files: convex/books.ts (modify - add new mutation)
  Architecture: Mutation calls action via scheduler, waits for result, returns to client
  Interface: books.fetchCover({ bookId }) → { success: true, coverUrl } | { success: false, error }

  Pseudocode:
    1. userId = await requireAuth(ctx)
    2. book = await ctx.db.get(bookId)
    3. if (!book || book.userId !== userId) throw "Access denied"
    4. if (book.coverUrl) return { success: false, error: "Book already has cover" }
    5. result = await ctx.scheduler.runAfter(0, internal.actions.coverFetch.search, { bookId })
    6. if (result.error) return { success: false, error: result.error }
    7. return { success: true, coverDataUrl: result.coverDataUrl, apiSource: result.apiSource }

  Success: Returns cover data URL for client-side blob upload
  Test:
    - Unit: Mock action response, verify error handling
    - Integration: Full flow with real action call
    - Edge: Book already has cover → skip, action fails → propagate error

  Dependencies: Module 1 (Cover Fetch Action)
  Time: 45min

  Module Value: High functionality (orchestrates async action, error handling) - Simple interface (bookId in, result out)
  Information Hiding: Caller doesn't know about scheduler, action internals, validation logic
  ```

### Module 4: UI Component

- [x] Build FetchCoverButton component
  ```
  Files: components/book/FetchCoverButton.tsx (new)
  Architecture: Button component with loading states, calls mutation + blob upload
  Interface: <FetchCoverButton bookId={Id<"books">} onSuccess={() => void} />

  Pseudocode:
    1. const [isLoading, setIsLoading] = useState(false)
    2. const fetchCover = useMutation(api.books.fetchCover)
    3. const updateCoverFromBlob = useMutation(api.books.updateCoverFromBlob)
    4. const { toast } = useToast()
    5.
    6. async function handleFetch():
    7.   setIsLoading(true)
    8.   try:
    9.     result = await fetchCover({ bookId })
    10.    if (!result.success):
    11.      toast.error(result.error)
    12.      return
    13.
    14.    // Convert data URL to Blob
    15.    blob = dataURLtoBlob(result.coverDataUrl)
    16.
    17.    // Upload to Vercel Blob (reuse pattern from AddBookSheet.tsx:189-220)
    18.    uploadResponse = await upload(`covers/${bookId}.jpg`, blob, {
    19.      access: 'public',
    20.      handleUploadUrl: '/api/blob/upload'
    21.    })
    22.
    23.    // Update book with blob URL
    24.    await updateCoverFromBlob({
    25.      bookId,
    26.      blobUrl: uploadResponse.url,
    27.      apiSource: result.apiSource,
    28.      apiCoverUrl: result.apiCoverUrl
    29.    })
    30.
    31.    toast.success("Cover found and saved")
    32.    onSuccess?.()
    33.  catch (error):
    34.    toast.error("Failed to fetch cover")
    35.  finally:
    36.    setIsLoading(false)
    37.
    38.  return (
    39.    <Button onClick={handleFetch} disabled={isLoading}>
    40.      {isLoading ? "Fetching cover..." : "Fetch Cover"}
    41.    </Button>
    42.  )

  Success: Button triggers fetch, uploads to blob, updates book, shows toast
  Test:
    - Manual: Click button on book without cover → cover appears
    - Integration: Mock mutations, verify upload flow
    - Edge: Upload fails → show error, mutation fails → show error

  Dependencies: Module 2 (Cover Update Mutation), Module 3 (Orchestration Mutation)
  Time: 60min

  Module Value: High functionality (loading states, error handling, blob upload, toasts) - Simple interface (2 props)
  Information Hiding: Parent doesn't know about mutations, blob upload, data URL conversion
  ```

### Module 5: Integration

- [x] Add FetchCoverButton to BookDetail page
  ```
  Files: components/book/BookDetail.tsx (modify)
  Architecture: Conditionally render button if no coverUrl

  Pseudocode:
    1. Import FetchCoverButton
    2. In render, after cover image section:
       {!book.coverUrl && (
         <FetchCoverButton
           bookId={book._id}
           onSuccess={() => {
             // Convex reactivity will auto-update book
           }}
         />
       )}

  Success: Button appears on books without covers, hidden if cover exists
  Test:
    - Manual: View book without cover → button visible, with cover → button hidden
    - Integration: Click button → cover fetched → button disappears

  Dependencies: Module 4 (UI Component)
  Time: 15min

  Module Value: Simple integration - Clean conditional render
  ```

### Module 6: Testing

- [ ] Write tests for cover fetch action
  ```
  Files: __tests__/convex/actions/coverFetch.test.ts (new)
  Architecture: Unit tests with mocked fetch, integration tests with real APIs

  Test Cases:
    1. Open Library success (ISBN found)
    2. Open Library fallback to Google Books
    3. Both APIs fail (return error)
    4. Invalid ISBN format
    5. Network timeout (5 second limit)
    6. API returns non-image content type

  Success: All test cases pass, 80%+ code coverage
  Dependencies: Module 1 (Cover Fetch Action)
  Time: 45min
  ```

- [ ] Write tests for cover update mutation
  ```
  Files: __tests__/convex/books.test.ts (modify or new)
  Architecture: Unit tests with Convex test helpers

  Test Cases:
    1. Authorized user updates cover
    2. Unauthorized user blocked
    3. Book doesn't exist → null return
    4. All fields updated correctly (coverUrl, apiSource, apiCoverUrl, updatedAt)

  Success: All test cases pass, ownership validation verified
  Dependencies: Module 2 (Cover Update Mutation)
  Time: 30min
  ```

## Environment Setup

- [ ] Configure Google Books API key (optional fallback)
  ```
  Command: npx convex env set GOOGLE_BOOKS_API_KEY "your-key-here"
  Files: .env.example (document), README.md (update environment variables section)
  Success: Key available in Convex actions via process.env.GOOGLE_BOOKS_API_KEY
  Note: Open Library doesn't require API key (unlimited via Cover ID pattern)
  Time: 10min
  ```

## Documentation

- [ ] Update README with cover fetching feature
  ```
  Files: README.md (modify - add to Features section)
  Content:
    - One-click cover fetching from Open Library and Google Books
    - Automatic fallback if primary API unavailable
    - Optional: Google Books API key for fallback (GOOGLE_BOOKS_API_KEY)

  Success: README documents feature and optional environment variable
  Time: 10min
  ```

## Total Estimated Time
- Module 1 (Action): 90min
- Module 2 (Mutation): 30min
- Module 3 (Orchestration): 45min
- Module 4 (Component): 60min
- Module 5 (Integration): 15min
- Module 6 (Testing): 75min
- Environment: 10min
- Documentation: 10min

**Total: 5.5 hours** (within 4-6 hour estimate from TASK.md)

## Success Criteria
- ✅ User can click "Fetch Cover" on book without cover
- ✅ Cover fetched from Open Library or Google Books in <2 seconds
- ✅ Cover uploaded to Vercel Blob and displayed on book
- ✅ Error messages shown for failures (not found, network error, etc.)
- ✅ Tests pass for action, mutation, and integration flows
- ✅ 80%+ success rate for books with valid ISBNs

## Module Boundaries Validation
✅ **Cover Fetch Action**: Simple interface (bookId in, cover data out), hides API complexity, cascading fallback, timeout handling
✅ **Cover Update Mutation**: Simple interface (4 args), hides ownership validation, database operations
✅ **Orchestration Mutation**: Simple interface (bookId in, result out), hides scheduler, action coordination
✅ **UI Component**: Simple props (bookId, onSuccess), hides loading states, error handling, blob upload, mutations

Each module has **high functionality** (many internal concerns) with **simple interface** (few external touchpoints) = **Deep Modules**.

## Future Features (Not in This TODO)
- Bulk fetch all missing covers (separate feature)
- Auto-fetch during import (integrate after bulk proven)
- AI cover generation with Gemini (much larger feature)
