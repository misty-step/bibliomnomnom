# DESIGN.md - bibliomnomnom Architecture

**Version:** 1.0
**Status:** Architecture Complete
**Date:** 2025-11-07

---

## Architecture Overview

**Selected Approach**: Convex-First with Actions for External Services

**Rationale**: This architecture provides the simplest mental model with a single source of truth (Convex), automatic real-time updates, end-to-end type safety, and deep modules that hide complexity behind clean interfaces. Alternative approaches (hybrid Server Actions or function-heavy patterns) introduced unnecessary coordination complexity between data layers.

**Core Modules**:
- **Authentication Layer** (Clerk + Convex): Handles user auth, session management, user sync
- **Data Layer** (Convex Queries/Mutations): All CRUD operations, privacy filtering, real-time subscriptions
- **External Services Layer** (Convex Actions): Book API search, orchestration of complex flows
- **File Upload Layer** (Vercel Blob + API Routes): Custom cover uploads with presigned URLs
- **UI Layer** (Next.js + React): Beautiful components with optimistic updates

**Data Flow**:
```
User Action → Convex Hook (useQuery/useMutation/useAction) → Convex Function → Database/External API → Real-time Update → UI
```

**Key Design Decisions**:
1. **Convex as Single Source of Truth**: All data operations flow through Convex for consistency and real-time updates
2. **Queries for Reads, Mutations for Writes, Actions for External**: Clear separation of concerns based on operation type
3. **Row-Level Security in Queries**: Privacy enforced at query level, not in database
4. **Optimistic Updates Everywhere**: Instant UI feedback, eventual consistency
5. **Client-Side File Upload Pattern**: Direct upload to Vercel Blob reduces server load

---

## Module Design (Deep Dive)

### Module 1: Authentication & User Management

**Responsibility**: Hide all authentication complexity—Clerk integration, JWT validation, user sync, session management—behind simple "get current user" interface.

**Public Interface**:
```typescript
// Convex Auth Helper (convex/auth.ts)
export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<UserId> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) throw new ConvexError("User not found");
  return user._id;
}

export async function getAuthOrNull(ctx: QueryCtx): Promise<UserId | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  return user?._id ?? null;
}

// Client Hook (lib/hooks/useAuth.ts)
export function useAuth() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  return { isLoading, isAuthenticated };
}
```

**Internal Implementation** (Hidden Complexity):
- Clerk JWT token validation in Next.js middleware
- Token passed to Convex via ConvexProviderWithClerk
- Convex validates token via ctx.auth.getUserIdentity()
- User lookup by clerkId with indexed query
- Webhook handling for user.created, user.updated, user.deleted
- User record sync between Clerk and Convex database

**Dependencies**:
- **Requires**: Clerk SDK, Convex auth, Next.js middleware
- **Used by**: All authenticated queries/mutations, UI components

**Data Structures**:
```typescript
// User in Convex (convex/schema.ts)
export const users = defineTable({
  clerkId: v.string(),
  email: v.string(),
  name: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_clerk_id", ["clerkId"]);

// Auth Identity (from Clerk)
interface ClerkIdentity {
  subject: string;      // Unique Clerk user ID
  email?: string;
  name?: string;
  tokenIdentifier: string;
}
```

**Error Handling**:
- `Unauthenticated` → Client redirects to /sign-in
- `User not found` → Trigger user sync webhook, retry once
- `Token expired` → Clerk auto-refreshes, transparent to app
- `Webhook failure` → Clerk retries with exponential backoff

---

### Module 2: Books Data Layer

**Responsibility**: Hide all book database complexity—CRUD operations, privacy filtering, status management, index queries—behind simple book operations interface.

**Public Interface**:
```typescript
// Convex Queries (convex/books.ts)

// Get user's books with optional filtering
export const list = query({
  args: {
    status: v.optional(v.union(
      v.literal("want-to-read"),
      v.literal("currently-reading"),
      v.literal("read")
    )),
    favoritesOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Book[]> => {
    const userId = await requireAuth(ctx);

    let q = ctx.db.query("books").withIndex("by_user", (q) =>
      q.eq("userId", userId)
    );

    if (args.status) {
      q = q.filter((q) => q.eq(q.field("status"), args.status));
    }

    if (args.favoritesOnly) {
      q = q.filter((q) => q.eq(q.field("isFavorite"), true));
    }

    return await q.collect();
  },
});

// Get single book (private, requires ownership)
export const get = query({
  args: { id: v.id("books") },
  handler: async (ctx, args): Promise<Book | null> => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.id);

    if (!book || book.userId !== userId) {
      return null;
    }

    return book;
  },
});

// Get public book (no auth required)
export const getPublic = query({
  args: { id: v.id("books") },
  handler: async (ctx, args): Promise<PublicBook | null> => {
    const book = await ctx.db.get(args.id);

    if (!book || book.privacy !== "public") {
      return null;
    }

    // Return sanitized public view
    return {
      _id: book._id,
      title: book.title,
      author: book.author,
      description: book.description,
      coverUrl: book.coverUrl,
      apiCoverUrl: book.apiCoverUrl,
      status: book.status,
      isFavorite: book.isFavorite,
      isAudiobook: book.isAudiobook,
      publishedYear: book.publishedYear,
    };
  },
});

// Convex Mutations (convex/books.ts)

export const create = mutation({
  args: {
    title: v.string(),
    author: v.string(),
    description: v.optional(v.string()),
    isbn: v.optional(v.string()),
    status: v.union(
      v.literal("want-to-read"),
      v.literal("currently-reading"),
      v.literal("read")
    ),
    // ... other fields
  },
  handler: async (ctx, args): Promise<Id<"books">> => {
    const userId = await requireAuth(ctx);

    return await ctx.db.insert("books", {
      ...args,
      userId,
      privacy: "private", // default
      isFavorite: false,
      isAudiobook: false,
      timesRead: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("books"),
    // Partial updates allowed
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    status: v.optional(v.union(/* ... */)),
    // ... other fields
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireAuth(ctx);
    const { id, ...updates } = args;

    const book = await ctx.db.get(id);
    if (!book || book.userId !== userId) {
      throw new ConvexError("Book not found or access denied");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("books") },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireAuth(ctx);

    const book = await ctx.db.get(args.id);
    if (!book || book.userId !== userId) {
      throw new ConvexError("Book not found or access denied");
    }

    // Delete book and cascade to notes
    await ctx.db.delete(args.id);

    // Delete associated notes
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_book", (q) => q.eq("bookId", args.id))
      .collect();

    for (const note of notes) {
      await ctx.db.delete(note._id);
    }
  },
});

// Quick status updates with optimistic UI
export const updateStatus = mutation({
  args: {
    id: v.id("books"),
    status: v.union(
      v.literal("want-to-read"),
      v.literal("currently-reading"),
      v.literal("read")
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.id);

    if (!book || book.userId !== userId) {
      throw new ConvexError("Access denied");
    }

    const updates: any = {
      status: args.status,
      updatedAt: Date.now(),
    };

    // Auto-set dates based on status change
    if (args.status === "currently-reading" && !book.dateStarted) {
      updates.dateStarted = Date.now();
    }

    if (args.status === "read" && !book.dateFinished) {
      updates.dateFinished = Date.now();
      updates.timesRead = book.timesRead + 1;
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const toggleFavorite = mutation({
  args: { id: v.id("books") },
  handler: async (ctx, args): Promise<boolean> => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.id);

    if (!book || book.userId !== userId) {
      throw new ConvexError("Access denied");
    }

    const newValue = !book.isFavorite;
    await ctx.db.patch(args.id, {
      isFavorite: newValue,
      updatedAt: Date.now(),
    });

    return newValue;
  },
});

export const updatePrivacy = mutation({
  args: {
    id: v.id("books"),
    privacy: v.union(v.literal("private"), v.literal("public")),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireAuth(ctx);
    const book = await ctx.db.get(args.id);

    if (!book || book.userId !== userId) {
      throw new ConvexError("Access denied");
    }

    await ctx.db.patch(args.id, {
      privacy: args.privacy,
      updatedAt: Date.now(),
    });
  },
});
```

