import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeListeningSessionHandler,
  createListeningSessionHandler,
  failListeningSessionHandler,
  markSynthesizingHandler,
  markTranscribingHandler,
  toClientSession,
} from "../../convex/listeningSessions";
import * as authModule from "../../convex/auth";
import type { Id } from "../../convex/_generated/dataModel";

const userId = "user_1" as unknown as Id<"users">;
const otherUserId = "user_2" as unknown as Id<"users">;

const BOOK_ID = "book_1" as unknown as Id<"books">;
const OTHER_BOOK_ID = "book_2" as unknown as Id<"books">;
const SESSION_ID = "session_1" as unknown as Id<"listeningSessions">;
const noteId = (n: number) => `note_${n}` as unknown as Id<"notes">;
const transcriptId = (n: number) =>
  `transcript_${n}` as unknown as Id<"listeningSessionTranscripts">;
const artifactId = (n: number) => `artifact_${n}` as unknown as Id<"listeningSessionArtifacts">;

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

type Transcript = {
  _id: Id<"listeningSessionTranscripts">;
  userId: Id<"users">;
  bookId: Id<"books">;
  sessionId: Id<"listeningSessions">;
  type: "segment" | "final";
  provider?: string;
  content: string;
  chars: number;
  createdAt: number;
  updatedAt: number;
};

