import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeListeningSessionHandler,
  createListeningSessionHandler,
  failListeningSessionHandler,
  markSynthesizingHandler,
  markTranscribingHandler,
} from "../../convex/listeningSessions";
import * as authModule from "../../convex/auth";
import type { Id } from "../../convex/_generated/dataModel";

const userId = "user_1" as unknown as Id<"users">;
const otherUserId = "user_2" as unknown as Id<"users">;

const BOOK_ID = "book_1" as unknown as Id<"books">;
const OTHER_BOOK_ID = "book_2" as unknown as Id<"books">;
const SESSION_ID = "session_1" as unknown as Id<"listeningSessions">;
const noteId = (n: number) => `note_${n}` as unknown as Id<"notes">;

type SessionStatus =
  | "recording"
  | "transcribing"
  | "synthesizing"
  | "review"
  | "complete"
  | "failed";

type Book = {
  _id: Id<"books">;
  userId: Id<"users">;
  title: string;
  author: string;
};

type NoteType = "note" | "quote";

type Note = {
  _id: Id<"notes">;
  userId: Id<"users">;
  bookId: Id<"books">;
  type: NoteType;
  content: string;
  createdAt?: number;
  updatedAt?: number;
};

type Session = {
  _id: Id<"listeningSessions">;
  userId: Id<"users">;
  bookId: Id<"books">;
  status: SessionStatus;
  startedAt: number;
  createdAt: number;
  updatedAt: number;
  capReached: boolean;
  capDurationMs: number;
  warningDurationMs: number;
  audioUrl?: string;
  durationMs?: number;
  endedAt?: number;
  transcriptLive?: string;
  transcript?: string;
  transcriptProvider?: string;
  transcriptChars?: number;
  rawNoteId?: Id<"notes">;
  synthesizedNoteIds?: Id<"notes">[];
  synthesis?: unknown;
  lastError?: string;
};

type DbId = Id<"books"> | Id<"listeningSessions"> | Id<"notes">;
type DbPatch = Partial<Book> | Partial<Session> | Partial<Note>;
type InsertTableName = "listeningSessions" | "notes";
type InsertDoc<T extends InsertTableName> = T extends "listeningSessions"
  ? Omit<Session, "_id">
  : Omit<Note, "_id">;
type InsertedId<T extends InsertTableName> = T extends "listeningSessions"
  ? Id<"listeningSessions">
  : Id<"notes">;

type TestCtx = {
  ctx: {
    db: {
      get: (id: DbId) => Promise<Book | Session | Note | null>;
      insert: <T extends InsertTableName>(
        tableName: T,
        doc: InsertDoc<T>,
      ) => Promise<InsertedId<T>>;
      patch: (id: DbId, doc: DbPatch) => Promise<void>;
    };
  };
  data: {
    books: Book[];
    sessions: Session[];
    notes: Note[];
  };
  patchCalls: { id: DbId; doc: DbPatch }[];
  insertCalls: { tableName: InsertTableName; doc: Session | Note }[];
};

const makeCtx = (seed?: Partial<TestCtx["data"]>): TestCtx => {
  const data: TestCtx["data"] = {
    books: [...(seed?.books ?? [])],
    sessions: [...(seed?.sessions ?? [])],
    notes: [...(seed?.notes ?? [])],
  };

  const counters = {
    listeningSessions: data.sessions.length,
    notes: data.notes.length,
  };

  const patchCalls: TestCtx["patchCalls"] = [];
  const insertCalls: TestCtx["insertCalls"] = [];

  const getById = (id: DbId) =>
    data.books.find((doc) => doc._id === id) ??
    data.sessions.find((doc) => doc._id === id) ??
    data.notes.find((doc) => doc._id === id) ??
    null;

  const insert = async <T extends InsertTableName>(
    tableName: T,
    doc: InsertDoc<T>,
  ): Promise<InsertedId<T>> => {
    if (tableName === "listeningSessions") {
      const id = `session_${++counters.listeningSessions}` as unknown as Id<"listeningSessions">;
      const full = { ...(doc as Omit<Session, "_id">), _id: id } as Session;
      data.sessions.push(full);
      insertCalls.push({ tableName, doc: full });
      return id as InsertedId<T>;
    }

    const id = `note_${++counters.notes}` as unknown as Id<"notes">;
    const full = { ...(doc as Omit<Note, "_id">), _id: id } as Note;
    data.notes.push(full);
    insertCalls.push({ tableName, doc: full });
    return id as InsertedId<T>;
  };

  return {
    ctx: {
      db: {
        get: async (id: DbId) => getById(id),
        insert,
        patch: async (id: DbId, doc: DbPatch) => {
          const target = getById(id);
          if (target) {
            Object.assign(target, doc);
          }
          patchCalls.push({ id, doc });
        },
      },
    },
    data,
    patchCalls,
    insertCalls,
  };
};