**Internal Implementation**:
- Index-based queries for performance (by_user, by_user_status)
- Privacy filtering at query level (not database level)
- Ownership validation on every mutation
- Cascade deletes for notes when book deleted
- Automatic timestamp updates
- Auto-increment timesRead when moved to "read"
- Auto-set dateStarted/dateFinished based on status changes

**Dependencies**:
- **Requires**: Auth module (requireAuth), Convex database
- **Used by**: Book UI components, Notes module (foreign key)

**Data Structures**:
```typescript
// Book Document (convex/schema.ts)
export const books = defineTable({
  userId: v.id("users"),

  // Metadata
  title: v.string(),
  author: v.string(),
  description: v.optional(v.string()),
  isbn: v.optional(v.string()),
  edition: v.optional(v.string()),
  publishedYear: v.optional(v.number()),
  pageCount: v.optional(v.number()),

  // Status & Flags
  status: v.union(
    v.literal("want-to-read"),
    v.literal("currently-reading"),
    v.literal("read")
  ),
  isFavorite: v.boolean(),
  isAudiobook: v.boolean(),
  privacy: v.union(v.literal("private"), v.literal("public")),

  // Tracking
  timesRead: v.number(),
  dateStarted: v.optional(v.number()),
  dateFinished: v.optional(v.number()),

  // Images
  coverUrl: v.optional(v.string()),      // Custom from Vercel Blob
  apiCoverUrl: v.optional(v.string()),   // From Google Books

  // API Integration
  apiId: v.optional(v.string()),
  apiSource: v.optional(v.union(
    v.literal("google-books"),
    v.literal("open-library"),
    v.literal("manual")
  )),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_status", ["userId", "status"])
  .index("by_user_favorite", ["userId", "isFavorite"]);
```

**Error Handling**:
- `Access denied` → Book not owned by user, return null or throw
- `Book not found` → Return null in queries, throw in mutations
- `Invalid status` → Zod validation fails, Convex rejects
- `Database error` → Convex automatic retry with exponential backoff

---

### Module 3: External Book Search

> **Status (Nov 10, 2025):** Deferred for MVP. Manual entry-only flow shipped while we revisit Google Books integration later. Architecture notes remain for future implementation.

**Responsibility**: Hide Google Books API complexity—rate limiting, error handling, response transformation, caching—behind simple search interface.

**Public Interface**:
```typescript
// Convex Action (convex/search.ts)
export const searchBooks = action({
  args: {
    query: v.string(),
    maxResults: v.optional(v.number()), // default 10
  },
  handler: async (ctx, args): Promise<SearchResult[]> => {
    // Action can make external HTTP calls
    const results = await searchGoogleBooks(args.query, args.maxResults);

    // Optional: Cache popular searches
    // await cacheSearchResults(ctx, args.query, results);

    return results;
  },
});

// Client Usage
const search = useAction(api.search.searchBooks);

const results = await search({
  query: "thinking fast and slow",
  maxResults: 10,
});
```

**Internal Implementation** (Hidden Complexity):
```typescript
// Internal helper (not exported)
async function searchGoogleBooks(
  query: string,
  maxResults: number = 10
): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${apiKey}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform Google Books response to our format
    return data.items?.map((item: any) => ({
      apiId: item.id,
      title: item.volumeInfo.title,
      author: item.volumeInfo.authors?.join(", ") || "Unknown",
      description: item.volumeInfo.description || "",
      isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier,
      publishedYear: item.volumeInfo.publishedDate ?
        parseInt(item.volumeInfo.publishedDate.split("-")[0]) :
        undefined,
      pageCount: item.volumeInfo.pageCount,
      apiCoverUrl: item.volumeInfo.imageLinks?.thumbnail,
      apiSource: "google-books" as const,
    })) || [];
  } catch (error) {
    console.error("Google Books API error:", error);
    // Return empty results instead of throwing
    return [];
  }
}

// Optional: Cache layer for popular searches
async function cacheSearchResults(
  ctx: ActionCtx,
  query: string,
  results: SearchResult[]
): Promise<void> {
  // Could store in Convex as "search_cache" table
  // with TTL of 24 hours
  // Not implementing in MVP, but shows extensibility
}
```

**Dependencies**:
- **Requires**: Google Books API key (env var), fetch API *(inactive until feature resumes)*
- **Used by**: Add Book modal, search UI *(future)*

