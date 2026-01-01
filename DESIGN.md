# DESIGN.md: Reader Profile Architecture

## Product Context (from SPEC.md)

**Problem**: Voracious readers can't articulate their literary identity. bibliomnomnom transforms a book collection into a shareable artifact.

**Users**: Reflective bibliophiles with 20-500+ books who value self-knowledge.

**Core Stories**:
1. View reader identity card (hero + stats + AI insights)
2. Share profile via public URL (`/readers/[username]`)
3. Graceful sparse data handling (20 book minimum)

**Success Metrics**:
- 50% of 20+ book users generate profile
- 15% share publicly
- 30% return within 7 days

**Non-Goals**: Monthly digests, yearly wrapped, recommendations, user comparisons, per-field privacy.

---

## Architecture Overview

**Selected Approach**: Convex-Native with Structured Storage

**Rationale**: Follows established codebase patterns (actions for external APIs, structured schemas for type safety), enables real-time updates via Convex queries, and separates pure computation (stats) from AI generation (insights).

**Core Modules**:
- **ProfileData**: Computes quantitative stats from books (no LLM)
- **ProfileInsights**: Generates AI analysis via OpenRouter action
- **ProfileStorage**: Caches generated profiles in Convex
- **ProfileView**: Renders identity card with sharing controls
- **ProfileOG**: Generates shareable OG images

**Data Flow**:
```
User visits /profile
  → Query: Check for cached profile (profiles.get)
  → If missing/stale:
      → Mutation: Create pending profile
      → Action: Generate insights (OpenRouter)
      → Mutation: Save completed profile
  → Render: Hero card + stats + insights
  → Share: Toggle public, generate OG image
```

**Key Design Decisions**:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | Structured Convex table | Type safety, queryable, real-time |
| LLM execution | Convex action | Matches import/cover-fetch patterns |
| Stats computation | Query-time | Always fresh, no cache invalidation |
| OG images | Next.js ImageResponse | Built-in, fast, no external service |
| Usernames | Add to users table | Simple, existing auth flow |

---

## Alternative Architectures Considered

### Alternative A: API Route + JSON Blob

**Approach**: LLM generation via Next.js API route (like OCR), store entire profile as single JSON blob in Convex.

**Pros**:
- Flexible schema (can add fields without migration)
- Simpler initial implementation

