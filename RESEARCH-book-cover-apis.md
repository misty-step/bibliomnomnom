# Book Cover API Research - 2025 Best Practices

**Research Date:** 2025-11-25
**Status:** Complete

## Executive Summary

This research evaluates available book cover APIs for ISBN/title+author lookups, focusing on free/low-cost options suitable for the bibliomnomnom project. **Recommendation: Use Open Library Covers API as primary source with Google Books API as fallback.**

---

## 1. Available Book Cover APIs

### Primary Recommendation: Open Library Covers API ⭐

**Official Documentation:** https://openlibrary.org/dev/docs/api/covers

#### Key Features
- **Cost:** Completely free, no API key required
- **Authentication:** None required
- **Image Quality:** Small (S), Medium (M), Large (L) sizes available
- **Coverage:** Extensive collection from Internet Archive
- **Reliability:** High uptime, stable infrastructure

#### Rate Limits
- **By ISBN/OCLC/LCCN:** 100 requests per IP per 5 minutes (rate-limited)
- **By Cover ID/OLID:** Unlimited (no rate limiting)
- **Workaround:** Use Books API first to get Cover IDs, then fetch by Cover ID

#### URL Format
```
https://covers.openlibrary.org/b/isbn/{ISBN}-{SIZE}.jpg

Sizes: S (small), M (medium), L (large)
```

#### Example URLs
```
https://covers.openlibrary.org/b/isbn/9780385533225-L.jpg
https://covers.openlibrary.org/b/isbn/0451524934-M.jpg
https://covers.openlibrary.org/b/olid/OL7353617M-L.jpg (unlimited)
```

#### Code Example - Direct Fetch
```typescript
// Simple ISBN-based fetch (rate-limited)
async function fetchCoverByISBN(isbn: string, size: 'S' | 'M' | 'L' = 'L'): Promise<string> {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;

  // Check if cover exists (returns 404 placeholder if not found)
  const response = await fetch(url, { method: 'HEAD' });

  if (!response.ok || response.headers.get('content-type') !== 'image/jpeg') {
    throw new Error('Cover not found');
  }

  return url;
}

// Usage
const coverUrl = await fetchCoverByISBN('9780385533225', 'L');
```

#### Code Example - Avoiding Rate Limits
```typescript
// Fetch via Books API to get Cover ID (unlimited)
async function fetchCoverByCoverID(isbn: string, size: 'S' | 'M' | 'L' = 'L'): Promise<string | null> {
  // Step 1: Get book metadata including Cover ID
  const booksApiUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const response = await fetch(booksApiUrl);
  const data = await response.json();

  const bookKey = `ISBN:${isbn}`;
  if (!data[bookKey]?.cover) {
    return null;
  }

  // Step 2: Extract Cover ID from cover URL
  const coverUrl = data[bookKey].cover[size.toLowerCase()];
  if (coverUrl) {
    return coverUrl; // Already have the full URL
  }

  // Alternative: Extract Cover ID and build URL
  // Cover IDs are in format: https://covers.openlibrary.org/b/id/{COVER_ID}-{SIZE}.jpg
  const coverIdMatch = data[bookKey].cover.large?.match(/\/id\/(\d+)-/);
  if (coverIdMatch) {
    const coverId = coverIdMatch[1];
    return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
  }

  return null;
}

// Usage
const coverUrl = await fetchCoverByCoverID('9780385533225', 'L');
```

#### Metadata JSON Support
```typescript
// Get cover metadata by adding .json to URL
async function getCoverMetadata(isbn: string): Promise<any> {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Cover metadata not found');
  }

  return response.json();
}

// Example response:
// {
//   "source_url": "https://...",
//   "width": 1400,
//   "height": 2100
// }
```

---

### Secondary Option: Google Books API

**Official Documentation:** https://developers.google.com/books/docs/v1/using

#### Key Features
- **Cost:** Free tier with API key (no credit card required)
- **Authentication:** API key required (simple to obtain)
- **Image Quality:** Variable - smallThumbnail, thumbnail, small, medium, large (inconsistent availability)
- **Coverage:** Massive Google Books database
- **Reliability:** High uptime, enterprise-grade

