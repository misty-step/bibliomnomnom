import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { FunctionReference } from "convex/server";
import { requireAuth } from "./auth";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { packContext, type ContextPackLibraryBook } from "../lib/listening-sessions/contextPacker";
import {
  MAX_SYNTH_ARTIFACT_ITEMS,
  MAX_CONTEXT_EXPANSION_ITEMS,
  type SynthesisArtifacts as SynthesisArtifactsShape,
} from "../lib/listening-sessions/synthesis";

const synthesisArtifacts = v.object({
  insights: v.array(
    v.object({
      title: v.string(),
      content: v.string(),
    }),
  ),
  openQuestions: v.array(v.string()),
  quotes: v.array(
    v.object({
      text: v.string(),
      source: v.optional(v.string()),
    }),
  ),
  followUpQuestions: v.array(v.string()),
  contextExpansions: v.array(
    v.object({
      title: v.string(),
      content: v.string(),
    }),
  ),
});

const DEFAULT_CAP_DURATION_MS = 30 * 60 * 1000;
const MIN_CAP_DURATION_MS = 60 * 1000;
const MAX_CAP_DURATION_MS = 4 * 60 * 60 * 1000;
const DEFAULT_WARNING_DURATION_MS = 60 * 1000;
const MIN_WARNING_DURATION_MS = 15 * 1000;
const MAX_SYNTH_NOTES = 12;
const MAX_RECENT_NOTES = 20;
const MAX_PROCESSING_RETRIES = 3;
const DEFAULT_STUCK_THRESHOLD_MS = 10 * 60 * 1000;
const STUCK_SESSION_BATCH_SIZE = 20;

type ProcessListeningSessionRunArgs = {
  sessionId: Id<"listeningSessions">;
  attempt?: number;
};

const processListeningSessionRun = (
  internal as unknown as {
    actions: {
      processListeningSession: {
        run: FunctionReference<"action", "internal", ProcessListeningSessionRunArgs>;
      };
    };
  }
).actions.processListeningSession.run;

type SessionStatus = Doc<"listeningSessions">["status"];
type SynthesisArtifacts = SynthesisArtifactsShape | undefined;
type ListeningSessionArtifactKind =
  | "insight"
  | "openQuestion"
  | "quote"
  | "followUpQuestion"
  | "contextExpansion";
const ACTIVE_SESSION_STATUSES: readonly SessionStatus[] = [
  "recording",
  "transcribing",
  "synthesizing",
  "review",
];

const ALLOWED_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  recording: ["transcribing", "failed"],
  transcribing: ["synthesizing", "complete", "failed"],
  synthesizing: ["review", "complete", "failed"],
  review: ["complete", "failed"],
  complete: ["complete"],
  failed: ["failed"],
};

function normalizeCapDuration(value: number | undefined): number {
  if (!value || Number.isNaN(value)) return DEFAULT_CAP_DURATION_MS;
  return Math.min(MAX_CAP_DURATION_MS, Math.max(MIN_CAP_DURATION_MS, value));
}

function normalizeWarningDuration(value: number | undefined, capDurationMs: number): number {
  if (!value || Number.isNaN(value)) {
    return Math.min(DEFAULT_WARNING_DURATION_MS, capDurationMs - 5_000);
  }
  const bounded = Math.max(MIN_WARNING_DURATION_MS, value);
  return Math.min(bounded, Math.max(MIN_WARNING_DURATION_MS, capDurationMs - 5_000));
}

function assertTransition(current: SessionStatus, next: SessionStatus) {
  if (current === next) return;
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new ConvexError(`Invalid session transition from ${current} to ${next}`);
  }
}

function formatDuration(durationMs: number | undefined): string {
  if (!durationMs || durationMs <= 0) return "Unknown";
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatQuote(text: string, source?: string): string {
  const trimmed = text.trim();
  return source?.trim() ? `> ${trimmed}\n\n— ${source.trim()}` : `> ${trimmed}`;
}

function truncate(input: string, maxChars: number): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
}