**Cons**:
- Loses Convex action patterns (can't use `ctx.runQuery`)
- No type safety for profile structure
- Can't query individual fields (e.g., "all users who like sci-fi")
- Duplicates auth logic between API route and Convex

**Ousterhout Analysis**: Shallow module — JSON blob pushes complexity to every consumer that must parse/validate the structure.

**Verdict**: Rejected — loses type safety and Convex-native benefits.

### Alternative B: Separate Microservice

**Approach**: Dedicated profile generation service (separate deployment), async queue for generation, webhook callback to Convex.

**Pros**:
- Independent scaling
- Could add heavy ML processing later

**Cons**:
- Massive complexity increase (new infra, webhooks, retry logic)
- Latency (network hops)
- Overkill for current scale

**Ousterhout Analysis**: Premature abstraction — creates distributed system complexity for a feature that fits cleanly in existing architecture.

**Verdict**: Rejected — premature optimization, 10x complexity.

### Alternative C: Client-Side Computation (Selected Variant)

**Approach**: Compute stats in React (client), only use LLM for AI insights.

**Pros**:
- Reduces server load
- Instant stats display

**Cons**:
- Duplicates computation on every page load
- Can't cache stats
- Public profiles need server-side computation anyway

**Partial Adoption**: Stats will be computed at query time in Convex (cheap, cacheable), not client-side. AI insights via action.

---

## Module Design

### Module: ProfileData (Stats Computation)

**Responsibility**: Compute quantitative reading statistics from user's book collection. No LLM, no external calls — pure aggregation.

**Public Interface**:
```typescript
// convex/profiles.ts
export const getStats = query({
  args: {},
  returns: v.object({
    totalBooks: v.number(),
    booksRead: v.number(),
    pagesRead: v.number(),
    audiobookRatio: v.number(), // 0-1
    averagePace: v.number(), // books per month
    topAuthors: v.array(v.object({ author: v.string(), count: v.number() })),
    fictionRatio: v.number(), // 0-1 (estimated from titles)
    yearRange: v.object({ earliest: v.number(), latest: v.number() }),
  }),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const books = await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return computeStats(books);
  },
});
```

**Internal Implementation**:
```typescript
function computeStats(books: Doc<"books">[]): ProfileStats {
  const read = books.filter(b => b.status === "read");
  const audiobooks = books.filter(b => b.isAudiobook);

  // Pages: sum pageCount, estimate 250 for missing
  const pages = books.reduce((sum, b) => sum + (b.pageCount ?? 250), 0);

  // Pace: books per month based on dateFinished spread
  const finishedDates = read
    .filter(b => b.dateFinished)
    .map(b => b.dateFinished!)
    .sort();
  const pace = calculatePace(finishedDates);

  // Top authors: group by author, sort by count
  const authorCounts = groupBy(books, b => b.author);
  const topAuthors = Object.entries(authorCounts)
    .map(([author, books]) => ({ author, count: books.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Year range: min/max publishedYear
  const years = books.map(b => b.publishedYear).filter(Boolean) as number[];

  return {
    totalBooks: books.length,
    booksRead: read.length,
    pagesRead: pages,
    audiobookRatio: audiobooks.length / books.length || 0,
    averagePace: pace,
    topAuthors,
    fictionRatio: 0.5, // TODO: infer from titles/descriptions
    yearRange: {
      earliest: Math.min(...years) || 0,
      latest: Math.max(...years) || new Date().getFullYear(),
    },
  };
}

function calculatePace(finishedDates: number[]): number {
  if (finishedDates.length < 2) return 0;
  const first = finishedDates[0]!;
  const last = finishedDates[finishedDates.length - 1]!;
  const monthsSpan = (last - first) / (1000 * 60 * 60 * 24 * 30);
  return monthsSpan > 0 ? finishedDates.length / monthsSpan : 0;
}
```

**Dependencies**:
- Requires: `books` table, `requireAuth` helper
- Used by: ProfileView component, ProfileInsights action

**Error Handling**:
- Empty library → return zeroed stats (not an error)
- Missing fields → use defaults (250 pages, current year)

---

### Module: ProfileInsights (AI Generation)

**Responsibility**: Generate AI-powered literary analysis using OpenRouter. Hides prompt engineering, model selection, and retry logic.

**Public Interface**:
```typescript
// convex/actions/profileInsights.ts
export const generate = action({
  args: {
    books: v.array(v.object({
      title: v.string(),
      author: v.string(),
      description: v.optional(v.string()),
    })),
    bookCount: v.number(), // For threshold logic
  },
  returns: v.object({
    tasteTagline: v.string(), // "A reader drawn to..."
    literaryTaste: v.object({
      genres: v.array(v.string()),
      moods: v.array(v.string()),
      complexity: v.union(v.literal("accessible"), v.literal("moderate"), v.literal("literary")),
    }),
    thematicConnections: v.array(v.object({
      theme: v.string(),
      books: v.array(v.string()), // titles
    })),
    readingEvolution: v.optional(v.string()), // Only for 50+ books
    confidence: v.union(v.literal("early"), v.literal("developing"), v.literal("strong")),
  }),
  handler: async (ctx, args) => {
    const userId = await requireAuthAction(ctx);

    // Build prompt
    const prompt = buildInsightsPrompt(args.books, args.bookCount);

    // Call OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

    const model = process.env.OPENROUTER_PROFILE_MODEL
      ?? "google/gemini-3-flash-preview";

    const response = await openRouterChatCompletion({
      apiKey,
      request: {
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1000,
      },
      timeoutMs: 120_000, // 2 min timeout for large libraries
    });

    // Parse and validate response
    const insights = parseInsightsResponse(response.content, args.bookCount);
    return insights;
  },
});
```

**Prompt Engineering**:
```typescript
function buildInsightsPrompt(books: BookSummary[], bookCount: number): string {
  const bookList = books
    .map(b => `- "${b.title}" by ${b.author}${b.description ? ` — ${b.description.slice(0, 100)}` : ""}`)
    .join("\n");

  const confidenceLevel = bookCount >= 50 ? "strong"
    : bookCount >= 20 ? "developing" : "early";

  return `You are a literary analyst. Analyze this reader's book collection and provide insights about their reading identity.

BOOKS (${bookCount} total):
${bookList}

Provide analysis in JSON format:

{
  "tasteTagline": "A reader drawn to [primary interest] who explores [secondary interest]",
  "literaryTaste": {
    "genres": ["top 3-5 genres"],
    "moods": ["preferred moods: dark/light, fast/slow, etc."],
    "complexity": "accessible|moderate|literary"
  },
  "thematicConnections": [
    { "theme": "recurring theme", "books": ["book titles that share it"] }
  ],
  ${confidenceLevel === "strong" ? '"readingEvolution": "How their taste has evolved over time",' : ""}
  "confidence": "${confidenceLevel}"
}

Rules:
- Be specific and insightful, not generic
- Base analysis ONLY on the books provided
- For "${confidenceLevel}" confidence, ${confidenceLevel === "early" ? "acknowledge limited data" : "provide deeper analysis"}
- Limit thematicConnections to 3 most significant themes
- Keep tasteTagline under 100 characters`;
}

function parseInsightsResponse(content: string, bookCount: number): ProfileInsights {
  try {
    const parsed = JSON.parse(content);
    // Validate required fields
    if (!parsed.tasteTagline || !parsed.literaryTaste) {
      throw new Error("Missing required fields");
    }
    return {
      tasteTagline: parsed.tasteTagline,
      literaryTaste: parsed.literaryTaste,
      thematicConnections: parsed.thematicConnections ?? [],
      readingEvolution: bookCount >= 50 ? parsed.readingEvolution : undefined,
      confidence: bookCount >= 50 ? "strong" : bookCount >= 20 ? "developing" : "early",
    };
  } catch (e) {
    // Fallback for malformed response
    return {
      tasteTagline: "A reader with eclectic tastes",
      literaryTaste: { genres: [], moods: [], complexity: "moderate" },
      thematicConnections: [],
      confidence: "early",
    };
  }
}
```

**Error Handling**:
- Rate limit (429) → throw with retry message
- Timeout → throw with "taking longer" message
- Parse error → return fallback insights
- Model unavailable → attempt DeepSeek fallback

**Model Fallback Chain**:
```typescript
const FALLBACK_MODELS = [
  "google/gemini-3-flash-preview",
  "deepseek/deepseek-v3.2-20251201",
  "qwen/qwen3-235b-a22b",
];

async function callWithFallback(request: OpenRouterRequest): Promise<string> {
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await openRouterChatCompletion({
        ...request,
        request: { ...request.request, model },
      });
      return response.content;
    } catch (e) {
      if (e instanceof OpenRouterApiError && e.status === 429) {
        continue; // Try next model
      }
      throw e;
    }
  }
  throw new Error("All models unavailable");
}
```

---

### Module: ProfileStorage (Caching Layer)

**Responsibility**: Store generated profiles in Convex with staleness tracking. Separate table from users to keep schema clean.

**Schema Addition** (`convex/schema.ts`):
```typescript
readerProfiles: defineTable({
  userId: v.id("users"),

  // User identity (for public display)
  username: v.string(), // unique, URL-safe slug
  displayName: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),

  // Computed stats (refreshed on access)
  stats: v.object({
    totalBooks: v.number(),
    booksRead: v.number(),
    pagesRead: v.number(),
    audiobookRatio: v.number(),
    averagePace: v.number(),
    topAuthors: v.array(v.object({
      author: v.string(),
      count: v.number()
    })),
  }),

  // AI-generated insights (cached)
  insights: v.optional(v.object({
    tasteTagline: v.string(),
    literaryTaste: v.object({
      genres: v.array(v.string()),
      moods: v.array(v.string()),
      complexity: v.union(
        v.literal("accessible"),
        v.literal("moderate"),
        v.literal("literary")
      ),
    }),
    thematicConnections: v.array(v.object({
      theme: v.string(),
      books: v.array(v.string()),
    })),
    readingEvolution: v.optional(v.string()),
    confidence: v.union(
      v.literal("early"),
      v.literal("developing"),
      v.literal("strong")
    ),
  })),

  // Generation state
  generationStatus: v.union(
    v.literal("pending"),
    v.literal("generating"),
    v.literal("complete"),
    v.literal("failed")
  ),
  generationError: v.optional(v.string()),
  lastGeneratedAt: v.optional(v.number()),
  bookCountAtGeneration: v.optional(v.number()),

  // Sharing
  isPublic: v.boolean(),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_username", ["username"])
  .index("by_public", ["isPublic"]),
```

**Username Addition** (`convex/schema.ts` - users table):
```typescript
users: defineTable({
  clerkId: v.string(),
  email: v.string(),
  name: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  username: v.optional(v.string()), // NEW: URL-safe slug
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_username", ["username"]), // NEW
```

**Public Interface**:
```typescript
// convex/profiles.ts

// Get own profile (creates if missing)
export const get = query({
  args: {},
  returns: v.union(
    v.object({ status: v.literal("no_books"), bookCount: v.number() }),
    v.object({ status: v.literal("below_threshold"), bookCount: v.number() }),
    v.object({
      status: v.literal("generating"),
      profile: v.object({ /* partial */ }),
    }),
    v.object({
      status: v.literal("ready"),
      profile: v.object({ /* full */ }),
      isStale: v.boolean(),
    }),
  ),
  handler: async (ctx) => { /* ... */ },
});

// Get public profile by username
export const getPublic = query({
  args: { username: v.string() },
  returns: v.union(v.null(), v.object({ /* sanitized profile */ })),
  handler: async (ctx, { username }) => {
    const profile = await ctx.db
      .query("readerProfiles")
      .withIndex("by_username", q => q.eq("username", username))
      .unique();

    if (!profile || !profile.isPublic) return null;

    // Return sanitized public data
    return {
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      stats: {
        totalBooks: profile.stats.totalBooks,
        booksRead: profile.stats.booksRead,
        averagePace: profile.stats.averagePace,
      },
      insights: profile.insights ? {
        tasteTagline: profile.insights.tasteTagline,
        literaryTaste: profile.insights.literaryTaste,
        thematicConnections: profile.insights.thematicConnections,
        confidence: profile.insights.confidence,
      } : null,
    };
  },
});

// Toggle public sharing
export const togglePublic = mutation({
  args: { isPublic: v.boolean() },
  handler: async (ctx, { isPublic }) => {
    const userId = await requireAuth(ctx);
    const profile = await ctx.db
      .query("readerProfiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      isPublic,
      updatedAt: Date.now()
    });
  },
});

// Trigger regeneration
export const regenerate = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const profile = await ctx.db
      .query("readerProfiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("Profile not found");

    // Rate limit: 1 regeneration per 5 minutes
    const cooldown = 5 * 60 * 1000;
    if (profile.lastGeneratedAt && Date.now() - profile.lastGeneratedAt < cooldown) {
      throw new Error("Please wait before regenerating");
    }

    await ctx.db.patch(profile._id, {
      generationStatus: "pending",
      updatedAt: Date.now(),
    });

    // Schedule generation action
    await ctx.scheduler.runAfter(0, internal.actions.profileInsights.generate, {
      profileId: profile._id,
    });
  },
});
```

**Staleness Logic**:
```typescript
function isProfileStale(profile: Doc<"readerProfiles">, currentBookCount: number): boolean {
  // Never generated
  if (!profile.lastGeneratedAt) return true;

  // More than 7 days old
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - profile.lastGeneratedAt > sevenDays) return true;

  // Significant book count change (>20% or 5+ books)
  const countAtGen = profile.bookCountAtGeneration ?? 0;
  const delta = currentBookCount - countAtGen;
  if (delta >= 5 || delta / countAtGen > 0.2) return true;

  return false;
}
```

---

### Module: ProfileView (UI Components)

**Responsibility**: Render the reader identity card, stats grid, and insight cards. Handle loading states and share modal.

**Component Structure**:
```
components/profile/
├── ProfilePage.tsx           # Main page container
├── ProfileHero.tsx           # Identity card (the product)
├── ProfileStats.tsx          # Stats grid with visualizations
├── ProfileInsights.tsx       # AI insight cards
├── ProfileSkeleton.tsx       # Loading state
├── ProfileThreshold.tsx      # Below 20 books state
├── ShareModal.tsx            # Share preview + toggle
└── ProfileOGCard.tsx         # Component for OG image
```

**ProfileHero.tsx** (The Product):
```typescript
interface ProfileHeroProps {
  profile: {
    displayName: string;
    avatarUrl?: string;
    stats: { booksRead: number; pagesRead: number; averagePace: number };
    insights?: { tasteTagline: string };
    isPublic: boolean;
    lastGeneratedAt?: number;
  };
  onShare: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function ProfileHero({ profile, onShare, onRegenerate, isRegenerating }: ProfileHeroProps) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-paper">
      {/* Background texture */}
      <div className="absolute inset-0 bg-[url('/paper-texture.png')] opacity-10" />

      {/* Card */}
      <motion.div
        className="relative z-10 max-w-2xl w-full mx-auto p-12 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Avatar */}
        {profile.avatarUrl && (
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="w-24 h-24 rounded-full mx-auto mb-6 ring-4 ring-leather/20"
          />
        )}

        {/* Name */}
        <h1 className="font-display text-4xl text-ink mb-2">
          {profile.displayName}
        </h1>

        {/* Taste tagline */}
        {profile.insights?.tasteTagline && (
          <p className="font-serif text-xl text-ink/70 italic mb-8 max-w-md mx-auto">
            "{profile.insights.tasteTagline}"
          </p>
        )}

        {/* Key stats */}
        <div className="flex justify-center gap-8 mb-8">
          <StatBadge
            value={profile.stats.booksRead}
            label="books read"
          />
          <StatBadge
            value={Math.round(profile.stats.pagesRead / 1000)}
            label="k pages"
          />
          <StatBadge
            value={profile.stats.averagePace.toFixed(1)}
            label="books/month"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button onClick={onShare} variant="default">
            <Share className="w-4 h-4 mr-2" />
            {profile.isPublic ? "Sharing" : "Share"}
          </Button>
          <Button
            onClick={onRegenerate}
            variant="ghost"
            disabled={isRegenerating}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRegenerating && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Last updated */}
        {profile.lastGeneratedAt && (
          <p className="text-xs text-ink/40 mt-8">
            Updated {formatDistanceToNow(profile.lastGeneratedAt)} ago
          </p>
        )}
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8"
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <ChevronDown className="w-6 h-6 text-ink/30" />
      </motion.div>
    </div>
  );
}
```

**ShareModal.tsx**:
```typescript
interface ShareModalProps {
  profile: PublicProfile;
  isPublic: boolean;
  username: string;
  onToggle: (isPublic: boolean) => void;
  onClose: () => void;
}

export function ShareModal({ profile, isPublic, username, onToggle, onClose }: ShareModalProps) {
  const shareUrl = `${window.location.origin}/readers/${username}`;
  const [showWarning, setShowWarning] = useState(false);

  const handleToggle = () => {
    if (isPublic) {
      // Warn before making private
      setShowWarning(true);
    } else {
      onToggle(true);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Your Reader Profile</DialogTitle>
        </DialogHeader>

        {/* Preview card */}
        <div className="border rounded-lg p-4 bg-paper">
          <ProfilePreviewCard profile={profile} />
        </div>

        {/* What's shared */}
        <div className="space-y-2 text-sm">
          <p className="font-medium">Public profile includes:</p>
          <ul className="text-ink/70">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              Books read count, reading pace
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              AI taste profile and themes
            </li>
          </ul>

          <p className="font-medium mt-4">Never shared:</p>
          <ul className="text-ink/70">
            <li className="flex items-center gap-2">
              <X className="w-4 h-4 text-red-600" />
              Individual book titles
            </li>
            <li className="flex items-center gap-2">
              <X className="w-4 h-4 text-red-600" />
              Notes and quotes
            </li>
          </ul>
        </div>

        {/* Toggle + URL */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="public-toggle">Make profile public</Label>
            <p className="text-xs text-ink/50">
              {isPublic ? shareUrl : "Generate a shareable link"}
            </p>
          </div>
          <Switch
            id="public-toggle"
            checked={isPublic}
            onCheckedChange={handleToggle}
          />
        </div>

        {isPublic && (
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly />
            <Button onClick={() => copyToClipboard(shareUrl)}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Warning dialog */}
        <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Make profile private?</AlertDialogTitle>
              <AlertDialogDescription>
                This will break any existing shared links. Anyone who has the link will no longer be able to view your profile.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { onToggle(false); setShowWarning(false); }}>
                Yes, make private
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Module: ProfileOG (Image Generation)

**Responsibility**: Generate Open Graph images for social sharing using Next.js ImageResponse.

**Route** (`app/api/og/profile/route.tsx`):
```typescript
import { ImageResponse } from "next/og";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "edge";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Load fonts
const crimsonText = fetch(
  new URL("../../../../public/fonts/CrimsonText-Regular.ttf", import.meta.url)
).then((res) => res.arrayBuffer());

const inter = fetch(
  new URL("../../../../public/fonts/Inter-Regular.ttf", import.meta.url)
).then((res) => res.arrayBuffer());

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return new Response("Missing username", { status: 400 });
  }

  // Fetch public profile data
  const profile = await client.query(api.profiles.getPublic, { username });

  if (!profile) {
    return new Response("Profile not found", { status: 404 });
  }

  const [crimsonFont, interFont] = await Promise.all([crimsonText, inter]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200",
          height: "630",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FDFBF7",
          fontFamily: "Inter",
        }}
      >
        {/* Paper texture overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.05,
            backgroundImage: "url(data:image/png;base64,...)",
          }}
        />

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {profile.avatarUrl && (
            <img
              src={profile.avatarUrl}
              width={120}
              height={120}
              style={{ borderRadius: "60px", marginBottom: "24px" }}
            />
          )}

          <div style={{
            fontFamily: "Crimson Text",
            fontSize: "48px",
            color: "#1A1A1A",
            marginBottom: "12px",
          }}>
            {profile.displayName}
          </div>

          {profile.insights?.tasteTagline && (
            <div style={{
              fontSize: "24px",
              color: "#1A1A1A99",
              fontStyle: "italic",
              maxWidth: "600px",
              textAlign: "center",
            }}>
              "{profile.insights.tasteTagline}"
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: "flex", gap: "48px", marginTop: "32px" }}>
            <StatBox value={profile.stats.booksRead} label="books read" />
            <StatBox value={profile.stats.averagePace.toFixed(1)} label="books/month" />
          </div>
        </div>

        {/* Branding */}
        <div style={{
          position: "absolute",
          bottom: "24px",
          fontSize: "14px",
          color: "#1A1A1A66"
        }}>
          bibliomnomnom.app
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Crimson Text", data: crimsonFont, style: "normal" },
        { name: "Inter", data: interFont, style: "normal" },
      ],
    }
  );
}
```

**Metadata** (`app/readers/[username]/page.tsx`):
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;

  return {
    title: `${username}'s Reader Profile | bibliomnomnom`,
    openGraph: {
      title: `${username}'s Reader Profile`,
      description: "See what kind of reader they are",
      images: [`/api/og/profile?username=${username}`],
    },
    twitter: {
      card: "summary_large_image",
      images: [`/api/og/profile?username=${username}`],
    },
  };
}
```

---

## File Organization

```
convex/
  schema.ts                    # ADD: readerProfiles table, username field
  profiles.ts                  # NEW: Queries + mutations for profiles
  actions/
    profileInsights.ts         # NEW: LLM generation action

