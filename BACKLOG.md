# BACKLOG.md

Last groomed: 2025-11-24 (quality infrastructure implementation)
Analyzed by: 8 specialized perspectives (complexity, architecture, security, performance, maintainability, UX, product, design)

---

## Now (Sprint-Ready, <2 weeks)

### [PRODUCT] Support rambling voice notes

- use case: after a reading session, i want to just talk to my phone about what i read in a disorganized way
- i want this to create / save a few things:
  * the raw transcription of the ramble
  * an organized synthesis of it
  * pushback / feedback / followup questions / challenges / things to mull over etc

### [ADOPTION BLOCKER] Export to JSON/CSV/Markdown

**File**: New feature - export module
**Perspectives**: product-visionary, security-sentinel (data portability)
**Business Case**:

- **Trust signal**: "Your data, your control" → removes "what if it shuts down" objection
- **Try-before-commit**: "I can always leave" paradoxically increases retention
- **Data portability**: GDPR/CCPA compliance, ethical table stakes
- **Integration ecosystem**: Export JSON → Notion/Obsidian/Roam workflows

**Implementation**:

```typescript
// convex/books.ts - New query
export const exportAllData = query({
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const books = await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      version: "1.0",
      exportedAt: Date.now(),
      books,
      notes,
    };
  },
});

// Frontend: Download as .json, .csv (Goodreads-compatible), .md (Obsidian-compatible)
```

**Acceptance Criteria**:

- "Export Library" button in settings
- Choose format: JSON (complete), CSV (Goodreads-compatible), Markdown (human-readable)
- Downloads file immediately
- JSON includes all fields (books + notes + metadata)
- CSV maps to Goodreads import format (reverse of import)

**Effort**: 1d (JSON) + 1d (CSV/Markdown) = 2d | **Impact**: Removes adoption barrier
**ROI**: Paradox of data freedom - easier to leave → more likely to stay

---

### [ADOPTION BLOCKER] External Book Search (Google Books API)

**File**: New feature - search modal (deferred from MVP)
**Perspectives**: product-visionary, user-experience-advocate
**Architecture**: Already designed in DESIGN.md Module 3
**Business Case**:

- **Universal expectation**: Every book app has search (Goodreads, StoryGraph, Literal, Oku)
- **3-second add vs. 2-minute add**: Search title → select → done (vs. type 10 fields manually)
- **Data quality**: Auto-filled covers, ISBNs, descriptions, page counts
- **Velocity multiplier**: Users add 5-10x more books when it's easy

**Implementation**:

```typescript
// convex/actions/googleBooks.ts
export const searchBooks = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`,
    );
    const data = await response.json();

    return data.items.map((item) => ({
      title: item.volumeInfo.title,
      author: item.volumeInfo.authors?.join(", "),
      coverUrl: item.volumeInfo.imageLinks?.thumbnail,
      isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier,
      pageCount: item.volumeInfo.pageCount,
      publishedYear: new Date(item.volumeInfo.publishedDate).getFullYear(),
      description: item.volumeInfo.description,
      apiSource: "google",
      apiId: item.id,
    }));
  },
});

// Frontend: SearchModal with debounced input (300ms), show results, click to auto-fill form
```

**Acceptance Criteria**:

- "Search for book" button in add book flow
- Type "Dune" → see 10 results with covers
- Click result → form auto-filled (title, author, ISBN, cover, page count, year)
- User can edit before saving
- "Not found? Add manually" fallback option
- Loading state, error handling

**Effort**: 3d (API integration) + 2d (UX polish) = 5d | **Impact**: Core workflow 10x improvement
**ROI**: Users add 5-10x more books, increases engagement and data accumulation (enables AI features later)

---

### [CRITICAL UX] Toast Notifications for Silent Failures

**Files**: CreateNote.tsx:59, NoteCard.tsx:60,72, BookDetail.tsx:78,88,99,113
**Perspectives**: user-experience-advocate, maintainability-maven
**Problem**:

- Note creation fails → user sees nothing, content lost
- Book toggle fails → optimistic update reverts silently, user confused
- Update/delete fails → no feedback, user assumes success

**Impact**: Users lose work, lose trust, abandon app

**Fix**:

```typescript
// components/notes/CreateNote.tsx:59
} catch (err) {
  console.error("Failed to create note:", err);
  toast({
    title: "Failed to save note",
    description: "Your note wasn't saved. Please try again.",
    variant: "destructive",
  });
  // Keep content in editor so user can retry
}

// Apply same pattern to NoteCard.tsx updates/deletes, BookDetail.tsx toggles
```

**Acceptance Criteria**:

- Any mutation failure shows toast with clear message
- Toast explains what went wrong (connection, server error, etc.)
- User can retry action (content preserved in forms)
- No more silent failures anywhere in app

**Effort**: 2h (add toasts to 8 catch blocks) | **Impact**: Prevents data loss, builds trust
**Priority**: CRITICAL - users losing work

---

### [CRITICAL REFACTOR] Extract Ownership Validation Helpers

**Files**: convex/books.ts (6 occurrences), convex/notes.ts (4 occurrences)
**Perspectives**: complexity-archaeologist, architecture-guardian, maintainability-maven
**Violation**: Change amplification - ownership validation duplicated 10 times across 2 modules

**Problem**:

```typescript
// Repeated 10 times:
const book = await ctx.db.get(args.id);
if (!book || book.userId !== userId) {
  throw new Error("Access denied");
}
```

**Change amplification**: Adding team access, shared libraries, or admin override requires editing 10 locations

**Fix**:

```typescript
// convex/auth.ts - Centralize ownership validation
export async function requireBookOwnership(
  ctx: QueryCtx | MutationCtx,
  bookId: Id<"books">,
): Promise<Doc<"books">> {
  const userId = await requireAuth(ctx);
  const book = await ctx.db.get(bookId);

  if (!book || book.userId !== userId) {
    throw new ConvexError("Book not found or access denied");
  }

  return book;
}

export async function requireNoteOwnership(
  ctx: QueryCtx | MutationCtx,
  noteId: Id<"notes">,
): Promise<Doc<"notes">> {
  const userId = await requireAuth(ctx);
  const note = await ctx.db.get(noteId);

  if (!note || note.userId !== userId) {
    throw new ConvexError("Note not found or access denied");
  }

  return note;
}

// Usage (books.ts:remove)
export const remove = mutation({
  args: { id: v.id("books") },
  handler: async (ctx, args) => {
    await requireBookOwnership(ctx, args.id); // One line replaces 4
    await ctx.db.delete(args.id);
  },
});
```

**Acceptance Criteria**:

- All 10 ownership checks use new helpers
- Tests verify helpers work (ownership validation, error messages)
- Future ownership changes require single edit

**Effort**: 3h (extract + refactor 10 sites + test) | **Impact**: Eliminates 40 lines duplication, unblocks team features
**Strategic Value**: Foundation for shared libraries, team features, admin tools

---

### [CRITICAL INFRASTRUCTURE] Fix Build Command for Convex Deployment

**File**: package.json:16, vercel.json (NEW), .github/workflows/\*.yml
**Perspectives**: architecture-guardian, security-sentinel
**Gap**: Build command is `next build` (missing Convex deploy) → production failures inevitable

**Critical Issue**: Convex schema/functions MUST deploy before Next.js build (types depend on Convex)

**Fix**:

```json
// package.json
{
  "scripts": {
-   "build": "next build",
+   "build": "npx convex deploy && next build",
  }
}