**Data Structures**:
```typescript
// Search Result (not stored, ephemeral)
interface SearchResult {
  apiId: string;
  title: string;
  author: string;
  description?: string;
  isbn?: string;
  publishedYear?: number;
  pageCount?: number;
  apiCoverUrl?: string;
  apiSource: "google-books" | "open-library";
}
```

**Error Handling**:
- `API key missing` → Log error, return empty array
- `Rate limit exceeded` → Return empty array, show user-friendly message
- `Network timeout` → Retry once, then return empty array
- `Invalid API response` → Log error, return empty array
- Never throw errors to client—always return empty array

---

### Module 4: Notes & Content

**Responsibility**: Hide note management complexity—CRUD operations, rich text storage, book association, ordering—behind simple note operations.

**Public Interface**:
```typescript
// Convex Queries (convex/notes.ts)

export const list = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args): Promise<Note[]> => {
    const userId = await requireAuth(ctx);

    // Verify user owns the book
    const book = await ctx.db.get(args.bookId);
    if (!book || book.userId !== userId) {
      return [];
    }

    return await ctx.db
      .query("notes")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .order("desc") // Most recent first
      .collect();
  },
});

// Convex Mutations (convex/notes.ts)

export const create = mutation({
  args: {
    bookId: v.id("books"),
    type: v.union(
      v.literal("note"),
      v.literal("quote"),
      v.literal("reflection")
    ),
    content: v.string(),
    page: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"notes">> => {
    const userId = await requireAuth(ctx);

    // Verify ownership
    const book = await ctx.db.get(args.bookId);
    if (!book || book.userId !== userId) {
      throw new ConvexError("Access denied");
    }

    return await ctx.db.insert("notes", {
      ...args,
      userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("notes"),
    content: v.optional(v.string()),
    page: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireAuth(ctx);
    const { id, ...updates } = args;

    const note = await ctx.db.get(id);
    if (!note || note.userId !== userId) {
      throw new ConvexError("Access denied");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireAuth(ctx);

    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) {
      throw new ConvexError("Access denied");
    }

    await ctx.db.delete(args.id);
  },
});
```

**Internal Implementation**:
- Ownership validation via book → user relationship
- Markdown content stored as string (parsed client-side)
- Index by bookId for fast retrieval
- Denormalized userId for direct ownership check

**Dependencies**:
- **Requires**: Auth module, Books module (foreign key validation)
- **Used by**: Book detail page, note editor components

**Data Structures**:
```typescript
// Note Document (convex/schema.ts)
export const notes = defineTable({
  bookId: v.id("books"),
  userId: v.id("users"), // Denormalized for fast queries

  type: v.union(
    v.literal("note"),
    v.literal("quote"),
    v.literal("reflection")
  ),
  content: v.string(), // Markdown
  page: v.optional(v.string()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_book", ["bookId"])
  .index("by_user", ["userId"]);
```

**Error Handling**:
- `Access denied` → Note/book not owned by user
- `Book not found` → Reject note creation
- `Invalid content` → Markdown validation client-side
- `Delete failed` → Automatic retry by Convex

---

### Module 5: File Upload (Custom Covers)

**Responsibility**: Hide Vercel Blob complexity—presigned URLs, token generation, upload progress, security—behind simple upload interface.

**Public Interface**:
```typescript
// Next.js API Route (app/api/blob/upload/route.ts)
export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json() as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validate user can upload
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          tokenPayload: JSON.stringify({ userId }),
          maximumSizeInBytes: 5 * 1024 * 1024, // 5MB
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("Upload completed:", blob.url);
        // Don't save to DB here—client will call Convex mutation
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

// Client Usage (components/UploadCover.tsx)
import { upload } from "@vercel/blob/client";

const handleUpload = async (file: File) => {
  try {
    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/blob/upload",
      onUploadProgress: ({ percentage }) => {
        setProgress(percentage);
      },
    });

    // Save URL to Convex
    await updateBook({
      id: bookId,
      coverUrl: blob.url,
    });

    toast.success("Cover uploaded!");
  } catch (error) {
    toast.error("Upload failed");
  }
};
```

**Internal Implementation**:
- Client uploads directly to Vercel Blob (not through server)
- API route only generates presigned upload token
- Clerk auth validates user before token generation
- Upload progress tracked client-side
- After upload, client calls Convex mutation to save URL

**Dependencies**:
- **Requires**: Vercel Blob SDK, Clerk auth, Convex (for saving URL)
- **Used by**: Book detail page, upload components

**Data Structures**:
```typescript
// Upload Token Payload
interface UploadToken {
  allowedContentTypes: string[];
  tokenPayload: string; // JSON with userId
  maximumSizeInBytes: number;
}

// Blob Response
interface BlobResult {
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType: string;
}
```

**Error Handling**:
- `Unauthorized` → No Clerk session, redirect to sign-in
- `File too large` → Validate client-side before upload
- `Invalid file type` → Validate client-side
- `Upload failed` → Show user-friendly error, allow retry
- `Network timeout` → Automatic retry with exponential backoff

---

## Core Algorithms (Pseudocode)

### Algorithm 1: User Authentication Flow

```pseudocode
function authenticateUser():
  1. User visits protected route (e.g., /library)
  2. Next.js middleware checks for Clerk session
     - If no session: redirect to /sign-in
     - If session exists: continue

  3. Clerk provides JWT token in cookie/header
  4. ConvexProviderWithClerk passes token to Convex

  5. When client calls Convex query/mutation:
     a. Convex receives token in ctx.auth
     b. Call ctx.auth.getUserIdentity()
        - Validates JWT signature
        - Checks expiration
        - Returns identity or null

     c. If identity is null:
        - Throw ConvexError("Unauthenticated")
        - Client catches, redirects to /sign-in

     d. If identity exists:
        - Extract clerkId from identity.subject
        - Query users table with by_clerk_id index:
          SELECT * FROM users WHERE clerkId = identity.subject

        - If user not found:
          - This shouldn't happen (webhook should have synced)
          - Trigger sync or throw error

        - If user found:
          - Return user._id (internal Convex ID)
          - Use for all subsequent queries

  6. Every subsequent query/mutation uses userId
     - All book queries filter by userId
     - All mutations verify ownership via userId
```

