# External API Integration Research: Convex + Next.js

**Date**: 2025-11-25
**Project**: bibliomnomnom
**Focus**: Google Books API & Gemini API integration patterns for Convex + Next.js architecture

## Executive Summary

This document provides comprehensive research on integrating external APIs (Google Books API, Gemini API for cover generation) into the bibliomnomnom Convex + Next.js architecture. Based on official Convex documentation and best practices from 2025, this guide covers where API calls should happen, API key management, caching strategies, rate limiting, file storage options, and background job queuing.

**Key Recommendations:**
1. **Use Convex Actions** for all external API calls (Google Books, Gemini)
2. **Store API keys** in Convex environment variables (dashboard or CLI)
3. **Implement Action Cache** component for expensive API responses
4. **Use Workpool** for rate-limited background jobs
5. **Store cover images** as URLs in database (prefer external hosting over blob storage)
6. **Leverage Convex Scheduler** for async workflows and retries

---

## 1. Where Should API Calls Happen?

### Answer: Convex Actions (Strongly Recommended)

**Convex Actions are the correct place for external API calls** because:

- Actions support non-deterministic operations like HTTP requests
- Queries and mutations are transactional and cannot call external APIs
- Actions can call mutations to persist API results transactionally
- Built-in retry mechanisms with Convex scheduler
- Better security (API keys never exposed to client)

### Architecture Decision Matrix

| Location | Use Case | Pros | Cons |
|----------|----------|------|------|
| **Convex Actions** ✅ | Google Books search, Gemini API calls | Secure, transactional persistence, retry logic, rate limiting | Slight cold start delay |
| Next.js API Routes | N/A for this project | None for this use case | Requires separate auth, no transactional DB access |
| Client-side | N/A | None | Exposes API keys, no retry logic, rate limit issues |

### Example: Google Books Search Action

```typescript
// convex/actions/googleBooks.ts
"use node"; // Use Node.js runtime for better npm package support

import { action } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Search Google Books API for books matching query
 * Returns array of book results with metadata
 */
export const searchBooks = action({
  args: {
    query: v.string(),
    maxResults: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate user authentication
    const userId = await requireAuth(ctx);

    // Get API key from environment variables
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_BOOKS_API_KEY not configured");
    }

    const maxResults = args.maxResults ?? 10;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(args.query)}&maxResults=${maxResults}&key=${apiKey}`;

    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Google Books API error: ${response.status}`);
      }

      const data = await response.json();

      // Transform API response to our book format
      return data.items?.map((item: any) => ({
        apiId: item.id,
        apiSource: "google-books" as const,
        title: item.volumeInfo.title,
        author: item.volumeInfo.authors?.join(", ") ?? "Unknown",
        description: item.volumeInfo.description,
        isbn: item.volumeInfo.industryIdentifiers?.find(
          (id: any) => id.type === "ISBN_13"
        )?.identifier,
        publishedYear: parseInt(item.volumeInfo.publishedDate?.substring(0, 4) ?? "0"),
        pageCount: item.volumeInfo.pageCount,
        apiCoverUrl: item.volumeInfo.imageLinks?.thumbnail?.replace("http:", "https:"),
      })) ?? [];
    } catch (error) {
      console.error("Google Books API error:", error);
      // Return empty array instead of throwing - fail gracefully
      return [];
    }
  },
});

/**
 * Fetch detailed information for a specific book by Google Books ID
 */
export const getBookById = action({
  args: {
    googleBooksId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

    if (!apiKey) {
      throw new Error("GOOGLE_BOOKS_API_KEY not configured");
    }

    const url = `https://www.googleapis.com/books/v1/volumes/${args.googleBooksId}?key=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const item = await response.json();
      return {
        apiId: item.id,
        apiSource: "google-books" as const,
        title: item.volumeInfo.title,
        author: item.volumeInfo.authors?.join(", ") ?? "Unknown",
        description: item.volumeInfo.description,
        isbn: item.volumeInfo.industryIdentifiers?.find(
          (id: any) => id.type === "ISBN_13"
        )?.identifier,
        publishedYear: parseInt(item.volumeInfo.publishedDate?.substring(0, 4) ?? "0"),
        pageCount: item.volumeInfo.pageCount,
        apiCoverUrl: item.volumeInfo.imageLinks?.thumbnail?.replace("http:", "https:"),
      };
    } catch (error) {
      console.error("Google Books API error:", error);
      return null;
    }
  },
});
```

### Example: Gemini Image Generation Action

```typescript
// convex/actions/geminiImages.ts
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Generate book cover image using Gemini API
 * Returns temporary URL to generated image
 */
