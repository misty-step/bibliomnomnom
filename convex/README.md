# Convex Backend

This directory contains the Convex backend - the single source of truth for bibliomnomnom's data and business logic.

## What is Convex?

Convex is a real-time backend platform that provides:
- **Database**: Serverless, auto-scaling document database
- **API**: Type-safe functions (queries, mutations, actions)
- **Real-time**: Automatic reactivity - components re-render when data changes
- **Auth**: Integration with Clerk via JWT validation

## Module Structure

### Core Modules

| File | Purpose | Lines | Exports | Depth |
|------|---------|-------|---------|-------|
| **auth.ts** | Auth helpers | 41 | 2 functions | Deep (9/10) |
| **books.ts** | Book CRUD + privacy | 298 | 8 functions | Deep (9/10) |
| **notes.ts** | Note/quote/reflection CRUD | 95 | 4 functions | Medium-Deep (8/10) |
| **users.ts** | User lifecycle | 61 | 3 functions | Medium (7/10) |
| **schema.ts** | Database schema | 62 | Schema exports | N/A (config) |

### Generated Files (Do Not Edit)

- `_generated/` - Auto-generated TypeScript types from schema
  - `api.ts` - Function references (e.g., `api.books.list`)
  - `dataModel.ts` - Table types and document interfaces
  - `server.ts` - Convex server runtime types

## Key Patterns

### Pattern 1: Authentication via `requireAuth()`

All mutations must validate authentication:

```typescript
import { requireAuth } from "./auth";

export const create = mutation({
  args: { title: v.string(), author: v.string() },
  handler: async (ctx, args) => {
    // ALWAYS call requireAuth first
    const userId = await requireAuth(ctx);

    // Now safe to proceed with database operations
    const bookId = await ctx.db.insert("books", {
      userId,
      title: args.title,
      author: args.author,
      // ...
    });

    return bookId;
  },
});
```

**Why**: Ensures only authenticated users can modify data. Throws error if unauthenticated.

### Pattern 2: Ownership Validation

All mutations validate resource ownership:

```typescript
export const update = mutation({
  args: { id: v.id("books"), title: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Fetch the book
    const book = await ctx.db.get(args.id);

    // Validate ownership
    if (!book || book.userId !== userId) {
      throw new Error("Access denied");
    }

    // Safe to update
    await ctx.db.patch(args.id, { title: args.title });
  },
});
```

**Why**: Prevents users from modifying other users' data.

### Pattern 3: Privacy Filtering in Queries

Queries automatically filter by userId:

```typescript
export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Filter by userId (row-level security)
    let books = await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Additional filtering if status provided
    if (args.status) {
      books = books.filter((book) => book.status === args.status);
    }

    return books;
  },
});
```

**Why**: Users only see their own books. Privacy enforced at query level.

### Pattern 4: Public Data Sanitization

Public queries return sanitized data:

```typescript
export const getPublic = query({
  args: { id: v.id("books") },
  handler: async (ctx, args) => {
    const book = await ctx.db.get(args.id);

    if (!book || book.privacy !== "public") {
      return null;
    }

    // Return only public fields (no userId, dates, etc.)
    return {
      id: book._id,
      title: book.title,
      author: book.author,
      status: book.status,
      pageCount: book.pageCount,
      coverImageUrl: book.coverImageUrl,
      // userId, dateStarted, dateFinished intentionally excluded
    } satisfies PublicBook;
  },
});
```

**Why**: Prevents accidental exposure of private user data.

## Database Schema

### Tables

#### users
- `clerkId` (string) - Clerk user ID (primary identifier)
- `email` (string) - User email
- `name` (string, optional) - Display name
- `imageUrl` (string, optional) - Profile picture
- `_creationTime` (number) - Auto-set timestamp

**Indexes**:
- `by_clerk_id` - Fast lookup by Clerk ID

#### books
- `userId` (id<"users">) - Owner
- `title` (string) - Book title
- `author` (string) - Author name
- `status` (string) - Reading status ("want-to-read", "currently-reading", "read")
- `privacy` (string) - Visibility ("private", "public")
- `favorite` (boolean) - Favorite flag
- `isAudiobook` (boolean) - Audiobook flag
- `pageCount` (number, optional) - Number of pages
- `coverImageUrl` (string, optional) - Cover image URL
- `dateStarted` (number, optional) - When started reading (timestamp)
- `dateFinished` (number, optional) - When finished reading (timestamp)
- `timesRead` (number) - How many times read (default: 0)
- `_creationTime` (number) - Auto-set timestamp

**Indexes**:
- `by_user` - Filter by userId
- `by_user_status` - Filter by userId + status (composite)
- `by_user_favorite` - Filter by userId + favorite

