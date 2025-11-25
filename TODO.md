- [x] Add delete book functionality
  ```
  Files:
  - components/book/BookDetail.tsx:28-35 (add delete mutation + state)
  - components/book/BookDetail.tsx:289-379 (add delete button in action row)
  - components/ui/alert-dialog.tsx (NEW FILE - install shadcn component)

  Pattern: Follow NoteCard.tsx:67-76 delete implementation, but replace native confirm()
  with custom AlertDialog (per BACKLOG.md:1010 UX requirement)

  Approach:
  1. Install shadcn AlertDialog component
     npx shadcn@latest add alert-dialog

  2. Import dependencies in BookDetail.tsx
     - useRouter from next/navigation (for redirect after delete)
     - Trash2 from lucide-react (delete icon)
     - AlertDialog components from @/components/ui/alert-dialog

  3. Add delete mutation and state (after line 34)
     const removeBook = useMutation(api.books.remove);
     const router = useRouter();
     const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  4. Query note count for confirmation message
     const notes = useAuthedQuery(api.notes.list, { bookId: book._id });
     const noteCount = notes?.length ?? 0;

  5. Implement delete handler
     - Call removeBook({ id: book._id })
     - Show success toast
     - router.push("/library") to redirect
     - Error handling with destructive toast

  6. Add delete button in action row (after privacy toggle, line ~340)
     - AlertDialog trigger with Trash2 icon
     - Show book title and note count in confirmation
     - "Delete Forever" destructive action button
     - Cancel button to close without deleting

  Success Criteria:
  - [x] Delete button appears in BookDetail action row
  - [x] Clicking delete shows AlertDialog with book title and note count
  - [x] Confirming delete removes book and redirects to /library
  - [x] Toast notification confirms deletion
  - [x] Canceling closes dialog without deleting
  - [x] Error handling shows toast on failure

  Edge Cases:
  - Book with 0 notes → "permanently delete this book"
  - Book with 1 note → "1 note" (singular)
  - Book with multiple notes → "N notes" (plural)
  - Network failure → toast error, book not deleted

  Dependencies:
  - Convex api.books.remove mutation exists ✅ (convex/books.ts:207)
  - shadcn AlertDialog component (must install first)

  NOT in Scope:
  - Soft delete / trash functionality
  - Batch delete multiple books
  - Cascade delete notes (backend handles automatically)
  - Undo delete

  Estimate: 45m
  ```

- [x] Show title + author for books without covers
  ```
  Files:
  - components/book/BookTile.tsx:67-71 (replace single letter with title/author)
  - components/book/BookDetail.tsx:225-228 (same pattern for detail page)

  Pattern: Reuse existing hover state layout (BookTile.tsx:75-98) but make it
  the default when no cover exists

  Context: With 400 books uploaded and no covers, single-letter fallback creates
  wall of indistinguishable "D D D T T M M" blocks. Title + author makes books
  scannable and identifiable.

  Approach:
  1. BookTile.tsx - Replace single letter fallback (lines 67-71)
     - Show title (font-display, text-lg, line-clamp-5)
     - Show author (font-mono, text-xs uppercase, line-clamp-2)
     - Show year at bottom if available (font-mono, text-xs)
     - Background: bg-canvas-bone with border-line-ghost/50
     - Spacing: p-5, justify-between flex layout

  2. BookDetail.tsx - Same pattern for detail cover (lines 225-228)
     - Larger text sizes (text-2xl for title, text-sm for author)
     - More padding (p-8 instead of p-5)
     - Same structure: title > author > year (optional)

  Success Criteria:
  - [x] Books without covers show title + author instead of single letter
  - [x] Text is readable and properly sized (lg for tiles, 2xl for detail)
  - [x] Layout matches bibliophile aesthetic (serif title, mono author)
  - [x] Published year shows at bottom if available
  - [x] Hover state still works on tiles (index card overlay)
  - [x] Visual hierarchy clear: title > author > year

  Edge Cases:
  - Very long titles (100+ chars) → line-clamp-5 truncation
  - Missing author → show title only
  - Missing year → hide bottom section
  - Title + author both long → flex layout handles proportional spacing

  Design Tokens:
  - Background: bg-canvas-bone
  - Border: border-line-ghost/50
  - Title: font-display text-text-ink (Crimson Text serif)
  - Author: font-mono text-text-inkMuted (JetBrains Mono uppercase)
  - Year: font-mono text-text-inkSubtle

  NOT in Scope:
  - AI-generated covers (future feature)
  - Fetching covers from external API (future feature)
  - Gradient/color variations per book

  Estimate: 30m
  ```

---

## Import Feature: Testability Refactoring