/**
 * @security Strips audioUrl before returning session data to clients.
 * All client-facing queries MUST pass through this projection.
 * If new sensitive fields are added to the schema, add them here.
 */
export function toClientSession(session: Doc<"listeningSessions">) {
  const { audioUrl: _audioUrl, ...safeSession } = session;
  return safeSession;
}

async function getOwnedBook(
  ctx: Parameters<typeof requireAuth>[0],
  userId: Id<"users">,
  bookId: Id<"books">,
) {
  const book = await ctx.db.get(bookId);
  if (!book || book.userId !== userId) {
    throw new ConvexError("Book not found or access denied");
  }
  return book;
}

async function getOwnedSession(
  ctx: Parameters<typeof requireAuth>[0],
  userId: Id<"users">,
  sessionId: Id<"listeningSessions">,
) {
  const session = await ctx.db.get(sessionId);
  if (!session || session.userId !== userId) {
    throw new ConvexError("Listening session not found or access denied");
  }
  return session;
}

async function getActiveSessionForBook(
  ctx: Parameters<typeof requireAuth>[0],
  userId: Id<"users">,
  bookId: Id<"books">,
) {
  const results = await Promise.all(
    ACTIVE_SESSION_STATUSES.map((status) =>
      ctx.db
        .query("listeningSessions")
        .withIndex("by_user_book_status", (q) =>
          q.eq("userId", userId).eq("bookId", bookId).eq("status", status),
        )
        .first(),
    ),
  );
  return results.find((r) => r !== null) ?? null;
}

async function buildSynthesisContext(ctx: QueryCtx, userId: Id<"users">, bookId: Id<"books">) {
  const currentBook = await getOwnedBook(ctx, userId, bookId);

  const currentlyReadingDocs = await ctx.db
    .query("books")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "currently-reading"))
    .take(50);

  const wantToReadDocs = await ctx.db
    .query("books")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "want-to-read"))
    .take(50);

  const readDocs = await ctx.db
    .query("books")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "read"))
    .take(50);

  const toPackerBooks = (docs: Doc<"books">[], status: ContextPackLibraryBook["status"]) =>
    docs
      .filter((b) => b._id !== currentBook._id)
      .map((b) => ({
        id: b._id,
        title: b.title,
        author: b.author,
        status,
        updatedAt: b.updatedAt,
        privacy: b.privacy,
      }));

  const allLibraryBooks = [
    ...toPackerBooks(currentlyReadingDocs, "currently-reading"),
    ...toPackerBooks(wantToReadDocs, "want-to-read"),
    ...toPackerBooks(readDocs, "read"),
  ];

  const recentNotesDocs = await ctx.db
    .query("notes")
    .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
    .order("desc")
    .take(MAX_RECENT_NOTES);

  const bookTitleById = new Map<Id<"books">, string>();
  const bookPrivacyById = new Map<Id<"books">, "public" | "private">();
  for (const note of recentNotesDocs) {
    if (bookTitleById.has(note.bookId)) continue;
    const book = await ctx.db.get(note.bookId);
    if (!book || book.userId !== userId) continue;
    bookTitleById.set(note.bookId, book.title);
    bookPrivacyById.set(note.bookId, book.privacy);
  }

  const allNotes = recentNotesDocs.map((note) => ({
    id: note._id,
    bookId: note.bookId,
    bookTitle: bookTitleById.get(note.bookId) ?? "Unknown book",
    bookPrivacy: bookPrivacyById.get(note.bookId) ?? "private",
    type: (note.type === "quote" ? "quote" : "note") as "note" | "quote",
    content: note.content,
    updatedAt: note.updatedAt,
  }));

  const pack = packContext({
    currentBook: {
      id: currentBook._id,
      title: currentBook.title,
      author: currentBook.author,
      description: currentBook.description,
      privacy: currentBook.privacy,
    },
    books: allLibraryBooks,
    notes: allNotes,
  });

  return {
    ...pack,
    packSummary: pack.summary,
  };
}

