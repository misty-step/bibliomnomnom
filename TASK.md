# TASK.md - bibliomnomnom MVP PRD

**Version:** 1.0
**Last Updated:** 2025-11-07
**Status:** Planning → Development

---

## Executive Summary

**bibliomnomnom** is a digital garden for voracious readers—a beautiful, private-first book tracking application that transcends traditional reading trackers like Goodreads.

### Vision
Create a tool that bibliophiles *want* to use: gorgeous typography, generous whitespace, subtle animations, and intelligent features that respect privacy while enabling deep engagement with reading history.

### Core Philosophy
- **Beauty first**: Drop-dead gorgeous UI that makes book tracking a pleasure
- **Privacy default**: Everything private unless explicitly shared
- **Simplicity over complexity**: No star ratings, no ISBN bureaucracy, no cruft
- **Personal knowledge garden**: Growing collection of thoughts, not just book checkboxes

### Target Users
- Voracious readers who track 50+ books per year
- Bibliophiles who journal about their reading
- People frustrated with Goodreads' stale interface and Amazon ties
- Readers who want beautiful, private book tracking

---

## Tech Stack

### Core Technologies
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: Convex (real-time, serverless)
- **Authentication**: Clerk
- **Storage**: Vercel Blob Storage (custom book covers)
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Deployment**: Vercel
- **Icons**: Lucide React

### Why This Stack?
- **Next.js + Convex**: Type-safe, real-time data layer with excellent DX
- **Clerk**: Drop-in auth with beautiful UI, webhooks for user sync
- **Vercel ecosystem**: Seamless integration, zero-config deployment
- **shadcn/ui**: High-quality, customizable components
- **Convex**: Perfect for real-time updates, simple queries/mutations, built-in auth

---

## MVP Features (P0)

### 1. Authentication & User Management

**User Stories**
- As a new user, I can sign up with email or OAuth
- As a returning user, I can sign in securely
- As a user, I can manage my profile
- As the system, I sync Clerk users to Convex automatically

**Technical Requirements**
- Clerk integration via `@clerk/nextjs`
- User sync: Clerk webhook → Convex mutation
- Protect all book data behind authentication
- Support email/password, Google, GitHub OAuth

**Acceptance Criteria**
- ✓ Sign up flow works end-to-end
- ✓ Sign in redirects to library
- ✓ User data synced to Convex within 5 seconds
- ✓ Sign out clears session properly

---

### 2. Book Management

**User Stories**
- As a reader, I can add books to my library
- As a reader, I can track three states: Want to Read, Currently Reading, Read
- As a reader, I can mark books as favorites
- As a reader, I can indicate if a book is an audiobook
- As a reader, I can track rereads with a counter
- As a reader, I can note which edition I'm reading
- As a reader, I can upload custom book covers

**Book States**
1. **Want to Read**: Books on my wishlist
2. **Currently Reading**: Books I'm actively reading
3. **Read**: Books I've completed

**Book Attributes**
```typescript
{
  // Core metadata
  title: string
  author: string
  description?: string
  isbn?: string
  edition?: string  // Simple text: "First Edition", "2023 Revised", etc.

  // Flags
  isFavorite: boolean
  isAudiobook: boolean
  status: "want-to-read" | "currently-reading" | "read"
  privacy: "private" | "public"

  // Tracking
  timesRead: number  // 0 = never read, 1 = read once, 2+ = rereads
  dateStarted?: Date
  dateFinished?: Date

  // Images
  coverUrl?: string       // Custom uploaded cover (Vercel Blob)
  apiCoverUrl?: string    // Cover from book API

  // API metadata
  apiId?: string          // Google Books ID or Open Library ID
  apiSource?: "google-books" | "open-library" | "manual"
}
```

**Technical Requirements**
- Convex mutations for CRUD operations
- Real-time updates across all views
- Optimistic updates for instant feedback
- Custom cover upload via Vercel Blob client upload
- Support covers up to 5MB (JPEG, PNG, WEBP)