export const generateCover = action({
  args: {
    bookTitle: v.string(),
    author: v.string(),
    genre: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Construct prompt for book cover generation
    const prompt = `Create a professional book cover design for:
Title: "${args.bookTitle}"
Author: "${args.author}"
${args.genre ? `Genre: ${args.genre}` : ""}

Style: Professional, modern, bibliophile aesthetic with warm tones`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              responseModalities: ["image"],
              aspectRatio: "3:4", // Book cover aspect ratio
              outputMimeType: "image/jpeg",
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();

      // Extract image data URL from response
      const imageData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!imageData) {
        throw new Error("No image data in Gemini response");
      }

      // Return data URL for client-side display
      // Client will then upload to Vercel Blob via existing upload flow
      return {
        dataUrl: `data:${imageData.mimeType};base64,${imageData.data}`,
        mimeType: imageData.mimeType,
      };
    } catch (error) {
      console.error("Gemini API error:", error);
      throw error; // Let client handle error display
    }
  },
});
```

### Client Usage Pattern

```typescript
// components/book/BookSearchModal.tsx
"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

export function BookSearchModal() {
  const searchBooks = useAction(api.actions.googleBooks.searchBooks);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const books = await searchBooks({ query, maxResults: 20 });
      setResults(books);
    } catch (error) {
      console.error("Search failed:", error);
      toast.error("Failed to search books");
    } finally {
      setIsSearching(false);
    }
  };

  // ... render search UI
}
```

---

## 2. API Key Management & Authentication

### Convex Environment Variables (Recommended)

**Store all API keys in Convex environment variables** for security and per-deployment configuration.

#### Setting Environment Variables

**Via Dashboard:**
1. Navigate to Deployment Settings in Convex Dashboard
2. Add environment variables:
   - `GOOGLE_BOOKS_API_KEY`
   - `GEMINI_API_KEY`
3. Variables are encrypted at rest and in transit

**Via CLI:**
```bash
# Set in development deployment
npx convex env set GOOGLE_BOOKS_API_KEY "your-api-key-here"
npx convex env set GEMINI_API_KEY "your-gemini-key-here"

# List current environment variables
npx convex env list

# Switch to production deployment and set separately
npx convex env set GOOGLE_BOOKS_API_KEY "prod-api-key" --prod
```

#### Accessing in Actions

```typescript
// convex/actions/example.ts
"use node";

import { action } from "../_generated/server";

export const myAction = action({
  handler: async (ctx, args) => {
    // Access environment variables via process.env
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

    if (!apiKey) {
      throw new Error("GOOGLE_BOOKS_API_KEY not configured");
    }

    // Use apiKey for external API calls
  },
});
```

#### Environment Variable Constraints

- Maximum 100 environment variables per deployment
- Variable names: max 40 characters, letters/numbers/underscores only, must start with letter
- Variable values: max 8KB per value
- **Per-deployment**: Different values for dev vs prod

#### Known Limitation: Multi-line Values

**Issue**: `convex env set` fails with multi-line values (e.g., PEM keys for JWT)
**Workaround**: Use dashboard for multi-line secrets or encode as base64

---

## 3. Caching Strategies for External API Responses

### Action Cache Component (Official Convex Solution)

**Install Action Cache:**
```bash
npx convex component install @convex-dev/action-cache
```

**Use Case**: Cache expensive API calls (Google Books lookups, Gemini generations) with optional TTL.

#### Example: Cached Google Books Lookup

```typescript
// convex/actions/googleBooksCached.ts
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { ActionCache } from "@convex-dev/action-cache/actionCache";

// Initialize cache with 1 hour TTL
const cache = new ActionCache(component.actionCache, {
  action: internal.actions.googleBooks.fetchBookData,
  ttl: 3600000, // 1 hour in milliseconds
});

/**
 * Fetch book data with caching
 * First call hits API, subsequent calls use cache for 1 hour
 */