async function persistListeningSessionTranscript(
  ctx: MutationCtx,
  args: {
    session: Doc<"listeningSessions">;
    userId: Id<"users">;
    transcript: string;
    transcriptProvider: string;
    occurredAt: number;
  },
) {
  const existing = await ctx.db
    .query("listeningSessionTranscripts")
    .withIndex("by_session", (q) => q.eq("sessionId", args.session._id))
    .first();
  if (existing) return;

  await ctx.db.insert("listeningSessionTranscripts", {
    userId: args.userId,
    bookId: args.session.bookId,
    sessionId: args.session._id,
    type: "final",
    provider: args.transcriptProvider,
    content: args.transcript,
    chars: args.transcript.length,
    createdAt: args.occurredAt,
    updatedAt: args.occurredAt,
  });
}

async function persistListeningSessionArtifacts(
  ctx: MutationCtx,
  args: {
    session: Doc<"listeningSessions">;
    userId: Id<"users">;
    synthesis: SynthesisArtifacts;
    source: string;
    occurredAt: number;
  },
) {
  if (!args.synthesis) {
    return;
  }

  const existingArtifact = await ctx.db
    .query("listeningSessionArtifacts")
    .withIndex("by_session", (q) => q.eq("sessionId", args.session._id))
    .first();
  if (existingArtifact) return;

  const addArtifact = async (artifact: {
    kind: ListeningSessionArtifactKind;
    title: string;
    content: string;
  }) => {
    const normalizedTitle = artifact.title.trim();
    const normalizedContent = artifact.content.trim();
    if (!normalizedContent || !normalizedTitle) {
      return;
    }
    await ctx.db.insert("listeningSessionArtifacts", {
      userId: args.userId,
      bookId: args.session.bookId,
      sessionId: args.session._id,
      kind: artifact.kind,
      title: normalizedTitle,
      content: normalizedContent,
      provider: args.source,
      createdAt: args.occurredAt,
      updatedAt: args.occurredAt,
    });
  };

  for (const insight of args.synthesis.insights.slice(0, MAX_SYNTH_ARTIFACT_ITEMS)) {
    await addArtifact({ kind: "insight", title: insight.title, content: insight.content.trim() });
  }

  for (const question of args.synthesis.openQuestions.slice(0, MAX_SYNTH_ARTIFACT_ITEMS)) {
    await addArtifact({ kind: "openQuestion", title: "Open question", content: question.trim() });
  }

  for (const question of args.synthesis.followUpQuestions.slice(0, MAX_SYNTH_ARTIFACT_ITEMS)) {
    await addArtifact({
      kind: "followUpQuestion",
      title: "Follow-up question",
      content: question.trim(),
    });
  }

  for (const quote of args.synthesis.quotes.slice(0, MAX_SYNTH_ARTIFACT_ITEMS)) {
    if (!quote.text.trim()) continue;
    await addArtifact({
      kind: "quote",
      title: "Quote",
      content: formatQuote(quote.text, quote.source),
    });
  }

  for (const expansion of args.synthesis.contextExpansions.slice(0, MAX_CONTEXT_EXPANSION_ITEMS)) {
    await addArtifact({
      kind: "contextExpansion",
      title: expansion.title,
      content: expansion.content.trim(),
    });
  }
}