**Acceptance Criteria**
- ✓ Can add/edit/delete books
- ✓ Can move books between states smoothly
- ✓ Favorite flag toggles instantly
- ✓ Custom covers upload and display within 3 seconds
- ✓ Can track multiple rereads
- ✓ Edition field accepts freeform text

---

### 3. Book Discovery (API Integration)

**User Stories**
- As a reader, I can search for books by title or author
- As a reader, I can see book covers, descriptions, and metadata in search results
- As a reader, I can import a book with one click
- As a reader, I can manually add books not found in APIs

**API Strategy**
1. **Primary**: Google Books API (free, comprehensive)
2. **Fallback**: Open Library API
3. **Manual**: Full manual entry form

**Search Experience**
- Real-time search as user types (debounced)
- Display results in grid with covers
- Show: title, author, year, cover thumbnail
- Click to see full description
- "Add to Library" button on each result

**Technical Requirements**
- Server-side API calls (Next.js API routes or Convex actions)
- No API keys exposed to client
- Cache common searches (Redis or Convex cache)
- Rate limiting to respect API limits
- Graceful fallback if APIs unavailable

**Acceptance Criteria**
- ✓ Search returns results within 1 second
- ✓ Can import book with all metadata
- ✓ Manual entry works when search fails
- ✓ API errors handled gracefully

---

### 4. Notes, Quotes & Reflections

**User Stories**
- As a reader, I can write notes about books
- As a reader, I can save favorite quotes
- As a reader, I can write reflections during and after reading
- As a reader, I can optionally include page numbers
- As a reader, I can see all notes for a book in chronological order

**Content Types**
1. **Note**: General observations, thoughts, reactions
2. **Quote**: Verbatim text from the book
3. **Reflection**: Deeper synthesis, how it connects to life/other books

**Note Attributes**
```typescript
{
  bookId: string          // Reference to book
  type: "note" | "quote" | "reflection"
  content: string         // Rich text (markdown)
  page?: string           // Optional page number or location
  createdAt: Date
  updatedAt: Date
}
```

**Technical Requirements**
- Rich text editor (Tiptap or similar)
- Support markdown formatting
- Real-time save (debounced)
- Attach notes to books
- Sort by creation date

**Acceptance Criteria**
- ✓ Can create/edit/delete all three types
- ✓ Rich text formatting works
- ✓ Changes save automatically
- ✓ Notes display chronologically
- ✓ Page numbers optional and freeform

---

### 5. Privacy Controls

**User Stories**
- As a reader, all my books are private by default
- As a reader, I can make individual books public
- As a reader, public books are accessible via shareable URLs
- As a reader, private books never leak to public views

**Privacy Model**
- **Default**: All books private
- **Per-book toggle**: Private ↔ Public
- **Public books**: Accessible at `/books/[bookId]` without auth
- **Private books**: Require authentication and ownership

**What's Public When a Book is Public?**
- ✓ Book metadata (title, author, cover, description)
- ✓ Your notes, quotes, and reflections for that book
- ✓ Read status and favorite flag
- ✗ Other private books in your library
- ✗ Personal user data

**Technical Requirements**
- Row-level security in Convex queries
- Separate query functions for private vs public data
- Public book pages work without authentication
- Clear visual indicator on private vs public books

**Acceptance Criteria**
- ✓ Books private by default
- ✓ Can toggle book to public
- ✓ Public URL loads without sign-in
- ✓ Private books require auth
- ✓ No data leakage between private/public contexts

---

### 6. User Interface & Experience

**Design Principles**
1. **Generous Whitespace**: Breathing room, never cramped
2. **Deliberate Typography**: Hierarchy, readability, beauty
3. **Subtle Animation**: Smooth, delightful, never jarring
4. **Content-First**: Books and thoughts are heroes
5. **Responsive**: Desktop-first, mobile-friendly

**Typography System**
- **Headings**: Crimson Text / Georgia (serif, classic, readable)
- **Body**: Inter / System UI (sans-serif, clean, modern)
- **Monospace**: JetBrains Mono (for code/technical content)
- **Scale**: 12px, 14px, 16px, 20px, 24px, 32px, 48px, 64px

