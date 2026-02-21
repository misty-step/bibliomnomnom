#!/usr/bin/env -S bun run
/**
 * Listening Session Guardrails
 *
 * Smoke-tests critical invariants that protect against regressions.
 * Run: bun run scripts/session-guardrails.ts
 * CI: included in quality gate
 */

import type { Id } from "../convex/_generated/dataModel";
import {
  completeListeningSessionHandler,
  createListeningSessionHandler,
  failListeningSessionHandler,
  markSynthesizingHandler,
  markTranscribingHandler,
} from "../convex/listeningSessions";
import { EMPTY_SYNTHESIS_ARTIFACTS } from "../lib/listening-sessions/synthesis";

type User = { _id: Id<"users">; clerkId: string; email: string; _creationTime: number };
type Book = { _id: Id<"books">; userId: Id<"users">; title: string; author: string };
type Note = {
  _id: Id<"notes">;
  userId: Id<"users">;
  bookId: Id<"books">;
  type: "note" | "quote";
  content: string;
  createdAt: number;
  updatedAt: number;
};
type Session = {
  _id: Id<"listeningSessions">;
  userId: Id<"users">;
  bookId: Id<"books">;
  status: "recording" | "transcribing" | "synthesizing" | "review" | "complete" | "failed";
  capReached: boolean;
  capDurationMs: number;
  warningDurationMs: number;
  startedAt: number;
  createdAt: number;
  updatedAt: number;
  durationMs?: number;
  rawNoteId?: Id<"notes">;
};
type DataStore = { users: User[]; books: Book[]; notes: Note[]; sessions: Session[] };

const USER_ID = "user_1" as Id<"users">;
const BOOK_ID = "book_1" as Id<"books">;
const MIN_CAP_MS = 60_000;
const MAX_CAP_MS = 4 * 60 * 60 * 1000;

function makeCtx(seed?: Partial<DataStore>) {
  const now = Date.now();
  const data: DataStore = {
    users: seed?.users ?? [
      { _id: USER_ID, clerkId: "clerk_user_1", email: "guardrails@test.dev", _creationTime: now },
    ],
    books: seed?.books ?? [{ _id: BOOK_ID, userId: USER_ID, title: "Guardrails", author: "Bot" }],
    notes: seed?.notes ?? [],
    sessions: seed?.sessions ?? [],
  };
  const counters = { sessions: data.sessions.length, notes: data.notes.length };
  const getById = (id: string) =>
    data.books.find((doc) => doc._id === id) ??
    data.sessions.find((doc) => doc._id === id) ??
    data.notes.find((doc) => doc._id === id) ??
    data.users.find((doc) => doc._id === id) ??
    null;

  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: "clerk_user_1" }) },
    db: {
      query: (tableName: string) => {
        if (tableName !== "users") throw new Error(`Unsupported query table: ${tableName}`);
        return {
          withIndex: (
            _index: string,
            where: (q: { eq: (field: string, value: string) => unknown }) => unknown,
          ) => {
            let clerkId = "";
            where({ eq: (_field: string, value: string) => ((clerkId = value), null) });
            return {
              unique: async () => data.users.find((user) => user.clerkId === clerkId) ?? null,
              collect: async () => data.users.filter((user) => user.clerkId === clerkId),
            };
          },
        };
      },
      get: async (id: string) => getById(id),
      insert: async (table: string, doc: Omit<Session, "_id"> | Omit<Note, "_id">) => {
        if (table === "listeningSessions") {
          const id = `session_${++counters.sessions}` as Id<"listeningSessions">;
          data.sessions.push({ ...(doc as Omit<Session, "_id">), _id: id });
          return id;
        }
        if (table === "notes") {
          const id = `note_${++counters.notes}` as Id<"notes">;
          data.notes.push({ ...(doc as Omit<Note, "_id">), _id: id });
          return id;
        }
        throw new Error(`Unsupported insert table: ${table}`);
      },
      patch: async (id: string, patch: Partial<Session> | Partial<Note>) => {
        const target = getById(id);
        if (target && typeof target === "object") Object.assign(target, patch);
      },
    },
  };
  return { ctx, data };
}

const mutationCtx = (ctx: ReturnType<typeof makeCtx>["ctx"]) =>
  ctx as unknown as Parameters<typeof createListeningSessionHandler>[0];
