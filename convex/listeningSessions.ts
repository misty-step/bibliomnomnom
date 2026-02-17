import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireAuth } from "./auth";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

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
const MAX_SYNTH_ARTIFACT_ITEMS = 6;
const MAX_SYNTH_CONTEXT_EXPANSIONS = 4;
const MAX_RECENT_NOTES = 20;
const RECENT_NOTE_SNIPPET_CHARS = 280;

type SessionStatus = Doc<"listeningSessions">["status"];
type SynthesisArtifacts = Doc<"listeningSessions">["synthesis"];

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

function truncate(input: string, maxChars: number): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
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

export const listByBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await getOwnedBook(ctx, userId, args.bookId);

    return await ctx.db
      .query("listeningSessions")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { sessionId: v.id("listeningSessions") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await getOwnedSession(ctx, userId, args.sessionId);
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

export const markTranscribingHandler = async (
  ctx: MutationCtx,
  args: {
    sessionId: Id<"listeningSessions">;
    audioUrl: string;
    durationMs: number;
    capReached: boolean;
    transcriptLive?: string;
  },
) => {
  const userId = await requireAuth(ctx);
  const session = await getOwnedSession(ctx, userId, args.sessionId);

  assertTransition(session.status, "transcribing");

  const now = Date.now();
  await ctx.db.patch(session._id, {
    status: "transcribing",
    audioUrl: args.audioUrl,
    durationMs: Math.max(0, Math.floor(args.durationMs)),
    capReached: args.capReached,
    transcriptLive: args.transcriptLive ? truncate(args.transcriptLive, 4_000) : undefined,
    endedAt: now,
    updatedAt: now,
    lastError: undefined,
  });
};

export const markTranscribing = mutation({
  args: {
    sessionId: v.id("listeningSessions"),
    audioUrl: v.string(),
    durationMs: v.number(),
    capReached: v.boolean(),
    transcriptLive: v.optional(v.string()),
  },
  handler: markTranscribingHandler,
});

export const markSynthesizingHandler = async (
  ctx: MutationCtx,
  args: { sessionId: Id<"listeningSessions"> },
) => {
  const userId = await requireAuth(ctx);
  const session = await getOwnedSession(ctx, userId, args.sessionId);
  assertTransition(session.status, "synthesizing");

  await ctx.db.patch(session._id, {
    status: "synthesizing",
    updatedAt: Date.now(),
    lastError: undefined,
  });
};

export const markSynthesizing = mutation({
  args: { sessionId: v.id("listeningSessions") },
  handler: markSynthesizingHandler,
});

export const completeListeningSessionHandler = async (
  ctx: MutationCtx,
  args: {
    sessionId: Id<"listeningSessions">;
    transcript: string;
    transcriptProvider?: string;
    synthesis?: SynthesisArtifacts;
  },
) => {
  const userId = await requireAuth(ctx);
  const session = await getOwnedSession(ctx, userId, args.sessionId);
  await getOwnedBook(ctx, userId, session.bookId);

  if (!["transcribing", "synthesizing", "review", "complete"].includes(session.status)) {
    throw new ConvexError(`Cannot complete session from state: ${session.status}`);
  }

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
      for (const expansion of synth.contextExpansions.slice(0, MAX_SYNTH_CONTEXT_EXPANSIONS)) {
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

      const content = quote.source?.trim()
        ? `> ${quote.text.trim()}\n\n— ${quote.source.trim()}`
        : `> ${quote.text.trim()}`;

      await addSynthesizedNote("quote", content);
    }
  }

  await ctx.db.patch(session._id, {
    status: "complete",
    transcript: cleanedTranscript,
    transcriptChars: cleanedTranscript.length,
    transcriptProvider: provider,
    rawNoteId,
    synthesizedNoteIds: synthesizedNoteIds.length > 0 ? synthesizedNoteIds : undefined,
    synthesis: synth,
    updatedAt: now,
    lastError: undefined,
  });

  return { rawNoteId, synthesizedNoteIds };
};

export const complete = mutation({
  args: {
    sessionId: v.id("listeningSessions"),
    transcript: v.string(),
    transcriptProvider: v.optional(v.string()),
    synthesis: v.optional(synthesisArtifacts),
  },
  handler: completeListeningSessionHandler,
});

export const failListeningSessionHandler = async (
  ctx: MutationCtx,
  args: { sessionId: Id<"listeningSessions">; message: string },
) => {
  const userId = await requireAuth(ctx);
  const session = await getOwnedSession(ctx, userId, args.sessionId);
  assertTransition(session.status, "failed");

  await ctx.db.patch(session._id, {
    status: "failed",
    lastError: truncate(args.message, 1_000),
    updatedAt: Date.now(),
  });
};

export const fail = mutation({
  args: {
    sessionId: v.id("listeningSessions"),
    message: v.string(),
  },
  handler: failListeningSessionHandler,
});

export const getSynthesisContext = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const currentBook = await getOwnedBook(ctx, userId, args.bookId);

    const mapBookItem = (book: Doc<"books">) => ({
      title: book.title,
      author: book.author,
    });

    const currentlyReadingDocs = await ctx.db
      .query("books")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "currently-reading"))
      .take(25);

    const wantToReadDocs = await ctx.db
      .query("books")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "want-to-read"))
      .take(25);

    const readDocs = await ctx.db
      .query("books")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "read"))
      .take(35);

    const currentlyReading = currentlyReadingDocs
      .filter((book) => book._id !== currentBook._id)
      .slice(0, 20)
      .map(mapBookItem);

    const wantToRead = wantToReadDocs
      .filter((book) => book._id !== currentBook._id)
      .slice(0, 20)
      .map(mapBookItem);

    const read = readDocs
      .filter((book) => book._id !== currentBook._id)
      .slice(0, 30)
      .map(mapBookItem);

    const recentNotesDocs = await ctx.db
      .query("notes")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_RECENT_NOTES);

    const bookTitleById = new Map<Id<"books">, string>();
    for (const note of recentNotesDocs) {
      if (bookTitleById.has(note.bookId)) continue;
      const book = await ctx.db.get(note.bookId);
      if (!book || book.userId !== userId) continue;
      bookTitleById.set(note.bookId, book.title);
    }

    type RecentSynthesisNote = { bookTitle: string; type: "note" | "quote"; content: string };
    const recentNotes: RecentSynthesisNote[] = recentNotesDocs.map<RecentSynthesisNote>((note) => ({
      bookTitle: bookTitleById.get(note.bookId) ?? "Unknown book",
      type: note.type === "quote" ? "quote" : "note",
      content: truncate(note.content, RECENT_NOTE_SNIPPET_CHARS),
    }));

    return {
      book: {
        title: currentBook.title,
        author: currentBook.author,
        description: currentBook.description,
      },
      currentlyReading,
      wantToRead,
      read,
      recentNotes,
    };
  },
});