---

### Algorithm 2: Book Status Update with Auto-Dating

```pseudocode
function updateBookStatus(bookId, newStatus):
  1. Authenticate user
     userId = await requireAuth(ctx)

  2. Fetch current book
     book = await ctx.db.get(bookId)

  3. Validate ownership
     if book.userId != userId:
       throw ConvexError("Access denied")

  4. Initialize updates object
     updates = {
       status: newStatus,
       updatedAt: Date.now(),
     }

  5. Handle status-specific logic

     if newStatus == "currently-reading":
       if book.dateStarted is null:
         updates.dateStarted = Date.now()
       # If already started, don't overwrite

     if newStatus == "read":
       if book.dateFinished is null:
         updates.dateFinished = Date.now()

       # Increment read counter
       updates.timesRead = book.timesRead + 1

       # Create reading session for history
       await ctx.db.insert("reading_sessions", {
         bookId: bookId,
         userId: userId,
         startDate: book.dateStarted || Date.now(),
         endDate: Date.now(),
         readNumber: book.timesRead + 1,
         createdAt: Date.now(),
       })

     if newStatus == "want-to-read":
       # Moving back to wishlist—clear dates
       if book.status == "read" or book.status == "currently-reading":
         updates.dateStarted = null
         updates.dateFinished = null

  6. Apply updates atomically
     await ctx.db.patch(bookId, updates)

  7. Return success
     # Real-time update automatically propagates to all clients
     return { success: true }
```

---

### Algorithm 3: Privacy-Aware Book Retrieval

```pseudocode
function getBook(bookId, requestContext):
  1. Determine if request is authenticated
     userId = await getAuthOrNull(ctx)

  2. Fetch book from database
     book = await ctx.db.get(bookId)

     if book is null:
       return null

  3. Check privacy and ownership

     if book.privacy == "private":
       # Private books require ownership
       if userId is null:
         return null  # Not authenticated

       if book.userId != userId:
         return null  # Not the owner

       # Owner requesting private book—return full data
       return book

     if book.privacy == "public":
       # Public books visible to everyone

       if userId == book.userId:
         # Owner sees full data
         return book

       # Non-owner sees sanitized public data
       return {
         _id: book._id,
         title: book.title,
         author: book.author,
         description: book.description,
         coverUrl: book.coverUrl,
         apiCoverUrl: book.apiCoverUrl,
         status: book.status,
         isFavorite: book.isFavorite,
         isAudiobook: book.isAudiobook,
         publishedYear: book.publishedYear,
         # Hide: userId, privacy, dates, internal metadata
       }
```

---

### Algorithm 4: Book Search with Google Books API

```pseudocode
function searchBooks(query, maxResults = 10):
  1. Validate input
     if query is empty or query.length < 2:
       return []

  2. Build API request
     apiKey = process.env.GOOGLE_BOOKS_API_KEY
     encodedQuery = encodeURIComponent(query)
     url = `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=${maxResults}&key=${apiKey}`

  3. Make HTTP request with timeout
     try:
       response = await fetch(url, {
         timeout: 5000  # 5 second timeout
       })

       if response.status == 429:
         # Rate limited
         log("Google Books rate limit hit")
         return []

       if response.status >= 400:
         log(`Google Books API error: ${response.status}`)
         return []

       data = await response.json()

     catch NetworkError:
       log("Network error calling Google Books")
       return []

  4. Transform results to our format
     results = []

     for each item in data.items (or empty if undefined):
       volumeInfo = item.volumeInfo

       # Extract first ISBN if available
       isbn = null
       if volumeInfo.industryIdentifiers exists:
         isbn = volumeInfo.industryIdentifiers[0].identifier

       # Parse published year from date string (YYYY-MM-DD)
       publishedYear = null
       if volumeInfo.publishedDate exists:
         publishedYear = parseInt(volumeInfo.publishedDate.split("-")[0])

       # Build result object
       result = {
         apiId: item.id,
         title: volumeInfo.title || "Unknown Title",
         author: volumeInfo.authors?.join(", ") || "Unknown Author",
         description: volumeInfo.description || "",
         isbn: isbn,
         publishedYear: publishedYear,
         pageCount: volumeInfo.pageCount,
         apiCoverUrl: volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail,
         apiSource: "google-books",
       }

       results.push(result)

  5. Return transformed results
     return results
```

---

### Algorithm 5: Optimistic Book Favorite Toggle

```pseudocode
# Client-side optimistic update
function toggleFavoriteOptimistic(bookId):
  1. Get current book from Convex cache
     currentBook = convexCache.getQuery("books.get", { id: bookId })

  2. Optimistically update local cache IMMEDIATELY
     newValue = !currentBook.isFavorite

     convexCache.setOptimisticUpdate("books.get", { id: bookId }, {
       ...currentBook,
       isFavorite: newValue,
       updatedAt: Date.now(),
     })

     # UI updates instantly, user sees immediate feedback

  3. Call actual mutation (async, in background)
     try:
       actualResult = await mutation("books.toggleFavorite", { id: bookId })

       # When mutation completes, Convex automatically reconciles
       # Real-time subscription updates cache with server truth

     catch error:
       # Mutation failed—rollback optimistic update
       convexCache.revertOptimisticUpdate("books.get", { id: bookId })

       # Show error to user
       toast.error("Failed to update favorite status")
```

---

## File Organization