// vercel.json (NEW FILE - override Vercel's build command)
{
  "buildCommand": "npx convex deploy && pnpm build",
  "framework": "nextjs"
}
```

**Acceptance Criteria**:

- ✅ `pnpm build` runs Convex deploy first
- ✅ Vercel deployments use correct build command
- ✅ Preview deploys work (Convex preview env configured)
- ✅ Build fails fast if Convex deploy fails (no orphaned Next.js build)

**Effort**: 30m (update scripts + create vercel.json + test deploy) | **Impact**: Prevents production build failures
**ROI**: CRITICAL. Without this, first Vercel deploy will fail. Saves hours debugging "why doesn't it work in prod?"

---

### [CRITICAL INFRASTRUCTURE] Structured Logging with Pino

**Files**: 16 console.log/error calls across components + API routes
**Perspectives**: architecture-guardian, security-sentinel
**Gap**: No log levels, no structured JSON, no correlation IDs → production debugging impossible

**Implementation**:

```typescript
// lib/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true },
        }
      : undefined,
});

// Usage (replace all console.error)
// Before: console.error("Failed to update note:", err);
// After:  logger.error({ err, noteId, userId }, 'Failed to update note');
```

**Acceptance Criteria**:

- All console.log/error replaced with logger
- Production logs are JSON (searchable in logging service)
- Dev logs are pretty-printed (human-readable)
- Errors include context (bookId, userId, etc.)

**Effort**: 4h (install + migrate 16 call sites) | **Impact**: Production debugging capability
**ROI**: First production bug saves 2h debugging time, pays for itself immediately

---

### [CRITICAL INFRASTRUCTURE] Sentry Error Tracking + PII Redaction

**File**: New - sentry.client.config.ts, sentry.server.config.ts, instrumentation.ts
**Perspectives**: architecture-guardian, security-sentinel
**Gap**: Production errors invisible, no stack traces, no user context

**CRITICAL**: Must use Vercel Integration (not manual tokens) to avoid preview deploy breakage

**Implementation**:

```bash
# Step 1: Install via Sentry wizard (auto-creates configs)
npx @sentry/wizard@latest -i nextjs

# Step 2: Enable Vercel Integration in Sentry dashboard
# Automatically sets SENTRY_DSN, SENTRY_PROJECT, SENTRY_ORG env vars
```

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% trace sampling (stay within free tier)

  // PII REDACTION (CRITICAL - GDPR compliance)
  sendDefaultPii: false,
  beforeSend(event) {
    // Redact email addresses
    if (event.user?.email) {
      event.user.email = "[EMAIL_REDACTED]";
    }

    // Scrub emails from exception messages
    if (event.exception?.values) {
      event.exception.values.forEach((ex) => {
        if (ex.value) {
          ex.value = ex.value.replace(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            "[EMAIL_REDACTED]",
          );
        }
      });
    }

    return event;
  },
});

// sentry.server.config.ts (same structure, server-side DSN)
// instrumentation.ts (Next.js 15 - registers Sentry)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
```

```typescript
// In catch blocks (app/api/blob/upload/route.ts:44, components/notes/CreateNote.tsx:59, etc.)
import * as Sentry from '@sentry/nextjs';

try {
  await createNote({ ... });
} catch (err) {
  Sentry.captureException(err, {
    contexts: {
      book: { id: bookId },
      note: { type: noteType }
    },
    user: { id: userId }, // ID only, never email/name
  });

  toast({
    title: "Failed to save note",
    description: "Please try again.",
    variant: "destructive",
  });
}
```

**Acceptance Criteria**:

- ✅ Vercel Integration configured (not manual DSN)
- ✅ PII redaction active (emails scrubbed from all errors)
- ✅ Source maps uploaded automatically on deploy
- ✅ Test error route `/test-error` verified
- ✅ All catch blocks instrument errors (7 files: CreateNote, NoteCard, BookDetail, BookForm, AddBookSheet, upload route, webhooks)
- ✅ Dashboard shows error frequency, affected users
- ✅ Alerts configured for new error types

**Effort**: 3h (wizard + Vercel Integration + PII redaction + instrument 7 catch blocks) | **Impact**: Production error visibility + GDPR compliance
**ROI**: Discover bugs users don't report, fix before they churn. First prevented production issue saves 4+ hours debugging.

---

### [CRITICAL INFRASTRUCTURE] Vercel Analytics + Speed Insights (QUICK WIN)

**File**: app/layout.tsx, package.json
**Perspectives**: product-visionary, user-experience-advocate
**Gap**: Zero visibility into user behavior, feature usage, performance metrics → can't make data-driven product decisions

**Why This Is Critical**:

- **Free & native**: Built into Vercel, zero config after install
- **Privacy-first**: GDPR compliant, no cookies, respects DNT
- **Real user metrics**: Actual user behavior, not synthetic tests
- **Core Web Vitals**: LCP, FID, CLS tracking for performance
- **5 minute setup**: Fastest observability win possible

**Implementation**:

```bash
# Install packages
pnpm add @vercel/analytics @vercel/speed-insights
```

```typescript
// app/layout.tsx (add to existing layout, line ~44)
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable} font-sans antialiased`}>
          <ConvexClientProvider>
            {children}
            <Toaster />
            <Analytics /> {/* Add this */}
            <SpeedInsights /> {/* Add this */}
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

**Enable in Vercel Dashboard**:

1. Go to Project Settings → Analytics → Enable
2. Go to Project Settings → Speed Insights → Enable
3. View metrics at https://vercel.com/[team]/[project]/analytics

**What You Get**:

- **Page views**: Which routes users visit most
- **User engagement**: Time on page, bounce rate
- **Conversion funnels**: Sign-up → Library → Add Book flows
- **Core Web Vitals**: LCP < 2.5s, FID < 100ms, CLS < 0.1
- **Device breakdown**: Desktop vs. mobile usage
- **Geographic distribution**: Where users are located

**Acceptance Criteria**:

- ✅ Analytics package installed and component added to layout
- ✅ Speed Insights package installed and component added
- ✅ Enabled in Vercel dashboard (both Analytics and Speed Insights)
- ✅ Metrics appear in dashboard within 24h of first deploy
- ✅ Core Web Vitals tracked for all routes

**Effort**: 10 min (install + add components + enable in dashboard) | **Impact**: Foundation for all product decisions
**ROI**: IMMEDIATE. First insight ("80% users never add a book") → prioritize onboarding. Pays for itself in first week.

---

### [DESIGN SYSTEM] Fix Hallucinated CSS Class Names

**Files**: LoadingSkeleton.tsx:13, ErrorState.tsx:16, StatusBadge.tsx:9-18
**Perspectives**: design-systems-architect
**Problem**: Legacy class names from old design system (paper, leather) → styling missing

**Fix**:

```typescript
// LoadingSkeleton.tsx:13
- className="h-4 animate-pulse rounded bg-paper-secondary/80"
+ className="h-4 animate-pulse rounded bg-canvas-boneMuted/80"

// ErrorState.tsx:16
- className="... hover:text-paper"
+ className="... hover:text-surface-dawn"

// StatusBadge.tsx:9-18 - Use actual tokens
- "want-to-read": { className: "bg-ink/5 text-ink" }
+ "want-to-read": { className: "bg-text-ink/5 text-text-ink" }
- "currently-reading": { className: "bg-primary/10 text-primary" }
+ "currently-reading": { className: "bg-canvas-boneMuted text-text-ink" }
- "read": { className: "bg-leather/10 text-leather" }
+ "read": { className: "bg-text-ink/10 text-text-ink" }
```

**Effort**: 30m | **Impact**: Visual consistency, fixes styling bugs
**Priority**: CRITICAL - functional issue

---

### [DESIGN SYSTEM] Remove FadeInContent Shallow Module

