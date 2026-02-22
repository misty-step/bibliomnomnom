"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { openRouterChatCompletion, OpenRouterApiError } from "../../lib/ai/openrouter";
import { DEFAULT_PROFILE_MODEL, PROFILE_FALLBACK_MODELS } from "../../lib/ai/models";
import type { Doc } from "../_generated/dataModel";

// --- Types ---

export type VoiceNoteSummary = {
  bookTitle: string;
  bookAuthor: string;
  artifacts: Array<{
    kind: "insight" | "openQuestion" | "quote" | "followUpQuestion" | "contextExpansion";
    title: string;
    content: string;
  }>;
};

type BookSummary = {
  title: string;
  author: string;
  description?: string;
  status: "want-to-read" | "currently-reading" | "read";
  isFavorite: boolean;
  isAudiobook: boolean;
  dateFinished?: number;
  timesRead: number;
};

type BookRecommendation = {
  title: string;
  author: string;
  reason: string; // Short hook < 80 chars
  detailedReason?: string; // 2-3 sentence explanation
  connectionBooks?: string[]; // Titles from user's library
  badges?: string[]; // "similar-atmosphere", "award-winner", etc.
  isReread?: boolean;
};

type EvolutionPhase = {
  title: string; // "The Thriller Years"
  period: string; // "2019-2021"
  description: string;
  keyBooks: string[]; // 2-4 representative titles
  catalyst?: string; // Book that triggered shift
};

type StructuredEvolution = {
  phases: EvolutionPhase[];
  narrative: string; // Overall 2-3 paragraph story
  trajectory: string; // Future speculation
};

// Matches schema union: string (legacy) or object (new format)
type ThematicBook =
  | string
  | {
      title: string;
      author: string;
      coverUrl?: string; // Enriched from user's library
    };

type ThematicConnection = {
  theme: string;
  description?: string;
  books: ThematicBook[];
};

type ProfileInsights = {
  tasteTagline: string;
  readerArchetype?: string; // "The Polymath", "Digital Sovereign", etc.
  literaryTaste: {
    genres: string[];
    moods: string[];
    complexity: "accessible" | "moderate" | "literary";
  };
  thematicConnections: ThematicConnection[];
  // Supports both legacy string and new structured format
  readingEvolution?: string | StructuredEvolution;
  evolutionSpeculation?: string; // Legacy: kept for backward compat
  confidence: "early" | "developing" | "strong";
  recommendations?: {
    goDeeper: BookRecommendation[];
    goWider: BookRecommendation[];
    // Legacy fields for backward compat
    continueReading?: BookRecommendation[];
    freshPerspective?: BookRecommendation[];
    revisit?: BookRecommendation[];
  };
};

// --- Constants ---

const MIN_BOOKS_FOR_FULL = 50;
const MAX_BOOKS_TO_ANALYZE = 200; // Limit context size
const GENERATION_TIMEOUT_MS = 120_000; // 2 minutes