async function completeListeningSessionForUser(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"listeningSessions">;
    transcript: string;
    transcriptProvider?: string;
    synthesis?: SynthesisArtifacts;
    estimatedCostUsd?: number;
  },
  userId: Id<"users">,
) {
  const session = await getOwnedSession(ctx, userId, args.sessionId);
  await getOwnedBook(ctx, userId, session.bookId);

  assertTransition(session.status, "complete");

  const now = Date.now();
  const cleanedTranscript = args.transcript.trim();
  if (!cleanedTranscript) {
    throw new ConvexError("Transcript cannot be empty");
  }

  const startedLabel = new Date(session.startedAt).toLocaleString();
  const endedLabel = session.endedAt ? new Date(session.endedAt).toLocaleString() : "Unknown";
  const provider = args.transcriptProvider?.trim() || session.transcriptProvider || "unknown";

  const rawNoteContent = [
    "## Voice Transcript",
    "",
    `Recorded: ${startedLabel}`,
    `Ended: ${endedLabel}`,
    `Duration: ${formatDuration(session.durationMs)}`,
    `Provider: ${provider}`,
    "",
    cleanedTranscript,
  ].join("\n");

  let rawNoteId = session.rawNoteId;
  if (rawNoteId) {
    const rawNote = await ctx.db.get(rawNoteId);
    if (!rawNote || rawNote.userId !== userId || rawNote.bookId !== session.bookId) {
      throw new ConvexError("Raw note not found or access denied");
    }
    await ctx.db.patch(rawNoteId, {
      content: rawNoteContent,
      updatedAt: now,
    });
  } else {
    rawNoteId = await ctx.db.insert("notes", {
      bookId: session.bookId,
      userId,
      type: "note",
      content: rawNoteContent,
      createdAt: now,
      updatedAt: now,
    });
  }

  const synthesizedNoteIds: Id<"notes">[] = session.synthesizedNoteIds
    ? [...session.synthesizedNoteIds]
    : [];

  const addSynthesizedNote = async (type: "note" | "quote", content: string) => {
    if (synthesizedNoteIds.length >= MAX_SYNTH_NOTES) return;
    const cleaned = content.trim();
    if (!cleaned) return;
    const noteId = await ctx.db.insert("notes", {
      bookId: session.bookId,
      userId,
      type: type satisfies Doc<"notes">["type"],
      content: cleaned,
      createdAt: now,
      updatedAt: now,
    });
    synthesizedNoteIds.push(noteId);
  };

  const renderSynthesisNote = (synth: NonNullable<SynthesisArtifacts>) => {
    const lines: string[] = ["## Voice Synthesis", ""];

    if (synth.insights.length > 0) {
      lines.push("### Key insights", "");
      for (const insight of synth.insights.slice(0, MAX_SYNTH_ARTIFACT_ITEMS)) {
        lines.push(`#### ${insight.title}`, "", insight.content.trim(), "");
      }
    }

    if (synth.openQuestions.length > 0) {
      lines.push("### Open questions", "");
      for (const question of synth.openQuestions.slice(0, MAX_SYNTH_ARTIFACT_ITEMS)) {
        lines.push(`- ${question.trim()}`);
      }
      lines.push("");
    }

    if (synth.followUpQuestions.length > 0) {
      lines.push("### Follow-ups", "");
      for (const question of synth.followUpQuestions.slice(0, MAX_SYNTH_ARTIFACT_ITEMS)) {
        lines.push(`- ${question.trim()}`);
      }
      lines.push("");
    }

    if (synth.contextExpansions.length > 0) {
      lines.push("### Context expansions", "");
      for (const expansion of synth.contextExpansions.slice(0, MAX_CONTEXT_EXPANSION_ITEMS)) {
        lines.push(`#### ${expansion.title}`, "", expansion.content.trim(), "");
      }
    }

    return lines.join("\n").trim();
  };

  const synth = args.synthesis;
  if (synth && synthesizedNoteIds.length === 0) {
    const hasSynthesisNote =
      synth.insights.length > 0 ||
      synth.openQuestions.length > 0 ||
      synth.followUpQuestions.length > 0 ||
      synth.contextExpansions.length > 0;

    if (hasSynthesisNote) {
      await addSynthesizedNote("note", renderSynthesisNote(synth));
    }

    const seenQuotes = new Set<string>();
    for (const quote of synth.quotes.slice(0, MAX_SYNTH_ARTIFACT_ITEMS)) {
      const normalized = quote.text.trim().replace(/\s+/g, " ");
      if (!normalized || seenQuotes.has(normalized)) continue;
      seenQuotes.add(normalized);

      await addSynthesizedNote("quote", formatQuote(quote.text, quote.source));
    }
  }

  const completePatch: Parameters<typeof ctx.db.patch>[1] = {
    status: "complete",
    transcriptChars: cleanedTranscript.length,
    transcriptProvider: provider,
    rawNoteId,
    synthesizedNoteIds: synthesizedNoteIds.length > 0 ? synthesizedNoteIds : undefined,
    updatedAt: now,
    lastError: undefined,
  };
  if (args.estimatedCostUsd !== undefined && Number.isFinite(args.estimatedCostUsd)) {
    completePatch.estimatedCostUsd = Math.max(0, args.estimatedCostUsd);
  }
  await ctx.db.patch(session._id, completePatch);

  await persistListeningSessionTranscript(ctx, {
    session,
    userId,
    transcript: cleanedTranscript,
    transcriptProvider: provider,
    occurredAt: now,
  });

  if (synth) {
    await persistListeningSessionArtifacts(ctx, {
      session,
      userId,
      synthesis: synth,
      source: provider,
      occurredAt: now,
    });
  }

  return { rawNoteId, synthesizedNoteIds };
}