**File**: components/layout/FadeInContent.tsx
**Perspectives**: complexity-archaeologist, design-systems-architect
**Violation**: Shallow module (interface ≈ implementation)

**Analysis**:

- Interface complexity: 1 prop (children)
- Implementation: 3 motion props
- Module value = 0 (just wrapping motion.div with fixed values)

**Fix**: Delete file, replace usage with direct motion.div

```typescript
// Before
<FadeInContent><BookDetail /></FadeInContent>

// After (clearer, no indirection)
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: [0.25, 1, 0.35, 1] }}
>
  <BookDetail />
</motion.div>
```

**Effort**: 15m | **Impact**: Less indirection, Ousterhout compliance
**Priority**: HIGH - demonstrates design discipline

---

### [INFRASTRUCTURE] Release Automation with release-please

**File**: .github/workflows/release.yml (NEW)
**Perspectives**: architecture-guardian, maintainability-maven
**Gap**: No changelogs, no version tags, no release history → users don't know what changed

**Current State**: Version stuck at 0.1.0, no git tags, manual release notes

**Why release-please** (vs. Changesets/semantic-release):

- **PR-based review**: Human approves before release
- **Conventional commits**: Analyzes commits for automatic versioning
- **GitHub releases**: Auto-creates with changelog
- **Zero maintenance**: Fully automated after setup

**Implementation**:

```yaml
# .github/workflows/release.yml
name: Release Please
on:
  push:
    branches: [main]

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: google-github-actions/release-please-action@v3
        with:
          release-type: node
          package-name: bibliomnomnom
          changelog-types: '[{"type":"feat","section":"Features"},{"type":"fix","section":"Bug Fixes"},{"type":"refactor","section":"Refactoring"},{"type":"perf","section":"Performance"}]'
```

**What You Get**:

- Auto-generated CHANGELOG.md from conventional commits
- Version bumps based on commit types (feat → minor, fix → patch, BREAKING → major)
- GitHub releases with tags
- Release PR for review before publishing

**Acceptance Criteria**:

- ✅ Release Please workflow runs on every main push
- ✅ Release PR created automatically when commits accumulate
- ✅ CHANGELOG.md generated from commits
- ✅ Version bumped in package.json automatically
- ✅ Git tags created for each release

**Effort**: 2h (setup workflow + test release cycle + configure commitlint) | **Impact**: Automated releases, clear communication
**ROI**: Saves 30min per release. Users see what changed. Professional image.

---

### [INFRASTRUCTURE] Environment Variable Validation Script

**File**: scripts/validate-env.sh (NEW)
**Perspectives**: security-sentinel, architecture-guardian
**Gap**: Missing env vars discovered at runtime (or worse, in production)

**Implementation**:

```bash
#!/usr/bin/env bash
# scripts/validate-env.sh

set -e

required=(
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
  "CLERK_SECRET_KEY"
  "CLERK_WEBHOOK_SECRET"
  "NEXT_PUBLIC_CONVEX_URL"
  "CONVEX_DEPLOYMENT"
  "BLOB_READ_WRITE_TOKEN"
)

missing=()

for var in "${required[@]}"; do
  if [[ -z "${!var}" ]]; then
    missing+=("$var")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "❌ Missing required environment variables:"
  printf '  - %s\n' "${missing[@]}"
  echo ""
  echo "Copy .env.example to .env.local and fill in values:"
  echo "  cp .env.example .env.local"
  exit 1
fi

echo "✅ All required environment variables are set"
```

**Usage**: Called by pre-push hook (prevents pushing broken env config)

**Acceptance Criteria**:

- ✅ Script validates all required env vars exist
- ✅ Clear error messages with instructions
- ✅ Runs in pre-push hook (optional - can skip with --no-verify)
- ✅ Documented in README

**Effort**: 1h (write script + integrate with Lefthook + test) | **Impact**: Prevents "works locally, fails in Vercel"
**ROI**: First prevented deploy failure = saved 10+ minutes debugging missing env var.

---

### [INFRASTRUCTURE] Dependabot Automated Dependency Updates

**File**: .github/dependabot.yml (NEW)
**Perspectives**: security-sentinel, maintainability-maven
**Gap**: Security vulnerabilities (esbuild, js-yaml, glob) sit unfixed → growing attack surface

**Current Vulnerabilities** (from pnpm audit):

- esbuild 0.21.5 (moderate - CORS issue in dev server)
- js-yaml 4.1.0 (moderate - transitive dep)
- glob <10.5.0 (moderate - transitive dep)

**Implementation**:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 5
    groups:
      # Group minor/patch updates together
      dev-dependencies:
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"
      production-dependencies:
        dependency-type: "production"
        update-types:
          - "patch"
    # Auto-merge patch updates for dev dependencies (low risk)
    labels:
      - "dependencies"
```

**Acceptance Criteria**:

- ✅ Dependabot PRs created weekly
- ✅ Security updates prioritized (separate PRs)
- ✅ Minor/patch updates grouped (reduces PR noise)
- ✅ Auto-merge configured for low-risk updates (optional)

**Effort**: 1h (create config + configure auto-merge rules) | **Impact**: Automated security patching
**ROI**: First auto-applied security patch = avoided vulnerability. Zero maintenance cost.

---

---

## Next (This Quarter, <3 months)

### [SECURITY] OCR API Rate Limiting

**Source**: PR #20 review (CodeRabbit)
**File**: `app/api/ocr/route.ts`
**Problem**: No per-user throttling on OCR endpoint. Authenticated users could abuse the endpoint, causing unbounded OpenRouter costs and potential DoS.

**Current mitigation**: Clerk authentication required (blocks anonymous abuse)
**Status**: deferred (not merge-blocking); implement before public launch

**Recommended fix**:
```typescript
// Option 1: Upstash Redis rate limiter
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute per user
});

// In handler:
const { success, limit, remaining, reset } = await ratelimit.limit(userId);
if (!success) {
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment.", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
  );
}
```

**Effort**: 2-4h (including Upstash setup)
**Impact**: Prevents cost abuse, improves service reliability
**Priority**: MEDIUM - MVP has low traffic, but should be added before public launch

---

### [ARCHITECTURE] Lift PhotoQuoteCapture mutation to parent

**Source**: PR #20 review (CodeRabbit nitpick)
**File**: `components/notes/PhotoQuoteCapture.tsx`, `components/notes/CreateNote.tsx`
**Problem**: PhotoQuoteCapture component calls `useMutation(api.notes.create)` directly instead of receiving a callback from parent. This violates the "UI components should be presentational" pattern.

**Current state**: Works correctly, just an architectural preference

**Recommended fix**:
```typescript
// PhotoQuoteCapture.tsx
type PhotoQuoteCaptureProps = {
  bookId: Id<"books">;
  onSaveQuote: (text: string) => Promise<void>; // Receive callback instead of calling mutation
};

// CreateNote.tsx
<PhotoQuoteCapture
  bookId={bookId}
  onSaveQuote={async (text) => {
    await createNote({ bookId, type: "quote", content: text });
    toast({ title: "Quote saved" });
  }}