**Color Palette** (Bibliophile-Inspired)
```css
/* Sepia & Warm Tones */
--bg-primary: #FDFBF7      /* Warm white (aged paper) */
--bg-secondary: #F5F1E8    /* Lighter sepia */
--text-primary: #1A1A1A    /* Near black (ink) */
--text-secondary: #6B5D52  /* Warm gray (faded ink) */
--accent: #8B4513          /* Saddle brown (leather) */
--accent-light: #D4A574    /* Tan (aged pages) */
--border: #E8DED0          /* Subtle border */
```

**Key UI Components**
- **Library View**: Grid of book covers, filterable by status
- **Book Detail Page**: Cover, metadata, tabs for notes/quotes/reflections
- **Add Book Modal**: Search or manual entry
- **Note Editor**: Clean, distraction-free writing
- **Navigation**: Persistent sidebar or top nav

**Animations**
- Page transitions: Smooth fade or slide
- Book card hover: Subtle lift with shadow
- State changes: Gentle color/position transitions
- Loading: Elegant skeleton screens
- Success actions: Micro-celebrations (check marks, toasts)

**Technical Requirements**
- Tailwind CSS for styling
- shadcn/ui components as foundation
- Framer Motion for animations
- Responsive breakpoints: 640px, 768px, 1024px, 1280px
- Dark mode support (post-MVP)

**Acceptance Criteria**
- ✓ Loads look polished, never plain
- ✓ Transitions smooth, never janky
- ✓ Readable on all screen sizes
- ✓ Typography hierarchy clear
- ✓ Whitespace feels generous

---

## Data Model (Convex Schema)

### `users` Table
```typescript
{
  _id: Id<"users">
  clerkId: string           // Unique Clerk user ID
  email: string
  name?: string
  imageUrl?: string
  createdAt: number
  updatedAt: number
}
```

**Indexes**
- `by_clerk_id`: Index on `clerkId` for auth lookups

---

### `books` Table
```typescript
{
  _id: Id<"books">
  userId: Id<"users">       // Owner of this book

  // Metadata
  title: string
  author: string
  description?: string
  isbn?: string
  edition?: string
  publishedYear?: number
  pageCount?: number

  // Status & Flags
  status: "want-to-read" | "currently-reading" | "read"
  isFavorite: boolean
  isAudiobook: boolean
  privacy: "private" | "public"

  // Tracking
  timesRead: number
  dateStarted?: number
  dateFinished?: number

  // Images
  coverUrl?: string         // Custom uploaded cover (Vercel Blob)
  apiCoverUrl?: string      // Cover from API

  // API Integration
  apiId?: string            // External API ID
  apiSource?: "google-books" | "open-library" | "manual"

  // Timestamps
  createdAt: number
  updatedAt: number
}
```

**Indexes**
- `by_user`: Index on `userId` for fetching user's library
- `by_user_status`: Compound index on `[userId, status]` for filtered views
- `by_user_favorite`: Compound index on `[userId, isFavorite]` for favorites view

---

### `notes` Table
```typescript
{
  _id: Id<"notes">
  bookId: Id<"books">       // Which book this belongs to
  userId: Id<"users">       // Owner (denormalized for queries)

  type: "note" | "quote" | "reflection"
  content: string           // Markdown content
  page?: string             // Optional page number/location

  createdAt: number
  updatedAt: number
}
```

**Indexes**
- `by_book`: Index on `bookId` for fetching book's notes
- `by_user`: Index on `userId` for fetching user's all notes

---

### `reading_sessions` Table
```typescript
{
  _id: Id<"reading_sessions">
  bookId: Id<"books">
  userId: Id<"users">

  startDate: number
  endDate?: number          // null if still reading
  readNumber: number        // 1st read, 2nd read, etc.

  createdAt: number
}
```

**Indexes**
- `by_book`: Index on `bookId` for book's reading history
- `by_user`: Index on `userId` for user's reading timeline

---

## Key User Flows