// --- Prompt Engineering ---

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function buildInsightsPrompt(
  books: BookSummary[],
  bookCount: number,
  voiceNoteSummaries: VoiceNoteSummary[] = [],
): string {
  // Separate books by category for richer context
  const readBooks = books.filter((b) => b.status === "read");
  const favorites = books.filter((b) => b.isFavorite);
  const recentBooks = readBooks
    .filter((b) => b.dateFinished)
    .sort((a, b) => (b.dateFinished || 0) - (a.dateFinished || 0))
    .slice(0, 10);
  const rereads = books.filter((b) => b.timesRead > 1);

  // Build enhanced book list with metadata
  const bookList = books
    .map((b) => {
      const tags: string[] = [];
      if (b.isFavorite) tags.push("★");
      if (b.isAudiobook) tags.push("audio");
      if (b.timesRead > 1) tags.push(`${b.timesRead}x read`);
      if (b.dateFinished) tags.push(`finished ${formatDate(b.dateFinished)}`);
      const tagStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
      return `- "${b.title}" by ${b.author}${tagStr}${b.description ? ` — ${b.description.slice(0, 80)}` : ""}`;
    })
    .join("\n");

  // Build recent reads section
  const recentSection =
    recentBooks.length > 0
      ? `\nRECENTLY FINISHED (last 10):\n${recentBooks.map((b) => `- "${b.title}" by ${b.author}`).join("\n")}`
      : "";

  // Build favorites section
  const favoritesSection =
    favorites.length > 0
      ? `\nFAVORITES (★ starred books):\n${favorites.map((b) => `- "${b.title}" by ${b.author}`).join("\n")}`
      : "";

  // Build re-reads section
  const rereadsSection =
    rereads.length > 0
      ? `\nRE-READS (books read multiple times):\n${rereads.map((b) => `- "${b.title}" by ${b.author} (${b.timesRead}x)`).join("\n")}`
      : "";

  // Build voice note evidence section
  const voiceNoteSection =
    voiceNoteSummaries.length > 0
      ? `\nVOICE NOTE EVIDENCE (reader's own spoken reactions while reading):\n${voiceNoteSummaries
          .map(
            (s) =>
              `"${s.bookTitle}" by ${s.bookAuthor}:\n${s.artifacts.map((a) => `  [${a.kind}] ${a.title}: ${a.content}`).join("\n")}`,
          )
          .join("\n\n")}`
      : "";

  const confidenceLevel = bookCount >= MIN_BOOKS_FOR_FULL ? "strong" : "developing";
  const includeEvolution = bookCount >= MIN_BOOKS_FOR_FULL;

  return `You are a literary analyst helping a voracious reader understand their reading patterns and discover their next great read.

READER'S LIBRARY (${bookCount} books):
${bookList}
${recentSection}${favoritesSection}${rereadsSection}${voiceNoteSection}

Analyze this collection and provide insights in JSON format:

{
  "tasteTagline": "Under 100 chars - memorable, specific, captures their unique reading identity",

  "readerArchetype": "2-3 word identity title. Examples: 'The Polymath', 'Digital Sovereign', 'Seeker of Shadows', 'The Chronicler', 'Midnight Wanderer'. Must feel like an earned title, not a description.",

  "literaryTaste": {
    "genres": ["5 specific genres, not generic - e.g., 'psychological thriller' not 'thriller'"],
    "moods": ["5 specific moods/atmospheres they gravitate toward"],
    "complexity": "accessible|moderate|literary"
  },

  "thematicConnections": [
    {
      "theme": "Specific unifying theme (not generic like 'adventure')",
      "description": "1-2 sentences explaining what this theme reveals about the reader",
      "books": [
        { "title": "Book Title", "author": "Author Name" }
      ]
    }
  ]${
    includeEvolution
      ? `,

  "readingEvolution": {
    "phases": [
      {
        "title": "Phase Name (e.g., 'The Thriller Years')",
        "period": "YYYY-YYYY",
        "description": "What defined this reading period - themes, moods, discoveries",
        "keyBooks": ["2-4 representative titles from this phase"],
        "catalyst": "The book that triggered this shift (optional)"
      }
    ],
    "narrative": "2-3 paragraph story of their reading journey, connecting the phases narratively",
    "trajectory": "Where their reading might go next based on current momentum"
  }`
      : ""
  },

  "recommendations": {
    "goDeeper": [
      {
        "title": "Book Title",
        "author": "Author",
        "reason": "Hook < 80 chars - why this deepens current interests",
        "detailedReason": "2-3 sentences connecting to SPECIFIC books they've read and why this continues that thread",
        "connectionBooks": ["Their Book 1", "Their Book 2"],
        "badges": ["similar-atmosphere", "award-winner"],
        "isReread": false
      }
    ],
    "goWider": [
      {
        "title": "Book Title",
        "author": "Author",
        "reason": "Hook < 80 chars - why this expands into NEW territory",
        "detailedReason": "2-3 sentences explaining what makes this genuinely different and why it would resonate",
        "connectionBooks": ["Their Book that shows readiness"],
        "badges": ["genre-defining", "cult-classic"]
      }
    ]
  }
}

ANALYSIS RULES:
- readerArchetype: Create a distinctive 2-3 word title that captures their reading identity. It should feel like an RPG class or a literary moniker — evocative and specific to THIS reader.
- Be specific and insightful, never generic platitudes
- Base analysis ONLY on books provided — do not assume books not listed${voiceNoteSummaries.length > 0 ? "\n- Only cite voice note evidence that is explicitly present in the VOICE NOTE EVIDENCE section above — never infer or fabricate reader reactions not recorded there" : ""}
- For "${confidenceLevel}" confidence: ${confidenceLevel === "developing" ? "note limited sample where appropriate" : "provide confident, deep analysis"}
- Keep tasteTagline under 100 characters, make it memorable and unique to THIS reader
- For complexity: "accessible" = popular fiction, "moderate" = literary-commercial, "literary" = dense/challenging
- Include ALL significant thematic connections you identify (typically 5-12 themes for well-read libraries)
- Include ALL relevant books per theme - do not truncate

RECOMMENDATION RULES:
- goDeeper (10-12 books): Focus on RECENT reads and their favorites
  • 8-10 external books that deepen themes they're actively exploring
  • 2-3 books FROM their library worth re-reading (mark isReread: true)
  • Each must have connectionBooks (1-3 titles from THEIR library)
  • Each must have 1-2 badges from: similar-atmosphere, same-author-style, award-winner, cult-classic, genre-defining, recently-adapted
- goWider (10-12 books): Identify GAPS in their reading
  • What perspectives, genres, time periods, or cultures are missing?
  • Suggest books that would genuinely expand their worldview
  • Not variations of existing themes — truly different territory
  • Each must have connectionBooks showing what they've read that suggests readiness
  • Each must have 1-2 badges
- Both:
  • Real published books only
  • "reason" is a hook UNDER 80 chars
  • "detailedReason" is 2-3 sentences of specific reasoning
  • Connect every recommendation to SPECIFIC titles from their library

EVOLUTION RULES (for 50+ books):
- Identify 3-5 distinct phases in their reading journey
- Each phase needs a catchy title, time period, and 2-4 representative books
- Identify the "catalyst" book that triggered major shifts (not every phase needs one)
- Narrative should read like a magazine profile, connecting phases into a story
- Trajectory should be specific and actionable, not generic speculation

Respond with valid JSON only, no markdown or extra text.`;
}