/>
```

**Effort**: 1h
**Impact**: Better separation of concerns, easier testing
**Priority**: LOW - purely architectural improvement

---

### [FEATURE] "Magic Add" Book Input

**Scope**: AddBookSheet.tsx, convex/actions/analyze.ts
**Perspectives**: user-experience-advocate, product-visionary
**Problem**: Adding books is high friction (manual entry or precise search).
**Solution**: Single "Magic Input" that accepts natural language ("Finished Project Hail Mary 5 stars"), messy copy-paste, or ISBNs. Uses LLM to parse intent and data, then auto-fills the form.

**Implementation**:

1.  **Backend (`convex/actions/analyze.ts`)**: New action using existing `llmExtract` logic to parse raw text into a `Partial<Book>`.
2.  **Frontend (`AddBookSheet.tsx`)**: Replace "Search Open Library" with "Magic Input".
3.  **Integration**: Wire analyzer result to pre-fill form fields and trigger cover fetch.

**Effort**: 2d | **Impact**: drastic reduction in friction, high "delight" factor.

---

### [DESIGN SYSTEM] Design Token Compliance Cleanup

**Files**: AddBookSheet.tsx:355, BookCoverManager.tsx:282, CoverPicker.tsx:75,79,120,122
**Perspectives**: design-systems-architect
**Problem**: Multiple hardcoded pixel values and color values bypass the design token system.
**Identified in**: PR #11 review (Gemini, CodeRabbit)

**Approach**:
1. Create `destructive-ghost` button variant for delete actions (red with opacity)
2. Extract common inline styles to utility classes or component variants
3. Audit components for raw pixel values and replace with spacing/size tokens

**Effort**: 2-3h | **Impact**: Visual consistency, maintainability
**Priority**: MEDIUM - functional but inconsistent

---

### [BUNDLE OPTIMIZATION] Replace Framer Motion with CSS Animations

**Scope**: BookTile, BookDetail, StatusBadge, FadeInContent
**Perspectives**: performance-pathfinder, design-systems-architect
**Why**: Framer Motion is 120KB minified+gzipped for simple fade/hover animations (overkill)
**Impact**:

- Current bundle: ~300KB chunk includes Framer Motion
- After removal: 120KB reduction → 500ms-1s faster First Contentful Paint
- Animations use native browser performance (60fps guaranteed)

**Approach**:

```css
/* globals.css - Add native CSS animations */
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

/* BookTile hover - Replace Framer Motion spring with CSS transform */
.book-tile {
  transition: transform 0.2s cubic-bezier(0.25, 1, 0.35, 1);
}
.book-tile:hover {
  transform: translateY(-4px);
}
```

**Effort**: 2-3h (migrate 4 components + test animations) | **Impact**: 120KB bundle reduction, 500ms-1s faster FCP

---

### [BUNDLE OPTIMIZATION] Replace Markdown Libraries with Lighter Alternative

**Scope**: Editor.tsx, NoteCard.tsx
**Perspectives**: performance-pathfinder
**Why**: Marked (47KB) + Turndown (18KB) + DOMPurify (23KB) = 88KB for basic markdown
**Impact**: Notes only use basic markdown (bold, italic, lists, links) - no code blocks, tables

**Approach**:

```typescript
// Replace: marked + turndown + DOMPurify (~88KB)
// With: remark-react (~35KB, 60% reduction)

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkReact from "remark-react";

const processor = unified().use(remarkParse).use(remarkReact);
```

**Effort**: 2h (migration + testing) | **Impact**: 88KB → 35KB bundle (60% reduction)

---

### [PERFORMANCE] Consolidate Book Filtering to Single Pass

**Files**: BookGrid.tsx:20-44, StatsBar.tsx:7-22
**Perspectives**: performance-pathfinder, complexity-archaeologist
**Why**: Both components call `api.books.list` and filter independently (7 total array iterations)
**Impact**: With 200 books, 1,400 iterations on every library page render → 50-100ms jank

**Approach**:

```typescript
// lib/hooks/useBookCategories.ts - Shared hook with single-pass reduce
export function useBookCategories() {
  const allBooks = useAuthedQuery(api.books.list, {});

  return useMemo(() => {
    if (!allBooks) return null;

    // Single pass: O(n) instead of O(7n)
    return allBooks.reduce(
      (acc, book) => {
        if (book.status === "read") {
          acc.finished.push(book);
          acc.counts.booksRead++;
        } else if (book.status === "currently-reading") {
          acc.reading.push(book);
          acc.counts.currentlyReading++;
        } else if (book.status === "want-to-read") {
          acc.toRead.push(book);
        }

        if (book.isFavorite) {
          acc.favorites.push(book);
          acc.counts.favorites++;
        }

        acc.counts.total++;
        return acc;
      },
      {
        reading: [],
        finished: [],
        toRead: [],
        favorites: [],
        counts: { booksRead: 0, currentlyReading: 0, favorites: 0, total: 0 },
      },
    );
  }, [allBooks]);
}
```

**Effort**: 1h (extract hook + migrate 2 components) | **Impact**: 50-100ms → <10ms (5-10x speedup)

---

### [UX CRITICAL] Delete Confirmations for Books & Notes

**Files**: BookDetail.tsx (book delete), NoteCard.tsx:68 (note delete)
**Perspectives**: user-experience-advocate
**Why**: Accidental delete = permanent data loss, hours of work gone, user rage-quits
**Current State**: Note delete uses native browser `confirm()` (jarring), book delete has NO confirmation

**Approach**:

```typescript
// Replace native confirm with custom AlertDialog matching design system
const [showDeleteDialog, setShowDeleteDialog] = useState(false);

<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
  <AlertDialogContent>
    <AlertDialogTitle>Delete "{book.title}"?</AlertDialogTitle>
    <AlertDialogDescription>
      This will permanently delete this book and all {noteCount} notes.
      This cannot be undone.
    </AlertDialogDescription>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction variant="destructive" onClick={handleDelete}>
        Delete Forever
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Effort**: 1h (book delete confirmation) + 45m (replace native confirm for notes) | **Impact**: Prevents catastrophic data loss

---

### [UX ENHANCEMENT] Improve Backend Error Messages

**Files**: convex/books.ts (5 mutations), convex/notes.ts (3 mutations)
**Perspectives**: user-experience-advocate, security-sentinel
**Why**: Generic "Access denied" messages confuse users - no context about what went wrong or how to fix

**Approach**:

```typescript
// Before:
throw new Error("Access denied");

// After:
if (!book) {
  throw new Error("This book no longer exists. It may have been deleted.");
}
if (book.userId !== userId) {
  throw new Error("You don't have permission to edit this book.");
}
```

**Effort**: 30m (update 8 error messages) | **Impact**: Users understand exactly what went wrong and can self-correct

---

### [UX ENHANCEMENT] Input Validation with User Feedback

**File**: BookForm.tsx:324-329
**Perspectives**: user-experience-advocate, maintainability-maven
**Why**: Invalid year/page count silently becomes `null` with no error message - user confused

**Approach**:

```typescript
// Add validation with feedback
const [yearError, setYearError] = useState("");

const handleYearChange = (value: string) => {
  setValues(prev => ({ ...prev, publishedYear: value }));

  if (value && !/^\d{4}$/.test(value)) {
    setYearError("Year must be 4 digits (e.g., 2024)");
  } else {
    setYearError("");
  }
};

// Show error in UI
{yearError && (
  <p className="text-sm text-accent-ember mt-1">{yearError}</p>
)}
```

**Effort**: 30m | **Impact**: Users see validation errors, can correct typos

---

### [DIFFERENTIATION] Reading Analytics Dashboard

**Scope**: New page - /analytics
**Perspectives**: product-visionary, user-experience-advocate
**Business Case**:

- **Shareable content**: "My 2025 Reading Wrapped" → viral growth (Spotify Wrapped proves demand)
- **Self-insight**: "I didn't realize I read mostly male authors" → behavior change
- **Retention hook**: Users return monthly to see updated stats
- **Monetization**: Premium tier unlocks advanced analytics, shareable reports

**Features**:

```typescript
// Phase 1: Enhanced Dashboard (3d)
- Books per month (line chart)
- Genres/themes distribution (bar chart)
- Pages read over time
- Reading pace (days per book)
- Completion rate (finished vs. started)
- Timeline visualization (reading journey)

// Phase 2: Shareable Reports (2d)
- "2025 Reading Wrapped" annual summary
- Beautiful PDF export
- Social sharing (image generation for Twitter/Instagram)
```

**Competitive Gap**:

- Goodreads: Basic stats, ugly UI
- StoryGraph: Good stats but cluttered
- Literal: Beautiful but basic
- **bibliomnomnom opportunity**: Best-in-class analytics with bibliophile aesthetic

**Effort**: 3d (dashboard) + 2d (sharing) = 5d | **Impact**: Unique differentiation + viral marketing engine
**ROI**: Shareable content = free marketing. Users who see friend's "Reading Wrapped" → try the app

---

### [DIFFERENTIATION] Collections & Tags System

**Scope**: New tables, CRUD, UI
**Perspectives**: product-visionary, user-experience-advocate
**Business Case**:

- **Power user retention**: Researchers, writers, educators need organization at scale
- **Thematic discovery**: "Show me all books about grief"
- **Sharing**: "My favorite sci-fi books" public list → viral sharing
- **Scalability**: Current flat library breaks at 200+ books

**Schema**:

```typescript
collections: defineTable({
  userId: v.id("users"),
  name: v.string(),
  description: v.optional(v.string()),
  isPublic: v.boolean(),
  createdAt: v.number(),
});

bookCollections: defineTable({
  bookId: v.id("books"),
  collectionId: v.id("collections"),
});
```

**Features**:

- Collection CRUD (create, rename, delete)
- Add/remove books to collections
- Filter library by collection
- Public collection pages (shareable URLs)

**Effort**: 0.5d (schema) + 3d (UI) = 3.5d | **Impact**: Enables power users (20% of users = 60% of value)
**ROI**: Power users generate word-of-mouth, feedback, evangelism. Losing them = losing advocates.

---

### [DIFFERENTIATION] Public User Profiles

**Scope**: New routes, privacy controls
**Perspectives**: product-visionary
**Business Case**:

- **Viral growth**: Every profile is a landing page
- **Social proof**: See real readers, not anonymous reviews
- **Network effects**: Each public profile drives 2-3 signups
- **Privacy-first social**: Opt-in, curated, thoughtful (not toxic social feed)

**Schema**:

```typescript
users: defineTable({
  ...existing,
  username: v.optional(v.string()), // unique
  bio: v.optional(v.string()),
  profilePrivacy: v.union("private", "public"), // default: private
});
```

**Routes**:

- /users/[username] - Public profile page
- Shows public books, stats (if enabled), collections
- Privacy controls (profile visibility, per-book privacy)

**Effort**: 0.5d (schema) + 2d (routes) + 1d (privacy) = 3.5d | **Impact**: Viral growth engine
**ROI**: Cost: $0 marketing. Retention: Users with followers have 3x longer lifetime.

---

### [FEATURE] Search Within Library (CMD+K Power User Feature)

**Scope**: Command palette
**Perspectives**: product-visionary, user-experience-advocate
**Why**: Users with 300+ books need fast navigation (scrolling or Cmd+F browser search is painful)

**Implementation**:

```typescript
// Frontend: Command palette (CMD+K)
- Search by title, author, notes content
- Fuzzy matching (Fuse.js)
- Jump to book
- Recent books
- Quick actions (add book, create note)

// Backend: Full-text search on notes
- Convex search index
- Search across all user's notes/quotes
- Highlight matching text
```

**Effort**: 3d | **Impact**: Power user productivity
**Priority**: After 100+ books, becomes critical

---

### [REFACTOR] Extract BookDetail into Focused Components

**File**: BookDetail.tsx (520 lines → 5 components of ~100 lines each)
**Perspectives**: complexity-archaeologist, maintainability-maven
**Why**: God component with 9 responsibilities → hard to test, modify, reuse

**Approach**:

```
BookDetail.tsx (container) → 150 lines
  → BookCoverManager.tsx (upload/hover logic) → 80 lines
  → BookActions.tsx (status/favorite/privacy) → 100 lines
  → BookMetadataDisplay.tsx (existing, line 478)
  → BookNotesSection.tsx → 60 lines
  → BookEditSheet.tsx (extract EditBookModalIcon) → 130 lines
```

**Effort**: 6h (careful extraction to preserve state + test interactions) | **Impact**: 520 lines → 5 focused components
**ROI**: Easier testing, enables reuse (BookActions could work in BookGrid hover state)

---

### [REFACTOR] Standardize Error Handling Pattern

**Scope**: Multiple files (books.ts, notes.ts, components)
**Perspectives**: maintainability-maven, security-sentinel
**Why**: Three different error patterns (throw Error, silent failure, console only) → inconsistent UX

**Approach**:

```typescript
// convex/errors.ts
import { ConvexError } from "convex/values";

export class NotFoundError extends ConvexError<"not_found"> {
  constructor(resource: string) {
    super({ code: "not_found", message: `${resource} not found` });
  }
}

export class AccessDeniedError extends ConvexError<"access_denied"> {
  constructor() {
    super({ code: "access_denied", message: "Access denied" });
  }
}

// Usage
if (!book || book.userId !== userId) {
  throw new AccessDeniedError();
}
```

**Effort**: 3h (create error classes + migrate all error handling) | **Impact**: Uniform error handling, better debugging

---

### [INFRASTRUCTURE] Performance Monitoring with Sentry Performance

**File**: sentry.client.config.ts, sentry.server.config.ts
**Perspectives**: performance-pathfinder, architecture-guardian
**Gap**: Can't identify slow Convex queries, frontend bottlenecks, or database performance issues

**Why Sentry Performance (vs. OpenTelemetry)**:

- **Unified platform**: Errors + Performance in one dashboard (correlation)
- **Vercel Integration**: Auto-configured, no manual setup
- **Free tier**: 10k transactions/month (plenty for MVP)
- **Zero code changes**: Automatic instrumentation for Next.js, fetch, React

**Implementation**:

```typescript
// sentry.client.config.ts (enhance existing config)
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

  // Enable performance monitoring
  tracesSampleRate: 0.1, // 10% of requests (stay within free tier)

  // Intelligent sampling: capture all errors, sample successes
  tracesSampler: (samplingContext) => {
    // Always trace errors
    if (samplingContext.transactionContext.name.includes("error")) {
      return 1.0;
    }
    // Sample high-value routes more
    if (samplingContext.transactionContext.name.includes("/library")) {
      return 0.2; // 20% sampling
    }
    // Default sampling
    return 0.1; // 10% sampling
  },

  // Automatically instrument fetch, HTTP, React rendering
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: [
        "localhost",
        /^https:\/\/bibliomnomnom\.vercel\.app/,
        /^https:\/\/.*\.convex\.cloud/, // Trace Convex API calls
      ],
    }),
  ],
});
```

**What You Get**:

- **Route performance**: P50, P95, P99 latency for every page
- **Convex query performance**: Time spent in `api.books.list`, `api.notes.create`
- **Frontend bottlenecks**: React render time, component slowness
- **Database queries**: Convex query execution time
- **Trace context**: See full request flow (frontend → Convex → return)

**Acceptance Criteria**:

- ✅ Sentry Performance enabled (tracesSampleRate > 0)
- ✅ Intelligent sampling configured (errors 100%, high-value routes 20%, default 10%)
- ✅ Convex API calls traced (fetch instrumentation)
- ✅ Dashboard shows P50/P95/P99 latency for all routes
- ✅ Alerts configured for slow transactions (p95 > 1s)