#### Rate Limits
- **Free tier:** ~1,000 requests/day per project
- **Paid tier:** Request quota increase in API Console
- **User-based quotas:** Available for multi-user applications
- **Enterprise:** 100,000+ requests/day possible

#### URL Format
```
https://www.googleapis.com/books/v1/volumes?q=isbn:{ISBN}&key={API_KEY}
```

#### Image Quality Issues ⚠️
- Most queries return only `smallThumbnail` and `thumbnail`
- `small`, `medium`, `large`, `extraLarge` often missing
- Some books have no images at all
- Some "large" images point to first page instead of cover

#### Code Example - TypeScript/Next.js
```typescript
interface GoogleBooksImageLinks {
  smallThumbnail?: string;
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  extraLarge?: string;
}

interface GoogleBooksVolumeInfo {
  title: string;
  authors?: string[];
  imageLinks?: GoogleBooksImageLinks;
  // ... other fields
}

interface GoogleBooksItem {
  id: string;
  volumeInfo: GoogleBooksVolumeInfo;
}

interface GoogleBooksResponse {
  items?: GoogleBooksItem[];
  totalItems: number;
}

async function fetchGoogleBooksCover(
  isbn: string,
  apiKey: string
): Promise<string | null> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${apiKey}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`);
    }

    const data: GoogleBooksResponse = await response.json();

    // Check if any results found
    if (!data.items || data.items.length === 0) {
      return null;
    }

    const volumeInfo = data.items[0].volumeInfo;
    const imageLinks = volumeInfo.imageLinks;

    // IMPORTANT: imageLinks can be undefined!
    if (!imageLinks) {
      return null;
    }

    // Prefer larger sizes, fallback to smaller
    const coverUrl =
      imageLinks.extraLarge ||
      imageLinks.large ||
      imageLinks.medium ||
      imageLinks.small ||
      imageLinks.thumbnail ||
      imageLinks.smallThumbnail;

    // Upgrade to HTTPS if needed (some old URLs are HTTP)
    return coverUrl?.replace('http://', 'https://') || null;

  } catch (error) {
    console.error('Failed to fetch Google Books cover:', error);
    return null;
  }
}

// Usage
const coverUrl = await fetchGoogleBooksCover('9780385533225', process.env.GOOGLE_BOOKS_API_KEY!);
```

#### React Component Example
```typescript
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface BookCoverProps {
  isbn: string;
  title: string;
  apiKey: string;
}

export function GoogleBooksCover({ isbn, title, apiKey }: BookCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCover() {
      const url = await fetchGoogleBooksCover(isbn, apiKey);
      setCoverUrl(url);
      setLoading(false);
    }

    loadCover();
  }, [isbn, apiKey]);

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-64 w-40" />;
  }

  if (!coverUrl) {
    return <PlaceholderCover title={title} />;
  }

  return (
    <Image
      src={coverUrl}
      alt={`Cover of ${title}`}
      width={400}
      height={600}
      className="rounded shadow-lg"
    />
  );
}
```

---

### Alternative APIs (Paid/Limited)

#### ISBNdb API
- **Cost:** Paid (starts at $10/month for 5,000 requests)
- **Coverage:** 43+ million book titles
- **Image Quality:** High quality covers
- **Rate Limits:** Based on plan tier
- **Best for:** Commercial applications with budget

#### Internet Archive API
- **Cost:** Free
- **Coverage:** Limited to books in Internet Archive collection
- **Image Quality:** Variable, often scanned covers
- **Use case:** Fallback for older/rare books

---

## 2. Caching Best Practices for External Cover Images

### Strategy 1: Store in Vercel Blob (Recommended)

**Benefits:**
- No external API calls after first fetch
- Fast CDN delivery via Vercel's edge network
- Cost-efficient storage ($0.15/GB/month)
- Integrated with Vercel's caching infrastructure

**Implementation:**
```typescript
import { put, head } from '@vercel/blob';