**Context**: Current import tests fail due to tight coupling between business logic and Convex database layer. Tests require elaborate mocking of Convex query chains (`.eq().eq()`) and environment variables. This refactoring extracts pure business logic, enables dependency injection, and creates clear module boundaries.

**Architectural Goal**: Transform shallow, leaky modules into deep modules with simple interfaces hiding complex implementations. Follow Ousterhout's principles: manage complexity through information hiding, not distribution.

**Success Metrics**:
- Import core logic testable with plain arrays (no database mocking)
- All 6 failing tests pass with stable, maintainable test code
- LLM extraction testable without environment variable manipulation
- Repository pattern enables in-memory testing (10-100x faster)

---

### Phase 1: Unblock Tests (Critical Path)

- [x] Extract pure book matching function
  ```
  Files:
  - lib/import/dedup/core.ts (NEW FILE - pure matching logic)
  - lib/import/dedup/repository.ts (NEW FILE - database layer)
  - lib/import/dedup.ts (MODIFY - thin wrapper for backward compatibility)
  - __tests__/import/dedup.test.ts (UPDATE - use pure functions)

  Problem: Current `findMatches` couples business logic with Convex query API,
  requiring brittle mocks that chain `.eq().eq()`. Separation enables testing
  with plain arrays.

  Approach:
  1. Create lib/import/dedup/core.ts with pure matching function:
     export const matchBooks = (
       existingBooks: Doc<"books">[],     // Plain array input
       incomingRows: ParsedBook[]
     ): Match[] => {
       // Current logic from findMatches (lines 40-100)
       // Build isbnMap, titleAuthorMap, apiIdMap from array
       // Return matches WITHOUT any database calls
     }

  2. Create lib/import/dedup/repository.ts for database access:
     export const fetchUserBooks = async (
       db: DatabaseReader,
       userId: Id<"users">
     ): Promise<Doc<"books">[]> => {
       return await db
         .query("books")
         .withIndex("by_user", (q) => q.eq("userId", userId))
         .collect();
     }

  3. Update lib/import/dedup.ts to use new functions:
     export const findMatches = async (
       db: DbReader,
       userId: Id<"users">,
       rows: ParsedBook[]
     ): Promise<Match[]> => {
       const books = await fetchUserBooks(db, userId);
       return matchBooks(books, rows);  // Delegate to pure function
     }

  4. Update __tests__/import/dedup.test.ts:
     - Remove makeDb mock function (lines 64-74)
     - Import matchBooks from lib/import/dedup/core
     - Test with plain Doc<"books">[] arrays
     - Example: matchBooks([book({ isbn: "123" })], [incoming({ isbn: "123" })])

  Success criteria: Tests pass without mocking Convex query chains. matchBooks
  function takes arrays, returns matches, has zero database dependencies.

  Edge Cases:
  - Empty existingBooks array → returns empty matches
  - Duplicate ISBNs in existing books → first match wins (Map behavior)
  - Multiple match types for same book → ISBN priority (early return in forEach)
  - Null/undefined userId → handled by repository layer, not core

  Deep Module Contract:
  - Interface: matchBooks(books[], rows[]) => Match[]
  - Hides: Map construction, normalization, priority logic, confidence scoring
  - Exposes: Only matching results with tempId + existingBookId + type + confidence

  NOT in Scope:
  - Changing matching priority algorithm (ISBN > title-author > apiId)
  - Adding new match types (e.g., publisher, series)
  - Performance optimization (current O(n*m) acceptable for <1000 books)
  - Fuzzy matching for titles

  Dependencies:
  - Existing normalization functions (normalizeIsbn, normalizeTitleAuthorKey, normalizeApiId)
  - Type definitions (Match, ParsedBook, Doc<"books">)

  Estimate: 2.5h
  ```