**Effort**: 1h (enhance Sentry config + verify traces) | **Impact**: Identify performance bottlenecks before users complain
**ROI**: First slow query detection (p99 > 2s) → optimize → 500ms faster = better UX + retention.

---

### [INFRASTRUCTURE] Convex Backend Observability via Axiom

**File**: Convex dashboard integration
**Perspectives**: architecture-guardian, performance-pathfinder
**Gap**: Convex logs disappear after 7 days, no queryable history, can't analyze function performance trends

**Why Axiom**:

- **Convex native integration**: One-click setup in Convex dashboard
- **Free tier**: 500MB/month logs, 30-day retention (plenty for MVP)
- **Prebuilt dashboard**: Function execution times, error rates, database usage
- **APL queries**: Powerful query language for log analysis
- **Real-time streaming**: Logs appear in <1 second

**Setup**:

```bash
# 1. Go to Convex Dashboard → Settings → Integrations → Axiom
# 2. Connect Axiom account (free tier)
# 3. Enable log streaming
# 4. View prebuilt dashboard at axiom.co/integrations/convex
```

**What You Get**:

```apl
# Find slowest Convex functions
['convex']
| where ['data.topic'] == "function_execution"
| summarize
    avg_time_ms = avg(['data.execution_time_ms']),
    max_time_ms = max(['data.execution_time_ms']),
    total_calls = count()
  by ['data.function.path']
| order by avg_time_ms desc

# Monitor function error rates
['convex']
| where ['data.topic'] == "function_execution" and ['data.status'] == "failure"
| summarize count() by ['data.function.path'], ['data.function.type']
| order by count_ desc

# Analyze database usage patterns
['convex']
| where ['data.topic'] == "function_execution"
| summarize
    avg_docs_read = avg(['data.usage.database_read_documents']),
    avg_bytes_read = avg(['data.usage.database_read_bytes'])
  by ['data.function.path']
| order by avg_bytes_read desc
```

**Acceptance Criteria**:

- ✅ Axiom integration enabled in Convex dashboard
- ✅ Logs streaming in real-time (<1s latency)
- ✅ Prebuilt dashboard showing function performance
- ✅ Custom APL query saved for slow function detection
- ✅ Alert configured for function error rate > 5%

**Effort**: 45 min (enable integration + configure dashboard + save queries) | **Impact**: Convex backend visibility, long-term log retention
**ROI**: First Convex bottleneck detected (api.books.list p99 > 500ms) → add index → 10x faster queries.

---

### [INFRASTRUCTURE] Deployment Tracking & Release Automation

**File**: .github/workflows/deploy.yml
**Perspectives**: architecture-guardian, security-sentinel
**Gap**: Can't correlate errors with deployments, no deployment history, manual release notes

**Implementation**:

```yaml
# .github/workflows/deploy.yml (NEW FILE)
name: Deploy & Track Releases

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for release notes

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install

      - name: Create Sentry release
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
        run: |
          # Create release in Sentry
          VERSION=$(git rev-parse --short HEAD)
          npx @sentry/cli releases new $VERSION
          npx @sentry/cli releases set-commits $VERSION --auto
          npx @sentry/cli releases finalize $VERSION

          # Annotate deployment (for correlating errors with releases)
          npx @sentry/cli releases deploys $VERSION new -e production

      - name: Build
        run: pnpm build

      # Vercel auto-deploys on push to main, this just tracks it
```

**Secrets to Add** (GitHub repo settings):

- `SENTRY_AUTH_TOKEN` (from Sentry account settings)
- `SENTRY_ORG` (your Sentry org slug)
- `SENTRY_PROJECT` (your Sentry project slug)

**What You Get**:

- **Error correlation**: See which deploy introduced each error
- **Deployment timeline**: Full history of what shipped when
- **Commit attribution**: See who changed what in each release
- **Automatic release notes**: Git commits become release notes
- **Rollback clarity**: Know which version to rollback to

**Acceptance Criteria**:

- ✅ GitHub Action runs on every push to main
- ✅ Sentry release created with git SHA as version
- ✅ Commits associated with each release
- ✅ Deployment annotated in Sentry dashboard
- ✅ Errors show "First seen in release X"

**Effort**: 1.5h (create workflow + add secrets + test deploy) | **Impact**: Error-to-deploy correlation, release history
**ROI**: First production error ("This started after yesterday's deploy") → rollback in 2 minutes instead of debugging for 2 hours.

---

### [INFRASTRUCTURE] Add Analytics Tracking (PostHog)

**Scope**: Event tracking
**Perspectives**: architecture-guardian, product-visionary
**Why**: No visibility into feature usage, conversion funnels, user journeys → can't make data-driven decisions

**Events to Track**:

- `book_added`, `book_status_changed`, `note_created`
- `privacy_toggled`, `cover_uploaded`
- `import_started`, `import_completed`
- `search_used`, `collection_created`

**Effort**: 4h (setup PostHog + instrument 10 key events) | **Impact**: Data-driven product decisions

---

### [INFRASTRUCTURE] Changelog Automation (Changesets)

**Scope**: Release notes
**Perspectives**: architecture-guardian
**Why**: Manual release notes, inconsistent versioning → hard to communicate updates to users

**Setup**:

```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

**Workflow**:

- Developer runs `pnpm changeset` when making changes
- Describes change in markdown (user-facing summary)
- On release, automatically generates CHANGELOG.md + bumps version

**Effort**: 2h | **Impact**: Automated releases, clear communication

---

---

## Soon (Exploring, 3-6 months)

### [INFRASTRUCTURE] Bundle Size Tracking with @next/bundle-analyzer

**File**: next.config.ts
**Perspectives**: performance-pathfinder, maintainability-maven
**Gap**: No bundle size visibility → performance regressions invisible

**Implementation**:

```typescript
// next.config.ts (enhance existing)
import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // ... existing config
};

export default withBundleAnalyzer(nextConfig);
```

**Usage**: `ANALYZE=true pnpm build` → opens bundle visualization

**Acceptance Criteria**:

- ✅ Bundle analyzer available on demand
- ✅ Documented in README ("Analyze Bundle" section)
- ✅ CI tracks bundle size trends (optional - via bundlewatch)

**Effort**: 30m (install + configure + document) | **Impact**: Bundle size awareness
**ROI**: First bundle bloat detection ("why did we add 200KB?") → investigate → remove unused dep.

---

### [INFRASTRUCTURE] Commitlint for Conventional Commits

**File**: .commitlintrc.json (NEW), package.json
**Perspectives**: maintainability-maven, architecture-guardian
**Gap**: Inconsistent commit messages → release-please can't auto-generate good changelogs

**Why**: Conventional commits enable automated versioning and changelog generation

**Implementation**:

```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional
```

```json
// .commitlintrc.json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "perf", "test", "chore"]
    ],
    "subject-case": [0]
  }
}
```

```yaml
# .lefthook.yml (add to existing)
commit-msg:
  commands:
    lint:
      run: pnpm commitlint --edit {1}