async function cacheBookCover(isbn: string, sourceUrl: string): Promise<string> {
  const blobPath = `covers/${isbn}.jpg`;

  // Check if already cached
  try {
    const existing = await head(blobPath);
    if (existing) {
      return existing.url;
    }
  } catch {
    // Not cached yet
  }

  // Fetch from external API
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch cover');
  }

  const blob = await response.blob();

  // Upload to Vercel Blob
  const { url } = await put(blobPath, blob, {
    access: 'public',
    contentType: 'image/jpeg',
    cacheControlMaxAge: 31536000, // 1 year
  });

  return url;
}

// Usage in mutation
export const addBook = mutation({
  args: {
    isbn: v.string(),
    // ... other fields
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Fetch cover from Open Library
    const externalCoverUrl = `https://covers.openlibrary.org/b/isbn/${args.isbn}-L.jpg`;

    // Cache to Vercel Blob
    const cachedCoverUrl = await cacheBookCover(args.isbn, externalCoverUrl);

    // Store blob URL in database
    await ctx.db.insert('books', {
      userId,
      isbn: args.isbn,
      coverUrl: cachedCoverUrl,
      // ... other fields
    });
  }
});
```

### Strategy 2: Next.js Image Optimization with External URLs

**Benefits:**
- Automatic optimization (WebP/AVIF conversion, resizing)
- Edge caching on Vercel CDN
- Device-appropriate variants
- No storage costs (images cached temporarily)

**Configuration:**
```typescript
// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
        pathname: '/b/**',
      },
      {
        protocol: 'https',
        hostname: 'books.google.com',
        pathname: '/books/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year (covers don't change)
  },
};

export default config;
```

**Usage:**
```typescript
import Image from 'next/image';

export function BookCover({ coverUrl, title }: { coverUrl: string; title: string }) {
  return (
    <Image
      src={coverUrl}
      alt={`Cover of ${title}`}
      width={400}
      height={600}
      className="rounded shadow-lg"
      priority // For above-the-fold images
    />
  );
}
```

### Strategy 3: Serverless Image Proxy with Caching

**Benefits:**
- Full control over caching logic
- Can implement custom retry/fallback
- Cache headers optimized for CDN

**Implementation:**
```typescript
// app/api/covers/[isbn]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { isbn: string } }
) {
  const { isbn } = params;

  try {
    // Try Open Library first
    const olUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    const response = await fetch(olUrl);

    if (response.ok && response.headers.get('content-type')?.includes('image')) {
      const imageBuffer = await response.arrayBuffer();

      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable', // 1 year
          'CDN-Cache-Control': 'public, max-age=31536000',
        },
      });
    }

    // Fallback to placeholder
    return NextResponse.redirect('/placeholder-cover.jpg');

  } catch (error) {
    console.error('Cover fetch error:', error);
    return NextResponse.redirect('/placeholder-cover.jpg');
  }
}

// Usage in component
<Image
  src={`/api/covers/${isbn}`}
  alt={title}
  width={400}
  height={600}
/>
```

### Cache-Control Headers Best Practices

**For immutable book covers:**
```
Cache-Control: public, max-age=31536000, immutable
```

- `public`: Can be cached by CDN and browser
- `max-age=31536000`: Cache for 1 year (365 days)
- `immutable`: Tells browser to never revalidate (even on refresh)

**Cache busting:** If cover changes, update filename/URL instead of reducing cache time:
```typescript
// Example: Append timestamp to URL when cover is updated
const coverUrl = `${baseUrl}?v=${book.coverUpdatedAt}`;
```

---

## 3. Fallback Strategies When Covers Not Available

### Option 1: Generated Placeholder with Book Metadata

**Design Approach:**
- Use book title and author to generate unique, attractive placeholder
- Consistent color scheme (bibliophile theme)
- Typography-focused design

**Implementation:**
```typescript
// components/book/GeneratedCover.tsx
import { useMemo } from 'react';

interface GeneratedCoverProps {
  title: string;
  author?: string;
  isbn?: string;
}

function stringToColor(str: string): string {
  // Generate deterministic color from string
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = hash % 360;
  return `hsl(${hue}, 45%, 40%)`; // Muted, book-like colors
}