const assert = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
};
const expectThrows = async (run: () => Promise<unknown>, message: string) => {
  try {
    await run();
    throw new Error(`Expected throw: ${message}`);
  } catch (error) {
    const actual = error instanceof Error ? error.message : String(error);
    if (!actual.includes(message)) throw new Error(`Unexpected error: ${actual}`);
  }
};

async function checkCapNormalization() {
  for (const input of [0, 500, 60_000, 30 * 60 * 1000, 999_999_999]) {
    const { ctx, data } = makeCtx();
    await createListeningSessionHandler(mutationCtx(ctx), {
      bookId: BOOK_ID,
      capDurationMs: input,
    });
    assert(data.sessions[0], `Missing session for cap=${input}`);
    assert(data.sessions[0]!.capDurationMs >= MIN_CAP_MS, `cap=${input} normalized below min`);
    assert(data.sessions[0]!.capDurationMs <= MAX_CAP_MS, `cap=${input} normalized above max`);
  }
}

const baseSession = (status: Session["status"]): Session => ({
  _id: "session_1" as Id<"listeningSessions">,
  userId: USER_ID,
  bookId: BOOK_ID,
  status,
  capReached: false,
  capDurationMs: MIN_CAP_MS,
  warningDurationMs: 55_000,
  startedAt: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

async function checkStateMachineTransitions() {
  const happy = makeCtx();
  const sessionId = await createListeningSessionHandler(mutationCtx(happy.ctx), {
    bookId: BOOK_ID,
  });
  await markTranscribingHandler(mutationCtx(happy.ctx), {
    sessionId,
    durationMs: 60_000,
    capReached: true,
  });
  await markSynthesizingHandler(mutationCtx(happy.ctx), { sessionId });
  const completion = await completeListeningSessionHandler(mutationCtx(happy.ctx), {
    sessionId,
    transcript: "Record -> process -> review/publish",
    transcriptProvider: "deepgram",
  });
  const completed = happy.data.sessions.find((session) => session._id === sessionId);
  assert(completed?.status === "complete", "Happy path did not reach complete");
  assert(!!completion.rawNoteId, "Happy path missing rawNoteId");
  const badSynth = makeCtx({ sessions: [baseSession("recording")] });
  await expectThrows(
    () =>
      markSynthesizingHandler(mutationCtx(badSynth.ctx), {
        sessionId: "session_1" as Id<"listeningSessions">,
      }),
    "Invalid session transition",
  );

  const badFail = makeCtx({ sessions: [{ ...baseSession("complete"), capReached: true }] });
  await expectThrows(
    () =>
      failListeningSessionHandler(mutationCtx(badFail.ctx), {
        sessionId: "session_1" as Id<"listeningSessions">,
        message: "boom",
      }),
    "Invalid session transition",
  );
}

async function checkSynthesisCompleteness() {
  const expectedKeys = [
    "contextExpansions",
    "followUpQuestions",
    "insights",
    "openQuestions",
    "quotes",
  ].sort();
  const actualKeys = Object.keys(EMPTY_SYNTHESIS_ARTIFACTS).sort();
  assert(
    actualKeys.length === expectedKeys.length &&
      actualKeys.every((key, index) => key === expectedKeys[index]),
    `EMPTY_SYNTHESIS_ARTIFACTS keys changed. Expected: [${expectedKeys.join(", ")}], Got: [${actualKeys.join(", ")}]`,
  );
}

async function checkLiveEnvReachability() {
  if (!process.env.CONVEX_URL || !process.env.CONVEX_DEPLOY_KEY) return;
  const response = await fetch(process.env.CONVEX_URL, {
    method: "HEAD",
    headers: { Authorization: `Bearer ${process.env.CONVEX_DEPLOY_KEY}` },
  });
  assert(response.status < 500, `Live Convex endpoint unhealthy (${response.status})`);
}

async function runCheck(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
const hasLiveEnv = Boolean(process.env.CONVEX_URL && process.env.CONVEX_DEPLOY_KEY);
console.log(`Listening session guardrails (${hasLiveEnv ? "live-env configured" : "mock mode"})`);
const checks: Array<[string, () => Promise<void>]> = [
  ["Cap normalization invariants", checkCapNormalization],
  ["State machine transition invariants", checkStateMachineTransitions],
  ["Synthesis completeness", checkSynthesisCompleteness],
];
if (hasLiveEnv) checks.push(["Live env reachability", checkLiveEnvReachability]);
const results = await Promise.all(checks.map(([name, fn]) => runCheck(name, fn)));
const passed = results.filter(Boolean).length;
const failed = results.length - passed;
console.log(`Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