- [x] Inject LLM providers at action boundary
  ```
  Files:
  - convex/imports.ts:114-145 (UPDATE extractBooks action)
  - __tests__/import/llm.test.ts (UPDATE - remove env mocking)

  Problem: LLM providers created from process.env inside business logic, making
  extraction logic untestable without environment manipulation. Move provider
  construction to action boundary, pass as dependency.

  Context: lib/import/llm.ts already supports provider injection via opts parameter.
  Action currently creates providers internally (lines 115-132). Tests must mock
  process.env, which is brittle and slow.

  Approach:
  1. Update convex/imports.ts extractBooks action (lines 114-145):
     - Keep environment variable access at top of action handler
     - Create providers using existing factory functions
     - Pass providers to llmExtract via opts parameter
     - Remove any provider creation from lower layers

     handler: async (ctx, args) => {
       const openaiKey = process.env.OPENAI_API_KEY;
       const geminiKey = process.env.GEMINI_API_KEY;

       if (!openaiKey && !geminiKey) {
         return { books: [], warnings: [], errors: [{ message: "No provider..." }] };
       }

       const provider = openaiKey ? createOpenAIProvider(openaiKey) : undefined;
       const fallbackProvider = geminiKey ? createGeminiProvider(geminiKey) : undefined;

       const llmResult = await llmExtract(args.rawText, {
         tokenCap: LLM_TOKEN_CAP,
         provider,              // Injected dependency
         fallbackProvider,      // Injected dependency
       });

       return { books: llmResult.rows, warnings: llmResult.warnings, errors: llmResult.errors };
     }

  2. Update __tests__/import/llm.test.ts:
     - Remove all process.env mocking
     - Import makeStaticProvider from lib/import/llm
     - Pass mock provider directly to llmExtract
     - Example: llmExtract(text, { provider: makeStaticProvider({ books: [...] }) })

  Success criteria: llmExtract function accepts provider via opts, never accesses
  process.env. Tests pass makeStaticProvider without environment setup. Action is
  only layer that reads OPENAI_API_KEY and GEMINI_API_KEY.

  Edge Cases:
  - Both providers undefined → error handled at action boundary, not in llmExtract
  - Primary provider fails → fallback provider used (existing logic)
  - Both providers fail → return errors array (existing logic)
  - Provider returns empty response → handled by parseModelJson (existing)

  Information Hiding:
  - llmExtract core knows nothing about OpenAI, Gemini, or environment variables
  - Provider interface abstracts all LLM implementation details
  - Action layer handles infrastructure concerns (env vars, provider construction)
  - Business logic remains pure: text + provider => parsed books

  NOT in Scope:
  - Adding new LLM providers (Anthropic, Cohere, etc.)
  - Retry logic for failed provider calls
  - Provider response caching
  - Token usage tracking improvements

  Dependencies:
  - Existing LlmProvider interface (lib/import/llm.ts:15-18)
  - Existing makeStaticProvider function (lib/import/llm.ts:274-277)
  - Existing createOpenAIProvider, createGeminiProvider (lib/import/llm.ts:280-333)

  Estimate: 1h
  ```

- [x] Fix empty string ISBN normalization in Goodreads parser
  ```
  Files:
  - lib/import/client/goodreads.ts:175-177 (UPDATE ISBN handling)
  - __tests__/import/goodreads.test.ts (UPDATE - verify empty ISBN → undefined)

  Problem: getValue returns empty string "" when CSV column is empty, but
  normalizeIsbn doesn't convert "" to undefined. This breaks dedup matching
  which expects undefined for missing ISBNs.

  Root Cause: getValue returns row[column] ?? undefined, but row[column] is ""
  for empty CSV cells, not null/undefined. normalizeIsbn("") returns "" instead
  of undefined.

  Approach:
  1. Update lib/import/types.ts normalizeIsbn function (if needed):
     - Check if this handles empty strings correctly
     - If not, add: if (!value || value.trim() === "") return undefined;
     - Otherwise, fix at call site in goodreads.ts

  2. Update lib/import/client/goodreads.ts ISBN extraction (line 175):
     const isbnRaw = getValue(row, headerLookup, OPTIONAL_HEADERS.isbn);
     const isbn = normalizeIsbn(isbnRaw || undefined);  // Convert "" to undefined

     OR if normalizeIsbn is fixed:
     const isbn = normalizeIsbn(getValue(row, headerLookup, OPTIONAL_HEADERS.isbn));

  3. Update __tests__/import/goodreads.test.ts:
     - Add test case: Empty ISBN column → parsed book has isbn: undefined
     - Add test case: Whitespace-only ISBN → undefined
     - Add test case: Valid ISBN "9780441013593" → normalized correctly
     - Verify dedup matching works with missing ISBNs

  Success criteria: Empty CSV ISBN cells produce isbn: undefined in ParsedBook.
  Dedup matching skips empty ISBNs (doesn't create false positives). Tests verify
  empty/whitespace ISBNs normalize to undefined.

  Edge Cases:
  - Empty string "" → undefined
  - Whitespace-only "   " → undefined
  - Valid ISBN with spaces " 978-0-441-01359-3 " → normalized (existing behavior)
  - Invalid ISBN format → undefined (existing normalizeIsbn behavior)
  - Multiple ISBN formats (ISBN-10, ISBN-13) → handled by normalizeIsbn (existing)

  Test Coverage:
  - Empty column in CSV → undefined
  - Column with spaces → undefined
  - Valid ISBN → normalized
  - Dedup doesn't match books on empty ISBNs

  NOT in Scope:
  - ISBN validation (checking checksums)
  - Auto-converting ISBN-10 to ISBN-13
  - Fetching ISBNs from external APIs
  - Handling multiple ISBNs per book

  Dependencies:
  - normalizeIsbn function (lib/import/types.ts or lib/import/normalize.ts)
  - getValue function (lib/import/client/goodreads.ts:44-56)

  Estimate: 30m
  ```