export function GeneratedCover({ title, author, isbn }: GeneratedCoverProps) {
  const backgroundColor = useMemo(() => stringToColor(isbn || title), [isbn, title]);

  // Extract initials or short title
  const displayText = title.length > 30 ? title.substring(0, 27) + '...' : title;

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center p-6 text-paper"
      style={{ backgroundColor }}
    >
      <div className="font-serif text-2xl text-center leading-tight mb-4">
        {displayText}
      </div>
      {author && (
        <div className="font-sans text-sm opacity-80 text-center">
          {author}
        </div>
      )}
    </div>
  );
}
```

### Option 2: Static Placeholder Assets

**Design Trends for 2025:**
- **Minimal Typography:** Bold, clear fonts with simple layouts
- **Gothic Art Academia:** Dark, sophisticated aesthetic
- **Thumbnail Optimization:** Looks good at small sizes and full size

**Example Placeholder:**
```typescript
// public/placeholder-cover.jpg - Static designed asset
// Or use SVG for scalability:

export function PlaceholderCover({ title }: { title: string }) {
  return (
    <svg
      width="400"
      height="600"
      viewBox="0 0 400 600"
      className="w-full h-full"
    >
      <rect width="400" height="600" fill="#FDFBF7"/> {/* Paper color */}
      <rect
        x="20"
        y="20"
        width="360"
        height="560"
        fill="none"
        stroke="#1A1A1A"
        strokeWidth="2"
      />
      <text
        x="200"
        y="300"
        textAnchor="middle"
        fill="#1A1A1A"
        fontSize="24"
        fontFamily="Crimson Text, serif"
      >
        {title.substring(0, 20)}
      </text>
      <text
        x="200"
        y="350"
        textAnchor="middle"
        fill="#8B4513"
        fontSize="16"
        fontFamily="Inter, sans-serif"
      >
        Cover unavailable
      </text>
    </svg>
  );
}
```

### Option 3: Cascading Fallback Chain

**Recommended implementation:**
```typescript
async function getCoverWithFallbacks(
  isbn: string,
  title: string,
  author?: string
): Promise<{ type: 'url' | 'generated'; url?: string }> {

  // 1. Try Open Library (fast, reliable)
  try {
    const olUrl = await fetchCoverByCoverID(isbn, 'L');
    if (olUrl) {
      // Verify image exists
      const response = await fetch(olUrl, { method: 'HEAD' });
      if (response.ok) {
        return { type: 'url', url: olUrl };
      }
    }
  } catch (error) {
    console.warn('Open Library fetch failed:', error);
  }

  // 2. Try Google Books API (good coverage)
  try {
    const gbUrl = await fetchGoogleBooksCover(isbn, process.env.GOOGLE_BOOKS_API_KEY!);
    if (gbUrl) {
      return { type: 'url', url: gbUrl };
    }
  } catch (error) {
    console.warn('Google Books fetch failed:', error);
  }

  // 3. Use generated placeholder
  return { type: 'generated' };
}