### Flow 1: New User Onboarding
1. User lands on marketing page
2. Clicks "Get Started" → Clerk sign-up
3. Complete sign-up (email or OAuth)
4. Redirected to empty library with onboarding tooltip
5. Prompted to add first book
6. Search or manual entry
7. Book added → Success state

**Success Metrics**
- 80%+ complete onboarding within 5 minutes
- 60%+ add at least one book in first session

---

### Flow 2: Adding a Book
1. User clicks "Add Book" from library
2. Modal opens with search interface
3. Types book title or author
4. Results load in real-time
5. Clicks "Add" on desired book
6. Book appears in "Want to Read" state
7. Modal closes, shows success toast

**Alternative: Manual Entry**
- If search fails, clicks "Add Manually"
- Form with title, author, description, etc.
- Optionally upload custom cover
- Submit → Book added

---

### Flow 3: Reading Journey
1. Move book to "Currently Reading"
2. Set start date (or auto-set)
3. Add notes/quotes as reading progresses
4. Move to "Read" when finished
5. Set finish date
6. Write reflection
7. Optional: Mark as favorite
8. Optional: Upload custom cover

---

### Flow 4: Sharing a Book
1. View book detail page
2. Click privacy toggle "Make Public"
3. Confirmation modal explains what's shared
4. Confirm
5. Shareable URL generated
6. Copy link to share

---

## Technical Architecture

### Project Structure
```
bibliomnomnom/
├── app/                      # Next.js app directory
│   ├── (auth)/              # Auth routes
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── (dashboard)/         # Protected routes
│   │   ├── library/
│   │   ├── books/[id]/
│   │   └── settings/
│   ├── books/[id]/          # Public book pages
│   ├── api/
│   │   ├── blob/            # Vercel Blob upload handlers
│   │   └── webhooks/        # Clerk webhooks
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                  # shadcn components
│   ├── book/                # Book-specific components
│   ├── notes/               # Note/quote/reflection components
│   └── shared/              # Reusable components
├── convex/
│   ├── schema.ts            # Convex schema
│   ├── users.ts             # User mutations/queries
│   ├── books.ts             # Book mutations/queries
│   ├── notes.ts             # Note mutations/queries
│   ├── search.ts            # Book API search actions
│   └── auth.ts              # Auth helpers
├── lib/
│   ├── utils.ts             # Utility functions
│   ├── constants.ts         # App constants
│   └── types.ts             # Shared TypeScript types
├── public/
└── styles/
```

---

### Convex Queries & Mutations

**Books**
- `books.list`: Get user's books (filtered by status, privacy)
- `books.get`: Get single book details
- `books.getPublic`: Get public book (no auth required)
- `books.create`: Add new book
- `books.update`: Update book metadata/status
- `books.delete`: Remove book
- `books.updatePrivacy`: Toggle public/private
- `books.toggleFavorite`: Toggle favorite flag
- `books.incrementReread`: Increment timesRead counter

**Notes**
- `notes.list`: Get all notes for a book
- `notes.create`: Add note/quote/reflection
- `notes.update`: Edit note content
- `notes.delete`: Remove note

**Search** (Actions)
- `search.googleBooks`: Search Google Books API
- `search.openLibrary`: Search Open Library API (fallback)

**Users** (Mutations)
- `users.createFromClerk`: Create user from Clerk webhook
- `users.updateFromClerk`: Update user from Clerk webhook

---

### Authentication Flow

```
1. User signs in via Clerk
2. Clerk issues JWT token
3. Next.js middleware validates token
4. Token passed to Convex via ConvexProviderWithClerk
5. Convex queries use ctx.auth.getUserIdentity()
6. Queries filter data by userId
```

**Clerk Webhook → Convex**
- `user.created` → `users.createFromClerk`
- `user.updated` → `users.updateFromClerk`
- `user.deleted` → Soft delete or hard delete user data

---

### File Upload Flow

```
1. User selects image file
2. Client requests presigned URL from API route
3. API route generates Vercel Blob presigned URL
4. Client uploads directly to Vercel Blob
5. Upload returns blob URL
6. Client calls Convex mutation to save URL
7. Image displays immediately
```