type Artifact = {
  _id: Id<"listeningSessionArtifacts">;
  userId: Id<"users">;
  bookId: Id<"books">;
  sessionId: Id<"listeningSessions">;
  kind: "insight" | "openQuestion" | "quote" | "followUpQuestion" | "contextExpansion";
  title: string;
  content: string;
  provider?: string;
  createdAt: number;
  updatedAt: number;
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

type DbId =
  | Id<"books">
  | Id<"listeningSessions">
  | Id<"notes">
  | Id<"listeningSessionTranscripts">
  | Id<"listeningSessionArtifacts">;
type DbPatch =
  | Partial<Book>
  | Partial<Session>
  | Partial<Note>
  | Partial<Transcript>
  | Partial<Artifact>;
type InsertTableName =
  | "listeningSessions"
  | "notes"
  | "listeningSessionTranscripts"
  | "listeningSessionArtifacts";
type InsertDoc<T extends InsertTableName> = T extends "listeningSessions"
  ? Omit<Session, "_id">
  : T extends "notes"
    ? Omit<Note, "_id">
    : T extends "listeningSessionTranscripts"
      ? Omit<Transcript, "_id">
      : Omit<Artifact, "_id">;
type InsertedId<T extends InsertTableName> = T extends "listeningSessions"
  ? Id<"listeningSessions">
  : T extends "notes"
    ? Id<"notes">
    : T extends "listeningSessionTranscripts"
      ? Id<"listeningSessionTranscripts">
      : Id<"listeningSessionArtifacts">;
type QueryTableName = InsertTableName | "books";

type QueryBuilder = {
  eq: (field: string, value: unknown) => QueryBuilder;
  neq: (field: string, value: unknown) => QueryBuilder;
  gte: (field: string, value: unknown) => QueryBuilder;
  lte: (field: string, value: unknown) => QueryBuilder;
  lt: (field: string, value: unknown) => QueryBuilder;
  gt: (field: string, value: unknown) => QueryBuilder;
  field: (name: string) => string;
};

type TestCtx = {
  ctx: {
    db: {
      get: (id: DbId) => Promise<Book | Session | Note | Transcript | Artifact | null>;
      insert: <T extends InsertTableName>(
        tableName: T,
        doc: InsertDoc<T>,
      ) => Promise<InsertedId<T>>;
      patch: (id: DbId, doc: DbPatch) => Promise<void>;
      query: <T extends QueryTableName>(tableName: T) => QueryHandle<T>;
    };
  };
  data: {
    books: Book[];
    sessions: Session[];
    notes: Note[];
    transcripts: Transcript[];
    artifacts: Artifact[];
  };
  patchCalls: { id: DbId; doc: DbPatch }[];
  insertCalls: { tableName: InsertTableName; doc: Session | Note | Transcript | Artifact }[];
};

type QueryHandle<T extends QueryTableName> = {
  withIndex: (indexName: string, buildIndex: (q: QueryBuilder) => void) => QueryHandle<T>;
  filter: (filterFn: (q: QueryBuilder) => void) => QueryHandle<T>;
  order: (direction: "asc" | "desc") => QueryHandle<T>;
  collect: () => Promise<Array<DocForTable<T>>>;
  take: (n: number) => Promise<Array<DocForTable<T>>>;
  first: () => Promise<DocForTable<T> | null>;
};

type DocForTable<T extends QueryTableName> = T extends "listeningSessions"
  ? Session
  : T extends "notes"
    ? Note
    : T extends "listeningSessionTranscripts"
      ? Transcript
      : T extends "listeningSessionArtifacts"
        ? Artifact
        : Book;

const makeCtx = (seed?: Partial<TestCtx["data"]>): TestCtx => {
  const data: TestCtx["data"] = {
    books: [...(seed?.books ?? [])],
    sessions: [...(seed?.sessions ?? [])],
    notes: [...(seed?.notes ?? [])],
    transcripts: [...(seed?.transcripts ?? [])],
    artifacts: [...(seed?.artifacts ?? [])],
  };

  const counters = {
    listeningSessions: data.sessions.length,
    notes: data.notes.length,
    listeningSessionTranscripts: data.transcripts.length,
    listeningSessionArtifacts: data.artifacts.length,
  };

  const patchCalls: TestCtx["patchCalls"] = [];
  const insertCalls: TestCtx["insertCalls"] = [];

  const getById = (id: DbId) =>
    data.books.find((doc) => doc._id === id) ??
    data.sessions.find((doc) => doc._id === id) ??
    data.notes.find((doc) => doc._id === id) ??
    data.transcripts.find((doc) => doc._id === id) ??
    data.artifacts.find((doc) => doc._id === id) ??
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
    if (tableName === "listeningSessionTranscripts") {
      const id =
        `transcript_${++counters.listeningSessionTranscripts}` as unknown as Id<"listeningSessionTranscripts">;
      const full = { ...(doc as Omit<Transcript, "_id">), _id: id } as Transcript;
      data.transcripts.push(full);
      insertCalls.push({ tableName, doc: full });
      return id as InsertedId<T>;
    }
    if (tableName === "listeningSessionArtifacts") {
      const id =
        `artifact_${++counters.listeningSessionArtifacts}` as unknown as Id<"listeningSessionArtifacts">;
      const full = { ...(doc as Omit<Artifact, "_id">), _id: id } as Artifact;
      data.artifacts.push(full);
      insertCalls.push({ tableName, doc: full });
      return id as InsertedId<T>;
    }

    const id = `note_${++counters.notes}` as unknown as Id<"notes">;
    const full = { ...(doc as Omit<Note, "_id">), _id: id } as Note;
    data.notes.push(full);
    insertCalls.push({ tableName, doc: full });
    return id as InsertedId<T>;
  };

  const query = <T extends QueryTableName>(tableName: T): QueryHandle<T> => {
    const getRows = (): Array<DocForTable<T>> => {
      if (tableName === "notes") return [...(data.notes as Array<DocForTable<T>>)];
      if (tableName === "listeningSessionTranscripts") {
        return [...(data.transcripts as Array<DocForTable<T>>)];
      }
      if (tableName === "listeningSessionArtifacts") {
        return [...(data.artifacts as Array<DocForTable<T>>)];
      }
      if (tableName === "books") {
        return [...(data.books as Array<DocForTable<T>>)];
      }
      return [...(data.sessions as Array<DocForTable<T>>)];
    };

    let rows = getRows();

    const makeBuilder = () => {
      const predicates: Array<(row: DocForTable<T>) => boolean> = [];
      const qb: QueryBuilder = {
        eq: (field, value) => {
          predicates.push((row) => {
            const left = (row as Record<string, unknown>)[field];
            return left === value;
          });
          return qb;
        },
        neq: (field, value) => {
          predicates.push((row) => {
            const left = (row as Record<string, unknown>)[field];
            return left !== value;
          });
          return qb;
        },
        gte: (field, value) => {
          predicates.push((row) => {
            const left = (row as Record<string, unknown>)[field];
            return (left as number) >= (value as number);
          });
          return qb;
        },
        lte: (field, value) => {
          predicates.push((row) => {
            const left = (row as Record<string, unknown>)[field];
            return (left as number) <= (value as number);
          });
          return qb;
        },
        lt: (field, value) => {
          predicates.push((row) => {
            const left = (row as Record<string, unknown>)[field];
            return (left as number) < (value as number);
          });
          return qb;
        },
        gt: (field, value) => {
          predicates.push((row) => {
            const left = (row as Record<string, unknown>)[field];
            return (left as number) > (value as number);
          });
          return qb;
        },
        field: (name) => name,
      };

      const apply = () => {
        rows = rows.filter((row) => predicates.every((predicate) => predicate(row)));
      };

      return { qb, apply };
    };

    const chain: QueryHandle<T> = {
      withIndex: (_indexName, buildIndex) => {
        const { qb, apply } = makeBuilder();
        buildIndex(qb);
        apply();
        return chain;
      },
      filter: (filterFn) => {
        const { qb, apply } = makeBuilder();
        filterFn(qb);
        apply();
        return chain;
      },
      order: (direction) => {
        rows = [...rows].sort((a, b) => {
          const rec = (r: DocForTable<T>) => r as Record<string, unknown>;
          const left = (rec(a)._creationTime ?? rec(a).createdAt ?? 0) as number;
          const right = (rec(b)._creationTime ?? rec(b).createdAt ?? 0) as number;
          return direction === "desc" ? right - left : left - right;
        });
        return chain;
      },
      collect: async () => rows,
      take: async (n: number) => rows.slice(0, n),
      first: async () => rows[0] ?? null,
    };

    return chain;
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
        query,
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
  ctx as unknown as Parameters<typeof createListeningSessionHandler>[0];

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

  it("prevents creating a new session while another active session exists for the same book", async () => {
    const activeStatuses: SessionStatus[] = ["recording", "transcribing", "synthesizing", "review"];

    for (const status of activeStatuses) {
      const { ctx } = makeCtx({
        books: [buildBook()],
        sessions: [buildSession({ status })],
      });

      await expect(
        createListeningSessionHandler(mutationCtx(ctx), {
          bookId: BOOK_ID,
        }),
      ).rejects.toThrow("Only one active listening session allowed per book");
    }
  });

  it("allows creating a new session after prior session is terminal", async () => {
    const terminalStatuses: SessionStatus[] = ["complete", "failed"];

    for (const status of terminalStatuses) {
      const { ctx, data } = makeCtx({
        books: [buildBook()],
        sessions: [buildSession({ status })],
      });

      const sessionId = await createListeningSessionHandler(mutationCtx(ctx), {
        bookId: BOOK_ID,
      });

      expect(sessionId).toBe("session_2");
      expect(data.sessions).toHaveLength(2);
      expect(data.sessions[1]).toMatchObject({
        status: "recording",
        userId,
      });
    }
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
      durationMs: 18_765.9,
      capReached: false,
      transcriptLive: "a   b",
    });

    const session = data.sessions[0]!;
    expect(session.status).toBe("transcribing");
    expect(session.durationMs).toBe(18_765);
    expect(patchCalls[0]?.doc).toMatchObject({
      status: "transcribing",
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
    expect(data.transcripts).toHaveLength(1);
    expect(data.transcripts[0]).toMatchObject({
      _id: transcriptId(1),
      sessionId: SESSION_ID,
      userId,
      bookId: BOOK_ID,
      type: "final",
      provider: "openai",
      content: "Final transcript",
      chars: 16,
    });
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
      transcriptProvider: "openai",
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
    expect(data.transcripts).toHaveLength(1);
    expect(data.artifacts).toHaveLength(28);
    const session = data.sessions[0]!;
    expect(session.synthesizedNoteIds).toHaveLength(6);
    expect(session.synthesizedNoteIds!.every((id) => id.startsWith("note_"))).toBe(true);
    expect(result.synthesizedNoteIds.every((id) => id.startsWith("note_"))).toBe(true);
    expect(new Set(result.synthesizedNoteIds).size).toBe(6);

    const artifactKinds = data.artifacts.map((artifact) => artifact.kind);
    expect(artifactKinds.filter((kind) => kind === "insight")).toHaveLength(6);
    expect(artifactKinds.filter((kind) => kind === "openQuestion")).toHaveLength(6);
    expect(artifactKinds.filter((kind) => kind === "followUpQuestion")).toHaveLength(6);
    expect(artifactKinds.filter((kind) => kind === "quote")).toHaveLength(6);
    expect(artifactKinds.filter((kind) => kind === "contextExpansion")).toHaveLength(4);
    expect(data.artifacts.every((artifact) => artifact.provider === "openai")).toBe(true);
    expect(data.artifacts[0]).toMatchObject({
      _id: artifactId(1),
      kind: "insight",
      provider: "openai",
      title: "Insight 0",
    });
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
    expect(data.artifacts).toHaveLength(2);
    const artifactKinds = data.artifacts.map((artifact) => artifact.kind);
    expect(artifactKinds.filter((kind) => kind === "insight")).toHaveLength(1);
    expect(artifactKinds.filter((kind) => kind === "quote")).toHaveLength(1);
    expect(data.artifacts.every((artifact) => artifact.provider === "unknown")).toBe(true);
    expect(data.artifacts[0]).toMatchObject({
      _id: artifactId(1),
      provider: "unknown",
    });
    const addedNoteIds = data.notes.map((note) => note._id);
    expect(addedNoteIds).toContain(noteId(13));
  });

  it("skips duplicate transcript/artifact inserts on re-completion (idempotent)", async () => {
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "transcribing", durationMs: 10_000 })],
    });

    // First completion
    await completeListeningSessionHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      transcript: "Final transcript",
      transcriptProvider: "openai",
      synthesis: {
        insights: [{ title: "I1", content: "C1" }],
        openQuestions: ["Q1"],
        quotes: [],
        followUpQuestions: [],
        contextExpansions: [],
      },
    });

    expect(data.transcripts).toHaveLength(1);
    expect(data.artifacts).toHaveLength(2);

    // Second completion (complete→complete self-transition)
    await completeListeningSessionHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      transcript: "Final transcript",
      transcriptProvider: "openai",
      synthesis: {
        insights: [{ title: "I1", content: "C1" }],
        openQuestions: ["Q1"],
        quotes: [],
        followUpQuestions: [],
        contextExpansions: [],
      },
    });

    // No duplicates
    expect(data.transcripts).toHaveLength(1);
    expect(data.artifacts).toHaveLength(2);
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

  it("handles 30-minute simulated session (cap reached path)", async () => {
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ capDurationMs: 30 * 60 * 1000, status: "recording" })],
    });

    await markTranscribingHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      durationMs: 30 * 60 * 1000,
      capReached: true,
    });

    expect(data.sessions[0]).toMatchObject({
      status: "transcribing",
      capReached: true,
      durationMs: 30 * 60 * 1000,
    });
  });

  it("handles 90-minute multi-rollover (3 consecutive sessions)", async () => {
    const sessionIds = [1, 2, 3].map((n) => `session_${n}` as unknown as Id<"listeningSessions">);
    const sessions = sessionIds.map((sessionId) => ({
      ...buildSession({ status: "recording", capDurationMs: 30 * 60 * 1000 }),
      _id: sessionId,
    }));
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      sessions,
    });

    for (const [index, sessionId] of sessionIds.entries()) {
      await markTranscribingHandler(mutationCtx(ctx), {
        sessionId,
        durationMs: 30 * 60 * 1000,
        capReached: true,
      });

      const result = await completeListeningSessionHandler(mutationCtx(ctx), {
        sessionId,
        transcript: `Final transcript rollover ${index + 1}`,
        transcriptProvider: "deepgram",
      });

      const session = data.sessions.find((candidate) => candidate._id === sessionId);
      expect(session).toBeTruthy();
      expect(session?.status).toBe("complete");
      expect(result.rawNoteId.startsWith("note_")).toBe(true);
    }

    expect(data.sessions.every((session) => session.status === "complete")).toBe(true);
    const finalSession = data.sessions.find((session) => session._id === sessionIds[2]);
    expect(finalSession?.rawNoteId).toBeTruthy();
    expect(finalSession?.rawNoteId?.startsWith("note_")).toBe(true);
  });

  it("normalizes sub-minimum cap duration to 60s", async () => {
    const { ctx, data } = makeCtx({ books: [buildBook()] });

    await createListeningSessionHandler(mutationCtx(ctx), {
      bookId: BOOK_ID,
      capDurationMs: 500,
    });

    expect(data.sessions[0]?.capDurationMs).toBe(60_000);
  });

  it("normalizes above-maximum cap duration to 4 hours", async () => {
    const { ctx, data } = makeCtx({ books: [buildBook()] });

    await createListeningSessionHandler(mutationCtx(ctx), {
      bookId: BOOK_ID,
      capDurationMs: 999_999_999,
    });

    expect(data.sessions[0]?.capDurationMs).toBe(4 * 60 * 60 * 1000);
  });

  it("warning cannot exceed cap minus 5s", async () => {
    const { ctx, data } = makeCtx({ books: [buildBook()] });

    await createListeningSessionHandler(mutationCtx(ctx), {
      bookId: BOOK_ID,
      capDurationMs: 120_000,
      warningDurationMs: 200_000,
    });

    expect(data.sessions[0]?.warningDurationMs).toBe(115_000);
  });

  it("warning minimum floor is 15s", async () => {
    const { ctx, data } = makeCtx({ books: [buildBook()] });

    await createListeningSessionHandler(mutationCtx(ctx), {
      bookId: BOOK_ID,
      capDurationMs: 30_000,
      warningDurationMs: 1_000,
    });

    expect(data.sessions[0]?.warningDurationMs).toBe(15_000);
  });
});