async function failListeningSessionForUser(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"listeningSessions">;
    message: string;
    failedStage?: string;
  },
  userId: Id<"users">,
) {
  const session = await getOwnedSession(ctx, userId, args.sessionId);
  assertTransition(session.status, "failed");

  const failPatch: Parameters<typeof ctx.db.patch>[1] = {
    status: "failed",
    lastError: truncate(args.message, 1_000),
    updatedAt: Date.now(),
  };
  const failedStage = args.failedStage?.trim();
  if (failedStage) {
    failPatch.failedStage = truncate(failedStage, 100);
  }
  await ctx.db.patch(session._id, failPatch);
}

export const listByBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await getOwnedBook(ctx, userId, args.bookId);

    const sessions = await ctx.db
      .query("listeningSessions")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .collect();

    return sessions.map(toClientSession);
  },
});

export const get = query({
  args: { sessionId: v.id("listeningSessions") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const session = await getOwnedSession(ctx, userId, args.sessionId);
    return toClientSession(session);
  },
});

export const getAudioUrlForOwner = query({
  args: { sessionId: v.id("listeningSessions") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) return null;
    return session.audioUrl ?? null;
  },
});

export const getForProcessing = internalQuery({
  args: { sessionId: v.id("listeningSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const getTranscriptForSession = internalQuery({
  args: { sessionId: v.id("listeningSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("listeningSessionTranscripts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

export const getDebugStats = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const [failedSessions, completedSessions] = await Promise.all([
      ctx.db
        .query("listeningSessions")
        .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "failed"))
        .order("desc")
        .take(100),
      ctx.db
        .query("listeningSessions")
        .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "complete"))
        .order("desc")
        .take(200),
    ]);

    const degradedSessions = completedSessions.filter((s) => s.degradedMode);

    const stageBreakdown: Record<string, number> = {};
    for (const session of failedSessions) {
      const stage = session.failedStage ?? "unknown";
      stageBreakdown[stage] = (stageBreakdown[stage] ?? 0) + 1;
    }

    const totalFailed = failedSessions.length;
    const fallbackUsedCount = failedSessions.filter(
      (session) => session.transcribeFallbackUsed,
    ).length;
    const totalEstimatedCost = failedSessions.reduce(
      (sum, session) => sum + (session.estimatedCostUsd ?? 0),
      0,
    );

    return {
      totalFailed,
      stageBreakdown,
      fallbackUsedCount,
      totalEstimatedCostUsd: Math.round(totalEstimatedCost * 10000) / 10000,
      // Sessions that completed but in degraded mode (synthesis partial/missing).
      degradedCompletions: {
        count: degradedSessions.length,
        totalEstimatedCostUsd:
          Math.round(
            degradedSessions.reduce((sum, s) => sum + (s.estimatedCostUsd ?? 0), 0) * 10000,
          ) / 10000,
      },
      // No user/book identifiers — only operational diagnostics per user.
      recentFailures: failedSessions.slice(0, 20).map((session) => ({
        id: session._id,
        failedStage: session.failedStage ?? "unknown",
        lastError: session.lastError,
        retryCount: session.retryCount ?? 0,
        transcribeFallbackUsed: session.transcribeFallbackUsed ?? false,
        estimatedCostUsd: session.estimatedCostUsd ?? 0,
        updatedAt: session.updatedAt,
      })),
    };
  },
});

