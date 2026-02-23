import { afterEach, describe, expect, it, vi } from "vitest";
import { processListeningSessionHandler } from "../processListeningSession";

type MockCtx = {
  runQuery: ReturnType<typeof vi.fn>;
  runMutation: ReturnType<typeof vi.fn>;
  scheduler: {
    runAfter: ReturnType<typeof vi.fn>;
  };
};

function makeCtx(runQueryResults: unknown[]): MockCtx {
  return {
    runQuery: vi.fn(async () => runQueryResults.shift()),
    runMutation: vi.fn(async () => undefined),
    scheduler: {
      runAfter: vi.fn(async () => undefined),
    },
  };
}

const SESSION_ID = "session_1" as any;
const BOOK_ID = "book_1" as any;
const USER_ID = "user_1" as any;

function baseSession(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    _id: SESSION_ID,
    userId: USER_ID,
    bookId: BOOK_ID,
    status: "transcribing",
    capReached: false,
    capDurationMs: 30 * 60 * 1000,
    warningDurationMs: 60 * 1000,
    startedAt: now - 60_000,
    createdAt: now - 60_000,
    updatedAt: now - 60_000,
    ...overrides,
  };
}

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;

describe("processListeningSessionHandler", () => {
  afterEach(() => {
    if (originalOpenRouterApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
    }
    vi.restoreAllMocks();
  });

  it("exits immediately for complete and failed sessions", async () => {
    for (const status of ["complete", "failed"] as const) {
      const ctx = makeCtx([baseSession({ status })]);
      await processListeningSessionHandler(ctx as any, { sessionId: SESSION_ID }, {});
      expect(ctx.runMutation).not.toHaveBeenCalled();
      expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
    }
  });

  it("fails session when user has no subscription", async () => {
    const ctx = makeCtx([
      baseSession({ status: "transcribing", retryCount: 0 }),
      false, // checkAccessForUser → no subscription
    ]);

    await processListeningSessionHandler(ctx as any, { sessionId: SESSION_ID }, {});

    expect(ctx.runMutation).toHaveBeenCalledTimes(1);
    expect(ctx.runMutation.mock.calls[0]?.[1]).toMatchObject({
      sessionId: SESSION_ID,
      message: "Subscription required for voice session processing",
    });
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("transcribes, synthesizes, then completes", async () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";

    const ctx = makeCtx([
      baseSession({
        status: "transcribing",
        audioUrl: "https://blob.vercel-storage.com/listening-sessions/sample.webm",
        retryCount: 0,
      }),
      true, // checkAccessForUser
      null, // getTranscriptForSession → no transcript yet, will transcribe from audioUrl
      {
        book: { title: "Dune", author: "Frank Herbert" },
        currentlyReading: [],
        wantToRead: [],
        read: [],
        recentNotes: [],
      },
    ]);

    const transcribeAudioFn = vi.fn().mockResolvedValue({
      transcript: "A fresh insight from this chapter.",
      provider: "deepgram",
    });
    const openRouterChatCompletionFn = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        insights: [{ title: "Key idea", content: "Use this on the next read." }],
        openQuestions: ["How does this evolve later?"],
        quotes: [{ text: "A fresh insight from this chapter." }],
        followUpQuestions: ["Track this symbol next chapter."],
        contextExpansions: [{ title: "Context", content: "Compare with earlier motifs." }],
      }),
      raw: { model: "test-model" },
    });

    await processListeningSessionHandler(
      ctx as any,
      { sessionId: SESSION_ID },
      { transcribeAudioFn, openRouterChatCompletionFn },
    );

    expect(transcribeAudioFn).toHaveBeenCalledTimes(1);
    expect(openRouterChatCompletionFn).toHaveBeenCalledTimes(1);
    expect(ctx.runMutation).toHaveBeenCalledTimes(2);
    expect(ctx.runMutation.mock.calls[0]?.[1]).toMatchObject({
      sessionId: SESSION_ID,
      transcript: "A fresh insight from this chapter.",
      transcriptProvider: "deepgram",
    });
    expect(ctx.runMutation.mock.calls[1]?.[1]).toMatchObject({
      sessionId: SESSION_ID,
      transcript: "A fresh insight from this chapter.",
      transcriptProvider: "deepgram",
    });
    expect(ctx.runMutation.mock.calls[1]?.[1]?.synthesis?.insights?.[0]?.title).toBe("Key idea");
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("retries on transcription error", async () => {
    const ctx = makeCtx([
      baseSession({
        status: "transcribing",
        audioUrl: "https://blob.vercel-storage.com/listening-sessions/sample.webm",
        retryCount: 0,
      }),
      true, // checkAccessForUser
    ]);

    const transcribeAudioFn = vi.fn().mockRejectedValue(new Error("provider outage"));

    await processListeningSessionHandler(
      ctx as any,
      { sessionId: SESSION_ID, attempt: 0 },
      { transcribeAudioFn },
    );

    expect(ctx.runMutation).toHaveBeenCalledTimes(1);
    expect(ctx.runMutation.mock.calls[0]?.[1]).toMatchObject({ sessionId: SESSION_ID });
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    expect(ctx.scheduler.runAfter.mock.calls[0]?.[0]).toBe(30_000);
    expect(ctx.scheduler.runAfter.mock.calls[0]?.[2]).toMatchObject({
      sessionId: SESSION_ID,
      attempt: 1,
    });
  });

  it("marks failed once max retries is reached", async () => {
    const ctx = makeCtx([
      baseSession({
        status: "transcribing",
        audioUrl: "https://blob.vercel-storage.com/listening-sessions/sample.webm",
        retryCount: 2,
      }),
      true, // checkAccessForUser
    ]);

    const transcribeAudioFn = vi.fn().mockRejectedValue(new Error("still failing"));

    await processListeningSessionHandler(
      ctx as any,
      { sessionId: SESSION_ID, attempt: 2 },
      { transcribeAudioFn },
    );

    expect(ctx.runMutation).toHaveBeenCalledTimes(2);
    expect(ctx.runMutation.mock.calls[0]?.[1]).toMatchObject({ sessionId: SESSION_ID });
    expect(ctx.runMutation.mock.calls[1]?.[1]).toMatchObject({
      sessionId: SESSION_ID,
      message: "still failing",
    });
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });
});
