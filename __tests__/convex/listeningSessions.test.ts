import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeListeningSessionHandler,
  createListeningSessionHandler,
  failListeningSessionHandler,
  markSynthesizingHandler,
  markTranscribingHandler,
} from "../../convex/listeningSessions";
import * as authModule from "../../convex/auth";

const userId = "user_1" as any;

type Session = {
  _id: any;
  userId: any;
  bookId: any;
  status: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  rawNoteId?: any;
  synthesizedNoteIds?: any[];
};

type TestCtx = {
  ctx: {
    db: {
      get: (id: any) => Promise<any>;
      insert: (tableName: string, doc: any) => Promise<any>;
      patch: (id: any, doc: any) => Promise<void>;
    };
  };
  data: {
    books: any[];
    sessions: any[];
    notes: any[];
  };
  patchCalls: { id: any; doc: any }[];
  insertCalls: { tableName: string; doc: any }[];
};

const makeCtx = (seed?: Partial<TestCtx["data"]>): TestCtx => {
  const data = {
    books: [...(seed?.books ?? [])],
    sessions: [...(seed?.sessions ?? [])],
    notes: [...(seed?.notes ?? [])],
  };

  const counters = {
    books: data.books.length,
    listeningSessions: data.sessions.length,
    notes: data.notes.length,
  };

  const insert = async (tableName: string, doc: any) => {
    let id: any;
    if (tableName === "listeningSessions") {
      id = `session_${++counters.listeningSessions}`;
      data.sessions.push({ ...doc, _id: id });
    } else if (tableName === "notes") {
      id = `note_${++counters.notes}`;
      data.notes.push({ ...doc, _id: id });
    } else {
      throw new Error(`Unhandled table: ${tableName}`);
    }

    insertCalls.push({ tableName, doc: { ...doc, _id: id } });
    return id;
  };

  const patchCalls: { id: any; doc: any }[] = [];
  const insertCalls: { tableName: string; doc: any }[] = [];

  const getById = (id: any) =>
    [...data.books, ...data.sessions, ...data.notes].find((doc) => doc._id === id) ?? null;

  return {
    ctx: {
      db: {
        get: async (id: any) => getById(id),
        insert,
        patch: async (id: any, doc: any) => {
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

const buildSession = (overrides: Partial<Session> = {}) => ({
  userId,
  bookId: "book_1" as any,
  status: "recording",
  capReached: false,
  capDurationMs: 30 * 60 * 1000,
  warningDurationMs: 60 * 1000,
  startedAt: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
  _id: "session_1" as any,
});

const buildBook = () => ({
  _id: "book_1" as any,
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
      bookId: "book_1" as any,
      capDurationMs: 30_000,
      warningDurationMs: 120_000,
    });

    expect(sessionId).toBe("session_1");
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]).toMatchObject({
      _id: "session_1",
      userId,
      status: "recording",
      capDurationMs: 60_000,
      warningDurationMs: 55_000,
      startedAt: now.getTime(),
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
    });
  });

  it("requires transcribing transition only from recording", async () => {
    const { ctx, data, patchCalls } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession()],
    });

    await markTranscribingHandler(mutationCtx(ctx), {
      sessionId: "session_1" as any,
      audioUrl: "https://blob/audio.webm",
      durationMs: 18_765.9,
      capReached: false,
      transcriptLive: "a   b",
    });

    expect(data.sessions[0].status).toBe("transcribing");
    expect(data.sessions[0].durationMs).toBe(18_765);
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
        sessionId: "session_1" as any,
        audioUrl: "https://blob/audio.webm",
        durationMs: 1000,
        capReached: true,
      }),
    ).rejects.toThrow("Invalid session transition from complete to transcribing");
    expect(rejected.patchCalls).toHaveLength(0);
  });

  it("requires synthesizing transition only from transcribing", async () => {
    const { ctx } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "transcribing" })],
    });

    await markSynthesizingHandler(mutationCtx(ctx), {
      sessionId: "session_1" as any,
    });

    const { ctx: badCtx } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "recording" })],
    });

    await expect(
      markSynthesizingHandler(mutationCtx(badCtx), {
        sessionId: "session_1" as any,
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
        sessionId: "session_1" as any,
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
        sessionId: "session_1" as any,
        transcript: "There is audio",
      }),
    ).rejects.toThrow("Cannot complete session from state: recording");
  });

  it("creates raw transcript note when missing and updates session on completion", async () => {
    const { ctx, data, patchCalls, insertCalls } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "transcribing" })],
    });

    const result = await completeListeningSessionHandler(mutationCtx(ctx), {
      sessionId: "session_1" as any,
      transcript: "Final transcript",
      transcriptProvider: "openai",
    });

    expect(result).toMatchObject({
      rawNoteId: "note_1",
      synthesizedNoteIds: [],
    });
    expect(data.notes).toHaveLength(1);
    expect(data.notes[0]).toMatchObject({
      type: "note",
      bookId: "book_1",
      content: expect.stringContaining("Final transcript"),
    });
    expect(data.sessions[0]).toMatchObject({
      status: "complete",
      transcript: "Final transcript",
      transcriptChars: 16,
      rawNoteId: "note_1",
    });
    expect(patchCalls.some((call) => call.id === "session_1")).toBe(true);
    expect(insertCalls.some((call) => call.tableName === "notes")).toBe(true);
  });

  it("updates an existing raw note instead of inserting a duplicate", async () => {
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      notes: [
        { _id: "note_1" as any, type: "note", content: "old content", bookId: "book_1", userId },
      ],
      sessions: [buildSession({ status: "transcribing", rawNoteId: "note_1" as any })],
    });

    const result = await completeListeningSessionHandler(mutationCtx(ctx), {
      sessionId: "session_1" as any,
      transcript: "Final transcript",
    });

    expect(result.rawNoteId).toBe("note_1");
    expect(data.notes).toHaveLength(1);
    expect(data.notes[0].content).toContain("Final transcript");
    expect(data.notes[0].content).not.toContain("old content");
  });

  it("creates synthesis artifacts with caps, dedup, and note cap behavior", async () => {
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      notes: [
        { _id: "note_1" as any, type: "note", content: "seed", bookId: "book_1", userId },
        ...Array.from({ length: 12 }, (_, i) => ({
          _id: `existing_${i + 1}` as any,
          type: "quote",
          content: `existing ${i}`,
          bookId: "book_1",
          userId,
        })),
      ],
      sessions: [buildSession({ status: "transcribing", synthesizedNoteIds: [] as any })],
    });

    const result = await completeListeningSessionHandler(mutationCtx(ctx), {
      sessionId: "session_1" as any,
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
    expect(result.synthesizedNoteIds).toHaveLength(6);
    expect(data.notes).toHaveLength(20);
    expect(data.sessions[0].synthesizedNoteIds).toHaveLength(6);
    expect(data.sessions[0].synthesizedNoteIds.every((id: string) => id.startsWith("note_"))).toBe(
      true,
    );
    expect(result.synthesizedNoteIds.every((id: string) => id.startsWith("note_"))).toBe(true);
    expect(new Set(result.synthesizedNoteIds).size).toBe(6);
  });

  it("enforces existing synthesized-note cap during completion", async () => {
    const preexistingNoteIds = Array.from({ length: 12 }, (_v, i) => `note_${i + 1}`);
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      notes: preexistingNoteIds.map((noteId, i) => ({
        _id: noteId as any,
        type: i % 2 === 0 ? "note" : "quote",
        content: `seed ${i}`,
        bookId: "book_1",
        userId,
      })),
      sessions: [
        buildSession({
          status: "transcribing",
          synthesizedNoteIds: preexistingNoteIds as any,
        }),
      ],
    });

    const result = await completeListeningSessionHandler(mutationCtx(ctx), {
      sessionId: "session_1" as any,
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
    expect(addedNoteIds).toContain("note_13");
  });

  it("marks session as failed with truncated error", async () => {
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "transcribing" })],
    });

    await failListeningSessionHandler(mutationCtx(ctx), {
      sessionId: "session_1" as any,
      message: "x".repeat(1_200),
    });

    expect(data.sessions[0].status).toBe("failed");
    expect(data.sessions[0].lastError).toHaveLength(1_000);
    expect((data.sessions[0].lastError as string).endsWith("…")).toBe(true);
  });
});