#### notes
- `userId` (id<"users">) - Owner (for index only, ownership validated via book)
- `bookId` (id<"books">) - Parent book
- `type` (string) - Note type ("note", "quote", "reflection")
- `content` (string) - Markdown content
- `_creationTime` (number) - Auto-set timestamp

**Indexes**:
- `by_book` - Filter by bookId
- `by_user` - Filter by userId (for user's notes across all books)

#### importRuns
- `userId` (id<"users">) - Owner of the import run
- `importRunId` (string) - Client-provided UUID used for idempotency
- `status` ("previewed" | "committed" | "failed") - Current run state
- `sourceType` (string) - Origin (goodreads-csv, csv, txt, md, unknown)
- `page` (number) - Current page processed (0-based)
- `totalPages` (number) - Total pages for the run
- `counts` (object) - `{ rows, created, merged, skipped, errors }`
- `errorMessage` (string, optional) - Latest failure message
- `createdAt` / `updatedAt` (number) - Timestamps for tracing + rate limits

**Indexes**:
- `by_user_run` - Find a run by userId + importRunId (idempotency + rate limit guard)

**After schema edits**: run `pnpm convex:push` to apply changes and regenerate `_generated/*` types.

## Auto-Dating Logic

The `books.updateStatus` mutation automatically manages reading dates:

```typescript
export const updateStatus = mutation({
  // ...
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.id);

    // Validate ownership...

    const updates: Partial<Doc<"books">> = { status: args.status };

    // Auto-set dateStarted when starting to read
    if (args.status === "currently-reading" && !book.dateStarted) {
      updates.dateStarted = Date.now();
    }

    // Auto-set dateFinished and increment timesRead when finishing
    if (args.status === "read") {
      updates.dateFinished = Date.now();
      updates.timesRead = book.timesRead + 1;
    }

    await ctx.db.patch(args.id, updates);
  },
});
```

**Behavior**:
- **"want-to-read"**: No date changes
- **"currently-reading"**: Sets `dateStarted` if not already set (preserves original start date on re-reads)
- **"read"**: Sets `dateFinished` to now, increments `timesRead`

## Error Handling

All functions should throw descriptive errors:

```typescript
// Good: Specific error message
if (!book || book.userId !== userId) {
  throw new ConvexError("Access denied");
}

// Good: Validation error
if (!args.title || args.title.trim().length === 0) {
  throw new ConvexError("Title is required");
}

// Bad: Generic error (don't do this)
throw new Error("Error");
```

Errors are caught by frontend and displayed via toast notifications.

## Testing

### Current: Manual Testing
During development, test functions via Convex dashboard or frontend UI.

### Future: Automated Tests
```typescript
import { convexTest } from "convex-test";
import { api } from "./_generated/api";

test("books.create requires auth", async () => {
  const t = convexTest();

  // Should throw without auth
  await expect(
    t.mutation(api.books.create, { title: "Test", author: "Author" })
  ).rejects.toThrow("Authentication required");
});

test("books.list filters by userId", async () => {
  const t = convexTest();

  // Create books for two different users
  const user1Books = await t.mutation(api.books.create, {...}, { auth: user1 });
  const user2Books = await t.mutation(api.books.create, {...}, { auth: user2 });

  // User 1 should only see their books
  const books = await t.query(api.books.list, {}, { auth: user1 });
  expect(books).toHaveLength(1);
  expect(books[0]._id).toBe(user1Books);
});
```

See [BACKLOG.md](../BACKLOG.md) for test coverage roadmap.

## Common Issues

### "Could not find public function"
**Cause**: Schema not synced to Convex deployment.
**Fix**: Run `pnpm convex:push` to sync schema and functions.

### "Authentication required"
**Cause**: `requireAuth()` called but no Clerk session present.
**Fix**: Check Clerk configuration, ensure JWT template named `convex` exists.

### "Access denied" on valid request
**Cause**: Ownership validation failing.
**Debug**: Log `userId` and `book.userId` to verify they match. Check that `requireAuth()` returns correct user ID.

### Type errors after schema change
**Cause**: Generated types out of sync.
**Fix**: Run `pnpm convex:push` to regenerate types, restart `pnpm dev` if needed.

## Best Practices

### ✅ DO:
- Call `requireAuth(ctx)` at the start of every mutation
- Validate ownership before any database writes
- Use indexes for filtering (`withIndex("by_user", ...)`)
- Return explicit types (not `any`)
- Throw descriptive errors (`ConvexError` with message)

### ❌ DON'T:
- Skip auth validation (security vulnerability)
- Trust client-provided `userId` (always derive from auth)
- Query without indexes (performance issue)
- Mutate data in queries (violates Convex model)
- Store sensitive data in public fields

## Related Documentation

- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture and module design
- [CLAUDE.md](../CLAUDE.md) - Development patterns and conventions
- [Convex Docs](https://docs.convex.dev) - Official Convex documentation