---

### Phase 2: Repository Pattern (High Value)

- [x] Define repository interfaces
  ```
  Files:
  - lib/import/repository/interfaces.ts (NEW FILE - repository contracts)

  Goal: Abstract database access behind simple interfaces. Enable in-memory
  testing, hide Convex query complexity, create clear boundary between business
  logic and persistence.

  Approach:
  1. Create lib/import/repository/interfaces.ts:
     export interface BookRepository {
       findByUser(userId: Id<"users">): Promise<Doc<"books">[]>;
       findById(id: Id<"books">): Promise<Doc<"books"> | null>;
       create(book: Omit<Doc<"books">, "_id" | "_creationTime">): Promise<Id<"books">>;
       update(id: Id<"books">, patch: Partial<Doc<"books">>): Promise<void>;
       delete(id: Id<"books">): Promise<void>;
     }

     export interface ImportRunRepository {
       findByUserAndRun(userId: Id<"users">, runId: string): Promise<Doc<"importRuns"> | null>;
       findRecentByUser(userId: Id<"users">, sinceMs: number): Promise<Doc<"importRuns">[]>;
       create(run: Omit<Doc<"importRuns">, "_id" | "_creationTime">): Promise<Id<"importRuns">>;
       update(id: Id<"importRuns">, patch: Partial<Doc<"importRuns">>): Promise<void>;
     }

     export interface ImportPreviewRepository {
       findByUserRunPage(
         userId: Id<"users">,
         runId: string,
         page: number
       ): Promise<Doc<"importPreviews"> | null>;
       create(preview: Omit<Doc<"importPreviews">, "_id" | "_creationTime">): Promise<Id<"importPreviews">>;
     }

  Success criteria: Interfaces define complete CRUD operations needed by import
  feature. Methods use domain language (findByUser, not query). Return types are
  simple (Doc | null, not Convex query builders). No Convex types leak into
  interface (DatabaseReader hidden).

  Deep Module Design:
  - Interface: Simple, domain-focused method signatures
  - Hides: Query construction, index selection, Convex API details
  - Exposes: Only necessary operations with clear semantics

  Edge Cases:
  - Missing documents → return null, not throw
  - Multiple matches → first() returns single document
  - Empty results → return [] (empty array)

  NOT in Scope:
  - Transactions (single document operations only)
  - Batch operations (insertMany, updateMany)
  - Query builders or filters (specific methods for each query)
  - Pagination (collections return full arrays)

  Estimate: 45m
  ```

- [x] Implement Convex repository adapters
  ```
  Files:
  - lib/import/repository/convex.ts (NEW FILE - Convex implementations)

  Goal: Wrap Convex database API in repository interfaces. Move all Convex query
  construction to single location. Enable swapping persistence layer in future.

  Approach:
  1. Create lib/import/repository/convex.ts:
     export class ConvexBookRepository implements BookRepository {
       constructor(private db: DatabaseReader & DatabaseWriter) {}

       async findByUser(userId: Id<"users">): Promise<Doc<"books">[]> {
         return await this.db
           .query("books")
           .withIndex("by_user", (q) => q.eq("userId", userId))
           .collect();
       }

       async findById(id: Id<"books">): Promise<Doc<"books"> | null> {
         return await this.db.get(id);
       }

       async create(book: Omit<Doc<"books">, "_id" | "_creationTime">): Promise<Id<"books">> {
         return await this.db.insert("books", book);
       }

       async update(id: Id<"books">, patch: Partial<Doc<"books">>): Promise<void> {
         await this.db.patch(id, patch);
       }

       async delete(id: Id<"books">): Promise<void> {
         await this.db.delete(id);
       }
     }

     export class ConvexImportRunRepository implements ImportRunRepository {
       constructor(private db: DatabaseReader & DatabaseWriter) {}

       async findByUserAndRun(userId: Id<"users">, runId: string): Promise<Doc<"importRuns"> | null> {
         return await this.db
           .query("importRuns")
           .withIndex("by_user_run", (q) => q.eq("userId", userId).eq("importRunId", runId))
           .first();
       }

       async findRecentByUser(userId: Id<"users">, sinceMs: number): Promise<Doc<"importRuns">[]> {
         const all = await this.db
           .query("importRuns")
           .withIndex("by_user_run", (q) => q.eq("userId", userId))
           .collect();
         const now = Date.now();
         return all.filter(r => now - r.createdAt < sinceMs);
       }

       // ... create, update methods
     }

     export class ConvexImportPreviewRepository implements ImportPreviewRepository {
       // ... similar pattern
     }

  2. Export factory function for convenience:
     export const createConvexRepositories = (db: DatabaseReader & DatabaseWriter) => ({
       books: new ConvexBookRepository(db),
       importRuns: new ConvexImportRunRepository(db),
       importPreviews: new ConvexImportPreviewRepository(db),
     });

  Success criteria: All Convex query construction isolated in repository classes.
  Each method maps 1:1 to database operation. No business logic in repositories
  (pure data access). Implements interfaces exactly (type-safe).

  Edge Cases:
  - db.get returns null for missing ID → pass through
  - Query returns empty array → pass through
  - Patch on non-existent ID → Convex throws, let it bubble
  - Index doesn't exist → Convex throws at dev time, caught by types

  Information Hiding:
  - Callers never see .query(), .withIndex(), .collect()
  - Index names hidden (by_user, by_user_run)
  - Convex-specific types (DatabaseReader) hidden behind interface

  NOT in Scope:
  - Caching query results
  - Optimistic updates
  - Query result transformation
  - Error handling/retry logic (let Convex errors bubble)

  Dependencies:
  - Repository interfaces (lib/import/repository/interfaces.ts)
  - Convex types (DatabaseReader, DatabaseWriter, Doc, Id)

  Estimate: 2h
  ```