export const getDailyUserCost = internalQuery({
  args: { userId: v.id("users"), dayStartMs: v.number(), dayEndMs: v.number() },
  handler: async (ctx, { userId, dayStartMs, dayEndMs }) => {
    const inRange = await ctx.db
      .query("listeningSessions")
      .withIndex("by_user_updatedAt", (q) =>
        q.eq("userId", userId).gte("updatedAt", dayStartMs).lte("updatedAt", dayEndMs),
      )
      .filter((q) => q.neq(q.field("estimatedCostUsd"), undefined))
      .collect();
    const totalCostUsd = inRange.reduce((sum, session) => sum + (session.estimatedCostUsd ?? 0), 0);
    return {
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      sessionCount: inRange.length,
    };
  },
});

export const getSynthesisContextForSession = internalQuery({
  args: { sessionId: v.id("listeningSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Listening session not found");
    }
    return await buildSynthesisContext(ctx, session.userId, session.bookId);
  },
});

export const createListeningSessionHandler = async (
  ctx: MutationCtx,
  args: {
    bookId: Id<"books">;
    capDurationMs?: number;
    warningDurationMs?: number;
  },
) => {
  const userId = await requireAuth(ctx);
  await getOwnedBook(ctx, userId, args.bookId);
  const activeSession = await getActiveSessionForBook(ctx, userId, args.bookId);
  if (activeSession) {
    throw new ConvexError("Only one active listening session allowed per book");
  }

  const now = Date.now();
  const capDurationMs = normalizeCapDuration(args.capDurationMs);
  const warningDurationMs = normalizeWarningDuration(args.warningDurationMs, capDurationMs);

  return await ctx.db.insert("listeningSessions", {
    userId,
    bookId: args.bookId,
    status: "recording",
    capReached: false,
    capDurationMs,
    warningDurationMs,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });
};

export const create = mutation({
  args: {
    bookId: v.id("books"),
    capDurationMs: v.optional(v.number()),
    warningDurationMs: v.optional(v.number()),
  },
  handler: createListeningSessionHandler,
});

const markTranscribingArgs = {
  sessionId: v.id("listeningSessions"),
  durationMs: v.number(),
  capReached: v.boolean(),
  transcriptLive: v.optional(v.string()),
  // audioUrl set by the server-side upload route; not sent by browser clients.
  audioUrl: v.optional(v.string()),
  transcribeLatencyMs: v.optional(v.number()),
  transcribeFallbackUsed: v.optional(v.boolean()),
} as const;

export const markTranscribingHandler = async (
  ctx: MutationCtx,
  args: {
    sessionId: Id<"listeningSessions">;
    durationMs: number;
    capReached: boolean;
    transcriptLive?: string;
    audioUrl?: string;
    transcribeLatencyMs?: number;
    transcribeFallbackUsed?: boolean;
  },
) => {
  const userId = await requireAuth(ctx);
  const session = await getOwnedSession(ctx, userId, args.sessionId);
  const shouldScheduleProcessing = session.status !== "transcribing";

  assertTransition(session.status, "transcribing");

  const now = Date.now();
  const patch: Parameters<typeof ctx.db.patch>[1] = {
    status: "transcribing",
    durationMs: Math.max(0, Math.floor(args.durationMs)),
    capReached: args.capReached,
    transcriptLive: args.transcriptLive ? truncate(args.transcriptLive, 4_000) : undefined,
    endedAt: now,
    updatedAt: now,
    lastError: undefined,
  };
  // Only set audioUrl when explicitly provided — avoids clobbering existing value
  // on the backward-compat markTranscribing path where clients don't send it.
  if (args.audioUrl !== undefined) {
    patch.audioUrl = args.audioUrl;
  }
  if (args.transcribeLatencyMs !== undefined) {
    patch.transcribeLatencyMs = Math.max(0, Math.floor(args.transcribeLatencyMs));
  }
  if (args.transcribeFallbackUsed !== undefined) {
    patch.transcribeFallbackUsed = args.transcribeFallbackUsed;
  }
  await ctx.db.patch(session._id, patch);
  return shouldScheduleProcessing;
};