---

## Success Criteria

### Performance
- ✓ Page load < 1 second (LCP)
- ✓ API search < 1 second
- ✓ Image upload < 3 seconds
- ✓ Mutations < 200ms
- ✓ Optimistic updates instant

### Functionality
- ✓ Can manage 500+ books without slowdown
- ✓ Search accurately finds books
- ✓ Privacy controls never leak data
- ✓ All CRUD operations work flawlessly
- ✓ Works on Chrome, Firefox, Safari, Edge

### User Experience
- ✓ Intuitive, no documentation needed
- ✓ Beautiful on first impression
- ✓ Animations smooth, not distracting
- ✓ Responsive on mobile and desktop
- ✓ Errors handled gracefully with helpful messages

### Business
- ✓ Users add 10+ books in first week
- ✓ 70%+ retention after 30 days
- ✓ Users report feeling delighted
- ✓ Prefer it to Goodreads

---

## Development Phases

### Phase 1: Foundation (Week 1)
- [ ] Next.js + TypeScript setup
- [ ] Tailwind + shadcn/ui configuration
- [ ] Convex initialization
- [ ] Clerk authentication
- [ ] Basic routing structure
- [ ] User schema and sync

### Phase 2: Core Features (Week 2-3)
- [ ] Book data model
- [ ] CRUD operations for books
- [ ] Library view with filtering
- [ ] Book detail page
- [ ] Book API integration (Google Books)
- [ ] Add book modal with search

### Phase 3: Content (Week 3-4)
- [ ] Notes data model
- [ ] Note/quote/reflection creation
- [ ] Rich text editor integration
- [ ] Display notes on book page
- [ ] Edit/delete notes

### Phase 4: Polish (Week 4-5)
- [ ] Privacy controls implementation
- [ ] Public book pages
- [ ] Custom cover upload (Vercel Blob)
- [ ] Favorite toggle
- [ ] Reread tracking
- [ ] Reading session tracking

### Phase 5: Design Refinement (Week 5-6)
- [ ] Typography finalization
- [ ] Color palette implementation
- [ ] Animation polish
- [ ] Responsive design
- [ ] Loading states
- [ ] Error states

### Phase 6: Testing & Launch (Week 6-7)
- [ ] E2E testing (Playwright?)
- [ ] Privacy audit
- [ ] Performance optimization
- [ ] Bug fixes
- [ ] Deploy to production
- [ ] Soft launch to friends/beta testers

---

## Open Questions

1. **Book API**: Google Books or Open Library primary? Both?
2. **Rich Text**: Tiptap, Lexical, or simple markdown?
3. **Reading sessions**: Automatically create on status change or manual?
4. **Edition tracking**: Just text field or structured data?
5. **Audiobook**: Just a flag or track narrators/duration?
6. **Public profiles**: Should users have public profile pages in MVP or post-MVP?
7. **Search**: Client-side search for user's library or always use API?

---

## Non-Goals (MVP)

These are explicitly **NOT** in MVP scope:

- ❌ AI features (embeddings, semantic search, recommendations)
- ❌ Analytics dashboard
- ❌ Reading goals/challenges
- ❌ Social features (following, activity feeds)
- ❌ Collections/shelves
- ❌ Import from Goodreads
- ❌ Dark mode
- ❌ Mobile app
- ❌ Keyboard shortcuts
- ❌ Ebook integration
- ❌ Series management
- ❌ Multi-language support
- ❌ Book lending tracker

All of these belong in BACKLOG.md for post-MVP development.

---

## References

- [Convex Docs](https://docs.convex.dev)
- [Clerk Docs](https://clerk.com/docs)
- [Vercel Blob Docs](https://vercel.com/docs/storage/vercel-blob)
- [shadcn/ui](https://ui.shadcn.com)
- [Google Books API](https://developers.google.com/books)
- [Open Library API](https://openlibrary.org/developers/api)

---

**Ready to build something beautiful. Let's ship it. 🚀**