```

**Acceptance Criteria**:

- ✅ Invalid commit messages blocked (must follow conventional format)
- ✅ Examples documented in CONTRIBUTING.md
- ✅ Team onboarded (clear error messages)

**Effort**: 1h (install + configure + document) | **Impact**: Better changelogs
**ROI**: Enables release-please automation. Professional commit history.

---

- **[Product] Bulk Actions** - Select multiple books → mark as favorite, change status, delete (4h effort, reduces 30 clicks → 3 clicks for bulk ops)
- **[Product] Reading Goals & Streaks** - Optional gentle gamification, no toxic "you're behind" pressure (2d effort, motivation without toxicity)
- **[Product] Book Recommendations** - Hybrid collaborative filtering + semantic similarity + LLM reasoning (8d effort, from BACKLOG Phase 1 AI)
- **[UX] Auto-Save for Long Notes** - localStorage draft every 10s, restore on crash (2h effort, never lose work)
- **[Performance] Server-Side Markdown Parsing** - Parse notes on save, cache HTML, eliminates 20-30ms client parsing (3h effort, schema migration)
- **[Design] Storybook Configuration** - Visual component library, isolated development (6h effort, 2h setup + 4h stories)
- **[Testing] Expand Component Test Coverage** - Surface, BookTile, CreateNote tests (4-8h effort, refactoring confidence)
- **[Design] Standardize Motion Tokens** - Add spring presets to design-tokens.json for Framer Motion (2h effort, consistent motion)
- **[Refactor] Extract Reusable SegmentedControl** - Used in NoteTypeSelector + BookForm (1h effort, DRY principle)
- **[Refactor] Extract FormField Component** - Consistent label styling across forms (1h effort, single source of truth)
- **[Infrastructure] Rate Limiting** - Upstash Redis rate limits on API routes + Convex mutations (3h effort, abuse prevention)

### [TESTABILITY] Value Objects for Import Match Keys

**Scope**: lib/import/dedup/matchKeys.ts (NEW)
**Perspectives**: complexity-archaeologist, architecture-guardian
**Context**: Phase 3 of import testability refactoring (optional polish)

**Description**: Encapsulate ISBN, Title-Author, and ApiId matching logic in value object classes with built-in normalization, equality checking, and priority.

**Value**:

- Type safety for matching (compiler catches misuse)
- Normalization + equality + priority in single cohesive unit
- Self-documenting code (IsbnKey.equals(other) clearer than string comparison)
- Easier to add new match types (SeriesKey, PublisherKey, etc.)

**Implementation**:

```typescript
// lib/import/dedup/matchKeys.ts
class IsbnKey {
  constructor(private normalized: string | undefined) {}

  static from(raw?: string | null): IsbnKey {
    return new IsbnKey(normalizeIsbn(raw));
  }

  equals(other: IsbnKey): boolean {
    return this.normalized !== undefined && this.normalized === other.normalized;
  }

  get priority(): number {
    return 1.0;
  }
  get isValid(): boolean {
    return this.normalized !== undefined;
  }
}

class TitleAuthorKey {
  constructor(private key: string) {}

  static from(title: string, author: string): TitleAuthorKey {
    return new TitleAuthorKey(normalizeTitleAuthorKey(title, author));
  }

  equals(other: TitleAuthorKey): boolean {
    return this.key === other.key;
  }

  get priority(): number {
    return 0.8;
  }
}

class ApiIdKey {
  constructor(private normalized: string | undefined) {}

  static from(raw?: string | null): ApiIdKey {
    return new ApiIdKey(normalizeApiId(raw));
  }

  equals(other: ApiIdKey): boolean {
    return this.normalized !== undefined && this.normalized === other.normalized;
  }