```
bibliomnomnom/
├── app/                           # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── sign-in/[[...sign-in]]/
│   │   │   └── page.tsx          # Clerk sign-in page
│   │   └── sign-up/[[...sign-up]]/
│   │       └── page.tsx          # Clerk sign-up page
│   │
│   ├── (dashboard)/              # Protected routes (requires auth)
│   │   ├── layout.tsx            # Dashboard layout with nav
│   │   ├── library/
│   │   │   ├── page.tsx          # Main library view (grid of books)
│   │   │   └── loading.tsx       # Loading skeleton
│   │   ├── books/[id]/
│   │   │   ├── page.tsx          # Book detail page (private)
│   │   │   └── loading.tsx       # Loading skeleton
│   │   └── settings/
│   │       └── page.tsx          # User settings
│   │
│   ├── books/[id]/               # Public book pages (no auth)
│   │   └── page.tsx              # Public book view
│   │
│   ├── api/
│   │   ├── blob/
│   │   │   └── upload/
│   │   │       └── route.ts      # Vercel Blob upload handler
│   │   └── webhooks/
│   │       └── clerk/
│   │           └── route.ts      # Clerk user sync webhook
│   │
│   ├── layout.tsx                # Root layout (Clerk + Convex providers)
│   ├── page.tsx                  # Landing/marketing page
│   └── globals.css               # Global styles (Tailwind)
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── toast.tsx
│   │   └── ...                   # Other shadcn components
│   │
│   ├── book/                     # Book-specific components
│   │   ├── BookCard.tsx          # Single book in grid
│   │   ├── BookGrid.tsx          # Grid of books with filters
│   │   ├── BookDetail.tsx        # Full book details
│   │   ├── BookForm.tsx          # Add/edit book form
│   │   ├── StatusBadge.tsx       # Visual status indicator
│   │   ├── PrivacyToggle.tsx     # Public/private toggle
│   │   └── UploadCover.tsx       # Custom cover upload
│   │
│   ├── notes/                    # Note/quote/reflection components
│   │   ├── NoteEditor.tsx        # Rich text editor (Tiptap)
│   │   ├── NoteList.tsx          # List of notes for a book
│   │   ├── NoteCard.tsx          # Single note display
│   │   └── NoteTypeSelector.tsx  # Toggle note/quote/reflection
│   │
│   ├── search/                   # Book search components
│   │   ├── SearchModal.tsx       # Modal with search + results
│   │   ├── SearchBar.tsx         # Search input with debounce
│   │   └── SearchResults.tsx     # Grid of API results
│   │
│   └── shared/                   # Reusable components
│       ├── LoadingSkeleton.tsx   # Generic loading state
│       ├── EmptyState.tsx        # No data placeholder
│       ├── ErrorBoundary.tsx     # Error handling UI
│       └── ConvexProviders.tsx   # Convex + Clerk providers
│
├── convex/
│   ├── _generated/               # Auto-generated by Convex
│   │   ├── api.ts                # Type-safe API exports
│   │   ├── dataModel.ts          # Database types
│   │   └── server.ts             # Server types
│   │
│   ├── schema.ts                 # Database schema definition
│   │
│   ├── auth.ts                   # Auth helpers (requireAuth, etc.)
│   │
│   ├── users.ts                  # User queries/mutations
│   │   # Exports:
│   │   # - internal.createFromClerk (webhook handler)
│   │   # - internal.updateFromClerk (webhook handler)
│   │
│   ├── books.ts                  # Book queries/mutations
│   │   # Exports:
│   │   # - list (query)
│   │   # - get (query)
│   │   # - getPublic (query)
│   │   # - create (mutation)
│   │   # - update (mutation)
│   │   # - remove (mutation)
│   │   # - updateStatus (mutation)
│   │   # - toggleFavorite (mutation)
│   │   # - updatePrivacy (mutation)
│   │
│   ├── notes.ts                  # Note queries/mutations
│   │   # Exports:
│   │   # - list (query)
│   │   # - create (mutation)
│   │   # - update (mutation)
│   │   # - remove (mutation)
│   │
│   ├── search.ts                 # External API search actions
│   │   # Exports:
│   │   # - searchBooks (action)
│   │
│   └── http.ts                   # HTTP routes for webhooks
│
├── lib/
│   ├── utils.ts                  # Utility functions (cn, etc.)
│   ├── constants.ts              # App constants (status types, etc.)
│   ├── types.ts                  # Shared TypeScript types
│   └── hooks/
│       ├── useAuth.ts            # Auth hooks
│       ├── useBooks.ts           # Book operation hooks
│       └── useOptimistic.ts      # Optimistic update helpers
│
├── middleware.ts                 # Next.js middleware (Clerk auth)
├── convex.json                   # Convex config
├── next.config.js                # Next.js config
├── tailwind.config.ts            # Tailwind config
├── tsconfig.json                 # TypeScript config
└── package.json                  # Dependencies
```

**Key Points**:
- Route groups `(auth)` and `(dashboard)` for organization (don't affect URLs)
- Convex functions organized by domain (books, notes, search)
- Components organized by feature (book, notes, search)
- Middleware handles Clerk auth for all protected routes
- Webhooks route handles Clerk → Convex user sync

---

## Integration Points

### Convex Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  books: defineTable({
    userId: v.id("users"),

    // Metadata
    title: v.string(),
    author: v.string(),
    description: v.optional(v.string()),
    isbn: v.optional(v.string()),
    edition: v.optional(v.string()),
    publishedYear: v.optional(v.number()),
    pageCount: v.optional(v.number()),

    // Status & Flags
    status: v.union(
      v.literal("want-to-read"),
      v.literal("currently-reading"),
      v.literal("read")
    ),
    isFavorite: v.boolean(),
    isAudiobook: v.boolean(),
    privacy: v.union(v.literal("private"), v.literal("public")),

    // Tracking
    timesRead: v.number(),
    dateStarted: v.optional(v.number()),
    dateFinished: v.optional(v.number()),

    // Images
    coverUrl: v.optional(v.string()),
    apiCoverUrl: v.optional(v.string()),

    // API Integration
    apiId: v.optional(v.string()),
    apiSource: v.optional(v.union(
      v.literal("google-books"),
      v.literal("open-library"),
      v.literal("manual")
    )),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_favorite", ["userId", "isFavorite"]),

  notes: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),

    type: v.union(
      v.literal("note"),
      v.literal("quote"),
      v.literal("reflection")
    ),
    content: v.string(),
    page: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_book", ["bookId"])
    .index("by_user", ["userId"]),

  reading_sessions: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),

    startDate: v.number(),
    endDate: v.optional(v.number()),
    readNumber: v.number(),

    createdAt: v.number(),
  })
    .index("by_book", ["bookId"])
    .index("by_user", ["userId"]),
});
```

---

### Clerk Configuration

```typescript
// app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/books/[id]", // Public book pages
]);

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect(); // Require auth for all other routes
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

---

### Environment Variables