app/
  (dashboard)/
    profile/
      page.tsx                 # Private profile page
      loading.tsx              # Loading skeleton
  readers/
    [username]/
      page.tsx                 # Public profile page
  api/
    og/
      profile/
        route.tsx              # OG image generation

components/
  profile/
    ProfilePage.tsx            # Main container
    ProfileHero.tsx            # Identity card
    ProfileStats.tsx           # Stats grid
    ProfileInsights.tsx        # AI insight cards
    ProfileSkeleton.tsx        # Loading state
    ProfileThreshold.tsx       # < 20 books state
    ShareModal.tsx             # Share controls

lib/
  ai/
    models.ts                  # ADD: DEFAULT_PROFILE_MODEL

public/
  fonts/
    CrimsonText-Regular.ttf    # For OG images
    Inter-Regular.ttf
```

---

## Implementation Pseudocode

### Profile Page Load Flow

```pseudocode
function ProfilePage():
  1. Get current user's book count
     - books = useQuery(api.books.list)
     - bookCount = books.length

  2. Check threshold
     - if bookCount < 20:
       - render ProfileThreshold({ current: bookCount, target: 20 })
       - return

  3. Get profile
     - result = useQuery(api.profiles.get)

  4. Handle states
     - if result.status === "no_books":
       - render ProfileThreshold (shouldn't happen if step 2 passed)

     - if result.status === "generating":
       - render ProfileSkeleton with "Analyzing..." message
       - useEffect to poll for completion

     - if result.status === "ready":
       - if result.isStale:
         - show subtle "refresh" indicator
       - render ProfileHero + ProfileStats + ProfileInsights

  5. Handle actions
     - onShare: open ShareModal
     - onRegenerate:
       - call regenerate mutation
       - show loading state
```

### Profile Generation Flow

```pseudocode
function generateProfile(profileId):
  1. Mark as generating
     - ctx.db.patch(profileId, { generationStatus: "generating" })

  2. Fetch books
     - profile = ctx.db.get(profileId)
     - books = ctx.db.query("books")
         .withIndex("by_user", q => q.eq("userId", profile.userId))
         .filter(q => q.eq(q.field("status"), "read"))
         .collect()

  3. Compute stats (no LLM)
     - stats = computeStats(books)

  4. Generate insights (LLM)
     - bookSummaries = books.map(b => ({ title, author, description }))
     - insights = await callWithFallback({
         model: DEFAULT_PROFILE_MODEL,
         prompt: buildInsightsPrompt(bookSummaries, books.length),
       })

  5. Save completed profile
     - ctx.db.patch(profileId, {
         stats,
         insights,
         generationStatus: "complete",
         lastGeneratedAt: Date.now(),
         bookCountAtGeneration: books.length,
       })

  6. Error handling
     - catch OpenRouterApiError:
       - if 429: try next model in fallback chain
       - else: mark as failed with error message
     - catch timeout:
       - mark as failed with "timeout" message
```

### Username Generation

```pseudocode
function generateUsername(name, email):
  1. Try name-based slug
     - base = slugify(name) or slugify(email.split("@")[0])
     - candidate = base

  2. Check uniqueness
     - for i in 1..10:
       - existing = db.query("users").withIndex("by_username", candidate)
       - if !existing: return candidate
       - candidate = `${base}-${randomDigits(3)}`

  3. Fallback to UUID
     - return `reader-${uuid().slice(0, 8)}`

function slugify(text):
  - lowercase
  - replace spaces with hyphens
  - remove non-alphanumeric except hyphens
  - limit to 20 chars
```

---

## State Management

**Client State**:
- Profile data via Convex query (real-time)
- Share modal open/closed (React state)
- Regeneration in progress (optimistic)

**Server State**:
- `readerProfiles` table in Convex
- Insights cached until stale
- Stats computed fresh on each query

**State Update Flow**:
1. User visits `/profile` → query fires → returns cached or triggers generation
2. Generation completes → Convex updates record → query auto-refreshes → UI updates
3. User toggles share → mutation fires → profile updates → query refreshes
4. User adds book → books query updates → staleness check may trigger regeneration

---

## Error Handling Strategy

| Error | User Message | Action |
|-------|--------------|--------|
| `< 20 books` | "Add X more books to unlock" | Show progress bar + add book CTA |
| `Generating` | "Analyzing your library..." | Show skeleton with progress |
| `Timeout (>90s)` | "Taking longer than expected..." | Keep showing skeleton |
| `Timeout (>3min)` | "Generation failed. [Retry]" | Show error state with retry button |
| `Rate limited` | "High demand. Try again in a few minutes." | Show error with countdown |
| `Model unavailable` | (silent fallback) | Try next model in chain |
| `All models failed` | "Analysis temporarily unavailable." | Show cached profile if available, else error |
| `Parse error` | (silent fallback) | Use generic insights |

**Error Logging**:
```typescript
logger.error("Profile generation failed", {
  userId,
  profileId,
  error: err.message,
  model: attemptedModel,
  bookCount,
});
```

---

## Testing Strategy

### Unit Tests

**ProfileData (stats computation)**:
```typescript
describe("computeStats", () => {
  it("handles empty library", () => {
    expect(computeStats([])).toEqual({
      totalBooks: 0,
      booksRead: 0,
      pagesRead: 0,
      // ...
    });
  });

  it("estimates pages for books without pageCount", () => {
    const books = [{ title: "Test", pageCount: undefined }];
    expect(computeStats(books).pagesRead).toBe(250);
  });

  it("calculates reading pace from finished dates", () => {
    const books = [
      { dateFinished: Date.now() - 30 * DAY },
      { dateFinished: Date.now() },
    ];
    expect(computeStats(books).averagePace).toBeCloseTo(2);
  });
});
```

**ProfileInsights (prompt building)**:
```typescript
describe("buildInsightsPrompt", () => {
  it("includes all book titles", () => {
    const books = [{ title: "Book 1", author: "Author 1" }];
    const prompt = buildInsightsPrompt(books, 1);
    expect(prompt).toContain("Book 1");
  });

  it("sets confidence level based on book count", () => {
    expect(buildInsightsPrompt([], 15)).toContain('"confidence": "early"');
    expect(buildInsightsPrompt([], 30)).toContain('"confidence": "developing"');
    expect(buildInsightsPrompt([], 60)).toContain('"confidence": "strong"');
  });
});
```

**Username generation**:
```typescript
describe("generateUsername", () => {
  it("slugifies name", () => {
    expect(slugify("John Smith")).toBe("john-smith");
  });

  it("handles special characters", () => {
    expect(slugify("José García")).toBe("jose-garcia");
  });

  it("limits length", () => {
    expect(slugify("Very Long Name That Exceeds Limit").length).toBeLessThanOrEqual(20);
  });
});
```

### Integration Tests

**Profile generation flow**:
```typescript
describe("profile generation", () => {
  it("creates profile for user with 20+ books", async () => {
    // Setup: create user with 25 books
    const userId = await createTestUser();
    await createTestBooks(userId, 25);

    // Trigger generation
    const result = await ctx.runMutation(api.profiles.regenerate);

    // Wait for completion
    await waitFor(() => {
      const profile = ctx.runQuery(api.profiles.get);
      return profile.status === "ready";
    });

    // Verify
    expect(profile.insights.tasteTagline).toBeDefined();
    expect(profile.stats.booksRead).toBe(25);
  });
});
```

### E2E Tests

**Profile sharing flow**:
```typescript
test("user can share profile", async ({ page }) => {
  // Login and navigate
  await page.goto("/profile");

  // Click share
  await page.click('button:has-text("Share")');

  // Toggle public
  await page.click('switch[id="public-toggle"]');

  // Verify URL shown
  await expect(page.locator('input[readonly]')).toHaveValue(/\/readers\/[a-z-]+/);

  // Visit public URL
  const url = await page.locator('input[readonly]').inputValue();
  await page.goto(url);

  // Verify public content
  await expect(page.locator('h1')).toContainText(/\w+/);
});
```

**Mocking Strategy**:
- Unit tests: Mock Convex context
- Integration tests: Real Convex test deployment, mocked OpenRouter
- E2E tests: Real everything except OpenRouter (mock with fixture response)

---

## Performance Considerations

**Expected Load**:
- ~1000 profile views/day
- ~100 generations/day (most are cached)
- < 2s p95 for cached profiles
- < 60s p95 for generation

**Optimizations**:

1. **Staleness check is cheap**: Just compare timestamps and book count
2. **Stats computed at query time**: Fast aggregation, no caching needed
3. **Insights cached 7 days**: LLM only called when stale
4. **OG images cached by CDN**: Vercel edge caches ImageResponse
5. **Parallel fallback**: Try next model immediately on 429

**Database Indexes**:
- `by_user` on readerProfiles (primary access pattern)
- `by_username` on readerProfiles (public URL lookup)
- `by_public` on readerProfiles (future: browse public profiles)

---

## Security Considerations

**Data Privacy**:
- Never send notes/quotes to LLM (privacy)
- Only send titles, authors, descriptions
- Sanitize public profile (no book titles, dates)
- Rate limit regeneration (5 min cooldown)

**Authentication**:
- Private routes require `requireAuth()`
- Public routes use `getPublic` query (no auth, returns null if not public)
- OG route fetches via HTTP client (no auth, respects isPublic)

**Input Validation**:
- Username: alphanumeric + hyphens, 3-20 chars
- All mutations validate ownership before modifying

---

## Open Questions Resolved

| Question | Decision | Rationale |
|----------|----------|-----------|
| Username system | Add to users table | Simple, reuse existing auth flow |
| LLM model | Gemini 3 Flash Preview | Best quality/cost, 1M context |
| Report storage | Structured fields in Convex | Type safety, queryable |
| OG images | Next.js ImageResponse | Built-in, fast, no external service |
| Rate limiting | 5 min cooldown mutation | Simple, prevents abuse |
| Model fallback | Gemini → DeepSeek → Qwen | Automatic on 429 errors |

---

## Summary

**Selected Architecture**: Convex-native with structured storage

**Key Modules**:
1. **ProfileData**: Compute stats from books (no LLM)
2. **ProfileInsights**: Generate AI analysis via action
3. **ProfileStorage**: Cache in Convex with staleness tracking
4. **ProfileView**: Render identity card with sharing
5. **ProfileOG**: Generate shareable images

**Critical Decisions**:
- On-demand generation (no cron)
- 20 book minimum threshold
- 7-day cache with book-count staleness
- Fallback model chain
- Sanitized public view

**What's NOT in scope**:
- Monthly/yearly digests (cut)
- Per-field privacy (simplified to binary)
- Real-time updates (regenerate on visit)

---

**Next Step**: Run `/build` to implement this architecture.