describe("cap rollover semantics", () => {
  beforeEach(() => {
    vi.spyOn(authModule, "requireAuth").mockResolvedValue(userId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("markTranscribing with capReached=true sets capReached flag", async () => {
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "recording" })],
    });

    await markTranscribingHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      durationMs: 42_000,
      capReached: true,
    });

    expect(data.sessions[0]?.capReached).toBe(true);
  });

  it("session with capReached=true can still complete successfully", async () => {
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "recording" })],
    });

    await markTranscribingHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      durationMs: 30 * 60 * 1000,
      capReached: true,
    });

    await completeListeningSessionHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      transcript: "Capped but complete transcript",
      transcriptProvider: "deepgram",
    });

    expect(data.sessions[0]).toMatchObject({
      status: "complete",
      capReached: true,
    });
  });

  it("capReached=false session has capReached false after markTranscribing", async () => {
    const { ctx, data } = makeCtx({
      books: [buildBook()],
      sessions: [buildSession({ status: "recording", capReached: true })],
    });

    await markTranscribingHandler(mutationCtx(ctx), {
      sessionId: SESSION_ID,
      durationMs: 10_000,
      capReached: false,
    });

    expect(data.sessions[0]?.capReached).toBe(false);
  });
});

describe("toClientSession", () => {
  it("strips audioUrl so it is never exposed to clients", () => {
    const session = buildSession({
      audioUrl: "https://blob.vercel-storage.com/listening-sessions/session_1/audio.webm",
    });
    const result = toClientSession(session as never);
    expect(result).not.toHaveProperty("audioUrl");
  });

  it("preserves all other session fields", () => {
    const session = buildSession({ status: "transcribing", durationMs: 12_000, capReached: true });
    const result = toClientSession(session as never);
    expect(result.status).toBe("transcribing");
    expect(result.durationMs).toBe(12_000);
    expect(result.capReached).toBe(true);
  });

  it("does not expose audioUrl even when session has no audioUrl set", () => {
    const session = buildSession();
    const result = toClientSession(session as never);
    expect("audioUrl" in result).toBe(false);
  });
});