export const markTranscribing = mutation({
  args: markTranscribingArgs,
  handler: async (ctx, args) => {
    const shouldScheduleProcessing = await markTranscribingHandler(ctx, args);
    if (shouldScheduleProcessing) {
      await ctx.scheduler.runAfter(5 * 60 * 1000, processListeningSessionRun, {
        sessionId: args.sessionId,
      });
    }
  },
});

// Telemetry-only mutation: records post-transcription metrics without touching
// session state fields (status, endedAt, transcriptLive).
export const recordTranscribeTelemetry = mutation({
  args: {
    sessionId: v.id("listeningSessions"),
    transcribeLatencyMs: v.number(),
    transcribeFallbackUsed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const session = await getOwnedSession(ctx, userId, args.sessionId);
    await ctx.db.patch(session._id, {
      transcribeLatencyMs: Math.max(0, Math.floor(args.transcribeLatencyMs)),
      transcribeFallbackUsed: args.transcribeFallbackUsed,
      updatedAt: Date.now(),
    });
  },
});

const markSynthesizingArgs = {
  sessionId: v.id("listeningSessions"),
  synthesisLatencyMs: v.optional(v.number()),
  synthesisProvider: v.optional(v.string()),
  degradedMode: v.optional(v.boolean()),
  estimatedCostUsd: v.optional(v.number()),
} as const;

export const markSynthesizingHandler = async (
  ctx: MutationCtx,
  args: {
    sessionId: Id<"listeningSessions">;
    synthesisLatencyMs?: number;
    synthesisProvider?: string;
    degradedMode?: boolean;
    estimatedCostUsd?: number;
  },
) => {
  const userId = await requireAuth(ctx);
  const session = await getOwnedSession(ctx, userId, args.sessionId);
  assertTransition(session.status, "synthesizing");

  const patch: Parameters<typeof ctx.db.patch>[1] = {
    status: "synthesizing",
    updatedAt: Date.now(),
    lastError: undefined,
  };
  if (args.synthesisLatencyMs !== undefined) {
    patch.synthesisLatencyMs = Math.max(0, Math.floor(args.synthesisLatencyMs));
  }
  const synthesisProvider = args.synthesisProvider?.trim();
  if (synthesisProvider) {
    patch.synthesisProvider = synthesisProvider;
  }
  if (args.degradedMode !== undefined) {
    patch.degradedMode = args.degradedMode;
  }
  if (args.estimatedCostUsd !== undefined) {
    patch.estimatedCostUsd = Math.max(0, args.estimatedCostUsd);
  }
  await ctx.db.patch(session._id, patch);
};

export const markSynthesizing = mutation({
  args: markSynthesizingArgs,
  handler: markSynthesizingHandler,
});

const completeListeningSessionArgs = {
  sessionId: v.id("listeningSessions"),
  transcript: v.string(),
  transcriptProvider: v.optional(v.string()),
  synthesis: v.optional(synthesisArtifacts),
  estimatedCostUsd: v.optional(v.number()),
} as const;

export const transitionSynthesizingInternal = internalMutation({
  args: {
    sessionId: v.id("listeningSessions"),
    transcript: v.string(),
    transcriptProvider: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Listening session not found");
    }

    assertTransition(session.status, "synthesizing");

    const cleanedTranscript = args.transcript.trim();
    if (!cleanedTranscript) {
      throw new ConvexError("Transcript cannot be empty");
    }

    const provider = args.transcriptProvider.trim() || "unknown";
    const now = Date.now();

    await ctx.db.patch(session._id, {
      status: "synthesizing",
      transcriptProvider: provider,
      updatedAt: now,
      lastError: undefined,
    });

    await persistListeningSessionTranscript(ctx, {
      session,
      userId: session.userId,
      transcript: cleanedTranscript,
      transcriptProvider: provider,
      occurredAt: now,
    });
  },
});