export function parseInsightsResponse(content: string, bookCount: number): ProfileInsights {
  const confidence: ProfileInsights["confidence"] =
    bookCount >= MIN_BOOKS_FOR_FULL ? "strong" : "developing";

  try {
    // Clean potential markdown code blocks
    let cleaned = content.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.tasteTagline || typeof parsed.tasteTagline !== "string" || !parsed.literaryTaste) {
      throw new Error("Missing required fields");
    }

    // Ensure complexity is valid
    const validComplexity = ["accessible", "moderate", "literary"];
    const complexity = validComplexity.includes(parsed.literaryTaste?.complexity)
      ? (parsed.literaryTaste.complexity as ProfileInsights["literaryTaste"]["complexity"])
      : "moderate";

    // Parse new-format recommendations with rich fields (goDeeper/goWider)
    const parseNewRecommendations = (
      recs: unknown[],
      maxItems: number = 12,
    ): BookRecommendation[] => {
      if (!Array.isArray(recs)) return [];
      return recs.slice(0, maxItems).map((r: unknown) => {
        const rec = r as {
          title?: string;
          author?: string;
          reason?: string;
          detailedReason?: string;
          connectionBooks?: string[];
          badges?: string[];
          isReread?: boolean;
        };
        return {
          title: String(rec.title ?? "").slice(0, 200),
          author: String(rec.author ?? "").slice(0, 100),
          reason: String(rec.reason ?? "").slice(0, 100), // Hook < 80 chars
          ...(rec.detailedReason
            ? { detailedReason: String(rec.detailedReason).slice(0, 500) }
            : {}),
          ...(Array.isArray(rec.connectionBooks) && rec.connectionBooks.length > 0
            ? { connectionBooks: rec.connectionBooks.slice(0, 5).map(String) }
            : {}),
          ...(Array.isArray(rec.badges) && rec.badges.length > 0
            ? { badges: rec.badges.slice(0, 3).map(String) }
            : {}),
          ...(rec.isReread ? { isReread: true } : {}),
        };
      });
    };

    // Parse structured evolution format
    const parseStructuredEvolution = (evo: unknown): StructuredEvolution | undefined => {
      if (!evo || typeof evo !== "object") return undefined;
      const evolution = evo as {
        phases?: unknown[];
        narrative?: string;
        trajectory?: string;
      };

      if (!evolution.phases || !Array.isArray(evolution.phases)) return undefined;
      if (!evolution.narrative || !evolution.trajectory) return undefined;

      const phases: EvolutionPhase[] = evolution.phases.slice(0, 5).map((p: unknown) => {
        const phase = p as {
          title?: string;
          period?: string;
          description?: string;
          keyBooks?: string[];
          catalyst?: string;
        };
        return {
          title: String(phase.title ?? "").slice(0, 100),
          period: String(phase.period ?? "").slice(0, 20),
          description: String(phase.description ?? "").slice(0, 300),
          keyBooks: Array.isArray(phase.keyBooks) ? phase.keyBooks.slice(0, 4).map(String) : [],
          ...(phase.catalyst ? { catalyst: String(phase.catalyst).slice(0, 200) } : {}),
        };
      });

      return {
        phases,
        narrative: String(evolution.narrative).slice(0, 3500), // Extended for 2-3 rich paragraphs
        trajectory: String(evolution.trajectory).slice(0, 800),
      };
    };

    // Build recommendations object with new format, fallback to legacy
    let recommendations: ProfileInsights["recommendations"] | undefined;
    if (parsed.recommendations) {
      const recs = parsed.recommendations;
      // Check for new format first
      if (recs.goDeeper || recs.goWider) {
        recommendations = {
          goDeeper: parseNewRecommendations(recs.goDeeper, 12),
          goWider: parseNewRecommendations(recs.goWider, 12),
        };
      } else {
        // Legacy format - convert to new format
        const continueReading = parseNewRecommendations(recs.continueReading, 3);
        const revisit = parseNewRecommendations(recs.revisit, 2).map((r) => ({
          ...r,
          isReread: true,
        }));
        recommendations = {
          goDeeper: [...continueReading, ...revisit],
          goWider: parseNewRecommendations(recs.freshPerspective, 3),
        };
      }
    }

    // Parse evolution - try structured first, fall back to string
    let readingEvolution: ProfileInsights["readingEvolution"];
    if (bookCount >= MIN_BOOKS_FOR_FULL && parsed.readingEvolution) {
      // Try structured format first
      const structured = parseStructuredEvolution(parsed.readingEvolution);
      if (structured) {
        readingEvolution = structured;
      } else if (typeof parsed.readingEvolution === "string") {
        // Fall back to legacy string format
        readingEvolution = String(parsed.readingEvolution).slice(0, 500);
      }
    }

    return {
      tasteTagline: parsed.tasteTagline.slice(0, 150),
      readerArchetype:
        typeof parsed.readerArchetype === "string"
          ? parsed.readerArchetype.slice(0, 50)
          : undefined,
      literaryTaste: {
        genres: Array.isArray(parsed.literaryTaste?.genres)
          ? parsed.literaryTaste.genres.slice(0, 5)
          : [],
        moods: Array.isArray(parsed.literaryTaste?.moods)
          ? parsed.literaryTaste.moods.slice(0, 5)
          : [],
        complexity,
      },
      // No hard limits on themes or books per theme - include all significant connections
      thematicConnections: Array.isArray(parsed.thematicConnections)
        ? parsed.thematicConnections.map(
            (tc: {
              theme?: string;
              description?: string;
              books?: Array<{ title?: string; author?: string } | string>;
            }) => ({
              theme: String(tc.theme ?? ""),
              ...(tc.description ? { description: String(tc.description).slice(0, 300) } : {}),
              books: Array.isArray(tc.books)
                ? tc.books.map((b) => {
                    // Handle both old string format and new object format
                    if (typeof b === "string") {
                      return { title: b, author: "Unknown" };
                    }
                    return {
                      title: String(b.title ?? ""),
                      author: String(b.author ?? "Unknown"),
                    };
                  })
                : [],
            }),
          )
        : [],
      readingEvolution,
      // Keep evolutionSpeculation for backward compat with legacy string format
      evolutionSpeculation:
        bookCount >= MIN_BOOKS_FOR_FULL &&
        parsed.evolutionSpeculation &&
        typeof parsed.readingEvolution === "string"
          ? String(parsed.evolutionSpeculation).slice(0, 300)
          : undefined,
      confidence,
      recommendations,
    };
  } catch {
    // Fallback for malformed response
    return {
      tasteTagline: "A reader with eclectic and diverse tastes",
      literaryTaste: { genres: [], moods: [], complexity: "moderate" },
      thematicConnections: [],
      confidence,
    };
  }
}