```bash
# .env.local

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
CLERK_WEBHOOK_SECRET=whsec_...

# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# (Deferred) Google Books API
# GOOGLE_BOOKS_API_KEY=AIza...
```

---

## State Management

### Client State (React)

**Authentication State**:
```typescript
// Managed by Clerk + Convex
const { isLoading, isAuthenticated } = useConvexAuth();

// Usage in components
if (isLoading) return <LoadingSkeleton />;
if (!isAuthenticated) return <Redirect to="/sign-in" />;
```

**Book Data State**:
```typescript
// Real-time subscriptions via Convex
const books = useQuery(api.books.list, {
  status: "currently-reading"
});

// books automatically updates when data changes
// No manual refetching needed
```

**Optimistic Updates**:
```typescript
// Immediate UI feedback
const toggleFavorite = useMutation(api.books.toggleFavorite);

const handleToggle = async (bookId: Id<"books">) => {
  // UI updates instantly
  await toggleFavorite({ id: bookId });
  // Convex reconciles with server truth
};
```

**Local UI State**:
```typescript
// Modal open/close, form inputs, etc.
const [isModalOpen, setIsModalOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState("");
```

---

### Server State (Convex)

**All persistent data in Convex database**:
- Users (synced from Clerk)
- Books (user's library)
- Notes (attached to books)
- Reading sessions (history)

**No in-memory state** on server:
- Stateless Convex functions
- Each function execution is independent
- All state retrieved from database

**Real-time Propagation**:
```typescript
// When mutation runs:
await ctx.db.patch(bookId, { status: "read" });

// Convex automatically:
1. Updates database
2. Notifies all subscribed clients
3. Clients receive updated data
4. React re-renders with new state

// No manual cache invalidation needed
```

---

## Error Handling Strategy

### Error Categories

**1. Authentication Errors (401)**
```typescript
// Convex function
const userId = await requireAuth(ctx);
// Throws ConvexError("Unauthenticated")

// Client handling
try {
  const data = await query(/* ... */);
} catch (error) {
  if (error.message === "Unauthenticated") {
    router.push("/sign-in");
  }
}
```

**2. Authorization Errors (403)**
```typescript
// User doesn't own resource
if (book.userId !== userId) {
  throw new ConvexError("Access denied");
}

// Client shows error toast
toast.error("You don't have permission to edit this book");
```

**3. Validation Errors (400)**
```typescript
// Convex rejects invalid arguments automatically
export const create = mutation({
  args: {
    title: v.string(), // Required
    author: v.string(), // Required
  },
  // ...
});

// If title is missing, Convex throws validation error
// Client shows field-specific error
```

**4. Not Found Errors (404)**
```typescript
// Query returns null instead of throwing
const book = await ctx.db.get(bookId);
if (!book) return null;

// Client handles gracefully
if (!book) {
  return <EmptyState message="Book not found" />;
}
```

**5. External API Errors (503)**
```typescript
// Google Books API failure
try {
  const response = await fetch(googleBooksUrl);
  // ...
} catch (error) {
  console.error("Google Books API error:", error);
  return []; // Return empty results, don't throw
}

// Client shows message
if (results.length === 0) {
  toast.info("No results found. Try a different search.");
}
```

**6. Upload Errors (500)**
```typescript
// Vercel Blob upload failure
try {
  await upload(file.name, file, { /* ... */ });
} catch (error) {
  toast.error("Upload failed. Please try again.");
  // Allow retry
}
```

---

### Error Response Format

**Convex Errors**:
```typescript
// Thrown by Convex functions
throw new ConvexError("Human-readable message");

// Received by client
catch (error) {
  console.error(error.message); // "Human-readable message"
}
```

**API Route Errors**:
```typescript
// Returned from Next.js API routes
return Response.json(
  { error: "Descriptive error message" },
  { status: 400 }
);

// Client handling
const response = await fetch("/api/blob/upload", { /* ... */ });
if (!response.ok) {
  const { error } = await response.json();
  toast.error(error);
}
```

---

### Logging

**Client-Side**:
```typescript
// Console errors in development
if (process.env.NODE_ENV === "development") {
  console.error("Book creation failed:", error);
}

// Send to error tracking in production
if (process.env.NODE_ENV === "production") {
  // Sentry, LogRocket, etc.
  errorTracker.captureException(error);
}
```

**Server-Side** (Convex):
```typescript
// Convex logs all errors automatically
// View in Convex dashboard

// Additional logging
console.log("Book created:", bookId);
console.error("Google Books API failed:", error);
```

---

## Testing Strategy

### Unit Tests (Convex Functions)

**Test Queries in Isolation**:
```typescript
// convex/books.test.ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { list } from "./books";

test("list returns only user's books", async () => {
  const t = convexTest(schema);

  // Create test users
  const userId1 = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "user1",
      email: "user1@test.com",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  const userId2 = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "user2",
      email: "user2@test.com",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  // Create books for both users
  await t.run(async (ctx) => {
    await ctx.db.insert("books", {
      userId: userId1,
      title: "Book 1",
      author: "Author 1",
      status: "read",
      isFavorite: false,
      isAudiobook: false,
      privacy: "private",
      timesRead: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("books", {
      userId: userId2,
      title: "Book 2",
      author: "Author 2",
      status: "read",
      isFavorite: false,
      isAudiobook: false,
      privacy: "private",
      timesRead: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  // Query as user1
  const books = await t.query(list, {}, { as: userId1 });

  // Should only see user1's books
  expect(books).toHaveLength(1);
  expect(books[0].title).toBe("Book 1");
});
```

**Test Mutations**:
```typescript
test("toggleFavorite updates flag", async () => {
  const t = convexTest(schema);

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", { /* ... */ });
  });

  const bookId = await t.run(async (ctx) => {
    return await ctx.db.insert("books", {
      userId,
      title: "Test Book",
      isFavorite: false,
      // ... other required fields
    });
  });

  // Toggle favorite
  const result = await t.mutation(toggleFavorite, { id: bookId }, { as: userId });

  expect(result).toBe(true);

  // Verify in database
  const book = await t.run(async (ctx) => {
    return await ctx.db.get(bookId);
  });

  expect(book.isFavorite).toBe(true);
});
```

---

### Integration Tests (Full Flows)

**Test Complete User Flow**:
```typescript
test("complete book journey", async () => {
  const t = convexTest(schema);

  // 1. Create user
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", { /* ... */ });
  });

  // 2. Add book
  const bookId = await t.mutation(create, {
    title: "Test Book",
    author: "Test Author",
    status: "want-to-read",
  }, { as: userId });

  // 3. Start reading
  await t.mutation(updateStatus, {
    id: bookId,
    status: "currently-reading",
  }, { as: userId });

  let book = await t.run(async (ctx) => {
    return await ctx.db.get(bookId);
  });

  expect(book.status).toBe("currently-reading");
  expect(book.dateStarted).toBeDefined();

  // 4. Finish reading
  await t.mutation(updateStatus, {
    id: bookId,
    status: "read",
  }, { as: userId });

  book = await t.run(async (ctx) => {
    return await ctx.db.get(bookId);
  });

  expect(book.status).toBe("read");
  expect(book.dateFinished).toBeDefined();
  expect(book.timesRead).toBe(1);

  // 5. Verify reading session created
  const sessions = await t.run(async (ctx) => {
    return await ctx.db
      .query("reading_sessions")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .collect();
  });

  expect(sessions).toHaveLength(1);
  expect(sessions[0].readNumber).toBe(1);
});
```

---

### E2E Tests (Playwright)

**Test User Journey in Browser**:
```typescript
// tests/e2e/books.spec.ts
import { test, expect } from "@playwright/test";

test("user can add and manage books", async ({ page }) => {
  // 1. Sign in
  await page.goto("http://localhost:3000/sign-in");
  await page.fill("input[name=email]", "test@example.com");
  await page.fill("input[name=password]", "password123");
  await page.click("button[type=submit]");

  // 2. Navigate to library
  await expect(page).toHaveURL("/library");

  // 3. Open add book modal
  await page.click("button:has-text('Add Book')");

  // 4. Search for book
  await page.fill("input[placeholder='Search for books...']", "Thinking Fast and Slow");
  await page.waitForSelector("[data-testid=search-result]");

  // 5. Add first result
  await page.click("[data-testid=search-result]:first-child button:has-text('Add')");

  // 6. Verify book appears in library
  await expect(page.locator("text=Thinking, Fast and Slow")).toBeVisible();

  // 7. Toggle favorite
  await page.click("[data-testid=favorite-toggle]");
  await expect(page.locator("[data-testid=favorite-icon]")).toHaveClass(/filled/);

  // 8. Change status
  await page.click("[data-testid=status-dropdown]");
  await page.click("text=Currently Reading");
  await expect(page.locator("text=Currently Reading")).toBeVisible();
});
```

---

### Mocking Strategy

**Mock External APIs in Tests**:
```typescript
// Don't call real Google Books API in tests
// Mock at the action level

import { vi } from "vitest";

vi.mock("./search", () => ({
  searchBooks: vi.fn().mockResolvedValue([
    {
      apiId: "test-id",
      title: "Mock Book",
      author: "Mock Author",
      apiSource: "google-books",
    },
  ]),
}));
```

**Don't Mock Convex Database**:
```typescript
// Use convex-test which provides in-memory database
// This ensures tests match production behavior
// Heavy mocking indicates tight coupling—avoid
```

---

## Performance Considerations

### Expected Load

- **Users**: 100-1000 in first month, 10K+ within year
- **Books per user**: 50-500 (voracious readers)
- **Queries per session**: 10-50 (browsing library, searching)
- **Mutations per session**: 3-10 (adding books, updating status, notes)
- **Real-time subscribers**: 1-5 per user (open tabs/devices)

**Target Performance**:
- Page load (LCP): < 1 second
- Query response: < 100ms
- Mutation response: < 200ms
- Search API: < 1 second
- File upload: < 3 seconds for 5MB

---

### Optimizations

**1. Index-Based Queries**:
```typescript
// Good: Uses index for fast lookup
const books = await ctx.db
  .query("books")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .collect();

// Bad: Full table scan
const books = await ctx.db
  .query("books")
  .filter((q) => q.eq(q.field("userId"), userId))
  .collect();
```

**2. Pagination for Large Lists**:
```typescript
// For users with 500+ books
const result = await ctx.db
  .query("books")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .order("desc") // Most recent first
  .paginate({ cursor: args.cursor, numItems: 50 });

return {
  books: result.page,
  cursor: result.continueCursor,
  isDone: result.isDone,
};
```

**3. Optimistic Updates**:
```typescript
// Instant UI feedback, no waiting for server
const toggleFavorite = useMutation(api.books.toggleFavorite)
  .withOptimisticUpdate((localStore, args) => {
    const book = localStore.getQuery(api.books.get, { id: args.id });
    if (book) {
      localStore.setQuery(api.books.get, { id: args.id }, {
        ...book,
        isFavorite: !book.isFavorite,
      });
    }
  });
```

**4. Client-Side Image Upload**:
```typescript
// User uploads directly to Vercel Blob
// Reduces load on Next.js server
// Faster upload with progress tracking
const blob = await upload(file.name, file, {
  access: "public",
  handleUploadUrl: "/api/blob/upload", // Only generates token
});
```

**5. Debounced Search**:
```typescript
// Don't call API on every keystroke
const debouncedSearch = useDebouncedCallback(
  (query: string) => {
    if (query.length > 2) {
      search({ query });
    }
  },
  500 // 500ms delay
);
```

**6. Lazy Loading Components**:
```typescript
// Don't load rich text editor until needed
const NoteEditor = lazy(() => import("./NoteEditor"));

// Usage
<Suspense fallback={<LoadingSkeleton />}>
  {showEditor && <NoteEditor />}
</Suspense>
```

---

### Scaling Strategy

**Horizontal Scaling**:
- Convex automatically scales (serverless)
- Next.js on Vercel scales automatically
- No server management needed

**Database Performance**:
- Convex handles up to 1M documents easily
- Indexes ensure fast queries even with 100K+ books
- If needed, partition by user with sharding (future)

**Rate Limiting**:
```typescript
// Protect expensive operations
const RATE_LIMIT = {
  search: 10, // 10 searches per minute
  upload: 5,  // 5 uploads per minute
};

// Implement with Convex rate limiter or Upstash
```

---

## Security Considerations

### Threats Mitigated

**1. Unauthorized Access**
- **Threat**: User A accesses User B's private books
- **Mitigation**:
  - All queries filter by userId
  - All mutations validate ownership
  - Public books explicitly marked, sanitized

**2. Authentication Bypass**
- **Threat**: Access protected routes without login
- **Mitigation**:
  - Clerk middleware on all routes
  - Convex validates JWT on every function call
  - ctx.auth.getUserIdentity() required

**3. Data Injection**
- **Threat**: Malicious data in book titles, notes
- **Mitigation**:
  - Convex validates all inputs with Zod schemas
  - Client-side sanitization in rich text editor
  - No SQL injection possible (Convex is not SQL)

**4. File Upload Attacks**
- **Threat**: Upload malicious files or exceed limits
- **Mitigation**:
  - Whitelist allowed content types (image/jpeg, image/png, image/webp)
  - Maximum file size enforced (5MB)
  - Vercel Blob scans uploads
  - User authenticated before upload token generated

**5. API Key Exposure**
- **Threat**: Google Books API key leaked
- **Mitigation**:
  - API keys stored in environment variables
  - Never sent to client
  - Actions run server-side only

**6. CSRF (Cross-Site Request Forgery)**
- **Threat**: Attacker tricks user into unwanted actions
- **Mitigation**:
  - Clerk uses secure cookies with SameSite=Strict
  - Convex validates JWT on every request
  - No sensitive actions via GET requests

---

### Security Best Practices

**Never Log Sensitive Data**:
```typescript
// Good
console.log("Book created:", bookId);

// Bad
console.log("User data:", { email, password, token });
```

**Sanitize User Input**:
```typescript
// Client-side: Rich text editor strips dangerous HTML
const sanitizedContent = DOMPurify.sanitize(rawContent);

// Server-side: Convex validates types
args: {
  content: v.string(), // Must be string
}
```

**Validate Ownership on Mutations**:
```typescript
// Always check before mutating
const book = await ctx.db.get(args.id);
if (!book || book.userId !== userId) {
  throw new ConvexError("Access denied");
}
```

**Use HTTPS Only**:
```typescript
// Vercel enforces HTTPS automatically
// Clerk cookies marked Secure
// No plaintext transmission
```

**Rate Limit Expensive Operations**:
```typescript
// Prevent abuse of search API
// Prevent spam book creation
// Implement with Convex or Upstash rate limiter
```

---

## Alternative Architectures Considered

### Alternative A: Hybrid Server Actions + Convex

**Description**: Use Next.js Server Actions for file uploads and external APIs, Convex only for database.

**Pros**:
- Server Actions natural for file handling
- Could use Server Actions for Google Books search
- Modern Next.js 15 patterns

**Cons**:
- Two data flow paths (Server Actions + Convex)
- Coordination complexity between Server Action and Convex
- Lose real-time updates for file upload state
- More mental overhead tracking where logic lives

**Why Rejected**: Added unnecessary complexity without clear benefits. Single source of truth (Convex) is simpler.

---

### Alternative B: Pure Convex Functions (Function-Heavy)

**Description**: All logic in Convex, Next.js is pure presentation layer.

**Pros**:
- Maximum real-time capabilities
- Single source of truth
- Simple client

**Cons**:
- Google Books API calls from Convex actions (extra hop)
- Can't leverage Next.js Server Actions
- File upload coordination awkward

**Why Rejected**: Too rigid. Vercel Blob upload pattern works better with API routes. Not all operations need real-time.

---

### Alternative C: Convex-First with Actions (Selected)

**Description**: Convex as single source of truth, actions for external services, thin Next.js.

**Why Selected**:
1. **Best balance**: Real-time where needed, flexibility where not
2. **Simplest mental model**: Everything goes through Convex
3. **Deep modules**: Convex functions hide all complexity
4. **Type-safety**: End-to-end with generated types
5. **Proven pattern**: Matches Convex best practices

---

## Implementation Notes

### Critical Path

1. **Foundation First**: Auth + schema + basic CRUD
2. **Core Features**: Book management + notes
3. **Polish**: Privacy controls + file uploads
4. **Search**: External API integration

**Don't Build Yet**:
- AI features (embeddings, semantic search)
- Analytics dashboard
- Social features
- Import/export

### Known Limitations

**MVP Constraints**:
- No offline support (requires PWA)
- No undo/redo (can add with event sourcing)
- No collaborative editing (one user per book)
- No real-time presence (not needed for MVP)

**Deliberate Trade-offs**:
- **Chose**: Convex actions for search (simpler)
- **Over**: Client-side API calls (CORS issues)
- **Because**: Server-side keeps API keys secret

- **Chose**: Client-side Blob upload (faster)
- **Over**: Server proxy upload (simpler)
- **Because**: Large files, progress tracking, reduced load

- **Chose**: Row-level security in queries (explicit)
- **Over**: Database-level permissions (Convex doesn't support)
- **Because**: More control, clearer code

---

## Next Steps

After architecture approval:

1. **Initialize Project**:
   ```bash
   npx create-next-app@latest bibliomnomnom --typescript --tailwind --app
   cd bibliomnomnom
   npm install convex @clerk/nextjs @vercel/blob
   npx convex dev
   ```

2. **Set Up Auth**:
   - Configure Clerk application
   - Add Clerk middleware
   - Create Convex auth helpers

3. **Implement Schema**:
   - Define Convex schema
   - Set up indexes
   - Create initial queries/mutations

4. **Build UI Foundation**:
   - Install shadcn/ui
   - Create design system (colors, typography)
   - Build layout components

5. **Implement Core Flows**:
   - Book CRUD operations
   - Library view
   - Book detail page
   - Notes system

6. **Add External Services**:
   - Google Books search
   - File upload
   - Privacy controls

7. **Polish & Deploy**:
   - Animations
   - Loading states
   - Error handling
   - Deploy to Vercel

---

**Architecture Status**: ✅ Complete and ready for implementation

**Estimated Development Time**: 6-7 weeks (as per TASK.md phases)

**Risk Level**: Low—all technologies proven, patterns well-established, clear module boundaries

**Confidence Level**: High—architecture is simple, explicit, and robust

🚀 **Ready to build something beautiful.**