- [x] Implement in-memory repository for tests
  ```
  Files:
  - lib/import/repository/memory.ts (NEW FILE - in-memory implementations)
  - __tests__/import/imports.action.test.ts (UPDATE - use in-memory repos)
  - __tests__/import/imports.commit.test.ts (UPDATE - use in-memory repos)

  Goal: Fast, deterministic testing without database. Enable parallel test
  execution. Prove repository abstraction works (two implementations exist).

  Approach:
  1. Create lib/import/repository/memory.ts:
     export class InMemoryBookRepository implements BookRepository {
       private books = new Map<Id<"books">, Doc<"books">>();
       private nextId = 1;

       async findByUser(userId: Id<"users">): Promise<Doc<"books">[]> {
         return Array.from(this.books.values())
           .filter(b => b.userId === userId);
       }

       async findById(id: Id<"books">): Promise<Doc<"books"> | null> {
         return this.books.get(id) ?? null;
       }

       async create(book: Omit<Doc<"books">, "_id" | "_creationTime">): Promise<Id<"books">> {
         const id = `book_${this.nextId++}` as Id<"books">;
         const doc: Doc<"books"> = {
           ...book,
           _id: id,
           _creationTime: Date.now(),
         };
         this.books.set(id, doc);
         return id;
       }

       async update(id: Id<"books">, patch: Partial<Doc<"books">>): Promise<void> {
         const existing = this.books.get(id);
         if (!existing) throw new Error(`Book ${id} not found`);
         this.books.set(id, { ...existing, ...patch });
       }

       async delete(id: Id<"books">): Promise<void> {
         this.books.delete(id);
       }

       // Test helpers
       seed(books: Doc<"books">[]): void {
         books.forEach(b => this.books.set(b._id, b));
       }

       clear(): void {
         this.books.clear();
       }
     }

     // Similar for InMemoryImportRunRepository, InMemoryImportPreviewRepository

     export const createInMemoryRepositories = () => ({
       books: new InMemoryBookRepository(),
       importRuns: new InMemoryImportRunRepository(),
       importPreviews: new InMemoryImportPreviewRepository(),
     });

  2. Update __tests__/import/imports.action.test.ts:
     - Remove makeCtx mock (lines 9-38)
     - Create in-memory repos at test setup
     - Seed test data using repo.seed()
     - Pass repos to business logic functions
     - Assert using repo.findByUser() instead of mocks

  3. Update __tests__/import/imports.commit.test.ts:
     - Same pattern as imports.action.test.ts
     - Use in-memory repos instead of Convex mocks

  Success criteria: Tests run without Convex mocking. In-memory repos behave
  identically to Convex repos (same interface). Tests run 10-100x faster. Can
  run tests in parallel (isolated state). Seed/clear helpers make test setup
  trivial.

  Edge Cases:
  - findById on missing ID → return null (match Convex)
  - update on missing ID → throw error (match Convex)
  - delete on missing ID → silent success (match Convex)
  - Multiple creates → increment ID counter (deterministic)
  - Seed with duplicate IDs → last write wins

  Test Helpers:
  - seed(docs[]) → pre-populate repository
  - clear() → reset state between tests
  - getAll() → inspect all documents (debugging)

  NOT in Scope:
  - Persistence across test runs
  - Index simulation (queries filter in-memory)
  - Transaction support
  - Query performance optimization

  Dependencies:
  - Repository interfaces (lib/import/repository/interfaces.ts)
  - Document types (Doc<"books">, Doc<"importRuns">, etc.)

  Estimate: 2.5h
  ```