// --- Model Fallback Logic ---

async function callWithFallback(apiKey: string, prompt: string): Promise<string> {
  const models = process.env.OPENROUTER_PROFILE_MODEL
    ? [process.env.OPENROUTER_PROFILE_MODEL, ...PROFILE_FALLBACK_MODELS]
    : [DEFAULT_PROFILE_MODEL, ...PROFILE_FALLBACK_MODELS];

  // Deduplicate models
  const uniqueModels = [...new Set(models)];

  for (const model of uniqueModels) {
    try {
      const response = await openRouterChatCompletion({
        apiKey,
        request: {
          model,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 4000, // Increased for richer evolution, 20+ recommendations, and detailed reasoning
        },
        timeoutMs: GENERATION_TIMEOUT_MS,
      });
      return response.content;
    } catch (e) {
      // On rate limit or model unavailable, try next
      if (e instanceof OpenRouterApiError && (e.status === 429 || e.status === 503)) {
        console.log(`Model ${model} unavailable (${e.status}), trying fallback...`);
        continue;
      }
      // For other errors, throw
      throw e;
    }
  }

  throw new Error("All models unavailable. Please try again later.");
}

// --- Main Action ---

export const generate = internalAction({
  args: {
    profileId: v.id("readerProfiles"),
  },
  handler: async (ctx, args) => {
    // Get profile
    const profile = await ctx.runQuery(internal.profiles.getProfileForAction, {
      profileId: args.profileId,
    });

    if (!profile) {
      console.error("Profile not found:", args.profileId);
      return;
    }

    // Mark as generating
    await ctx.runMutation(internal.profiles.updateGenerationStatus, {
      profileId: args.profileId,
      status: "generating",
    });

    try {
      // Get API key
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY not configured");
      }

      // Get books
      const books = await ctx.runQuery(internal.profiles.getBooksForProfile, {
        userId: profile.userId,
      });

      const bookCount = books.length;
      if (bookCount < 20) {
        throw new Error("Not enough books for profile generation");
      }

      // Prepare enhanced book summaries with metadata
      const bookSummaries: BookSummary[] = books
        .slice(0, MAX_BOOKS_TO_ANALYZE)
        .map((book: Doc<"books">) => ({
          title: book.title,
          author: book.author,
          description: book.description,
          status: book.status,
          isFavorite: book.isFavorite,
          isAudiobook: book.isAudiobook,
          dateFinished: book.dateFinished,
          timesRead: book.timesRead,
        }));

      // Fetch voice-note synthesis artifacts (graceful degradation if query fails)
      let voiceNoteSummaries: VoiceNoteSummary[] = [];
      try {
        voiceNoteSummaries = await ctx.runQuery(internal.profiles.getVoiceNoteSummariesForProfile, {
          userId: profile.userId,
        });
      } catch (e) {
        console.warn("Failed to fetch voice note summaries, proceeding without:", e);
      }

      // Build prompt
      const prompt = buildInsightsPrompt(bookSummaries, bookCount, voiceNoteSummaries);

      // Call LLM with fallback
      const responseContent = await callWithFallback(apiKey, prompt);

      // Parse response
      const insights = parseInsightsResponse(responseContent, bookCount);

      // Enrich thematic connections with cover URLs from user's library
      const booksWithCovers = books.map((book: Doc<"books">) => ({
        title: book.title.toLowerCase(),
        author: book.author.toLowerCase(),
        coverUrl: book.coverUrl || book.apiCoverUrl,
      }));

      insights.thematicConnections = insights.thematicConnections.map((tc) => ({
        ...tc,
        books: tc.books.map((themeBook) => {
          // Handle both string (legacy) and object formats
          const bookTitle = typeof themeBook === "string" ? themeBook : themeBook.title;
          const bookAuthor = typeof themeBook === "string" ? "" : themeBook.author;

          // Try to find matching book in user's library (exact match only)
          const match = booksWithCovers.find((b) => b.title === bookTitle.toLowerCase());
          return {
            title: bookTitle,
            author: bookAuthor,
            coverUrl: match?.coverUrl,
          };
        }),
      }));

      // Save insights
      await ctx.runMutation(internal.profiles.saveInsights, {
        profileId: args.profileId,
        insights,
        bookCount,
      });

      console.log(`Profile insights generated for ${args.profileId}: ${insights.tasteTagline}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Profile generation failed:", message);

      await ctx.runMutation(internal.profiles.updateGenerationStatus, {
        profileId: args.profileId,
        status: "failed",
        error: message,
      });
    }
  },
});