export const getBookWithCache = action({
  args: {
    googleBooksId: v.string(),
  },
  handler: async (ctx, args) => {
    // Cache key is automatically: action name + arguments
    const bookData = await cache.fetch(ctx, {
      bookId: args.googleBooksId
    });

    return bookData;
  },
});

// Internal action that performs actual API call
export const fetchBookData = internalAction({
  args: {
    bookId: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes/${args.bookId}?key=${apiKey}`
    );

    if (!response.ok) return null;

    const item = await response.json();
    return {
      // ... transform book data
    };
  },
});
```

#### Cache Behavior

- **Cache Key**: Action name + arguments (automatically generated)
- **Expiration**: Optional TTL, expired entries cleaned daily via cron
- **Storage**: Cached values stored in Convex database
- **Invalidation**: Manual invalidation by deleting cache entries

#### Database-Level Caching Pattern

**Alternative**: Store API responses directly in Convex tables with timestamp-based expiration.

```typescript
// convex/schema.ts
export default defineSchema({
  // ... existing tables
  apiCache: defineTable({
    cacheKey: v.string(),
    data: v.any(),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_cache_key", ["cacheKey"]),
});

// convex/actions/googleBooksWithDbCache.ts
export const searchBooksWithCache = action({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const cacheKey = `google-books:${args.query}`;

    // Check cache first
    const cached = await ctx.runQuery(internal.cache.get, { cacheKey });
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Cache miss - fetch from API
    const results = await fetchGoogleBooks(args.query);

    // Store in cache with 1 hour expiration
    await ctx.runMutation(internal.cache.set, {
      cacheKey,
      data: results,
      expiresAt: Date.now() + 3600000,
    });

    return results;
  },
});
```

---

## 4. Rate Limiting & Retry Logic

### Rate Limiter Component (Official Solution)

**Install Rate Limiter:**
```bash
npx convex component install @convex-dev/rate-limiter
```

**Features:**
- Token bucket and fixed window algorithms
- Per-user or global rate limits
- Fair queuing via credit reservation
- Configurable sharding for high contention
- Returns `retryAt` timestamp for client backoff

#### Example: Rate-Limited Google Books Search

```typescript
// convex/actions/googleBooksRateLimited.ts
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { RateLimiter } from "@convex-dev/rate-limiter";

// Rate limiter: 10 requests per minute per user
const rateLimiter = new RateLimiter(component.rateLimiter, {
  kind: "token bucket",
  rate: 10,        // 10 tokens
  period: 60000,   // per 60 seconds
  capacity: 20,    // burst capacity
  maxReserved: 100, // max queued operations
});

export const searchBooksRateLimited = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Check rate limit before making API call
    const { ok, retryAt } = await rateLimiter.limit(ctx, userId, {
      count: 1, // consume 1 token
    });

    if (!ok) {
      // Rate limit exceeded - return retry timestamp
      throw new Error(`Rate limit exceeded. Retry after ${new Date(retryAt).toISOString()}`);
    }

    // Proceed with API call
    const results = await fetchGoogleBooks(args.query);
    return results;
  },
});
```

### Retry Logic with Exponential Backoff

**Pattern**: Use Convex scheduler to retry failed actions with exponential backoff.

```typescript
// convex/actions/googleBooksWithRetry.ts
"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const BACKOFF_BASE = 2;

export const searchBooksWithRetry = action({
  args: {
    query: v.string(),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const retryCount = args.retryCount ?? 0;

    try {
      // Attempt API call
      const results = await fetchGoogleBooks(args.query);
      return results;
    } catch (error) {
      if (retryCount >= MAX_RETRIES) {
        console.error(`Max retries exceeded for query: ${args.query}`);
        throw error;
      }

      // Calculate exponential backoff with jitter
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(BACKOFF_BASE, retryCount);
      const jitter = Math.random() * backoffMs * 0.1; // 10% jitter
      const delayMs = backoffMs + jitter;

      console.log(`Retry ${retryCount + 1}/${MAX_RETRIES} after ${delayMs}ms`);

      // Schedule retry using Convex scheduler
      await ctx.scheduler.runAfter(
        delayMs,
        internal.actions.googleBooksWithRetry.searchBooksWithRetry,
        {
          query: args.query,
          retryCount: retryCount + 1,
        }
      );

      // Return partial result or throw
      throw new Error("API call failed, retry scheduled");
    }
  },
});
```

### Handling Thundering Herd

**Problem**: Multiple clients retrying at same time overwhelm API
**Solution**: Add jitter to retry delays

```typescript
// Add random jitter to retry delay
const jitterFactor = 0.1 + Math.random() * 0.2; // 10-30% jitter
const delayMs = backoffMs * jitterFactor;
```

---

## 5. File Storage Options: Blob vs Convex vs URLs

### Recommendation: Store URLs in Database (Preferred)

**Best Practice for External API Covers:**
1. Google Books provides CDN-hosted cover URLs → **Store URL directly**
2. Gemini generates images → **Convert to data URL, let client upload to Vercel Blob**
3. User-uploaded covers → **Vercel Blob with presigned upload** (existing pattern)

### Storage Decision Matrix

| Storage Type | Use Case | Cost | Pros | Cons |
|--------------|----------|------|------|------|
| **External URL** ✅ | Google Books covers | Free | No storage cost, CDN-backed, simple | URL may expire, external dependency |
| **Vercel Blob** ✅ | User uploads, Gemini covers | $0.15/GB | Fast, integrated with Next.js, reliable | Storage cost, bandwidth cost |
| **Convex File Storage** ⚠️ | Large files, arbitrary formats | Included | Integrated with DB, transactional | 20MB limit via HTTP actions |
| **Cloudflare R2** ⚠️ | Cost optimization, large scale | $0.015/GB | Cheapest, no egress fees | Requires external component, complexity |

### Implementation: Store Cover URLs

```typescript
// convex/schema.ts
export default defineSchema({
  books: defineTable({
    // ... existing fields
    coverUrl: v.optional(v.string()),        // User-uploaded or generated (Vercel Blob URL)
    apiCoverUrl: v.optional(v.string()),     // Google Books thumbnail URL (external CDN)
    apiSource: v.optional(
      v.union(v.literal("google-books"), v.literal("open-library"), v.literal("manual"))
    ),
  }),
});

// Display logic: Prefer user upload, fallback to API cover
function getBookCoverUrl(book: Doc<"books">): string | undefined {
  return book.coverUrl || book.apiCoverUrl;
}
```

### Pattern: Gemini Cover → Blob Upload

**Flow:**
1. Action generates cover via Gemini → returns data URL
2. Client receives data URL, displays preview
3. Client converts data URL to Blob, uploads via existing Vercel Blob flow
4. Mutation saves Blob URL to `coverUrl` field

```typescript
// Client-side flow
const generateCover = useAction(api.actions.geminiImages.generateCover);
const updateBook = useMutation(api.books.update);

const handleGenerateCover = async () => {
  // Step 1: Generate via Gemini
  const { dataUrl } = await generateCover({
    bookTitle: book.title,
    author: book.author
  });

  // Step 2: Convert data URL to Blob
  const blob = await fetch(dataUrl).then(r => r.blob());

  // Step 3: Upload to Vercel Blob (existing flow)
  const { url } = await uploadCoverImage(blob);

  // Step 4: Save URL to database
  await updateBook({
    id: book._id,
    coverUrl: url
  });
};
```

### Convex File Storage (Alternative)

**Use if:** You want transactional file storage integrated with DB.

```typescript
// convex/actions/uploadCover.ts
import { action } from "../_generated/server";

export const uploadGeneratedCover = action({
  args: {
    bookId: v.id("books"),
    imageData: v.bytes(), // Binary image data
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Store file and get storage ID
    const storageId = await ctx.storage.store(
      new Blob([args.imageData], { type: "image/jpeg" })
    );

    // Save storage ID to database
    await ctx.runMutation(internal.books.updateCoverStorage, {
      bookId: args.bookId,
      storageId,
    });

    return storageId;
  },
});

// Serve file via HTTP action
export const serveCover = httpAction(async (ctx, request) => {
  const storageId = new URL(request.url).searchParams.get("id");
  const blob = await ctx.storage.get(storageId);

  if (!blob) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(blob, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
```

---

## 6. Background Job Queuing for Bulk Operations

### Workpool Component (Official Solution)

**Install Workpool:**
```bash
npx convex component install @convex-dev/workpool
```

**Use Case**: Queue bulk cover fetching/generation jobs with controlled concurrency.

#### Example: Bulk Cover Fetching Queue

```typescript
// convex/actions/bulkCoverFetch.ts
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { Workpool } from "@convex-dev/workpool";

// Workpool: max 5 concurrent cover fetch operations
const coverFetchPool = new Workpool(component.workpool, {
  maxParallelism: 5,
});

/**
 * Queue bulk cover fetch for books missing covers
 * Returns job ID for status tracking
 */
export const queueBulkCoverFetch = action({
  args: {
    bookIds: v.array(v.id("books")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Create background job status tracker
    const jobId = await ctx.runMutation(internal.jobs.createCoverFetchJob, {
      userId,
      totalBooks: args.bookIds.length,
    });

    // Queue each book for cover fetching
    for (const bookId of args.bookIds) {
      await coverFetchPool.runAction(ctx, internal.actions.bulkCoverFetch.fetchSingleCover, {
        bookId,
        jobId,
      });
    }

    return jobId;
  },
});

/**
 * Internal action to fetch single book cover
 * Called by workpool with controlled concurrency
 */
export const fetchSingleCover = internalAction({
  args: {
    bookId: v.id("books"),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    try {
      // Get book details
      const book = await ctx.runQuery(internal.books.getInternal, {
        id: args.bookId
      });

      if (!book || book.apiCoverUrl) {
        // Skip if book not found or already has cover
        await ctx.runMutation(internal.jobs.incrementSkipped, { jobId: args.jobId });
        return;
      }

      // Fetch cover from Google Books
      const coverUrl = await fetchCoverFromGoogleBooks(book.isbn);

      if (coverUrl) {
        // Update book with cover URL
        await ctx.runMutation(internal.books.updateInternal, {
          id: args.bookId,
          apiCoverUrl: coverUrl,
        });

        await ctx.runMutation(internal.jobs.incrementCompleted, { jobId: args.jobId });
      } else {
        await ctx.runMutation(internal.jobs.incrementFailed, { jobId: args.jobId });
      }
    } catch (error) {
      console.error(`Cover fetch failed for book ${args.bookId}:`, error);
      await ctx.runMutation(internal.jobs.incrementFailed, { jobId: args.jobId });
    }
  },
});
```

#### Job Status Tracking Schema

```typescript
// convex/schema.ts
export default defineSchema({
  // ... existing tables
  jobs: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("cover-fetch"), v.literal("cover-generate")),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    totalBooks: v.number(),
    completed: v.number(),
    failed: v.number(),
    skipped: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_status", ["userId", "status"]),
});

// convex/jobs.ts - Job status mutations
export const createCoverFetchJob = internalMutation({
  args: {
    userId: v.id("users"),
    totalBooks: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jobs", {
      userId: args.userId,
      type: "cover-fetch",
      status: "running",
      totalBooks: args.totalBooks,
      completed: 0,
      failed: 0,
      skipped: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const incrementCompleted = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const newCompleted = job.completed + 1;
    const isComplete = (newCompleted + job.failed + job.skipped) >= job.totalBooks;

    await ctx.db.patch(args.jobId, {
      completed: newCompleted,
      status: isComplete ? "completed" : "running",
      updatedAt: Date.now(),
    });
  },
});
```

#### Client: Monitor Job Progress

```typescript
// components/jobs/BulkCoverFetchProgress.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function BulkCoverFetchProgress({ jobId }: { jobId: Id<"jobs"> }) {
  const job = useQuery(api.jobs.get, { jobId });

  if (!job) return null;

  const progress = ((job.completed + job.failed + job.skipped) / job.totalBooks) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Fetching covers...</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-border rounded-full h-2">
        <div
          className="bg-leather h-2 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {job.completed} completed • {job.failed} failed • {job.skipped} skipped
      </div>
    </div>
  );
}
```

### Alternative: Scheduler-Based Queue

**Without Workpool**: Use Convex scheduler directly for sequential processing.

```typescript
// convex/actions/scheduledCoverFetch.ts
export const queueCoverFetch = action({
  args: {
    bookIds: v.array(v.id("books")),
  },
  handler: async (ctx, args) => {
    // Schedule first book immediately
    if (args.bookIds.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.scheduledCoverFetch.processCoverQueue,
        {
          bookIds: args.bookIds,
          currentIndex: 0,
        }
      );
    }
  },
});

export const processCoverQueue = internalAction({
  args: {
    bookIds: v.array(v.id("books")),
    currentIndex: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.currentIndex >= args.bookIds.length) {
      // Queue complete
      return;
    }

    const bookId = args.bookIds[args.currentIndex];

    // Process current book
    await fetchAndStoreCover(ctx, bookId);

    // Schedule next book with 500ms delay (rate limiting)
    await ctx.scheduler.runAfter(
      500,
      internal.actions.scheduledCoverFetch.processCoverQueue,
      {
        bookIds: args.bookIds,
        currentIndex: args.currentIndex + 1,
      }
    );
  },
});
```

---

## 7. Complete Example: Google Books Integration

### File Structure

```
convex/
├── actions/
│   ├── googleBooks.ts          # External API calls
│   └── googleBooksCached.ts    # Cached version with Action Cache
├── books.ts                     # Existing book mutations/queries
├── auth.ts                      # Existing auth helpers
└── schema.ts                    # Database schema

components/
└── book/
    ├── BookSearchModal.tsx      # Search UI
    └── BookResultCard.tsx       # Search result display
```

### Complete Action Implementation

```typescript
// convex/actions/googleBooks.ts
"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { requireAuth } from "../auth";

const GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1";

/**
 * Search Google Books API
 * Includes rate limiting, error handling, and retry logic
 */
export const searchBooks = action({
  args: {
    query: v.string(),
    maxResults: v.optional(v.number()),
    startIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

    if (!apiKey) {
      console.error("GOOGLE_BOOKS_API_KEY not configured");
      return [];
    }

    const maxResults = Math.min(args.maxResults ?? 20, 40);
    const startIndex = args.startIndex ?? 0;

    const url = new URL(`${GOOGLE_BOOKS_BASE_URL}/volumes`);
    url.searchParams.set("q", args.query);
    url.searchParams.set("maxResults", maxResults.toString());
    url.searchParams.set("startIndex", startIndex.toString());
    url.searchParams.set("key", apiKey);

    try {
      const response = await fetch(url.toString(), {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.status === 429) {
        // Rate limited - throw error with retry info
        const retryAfter = response.headers.get("Retry-After");
        throw new Error(`Rate limited. Retry after ${retryAfter || 60} seconds`);
      }

      if (!response.ok) {
        throw new Error(`Google Books API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        totalItems: data.totalItems ?? 0,
        items: transformGoogleBooksItems(data.items ?? []),
      };
    } catch (error) {
      console.error("Google Books search error:", error);
      return { totalItems: 0, items: [] };
    }
  },
});