  get priority(): number {
    return 0.6;
  }
  get isValid(): boolean {
    return this.normalized !== undefined;
  }
}
```

**Effort**: 2-3 hours | **Impact**: Better encapsulation, type safety, clearer intent

**Trade-offs**:

- ✅ Pros: Better encapsulation, type safety, clearer intent
- ❌ Cons: More classes, indirection, possible over-engineering for current scale
- ⚖️ Decision: Wait until adding 3+ new match types to justify abstraction

**When to Implement**:

- When adding SeriesKey, PublisherKey, or other match types
- When matching logic becomes complex (fuzzy matching, weighted combinations)
- When tests need to verify normalization + equality together

---

### [TESTABILITY] Comprehensive Import Integration Tests

**Scope**: **tests**/import/integration.test.ts (NEW)
**Perspectives**: maintainability-maven, architecture-guardian
**Context**: Post-Phase 2 validation tests

**Description**: Full workflow tests using in-memory repositories to verify import flows end-to-end (CSV upload → preview → dedup → commit → verify books created).

**Value**:

- Catch integration bugs between layers (repository + service + handler)
- Verify complete user workflows (not just unit behavior)
- Regression protection for multi-step operations
- Documentation through executable tests

**Implementation**:

```typescript
describe("Import workflow integration", () => {
  it("imports Goodreads CSV with deduplication", async () => {
    const repos = createInMemoryRepositories();
    const userId = "user_1" as Id<"users">;

    // Seed existing books
    repos.books.seed([book({ isbn: "9780441013593", title: "Dune", author: "Frank Herbert" })]);

    // Parse CSV
    const csvText = `Title,Author,ISBN\nDune,Frank Herbert,9780441013593\nFoundation,Isaac Asimov,`;
    const parsed = parseGoodreadsCsv(csvText);

    // Preview (dedup should find 1 match)
    const preview = await preparePreviewHandler(mockCtx, {
      importRunId: "run_1",
      sourceType: "goodreads-csv",
      rows: parsed.rows,
      page: 0,
    });

    expect(preview.dedupMatches).toHaveLength(1);
    expect(preview.dedupMatches[0].matchType).toBe("isbn");

    // Commit with skip decision on duplicate
    const result = await commitImportHandler(mockCtx, {
      importRunId: "run_1",
      page: 0,
      decisions: [
        { tempId: parsed.rows[0].tempId, action: "skip" },
        { tempId: parsed.rows[1].tempId, action: "create" },
      ],
    });

    expect(result.skipped).toBe(1);
    expect(result.created).toBe(1);

    // Verify final state
    const books = await repos.books.findByUser(userId);
    expect(books).toHaveLength(2); // Original + Foundation
    expect(books.find((b) => b.title === "Foundation")).toBeDefined();
  });

  it("handles LLM extraction provider errors", async () => {
    // Test full LLM flow with provider failure (no fallback)
  });

  it("enforces rate limits across multiple previews", async () => {
    // Test rate limiting across 6 preview attempts in one day
  });
});
```

**Effort**: 3-4 hours | **Impact**: Catch integration bugs, regression protection

**When to Implement**:

- After Phase 2 repository refactoring completes
- When adding new import sources (Storygraph, LibraryThing)
- Before major refactoring (regression safety net)

---

### [TESTABILITY] Repository Transaction Support

**Scope**: lib/import/repository interfaces
**Perspectives**: architecture-guardian, maintainability-maven

**Description**: Add transaction boundaries to repositories for atomic multi-document operations (e.g., create book + update import run + delete preview in single transaction).

**Impact**: Prevents partial state on failure (all-or-nothing commits)

**Effort**: 4-6 hours | **Complexity**: Medium (Convex doesn't expose transaction API directly)

**When to Implement**: When data consistency issues emerge in multi-step operations

---

### [PERFORMANCE] Repository Query Result Caching

**Scope**: lib/import/repository
**Perspectives**: performance-pathfinder

**Description**: Cache `findByUser` query results during import workflow (called multiple times per import).

**Impact**: Reduce database round-trips by ~30% during commit phase

**Effort**: 2-3 hours

**When to Implement**: When import performance becomes user-visible issue (>2 second commits)

---

### [RELIABILITY] LLM Provider Retry Logic

**Scope**: lib/import/llm.ts
**Perspectives**: architecture-guardian

**Description**: Automatic retry with exponential backoff for transient LLM API failures (rate limits, network errors).

**Impact**: Better reliability for imports using TXT/MD files

**Effort**: 2 hours | **Trade-off**: Adds latency on failure, may hit rate limits faster

---

### [FEATURE] Fuzzy Title Matching for Deduplication

**Scope**: lib/import/dedup
**Perspectives**: product-visionary, user-experience-advocate

**Description**: Use Levenshtein distance or fuzzy string matching for title-author dedup (catch typos, minor variations).

**Impact**: Reduce false negatives (books marked as new when they exist with slight title variation)

**Effort**: 3-4 hours | **Complexity**: Medium (tuning similarity thresholds to avoid false positives)

**When to Implement**: When user feedback shows missed duplicates are common

---

### [ARCHITECTURE] Extract Books Module Repository Pattern

**Scope**: convex/books.ts, convex/notes.ts
**Perspectives**: architecture-guardian, maintainability-maven

**Description**: Apply same repository pattern to `convex/books.ts` and `convex/notes.ts` (not just import feature).

**Benefit**: Consistent architecture across codebase, testable book/note mutations

**Effort**: 8-10 hours (more modules to refactor)

**When to Address**: After import refactoring proves successful, before adding new major features

---

### [INFRASTRUCTURE] Migrate Rate Limiting to Convex Rate Limiter

**Scope**: lib/import/rateLimit.ts
**Perspectives**: architecture-guardian

**Description**: Use Convex's built-in rate limiting primitives instead of custom implementation.

**Benefit**: Distributed rate limiting (works across multiple Convex processes), built-in backoff

**Effort**: 2 hours | **Documentation**: https://docs.convex.dev/production/rate-limiting

**When to Address**: When scaling beyond single Convex deployment, or Convex rate limiter becomes stable

---

### [CONFIGURATION] LLM Provider Configuration Externalization

**Scope**: lib/import/llm.ts, convex/imports.ts
**Perspectives**: architecture-guardian

**Description**: Move LLM model selection ("gpt-5.1-mini", "gemini-2.5-flash") to environment variables instead of hardcoded.

**Benefit**: Swap models without code changes, easier A/B testing, cost optimization

**Effort**: 1 hour

**Example**:

```bash
# .env.local
OPENAI_MODEL=gpt-5.1-mini
GEMINI_MODEL=gemini-2.5-flash
LLM_TOKEN_CAP=50000
```

**When to Address**: When experimenting with new models (GPT-4, Claude, etc.)

---

### [PERFORMANCE] Import Preview Pagination

**Scope**: convex/imports.ts, components/import/\*
**Perspectives**: performance-pathfinder

**Description**: Current implementation loads all books into memory (300/page). Add true cursor-based pagination for previews with >300 books.

**Benefit**: Handle large imports (1000+ books) without memory pressure

**Effort**: 4 hours

**When to Address**: When users report slow previews or memory issues with large CSVs

---

### [HEALTH] Deep dependency checks in health endpoint

**Scope**: app/api/health/route.ts
**Description**: Add “deep health” mode that performs lightweight reachability checks to Convex/Clerk/blob rather than only env presence; mirror no-store headers on error responses.
**Effort**: 1-2 hours | **When**: After current release once monitoring needs clarity.

### [SECURITY] Tighten CSP once safe

**Scope**: next.config.ts
**Description**: Remove `unsafe-inline`/`unsafe-eval` from script-src when tooling allows; track third-party domains as they’re added.
**Effort**: 1 hour | **When**: After verifying production build compatibility.

### [TESTING] Broaden import test coverage

**Scope**: **tests**/import/\*
**Description**: Add cases for CSV size/10MB limit, malformed CSV, dedup fuzzy/confidence edges (≥/</0.85), commit skip/error/idempotency, LLM text path in useImportJob.
**Effort**: 3-4 hours | **When**: Next test pass cycle.

### [QUALITY] Raise docstring coverage toward 80%

**Scope**: lib/import/_, convex/_
**Description**: Address bot warning (28.57%); add concise docstrings for exported functions/types most used externally.
**Effort**: 2 hours | **When**: After functional fixes land.

### [FEATURE] Batch Import API

**Scope**: New endpoints, UI
**Perspectives**: product-visionary

**Description**: Allow importing multiple files in single workflow (upload folder of CSVs, process sequentially).

**Value**: Power users with multiple export files

**Effort**: 6-8 hours

---

### [FEATURE] Import Templates

**Scope**: New schema tables, UI
**Perspectives**: product-visionary, user-experience-advocate

**Description**: Save dedup decision patterns as templates ("always skip duplicates", "always merge metadata", etc.).

**Value**: Faster workflow for repeat imports

**Effort**: 8-10 hours

---

### [FEATURE] Undo Import

**Scope**: Audit log, version tracking
**Perspectives**: user-experience-advocate

**Description**: Add ability to undo last import (delete created books, restore merged books to previous state).

**Value**: Safety net for accidental imports

**Effort**: 10-12 hours (requires audit log/versioning)

---

---

## Later (Someday/Maybe, 6+ months)

- **[Platform] AI Features (Phase 1 from original BACKLOG)** - Embeddings, semantic search, auto-tagging, recommendations (40d effort, unique competitive moat)
- **[Platform] Mobile App (PWA)** - Offline reading, install on device (15d effort, 60% of users want mobile)
- **[Platform] API for Integrations** - Public API, webhooks, OAuth (10d effort, integration ecosystem)
- **[Feature] Ebook Integration** - Upload EPUB, in-browser reader, sync highlights (ambitious, complex, legal considerations)
- **[Feature] Library/Bookstore Integrations** - "Find at local library" (Libby), "Buy from indie bookstore" (Bookshop.org)
- **[Monetization] Freemium Model** - Free: 100 books, Premium ($5-7/mo): unlimited + advanced analytics + AI features
- **[Design] OKLCH Color Space** - Perceptual uniformity for future accent colors or dark mode (2h effort, defer until color complexity)
- **[Design] Tailwind 4 Migration** - @theme directive, CSS-first config (4h effort, wait for stable release)

---

## Learnings

**From quality infrastructure audit (2025-11-20):**

1. **Quality gates prevent production fires** - No CI/CD = type errors in production. No git hooks = secrets committed. No backend tests = privacy bugs ship. Infrastructure isn't overhead—it's prevention. 3 days invested now saves weeks debugging production incidents.

2. **Convex build order is critical** - `npx convex deploy && next build` (not just `next build`). Types depend on Convex schema. Wrong order = guaranteed Vercel deploy failures. One 30min fix prevents hours of "why doesn't prod work?"

3. **Coverage for confidence, not vanity** - Track critical paths only (auth, privacy, payments) at 75% threshold. Don't waste time testing shadcn components or hitting 100% everywhere. Focus = 1 day of strategic tests vs. 1 week of comprehensive busywork.

**From previous grooming session:**

4. **Import/Export is existential, not nice-to-have** - Without these, product won't get users beyond early adopters. Every competitor has import. Data portability is ethical table stakes. Build before public launch.

5. **Silent failures are killing UX** - Users losing work without feedback → trust erosion → churn. Toast notifications cost 2h but prevent massive user frustration. Critical path issue.

6. **Design system is already exceptional** - 8.5/10 maturity for MVP. Token architecture is best-in-class. Fix 3 quick bugs (hallucinated classes, shallow module), then focus on features. Don't over-engineer what's working.

7. **Testing is strategic, not tactical** - Backend mutations untested = data corruption risk. Component tests enable refactoring confidence. Invest 4-8h in critical path tests (Surface, BookTile, CreateNote) before major refactors.

**Keep 2-3 recent learnings, delete old ones on next groom**

---

**This backlog is a living strategic roadmap. As we learn from users, priorities shift. Value > completeness. Ship the 20% of work that drives 80% of adoption/retention/revenue. 📚✨**