- [x] Extract rate limiting as middleware
  ```
  Files:
  - lib/import/rateLimit.ts (NEW FILE - pure rate limit logic)
  - convex/imports.ts:416-449 (MOVE enforceRateLimits to lib/import/rateLimit.ts)
  - convex/imports.ts:161 (UPDATE - use middleware)
  - convex/imports.ts:287 (UPDATE - use middleware)

  Goal: Separate rate limiting concern from business logic. Enable testing
  preview/commit without rate limit setup. Make rate limits reusable across
  future import features.

  Context: Currently enforceRateLimits is embedded in convex/imports.ts and
  queries database directly. Tests must mock rate limit state to test core
  import logic. Separation enables independent testing.

  Approach:
  1. Create lib/import/rateLimit.ts:
     export type RateLimitConfig = {
       dailyLimit: number;
       concurrentLimit: number;
       previewTimeoutMs: number;
     };

     export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
       dailyLimit: 5,
       concurrentLimit: 1,
       previewTimeoutMs: 15 * 60 * 1000,
     };

     export const checkImportRateLimits = async (
       repository: ImportRunRepository,
       userId: Id<"users">,
       config: RateLimitConfig = DEFAULT_RATE_LIMITS
     ): Promise<void> => {
       const now = Date.now();
       const oneDayMs = 24 * 60 * 60 * 1000;
       const runs = await repository.findRecentByUser(userId, oneDayMs);

       if (runs.length >= config.dailyLimit) {
         throw new Error("Too many imports today. Please try again tomorrow.");
       }

       const inFlight = runs.filter(
         r => r.status === "previewed" && now - r.updatedAt < config.previewTimeoutMs
       );

       if (inFlight.length >= config.concurrentLimit) {
         throw new Error("Too many concurrent imports. Finish existing imports first.");
       }
     };

     export const shouldSkipRateLimits = (): boolean => {
       return process.env.NODE_ENV === "development";
     };

  2. Update convex/imports.ts preparePreviewHandler (line 161):
     const userId = await requireAuth(ctx) as Id<"users">;

     // Rate limiting middleware
     if (!shouldSkipRateLimits()) {
       await checkImportRateLimits(importRunRepo, userId);
     }

     // Pure business logic follows...

  3. Update convex/imports.ts commitImportHandler (line 287):
     // Same pattern - check rate limits before business logic

  4. Remove enforceRateLimits function (lines 416-449)

  Success criteria: Rate limiting logic isolated in lib/import/rateLimit.ts.
  Business logic functions (preparePreview, commitImport) call middleware at
  entry point. Tests can skip rate limiting by mocking shouldSkipRateLimits or
  passing unlimited config. Rate limit config externalizable (different limits
  per environment).

  Edge Cases:
  - Development environment → skip rate limits (existing behavior)
  - Production environment → enforce limits
  - Expired previews (>15 min old) → don't count toward concurrent limit
  - Failed imports → don't count toward daily limit (status !== "previewed")
  - Clock skew → rare, acceptable (Date.now() based)

  Separation of Concerns:
  - Rate limit logic knows nothing about import preview/commit
  - Import handlers know nothing about rate limit implementation
  - Repository abstracts data access
  - Config separates policy from enforcement

  NOT in Scope:
  - Redis-based distributed rate limiting
  - Per-user configurable limits
  - Rate limit response headers (X-RateLimit-Remaining)
  - Exponential backoff or retry-after headers

  Dependencies:
  - ImportRunRepository interface
  - Node.js process.env (for environment detection)

  Estimate: 1.5h
  ```