const buildSession = (overrides: Partial<Session> = {}): Session => ({
  userId,
  bookId: BOOK_ID,
  status: "recording",
  capReached: false,
  capDurationMs: 30 * 60 * 1000,
  warningDurationMs: 60 * 1000,
  startedAt: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
  _id: SESSION_ID,
});

const buildBook = (): Book => ({
  _id: BOOK_ID,
  userId,
  title: "The Book",
  author: "Book Author",
});

const mutationCtx = (ctx: TestCtx["ctx"]) =>
  ctx as Parameters<typeof createListeningSessionHandler>[0];

describe("listening session state machine handlers", () => {
  beforeEach(() => {
    vi.spyOn(authModule, "requireAuth").mockResolvedValue(userId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("normalizes create defaults and writes recording session", async () => {
    const now = new Date("2025-01-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { ctx, data } = makeCtx({ books: [buildBook()] });

    const sessionId = await createListeningSessionHandler(mutationCtx(ctx), {
      bookId: BOOK_ID,
      capDurationMs: 30_000,
      warningDurationMs: 120_000,
    });

    expect(sessionId).toBe(SESSION_ID);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]).toMatchObject({
      _id: SESSION_ID,
      userId,
      status: "recording",
      capDurationMs: 60_000,
      warningDurationMs: 55_000,
      startedAt: now.getTime(),
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
    });
  });

  it("uses create defaults when durations omitted", async () => {
    const now = new Date("2025-01-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { ctx, data } = makeCtx({ books: [buildBook()] });

    const sessionId = await createListeningSessionHandler(mutationCtx(ctx), {
      bookId: BOOK_ID,
    });

    expect(sessionId).toBe(SESSION_ID);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]).toMatchObject({
      _id: SESSION_ID,
      userId,
      status: "recording",
      capDurationMs: 30 * 60 * 1000,
      warningDurationMs: 60 * 1000,
      startedAt: now.getTime(),
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
    });
  });

  it("rejects when book or session are not owned by user", async () => {
    const createDenied = makeCtx({
      books: [{ ...buildBook(), userId: otherUserId }],
    });

    await expect(
      createListeningSessionHandler(mutationCtx(createDenied.ctx), {
        bookId: BOOK_ID,
      }),
    ).rejects.toThrow("Book not found or access denied");

    const transcribeDenied = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ userId: otherUserId })],
    });

    await expect(
      markTranscribingHandler(mutationCtx(transcribeDenied.ctx), {
        sessionId: SESSION_ID,
        audioUrl: "https://blob/audio.webm",
        durationMs: 1000,
        capReached: false,
      }),
    ).rejects.toThrow("Listening session not found or access denied");
  });

  it("requires transcribing transition only from recording", async () => {
    const { ctx, data, patchCalls } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession()],
    });

    await markTranscribingHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      audioUrl: "https://blob/audio.webm",
      durationMs: 18_765.9,
      capReached: false,
      transcriptLive: "a   b",
    });

    const session = data.sessions[0]!;
    expect(session.status).toBe("transcribing");
    expect(session.durationMs).toBe(18_765);
    expect(patchCalls[0]?.doc).toMatchObject({
      status: "transcribing",
      audioUrl: "https://blob/audio.webm",
      durationMs: 18_765,
      transcriptLive: "a b",
    });

    const rejected = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "complete" })],
    });

    await expect(
      markTranscribingHandler(mutationCtx(rejected.ctx), {
        sessionId: SESSION_ID,
        audioUrl: "https://blob/audio.webm",
        durationMs: 1000,
        capReached: true,
      }),
    ).rejects.toThrow("Invalid session transition from complete to transcribing");
    expect(rejected.patchCalls).toHaveLength(0);
  });

  it("truncates transcriptLive to 4,000 chars", async () => {
    const { ctx, patchCalls } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession()],
    });

    await markTranscribingHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      audioUrl: "https://blob/audio.webm",
      durationMs: 1000,
      capReached: false,
      transcriptLive: "x".repeat(4_001),
    });

    const transcriptLive = (patchCalls[0]?.doc as Partial<Session> | undefined)?.transcriptLive;
    expect(transcriptLive).toBeTypeOf("string");
    expect(transcriptLive).toHaveLength(4_000);
    expect(transcriptLive!.endsWith("…")).toBe(true);
  });

  it("requires synthesizing transition only from transcribing", async () => {
    const { ctx } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "transcribing" })],
    });

    await markSynthesizingHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
    });

    const { ctx: badCtx } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "recording" })],
    });

    await expect(
      markSynthesizingHandler(mutationCtx(badCtx), {
        sessionId: SESSION_ID,
      }),
    ).rejects.toThrow("Invalid session transition from recording to synthesizing");
  });

  it("rejects complete for empty transcript and invalid start state", async () => {
    const validBook = buildBook();

    const { ctx: completeCtx } = makeCtx({
      books: [validBook],
      sessions: [buildSession({ status: "transcribing" })],
    });

    await expect(
      completeListeningSessionHandler(mutationCtx(completeCtx), {
        sessionId: SESSION_ID,
        transcript: "   ",
        transcriptProvider: "openai",
      }),
    ).rejects.toThrow("Transcript cannot be empty");

    const { ctx: badStateCtx } = makeCtx({
      books: [validBook],
      sessions: [buildSession({ status: "recording" })],
    });

    await expect(
      completeListeningSessionHandler(mutationCtx(badStateCtx), {
        sessionId: SESSION_ID,
        transcript: "There is audio",
      }),
    ).rejects.toThrow("Invalid session transition from recording to complete");
  });

  it("creates raw transcript note when missing and updates session on completion", async () => {
    const { ctx, data, patchCalls, insertCalls } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "transcribing", durationMs: 65_000 })],
    });

    const result = await completeListeningSessionHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      transcript: "Final transcript",
      transcriptProvider: "openai",
    });

    expect(result).toMatchObject({
      rawNoteId: noteId(1),
      synthesizedNoteIds: [],
    });
    expect(data.notes).toHaveLength(1);
    const rawNote = data.notes[0]!;
    expect(rawNote).toMatchObject({
      type: "note",
      bookId: BOOK_ID,
      content: expect.stringContaining("Final transcript"),
    });
    expect(rawNote.content).toContain("Duration: 1:05");
    expect(data.sessions[0]!).toMatchObject({
      status: "complete",
      transcript: "Final transcript",
      transcriptChars: 16,
      rawNoteId: noteId(1),
    });
    expect(patchCalls.some((call) => call.id === SESSION_ID)).toBe(true);
    expect(insertCalls.some((call) => call.tableName === "notes")).toBe(true);
  });

  it("updates an existing raw note instead of inserting a duplicate", async () => {
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      notes: [{ _id: noteId(1), type: "note", content: "old content", bookId: BOOK_ID, userId }],
      sessions: [buildSession({ status: "transcribing", rawNoteId: noteId(1) })],
    });

    const result = await completeListeningSessionHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      transcript: "Final transcript",
    });

    expect(result.rawNoteId).toBe(noteId(1));
    expect(data.notes).toHaveLength(1);
    const rawNote = data.notes[0]!;
    expect(rawNote.content).toContain("Final transcript");
    expect(rawNote.content).not.toContain("old content");
  });

  it("rejects completion when raw note belongs to another book", async () => {
    const { ctx } = makeCtx({
      books: [buildBook()],
      notes: [
        { _id: noteId(1), type: "note", content: "old content", bookId: OTHER_BOOK_ID, userId },
      ],
      sessions: [buildSession({ status: "transcribing", rawNoteId: noteId(1) })],
    });

    await expect(
      completeListeningSessionHandler(mutationCtx(ctx), {
        sessionId: SESSION_ID,
        transcript: "Final transcript",
      }),
    ).rejects.toThrow("Raw note not found or access denied");
  });

  it("creates synthesis artifacts with caps, dedup, and note cap behavior", async () => {
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      notes: [
        {
          _id: noteId(1),
          type: "note" satisfies NoteType,
          content: "seed",
          bookId: BOOK_ID,
          userId,
        },
        ...Array.from(
          { length: 12 },
          (_, i): Note => ({
            _id: `existing_${i + 1}` as unknown as Id<"notes">,
            type: "quote",
            content: `existing ${i}`,
            bookId: BOOK_ID,
            userId,
          }),
        ),
      ],
      sessions: [buildSession({ status: "transcribing", synthesizedNoteIds: [] })],
    });

    const result = await completeListeningSessionHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      transcript: "Final transcript",
      synthesis: {
        insights: Array.from({ length: 12 }, (_v, i) => ({
          title: `Insight ${i}`,
          content: `Content ${i}`,
        })),
        openQuestions: Array.from({ length: 12 }, (_v, i) => `Question ${i}`),
        quotes: [
          { text: "Q-1", source: "S1" },
          { text: "Q-1", source: "S1b" },
          { text: "Q-2", source: "S2" },
          { text: "Q-3", source: "S3" },
          { text: "Q-4", source: "S4" },
          { text: "Q-5", source: "S5" },
          { text: "Q-6", source: "S6" },
        ],
        followUpQuestions: Array.from({ length: 12 }, (_v, i) => `Follow ${i}`),
        contextExpansions: Array.from({ length: 12 }, (_v, i) => ({
          title: `Context ${i}`,
          content: `Context body ${i}`,
        })),
      },
    });

    expect(result.synthesizedNoteIds).toHaveLength(6);
    expect(data.notes).toHaveLength(20);
    const session = data.sessions[0]!;
    expect(session.synthesizedNoteIds).toHaveLength(6);
    expect(session.synthesizedNoteIds!.every((id) => id.startsWith("note_"))).toBe(true);
    expect(result.synthesizedNoteIds.every((id) => id.startsWith("note_"))).toBe(true);
    expect(new Set(result.synthesizedNoteIds).size).toBe(6);
  });

  it("enforces existing synthesized-note cap during completion", async () => {
    const preexistingNoteIds = Array.from({ length: 12 }, (_v, i) => noteId(i + 1));
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      notes: preexistingNoteIds.map((seedNoteId, i) => ({
        _id: seedNoteId,
        type: i % 2 === 0 ? "note" : "quote",
        content: `seed ${i}`,
        bookId: BOOK_ID,
        userId,
      })),
      sessions: [
        buildSession({
          status: "transcribing",
          synthesizedNoteIds: preexistingNoteIds,
        }),
      ],
    });

    const result = await completeListeningSessionHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      transcript: "Final transcript",
      synthesis: {
        insights: [{ title: "A", content: "B" }],
        openQuestions: [],
        quotes: [{ text: "Q", source: "S" }],
        followUpQuestions: [],
        contextExpansions: [],
      },
    });

    expect(result.synthesizedNoteIds).toHaveLength(12);
    expect(data.notes).toHaveLength(13);
    const addedNoteIds = data.notes.map((note) => note._id);
    expect(addedNoteIds).toContain(noteId(13));
  });

  it("marks session as failed with truncated error", async () => {
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "transcribing" })],
    });

    await failListeningSessionHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      message: "x".repeat(1_200),
    });

    const session = data.sessions[0]!;
    expect(session.status).toBe("failed");
    expect(session.lastError).toHaveLength(1_000);
    expect(session.lastError!.endsWith("…")).toBe(true);
  });

  it("rejects failing a complete session", async () => {
    const { ctx } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "complete" })],
    });

    await expect(
      failListeningSessionHandler(mutationCtx(ctx), {
        sessionId: SESSION_ID,
        message: "boom",
      }),
    ).rejects.toThrow("Invalid session transition from complete to failed");
  });
});