export const completeListeningSessionHandler = async (
  ctx: MutationCtx,
  args: {
    sessionId: Id<"listeningSessions">;
    transcript: string;
    transcriptProvider?: string;
    synthesis?: SynthesisArtifacts;
    estimatedCostUsd?: number;
  },
) => {
  const userId = await requireAuth(ctx);
  return await completeListeningSessionForUser(ctx, args, userId);
};

export const complete = mutation({
  args: completeListeningSessionArgs,
  handler: completeListeningSessionHandler,
});

export const completeInternal = internalMutation({
  args: completeListeningSessionArgs,
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Listening session not found");
    }
    return await completeListeningSessionForUser(ctx, args, session.userId);
  },
});

const failListeningSessionArgs = {
  sessionId: v.id("listeningSessions"),
  message: v.string(),
  failedStage: v.optional(v.string()),
} as const;

export const failListeningSessionHandler = async (
  ctx: MutationCtx,
  args: { sessionId: Id<"listeningSessions">; message: string; failedStage?: string },
) => {
  const userId = await requireAuth(ctx);
  await failListeningSessionForUser(ctx, args, userId);
};

export const fail = mutation({
  args: failListeningSessionArgs,
  handler: failListeningSessionHandler,
});

export const failInternal = internalMutation({
  args: failListeningSessionArgs,
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Listening session not found");
    }
    await failListeningSessionForUser(ctx, args, session.userId);
  },
});

export const incrementRetry = internalMutation({
  args: { sessionId: v.id("listeningSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Listening session not found");
    }
    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      retryCount: (session.retryCount ?? 0) + 1,
      lastRetryAt: now,
      updatedAt: now,
    });
  },
});

async function listStuckSessionDocs(
  ctx: { db: QueryCtx["db"] },
  args: { stuckThresholdMs?: number; maxRetries?: number },
) {
  const stuckThresholdMs =
    typeof args.stuckThresholdMs === "number" && args.stuckThresholdMs > 0
      ? args.stuckThresholdMs
      : DEFAULT_STUCK_THRESHOLD_MS;
  const maxRetries =
    typeof args.maxRetries === "number" && args.maxRetries > 0
      ? args.maxRetries
      : MAX_PROCESSING_RETRIES;
  const threshold = Date.now() - stuckThresholdMs;

  const transcribing = await ctx.db
    .query("listeningSessions")
    .withIndex("by_status_updatedAt", (q) =>
      q.eq("status", "transcribing").lt("updatedAt", threshold),
    )
    .collect();
  const synthesizing = await ctx.db
    .query("listeningSessions")
    .withIndex("by_status_updatedAt", (q) =>
      q.eq("status", "synthesizing").lt("updatedAt", threshold),
    )
    .collect();
  const candidates = [...transcribing, ...synthesizing];

  return candidates
    .filter((session) => (session.retryCount ?? 0) < maxRetries)
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(0, STUCK_SESSION_BATCH_SIZE);
}

export const listStuckSessions = internalQuery({
  args: {
    stuckThresholdMs: v.optional(v.number()),
    maxRetries: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await listStuckSessionDocs(ctx, args);
  },
});

export const getSynthesisContext = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await buildSynthesisContext(ctx, userId, args.bookId);
  },
});

export const recoverStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stuckSessions = await listStuckSessionDocs(ctx, {
      stuckThresholdMs: DEFAULT_STUCK_THRESHOLD_MS,
      maxRetries: MAX_PROCESSING_RETRIES,
    });
    for (const session of stuckSessions) {
      await ctx.scheduler.runAfter(0, processListeningSessionRun, {
        sessionId: session._id,
        attempt: 1,
      });
    }
    console.log(`Recovered ${stuckSessions.length} stuck listening sessions`);
    return { recovered: stuckSessions.length };
  },
});