/**
 * Get single book by Google Books ID
 * Uses caching to reduce API calls
 */
export const getBookById = action({
  args: { googleBooksId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

    if (!apiKey) return null;

    // Check if we already have this book in our database
    const existingBook = await ctx.runQuery(internal.books.getByApiId, {
      apiId: args.googleBooksId,
      apiSource: "google-books",
    });

    if (existingBook) {
      return transformBookDoc(existingBook);
    }

    // Fetch from API
    const url = `${GOOGLE_BOOKS_BASE_URL}/volumes/${args.googleBooksId}?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return null;

      const item = await response.json();
      return transformGoogleBooksItem(item);
    } catch (error) {
      console.error("Google Books fetch error:", error);
      return null;
    }
  },
});

/**
 * Import book from Google Books API directly to user's library
 */
export const importBook = action({
  args: {
    googleBooksId: v.string(),
    status: v.optional(v.union(
      v.literal("want-to-read"),
      v.literal("currently-reading"),
      v.literal("read")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Fetch book data
    const bookData = await getBookById(ctx, { googleBooksId: args.googleBooksId });

    if (!bookData) {
      throw new Error("Book not found");
    }

    // Create book in database
    const bookId = await ctx.runMutation(api.books.create, {
      ...bookData,
      status: args.status ?? "want-to-read",
    });

    return bookId;
  },
});

// Helper: Transform Google Books API response to our format
function transformGoogleBooksItems(items: any[]): any[] {
  return items.map(transformGoogleBooksItem);
}

function transformGoogleBooksItem(item: any) {
  const volumeInfo = item.volumeInfo || {};

  return {
    apiId: item.id,
    apiSource: "google-books" as const,
    title: volumeInfo.title || "Unknown Title",
    author: volumeInfo.authors?.join(", ") || "Unknown Author",
    description: volumeInfo.description,
    isbn: volumeInfo.industryIdentifiers?.find(
      (id: any) => id.type === "ISBN_13" || id.type === "ISBN_10"
    )?.identifier,
    publishedYear: volumeInfo.publishedDate
      ? parseInt(volumeInfo.publishedDate.substring(0, 4))
      : undefined,
    pageCount: volumeInfo.pageCount,
    apiCoverUrl: volumeInfo.imageLinks?.thumbnail?.replace("http:", "https:"),
    categories: volumeInfo.categories,
    language: volumeInfo.language,
  };
}
```

### Client-Side Integration

```typescript
// components/book/BookSearchModal.tsx
"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";

export function BookSearchModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchBooks = useAction(api.actions.googleBooks.searchBooks);
  const importBook = useAction(api.actions.googleBooks.importBook);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const response = await searchBooks({ query, maxResults: 20 });
      setResults(response.items);

      if (response.items.length === 0) {
        toast({
          title: "No results",
          description: "Try a different search query",
        });
      }
    } catch (error) {
      toast({
        title: "Search failed",
        description: "Could not search Google Books. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleImport = async (googleBooksId: string) => {
    try {
      await importBook({ googleBooksId, status: "want-to-read" });

      toast({
        title: "Book added",
        description: "Book added to your library",
      });

      onClose();
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Could not add book to library",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Google Books</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, author, or ISBN..."
            className="flex-1"
          />
          <Button type="submit" disabled={isSearching}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-3">
          {results.map((book) => (
            <div
              key={book.apiId}
              className="flex gap-3 p-3 border rounded-lg hover:bg-accent"
            >
              {book.apiCoverUrl && (
                <img
                  src={book.apiCoverUrl}
                  alt={book.title}
                  className="w-16 h-24 object-cover rounded"
                />
              )}
              <div className="flex-1">
                <h3 className="font-medium">{book.title}</h3>
                <p className="text-sm text-muted-foreground">{book.author}</p>
                {book.publishedYear && (
                  <p className="text-xs text-muted-foreground">
                    {book.publishedYear}
                  </p>
                )}
              </div>
              <Button
                onClick={() => handleImport(book.apiId)}
                variant="outline"
                size="sm"
              >
                Add to Library
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 8. Cost Analysis & Best Practices

### API Cost Comparison

| Service | Free Tier | Paid Tier | Rate Limits |
|---------|-----------|-----------|-------------|
| **Google Books API** | 1,000 req/day | No paid tier | 1,000 req/day per project |
| **Gemini API** | 60 req/min, 1,000 req/day | Pay-as-you-go | Varies by model |
| **Vercel Blob** | 500MB storage, 1GB bandwidth | $0.15/GB storage, $0.20/GB bandwidth | No rate limits |
| **Convex** | Free tier: 1M reads, 100K writes/month | Pro: $25/month | No hard limits |

### Best Practices Summary

1. **API Calls in Actions**: Always use Convex actions for external APIs, never client-side
2. **Environment Variables**: Store API keys in Convex env vars, separate for dev/prod
3. **Caching**: Use Action Cache component for expensive/repeated API calls
4. **Rate Limiting**: Implement rate limiter for user-facing API operations
5. **Retry Logic**: Use exponential backoff with jitter for failed API calls
6. **File Storage**: Store external API cover URLs directly, use Vercel Blob for uploads
7. **Background Jobs**: Use Workpool for bulk operations with controlled concurrency
8. **Error Handling**: Fail gracefully, return empty arrays instead of throwing when possible
9. **Monitoring**: Track API usage and error rates in background job status tables
10. **Cost Optimization**: Cache aggressively, implement user rate limits, prefer URL storage

---

## 9. Next Steps for Implementation

### Phase 1: Google Books Search (Immediate)

1. Install dependencies:
   ```bash
   # No additional dependencies needed - uses built-in fetch
   ```

2. Set environment variables:
   ```bash
   npx convex env set GOOGLE_BOOKS_API_KEY "your-key-here"
   ```

3. Create actions file:
   - Copy `convex/actions/googleBooks.ts` from examples above
   - Add internal queries to `convex/books.ts` for checking existing books

4. Create search modal component:
   - Copy `components/book/BookSearchModal.tsx`
   - Wire up to existing UI (add button to library page)

5. Test and iterate:
   - Manual testing in dev environment
   - Monitor API usage in Google Cloud Console
   - Add error tracking for API failures

### Phase 2: Caching & Rate Limiting (Short-term)

1. Install Action Cache:
   ```bash
   npx convex component install @convex-dev/action-cache
   ```

2. Wrap expensive operations:
   - Cache Google Books lookups by ID (1 hour TTL)
   - Cache search results (5 minute TTL)

3. Install Rate Limiter:
   ```bash
   npx convex component install @convex-dev/rate-limiter
   ```

4. Add rate limits:
   - 20 searches per minute per user
   - 5 imports per minute per user

### Phase 3: Gemini Cover Generation (Medium-term)

1. Set up Gemini API:
   ```bash
   npx convex env set GEMINI_API_KEY "your-key-here"
   ```

2. Create cover generation action:
   - Copy `convex/actions/geminiImages.ts`
   - Add UI button to book detail page

3. Integrate with existing upload flow:
   - Generate → data URL → client converts to Blob → upload via Vercel Blob
   - Reuse existing `app/api/blob/upload/route.ts` endpoint

### Phase 4: Bulk Cover Fetching (Future)

1. Install Workpool:
   ```bash
   npx convex component install @convex-dev/workpool
   ```

2. Create bulk job infrastructure:
   - Add `jobs` table to schema
   - Create job status mutations
   - Build progress UI component

3. Implement queue:
   - Copy `convex/actions/bulkCoverFetch.ts`
   - Add "Fetch Missing Covers" button to settings

---

## 10. References & Documentation

### Convex Documentation

- [Actions | Convex Developer Hub](https://docs.convex.dev/functions/actions)
- [Convex Tutorial: Calling External Services | Convex Developer Hub](https://docs.convex.dev/tutorial/actions)
- [Environment Variables | Convex Developer Hub](https://docs.convex.dev/production/environment-variables)
- [Scheduling | Convex Developer Hub](https://docs.convex.dev/scheduling)
- [File Storage | Convex Developer Hub](https://docs.convex.dev/file-storage)

### Convex Components

- [Action Cache](https://www.convex.dev/components/action-cache) - GitHub: [get-convex/action-cache](https://github.com/get-convex/action-cache)
- [Rate Limiter](https://www.convex.dev/components/rate-limiter) - GitHub: [get-convex/rate-limiter](https://github.com/get-convex/rate-limiter)
- [Workpool](https://www.convex.dev/components/workpool)

### Convex Best Practices

- [Best Practices | Convex Developer Hub](https://docs.convex.dev/understanding/best-practices/)
- [Background Job Management](https://stack.convex.dev/background-job-management)
- [Application-Layer Rate Limiting](https://stack.convex.dev/rate-limiting)
- [The Ultimate Caching Definition: Invalidation, Optimization, and Layers](https://stack.convex.dev/caching-in)

### External APIs

- [Google Books APIs | Getting Started](https://developers.google.com/books/docs/v1/getting_started)
- [Gemini API Documentation](https://ai.google.dev/docs)

### Storage Solutions

- [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
- [Cloudflare R2 Component for Convex](https://github.com/get-convex/r2)

---

## Conclusion

This research provides a comprehensive guide for integrating Google Books API and Gemini API into bibliomnomnom's Convex + Next.js architecture. The key architectural decisions are:

1. **Convex Actions** for all external API calls (security, transactionality, retry logic)
2. **Environment Variables** for API keys (per-deployment, encrypted)
3. **Action Cache** for expensive operations (reduce API costs, improve performance)
4. **Rate Limiter** for user-facing operations (prevent abuse, respect API quotas)
5. **URL Storage** for covers (cost-effective, simple, leverages CDNs)
6. **Workpool** for background jobs (controlled concurrency, fair queuing)

All patterns follow official Convex best practices from 2025 and integrate seamlessly with your existing architecture. Implementation can proceed in phases, starting with basic Google Books search and progressively adding caching, rate limiting, and advanced features.

**Recommended first implementation**: Google Books search modal (Phase 1) - highest value, lowest complexity.