- [ ] Update mutation handlers to use repositories
  ```
  Files:
  - convex/imports.ts:148-211 (UPDATE preparePreviewHandler)
  - convex/imports.ts:272-382 (UPDATE commitImportHandler)
  - convex/imports.ts (ADD repository factory at file scope)

  Goal: Remove direct database calls from mutation handlers. Use repository
  interfaces. Enable testing handlers with in-memory repos. Prove architecture
  works end-to-end.

  Approach:
  1. Add repository factory helper at top of convex/imports.ts:
     import { createConvexRepositories } from "../lib/import/repository/convex";

     const getRepositories = (db: any) => createConvexRepositories(db);

  2. Update preparePreviewHandler (lines 148-211):
     - Add at start: const repos = getRepositories(ctx.db);
     - Replace lib/import/dedup.findMatches with:
       const existingBooks = await repos.books.findByUser(userId);
       const matches = matchBooks(existingBooks, books);  // Pure function
     - Replace ctx.db.insert("importPreviews", ...) with:
       await repos.importPreviews.create({ ... });
     - Replace upsertImportRun database calls with:
       const existing = await repos.importRuns.findByUserAndRun(userId, importRunId);
       if (!existing) {
         await repos.importRuns.create({ ... });
       } else {
         await repos.importRuns.update(existing._id, { ... });
       }

  3. Update commitImportHandler (lines 272-382):
     - Add at start: const repos = getRepositories(ctx.db);
     - Replace ctx.db.query("importRuns") with:
       const run = await repos.importRuns.findByUserAndRun(userId, importRunId);
     - Replace ctx.db.insert("books", ...) with:
       await repos.books.create(newBook);
     - Replace ctx.db.get(bookId) + ctx.db.patch with:
       const book = await repos.books.findById(bookId);
       await repos.books.update(bookId, patch);
     - Replace loadPreviewRows database access with:
       const preview = await repos.importPreviews.findByUserRunPage(...);

  4. Update helper functions:
     - upsertImportRun → accept ImportRunRepository parameter
     - loadPreviewRows → accept ImportPreviewRepository parameter

  Success criteria: Zero direct ctx.db calls in mutation handlers (except
  repository construction). All database access goes through repositories.
  Handlers orchestrate business logic without knowing Convex query syntax.
  Tests can inject in-memory repositories.

  Edge Cases:
  - Missing run document → repository returns null, handler checks
  - Multiple concurrent previews → repository queries handle correctly
  - Book ownership validation → still checks book.userId === userId
  - Transaction boundaries → repositories don't provide, handlers handle atomicity

  Deep Module Achievement:
  - Mutation handlers: thin orchestration layer (20-30 lines)
  - Repositories: hide Convex complexity (50 lines per table)
  - Business logic: pure functions in lib/import/* (testable)

  NOT in Scope:
  - Refactoring other Convex modules (books.ts, notes.ts, etc.)
  - Adding repository caching
  - Transaction support across repositories
  - Migration script for existing data

  Dependencies:
  - Repository interfaces (lib/import/repository/interfaces.ts)
  - Convex repository implementations (lib/import/repository/convex.ts)
  - Pure matchBooks function (lib/import/dedup/core.ts)
  - Rate limit middleware (lib/import/rateLimit.ts)

  Estimate: 3h
  ```

- [ ] Update all import tests to use new architecture
  ```
  Files:
  - __tests__/import/dedup.test.ts (UPDATE - use matchBooks with arrays)
  - __tests__/import/imports.action.test.ts (UPDATE - use in-memory repos)
  - __tests__/import/imports.commit.test.ts (UPDATE - use in-memory repos)
  - __tests__/import/llm.test.ts (UPDATE - inject providers)
  - __tests__/import/goodreads.test.ts (UPDATE - verify ISBN fix)

  Goal: All 6 failing tests pass with new architecture. Tests run fast (no
  database). Tests are maintainable (no brittle mocks). Coverage proves
  architecture works.

  Approach:
  1. Update __tests__/import/dedup.test.ts:
     - Import matchBooks from lib/import/dedup/core
     - Remove makeDb mock function
     - Create Doc<"books">[] test fixtures
     - Test matchBooks(fixtures, incomingRows)
     - Verify ISBN priority, title-author fallback, apiId matching
     - Add test: empty existing books → no matches
     - Add test: multiple match candidates → highest priority wins

  2. Update __tests__/import/imports.action.test.ts:
     - Import createInMemoryRepositories from lib/import/repository/memory
     - Remove makeCtx mock
     - Create repos = createInMemoryRepositories()
     - Seed test data: repos.books.seed([...])
     - Test preparePreviewHandler with injected repos
     - Verify preview created, dedup matches found, run status updated

  3. Update __tests__/import/imports.commit.test.ts:
     - Same pattern as imports.action.test.ts
     - Test commitImportHandler with in-memory repos
     - Verify books created, merged, skipped correctly
     - Check run status transitions

  4. Update __tests__/import/llm.test.ts:
     - Remove process.env mocking (lines with vi.stubEnv)
     - Import makeStaticProvider from lib/import/llm
     - Create mock provider: makeStaticProvider({ books: [...] })
     - Pass provider to llmExtract directly
     - Test extraction, chunking, verification
     - Add test: no provider passed → error
     - Add test: fallback provider used when primary fails

  5. Update __tests__/import/goodreads.test.ts:
     - Add test case: empty ISBN column → undefined
     - Add test case: whitespace ISBN → undefined
     - Verify parseGoodreadsCsv normalizes correctly
     - Integration: CSV with empty ISBNs → dedup doesn't false-match

  Success criteria: All 6 tests pass. No Convex query mocking. No environment
  variable mocking. Tests run in <500ms total (vs 5+ seconds before). 100%
  coverage of refactored code paths.

  Test Quality Metrics:
  - Zero brittle mocks (no .eq().eq() chains)
  - Test data as plain objects (easy to read)
  - Clear arrange-act-assert structure
  - Edge cases explicitly tested
  - Failure messages identify exact issue

  Edge Cases to Cover:
  - Empty input arrays
  - Missing required fields
  - Duplicate tempIds
  - Invalid book IDs in decisions
  - Concurrent rate limit violations
  - Provider failures and fallbacks

  NOT in Scope:
  - E2E tests through Next.js API
  - Integration tests with real Convex deployment
  - Performance benchmarking
  - Mutation coverage in other modules

  Dependencies:
  - All Phase 1 and Phase 2 tasks complete
  - In-memory repositories implemented
  - Pure functions extracted
  - Providers injectable

  Estimate: 2.5h
  ```