// Usage in component
export function SmartBookCover({ isbn, title, author }: BookCoverProps) {
  const [cover, setCover] = useState<{ type: 'url' | 'generated'; url?: string } | null>(null);

  useEffect(() => {
    getCoverWithFallbacks(isbn, title, author).then(setCover);
  }, [isbn, title, author]);

  if (!cover) {
    return <LoadingSkeleton />;
  }

  if (cover.type === 'url') {
    return <Image src={cover.url!} alt={title} width={400} height={600} />;
  }

  return <GeneratedCover title={title} author={author} isbn={isbn} />;
}
```

---

## 4. Recommended Architecture for bibliomnomnom

### Phase 1: MVP Implementation (Immediate)

**Primary Source:** Open Library Covers API (unlimited via Cover ID)
**Fallback:** Generated placeholder with book metadata
**Storage:** Direct external URLs (no caching yet)
**Next.js Config:** Whitelist `covers.openlibrary.org` for Image component

```typescript
// convex/books.ts
export const create = mutation({
  args: {
    isbn: v.string(),
    title: v.string(),
    author: v.optional(v.string()),
    // ...
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Fetch cover URL from Open Library (via Cover ID to avoid rate limits)
    let coverUrl: string | null = null;

    try {
      const booksApiUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${args.isbn}&format=json&jscmd=data`;
      const response = await fetch(booksApiUrl);
      const data = await response.json();

      const bookKey = `ISBN:${args.isbn}`;
      if (data[bookKey]?.cover?.large) {
        coverUrl = data[bookKey].cover.large;
      }
    } catch (error) {
      console.error('Failed to fetch Open Library cover:', error);
      // coverUrl remains null, will use generated placeholder on frontend
    }

    // Store book with external cover URL (or null)
    await ctx.db.insert('books', {
      userId,
      isbn: args.isbn,
      title: args.title,
      author: args.author,
      coverUrl, // Can be null
      // ...
    });
  }
});
```

```typescript
// components/book/BookCover.tsx
'use client';

import Image from 'next/image';
import { GeneratedCover } from './GeneratedCover';

interface BookCoverProps {
  coverUrl?: string | null;
  title: string;
  author?: string;
  isbn?: string;
}

export function BookCover({ coverUrl, title, author, isbn }: BookCoverProps) {
  if (!coverUrl) {
    return <GeneratedCover title={title} author={author} isbn={isbn} />;
  }

  return (
    <Image
      src={coverUrl}
      alt={`Cover of ${title}`}
      width={400}
      height={600}
      className="rounded shadow-lg object-cover"
      onError={(e) => {
        // If external image fails to load, show generated placeholder
        e.currentTarget.style.display = 'none';
        e.currentTarget.nextElementSibling?.classList.remove('hidden');
      }}
    />
  );
}
```

### Phase 2: Enhanced Implementation (Post-MVP)

**Primary:** Open Library via Cover ID
**Secondary:** Google Books API (requires API key)
**Storage:** Cache to Vercel Blob on first access
**Optimization:** Next.js Image with WebP/AVIF conversion

```typescript
// convex/actions.ts (Convex Action for external API calls)
export const fetchAndCacheBookCover = action({
  args: { isbn: v.string() },
  handler: async (ctx, args): Promise<string | null> => {
    // Try Open Library first
    let coverUrl = await fetchOpenLibraryCover(args.isbn);

    // Fallback to Google Books
    if (!coverUrl) {
      coverUrl = await fetchGoogleBooksCover(
        args.isbn,
        process.env.GOOGLE_BOOKS_API_KEY!
      );
    }

    if (!coverUrl) {
      return null;
    }

    // Cache to Vercel Blob
    const cachedUrl = await cacheToVercelBlob(args.isbn, coverUrl);

    return cachedUrl;
  }
});
```

### Phase 3: Advanced Features (Future)

- Manual cover upload override (already supported via Vercel Blob)
- Cover refresh/update functionality
- Multiple cover versions (different editions)
- Cover quality scoring (prefer higher quality sources)
- Analytics on cover source success rates

---

## 5. Comparison Matrix

| Feature | Open Library | Google Books | ISBNdb (Paid) |
|---------|-------------|--------------|---------------|
| **Cost** | Free | Free (with key) | $10/mo+ |
| **Auth Required** | No | Yes (API key) | Yes (API key) |
| **Rate Limit** | 100/5min (ISBN)<br>Unlimited (Cover ID) | ~1,000/day | Plan-based |
| **Image Quality** | Good (S/M/L) | Variable | Excellent |
| **Coverage** | Extensive | Massive | 43M+ titles |
| **Reliability** | High | Very High | High |
| **ISBN Lookup** | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| **Title+Author Lookup** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Setup Complexity** | Minimal | Low | Medium |
| **Best For** | MVP, indie projects | Apps with existing Google integration | Commercial apps |

---

## 6. Implementation Checklist for bibliomnomnom

### Immediate (MVP)
- [ ] Add Open Library fetch to `books.create` mutation
- [ ] Use Books API with Cover ID to avoid rate limits
- [ ] Store external cover URL in `coverUrl` field (nullable)
- [ ] Create `GeneratedCover` component for fallback
- [ ] Update `next.config.ts` to whitelist `covers.openlibrary.org`
- [ ] Add error handling for failed cover fetches
- [ ] Update `BookCover` component to handle null coverUrl

### Post-MVP
- [ ] Add Google Books API as secondary source
- [ ] Obtain and configure Google Books API key
- [ ] Implement Convex Action for external API calls
- [ ] Cache covers to Vercel Blob on first access
- [ ] Add cover refresh functionality in admin UI
- [ ] Implement cascading fallback chain
- [ ] Add analytics for cover source success rates

### Future Enhancements
- [ ] Support multiple cover versions (different editions)
- [ ] Cover quality scoring algorithm
- [ ] Batch cover fetching for bulk imports
- [ ] Admin dashboard for cover source management
- [ ] Cover upload override UI (already supported backend)

---

## 7. Code Examples Summary

### Minimal MVP Implementation (Recommended for bibliomnomnom)

**1. Fetch cover in Convex mutation:**
```typescript
// convex/books.ts
const coverUrl = await fetchOpenLibraryCoverByCoverID(args.isbn);
await ctx.db.insert('books', { coverUrl, /* ... */ });
```

**2. Display with fallback:**
```typescript
// components/book/BookCover.tsx
{coverUrl ? (
  <Image src={coverUrl} alt={title} width={400} height={600} />
) : (
  <GeneratedCover title={title} author={author} isbn={isbn} />
)}
```

**3. Configure Next.js:**
```typescript
// next.config.ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'covers.openlibrary.org' }
  ],
  minimumCacheTTL: 31536000, // 1 year
}
```

---

## Sources

### API Documentation
- [Open Library Covers API](https://openlibrary.org/dev/docs/api/covers)
- [Open Library Books API](https://openlibrary.org/dev/docs/api/books)
- [Google Books API Documentation](https://developers.google.com/books/docs/v1/using)
- [ISBNDB Blog - Top 9 Book APIs](https://isbndb.com/blog/book-api/)
- [ISBNDB Blog - How to Get Book Cover Images](https://isbndb.com/blog/how-to-get-book-cover-images/)

### Rate Limits & Authentication
- [Stack Overflow - Open Library Rate Limits](https://stackoverflow.com/questions/43091801/open-library-covers-api-rate-limit)
- [GitHub Issue - Understanding Open Library API Rate Limits](https://github.com/internetarchive/openlibrary/issues/10585)
- [Stack Overflow - Google Books API Rate Limiting](https://stackoverflow.com/questions/35302157/google-books-api-rate-limiting-information)

### Image Quality & Implementation
- [Stack Overflow - High Quality Covers from Google Books](https://stackoverflow.com/questions/65562340/high-quality-book-covers-using-google-books-api)
- [Stack Overflow - Getting Book Cover from ISBN](https://stackoverflow.com/questions/14422528/how-to-get-book-cover-from-isbn-using-google-book-api)
- [CodePen - Getting Book Cover through Google Books API](https://codepen.io/Kicky/pen/ZxvvqE)

### Caching & Optimization
- [Vercel Blob Documentation](https://vercel.com/docs/vercel-blob)
- [Stefan Judis - Serverless Function as Image Proxy](https://www.stefanjudis.com/snippets/how-to-use-a-serverless-function-as-image-caching-proxy/)
- [Next.js Image Component Documentation](https://nextjs.org/docs/app/api-reference/components/image)
- [Next.js Image Optimization Guide](https://nextjs.org/docs/app/getting-started/images)
- [Uploadcare - Image Optimization for Next.js](https://uploadcare.com/blog/image-optimization-in-nextjs/)

### Design & Fallbacks
- [Novelist Plugin - Cover Coming Soon Image](https://novelistplugin.com/coming-soon-book-cover/)
- [Damonza - Book Cover Trends for 2025](https://damonza.com/book-cover-trends-for-2025/)
- [MIBLART - 10 Book Cover Design Trends for 2025](https://miblart.com/blog/book-cover-trends-this-year/)

---

**Research Completed:** 2025-11-25
**Researcher:** Claude Code (Sonnet 4.5)
**Project:** bibliomnomnom - Book Tracking Application