- [ ] PR review fixes: auth + client bootstrapping
  - Files: convex/auth.ts, convex/schema.ts, convex/auth.config.ts, app/ConvexClientProvider.tsx, hooks/useImportJob.ts
  - Actions:
    - Add unique constraint for `clerkId` in `users` table and handle concurrent insert race by re-querying on unique violation.
    - DRY lazy user creation into shared helper; clarify docs that creation only happens in mutation contexts; use distinctive email fallback or throw when missing.
    - Require `CLERK_JWT_ISSUER_DOMAIN` (fail fast) instead of silent default.
    - Hoist `ConvexReactClient` to module scope (or memo with convexUrl), switch to Convex-aware `useAuth` hook, and fix `IMPORT_PAGE_SIZE` typing (value import + typeof).
  - Acceptance:
    - No duplicate user rows possible for concurrent first login.
    - Auth helpers have single creation path and accurate docs.
    - Provider instantiates client once and uses Convex auth readiness; TypeScript passes without importing const as type.
    - Missing issuer env crashes clearly (and checklist updated if needed).

- [ ] PR review fixes: import mutations/metrics hardening
  - Files: convex/imports.ts, lib/import/metrics.ts (usage)
  - Actions:
    - Move `logImportEvent` before the return in `preparePreviewHandler` so preview metrics emit.
    - Guard `adminCleanupAllStuckImports` with auth/admin or dev-only environment check.
  - Acceptance:
    - Preview calls produce metrics and lint has no unreachable code.
    - Admin cleanup rejects unauthorized callers (or production use) with clear error.

- [ ] PR review fixes: secret hygiene
  - Files: .github/VERCEL_INVESTIGATION.md
  - Actions:
    - Remove/replace live Clerk/Convex keys with obvious placeholders.
    - Note key rotation completed (Clerk + Convex + Vercel); plan history scrub if repo ever public.
  - Acceptance:
    - No real secrets remain in working tree; doc uses dummy values and warns to set env separately.

- [ ] PR review fixes: UI + docs polish
  - Files: components/book/AddBookSheet.tsx, components/book/BookTile.tsx, components/import/PreviewTable.tsx, components/import/DedupControls.tsx, components/import/UploadDropzone.tsx, README.md, .github/DEPLOYMENT_FIX_SUMMARY.md, .github/DEPLOYMENT_ISSUE_SUMMARY.md, PRODUCTION_CHECKLIST.md, __tests__/fixtures/reading-sample.md, BACKLOG.md
  - Actions:
    - Fix stale closure in AddBookSheet handleClose (useCallback deps) and remove eslint-disable.
    - Make BookTile overlay focus-visible and avoid empty metadata rows.
    - PreviewTable: use inclusive ≥0.85 merge threshold (shared constant if available).
    - DedupControls: distinguish loading vs missing existingBook; avoid per-row N+1 (batch or include match payload).
    - UploadDropzone: enforce accepted file types, smooth dragLeave flicker, avoid double button semantics.
    - README env section: clarify CONVEX_DEPLOY_KEY vs CONVEX_DEPLOYMENT; surface import env vars.
    - Markdown lint fixes (bare URLs, headings, fenced languages) in deployment docs + fixture heading.
    - BACKLOG: wrap bare Convex rate-limit URL.
  - Acceptance:
    - ESLint no-disable in AddBookSheet; keyboard users see overlay; merge threshold matches spec; lint passes markdown; doc/env clarity improved.
