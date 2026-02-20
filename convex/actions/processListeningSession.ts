"use node";

import { internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { openRouterChatCompletion } from "../../lib/ai/openrouter";
import {
  clampArtifacts,
  EMPTY_SYNTHESIS_ARTIFACTS,
  normalizeArtifacts,
  type SynthesisArtifacts,
  type SynthesisContext,
} from "../../lib/listening-sessions/synthesis";
import { getListeningSynthesisConfig } from "../../lib/listening-sessions/synthesisConfig";
import { buildListeningSynthesisPrompt } from "../../lib/listening-sessions/synthesisPrompt";
import { transcribeAudio } from "../../lib/listening-sessions/transcription";

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000] as const;
const MAX_SYNTHESIS_TRANSCRIPT_CHARS = 50_000;

const processListeningSessionRun = (
  internal as unknown as {
    actions: { processListeningSession: { run: unknown } };
  }
).actions.processListeningSession.run;

const RESPONSE_SCHEMA = {
  name: "listening_session_artifacts",
  strict: true,
  schema: {
    type: "object",
    description:
      "Artifacts that help a reader remember, think, and act on a spoken reading session. Must be grounded in transcript + provided context.",
    additionalProperties: false,
    properties: {
      insights: {
        type: "array",
        description:
          "High-signal insights grounded in the transcript. Each insight should be specific, non-generic, and oriented toward future recall. Prefer fewer, better insights over many shallow ones.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", description: "A specific, memorable title." },
            content: {
              type: "string",
              description:
                "2-6 sentences. Include: the claim, why it matters, and a concrete next step or question when possible.",
            },
          },
          required: ["title", "content"],
        },
      },
      openQuestions: {
        type: "array",
        description:
          "Open questions raised by the transcript that you (the reader) would want to answer later. Prefer questions that will change your reading or interpretation.",
        items: {
          type: "string",
          description: "One specific question. Avoid multi-part questions.",
        },
      },
      quotes: {
        type: "array",
        description:
          "Verbatim excerpts pulled from the transcript ONLY. Do not paraphrase. If it's not in the transcript, omit it.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string", description: "Verbatim quote from the transcript." },
            source: {
              type: "string",
              description:
                "Optional location hint if the reader mentioned it (chapter/page/scene). Otherwise omit.",
            },
          },
          required: ["text"],
        },
      },
      followUpQuestions: {
        type: "array",
        description:
          "Prompts for what to pay attention to next time you read (or next session). These should be actionable, not philosophical filler.",
        items: { type: "string", description: "One concrete follow-up prompt." },
      },
      contextExpansions: {
        type: "array",
        description:
          "Helpful contextual expansions: historical, literary, philosophical, or interpretive scaffolding. Prefer 'what to look up' over asserting shaky facts.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", description: "A specific topic to explore." },
            content: {
              type: "string",
              description:
                "2-6 sentences. Provide safe, useful context and suggest a next lookup or comparison in the current book.",
            },
          },
          required: ["title", "content"],
        },
      },
    },
    required: ["insights", "openQuestions", "quotes", "followUpQuestions", "contextExpansions"],
  },
} as const;

type ProcessingCtx = Pick<ActionCtx, "runQuery" | "runMutation" | "scheduler">;

type ProcessingDeps = {
  transcribeAudioFn?: typeof transcribeAudio;
  openRouterChatCompletionFn?: typeof openRouterChatCompletion;
};

function getRetryDelayMs(attempt: number): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const fallback = RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
  return RETRY_DELAYS_MS[Math.min(safeAttempt, RETRY_DELAYS_MS.length - 1)] ?? fallback;
}

async function retryOrFail(
  ctx: ProcessingCtx,
  params: {
    sessionId: Id<"listeningSessions">;
    message: string;
    retryCount: number;
    attempt: number;
  },
) {
  const nextRetryCount = params.retryCount + 1;
  await ctx.runMutation(internal.listeningSessions.incrementRetry, {
    sessionId: params.sessionId,
  });

  if (nextRetryCount >= MAX_RETRIES) {
    await ctx.runMutation(internal.listeningSessions.failInternal, {
      sessionId: params.sessionId,
      message: params.message,
    });
    return;
  }

  await ctx.scheduler.runAfter(getRetryDelayMs(params.attempt), processListeningSessionRun as any, {
    sessionId: params.sessionId,
    attempt: params.attempt + 1,
  });
}

export async function processListeningSessionHandler(
  ctx: ProcessingCtx,
  args: { sessionId: Id<"listeningSessions">; attempt?: number },
  deps: ProcessingDeps = {},
) {
  const attempt = Math.max(0, Math.floor(args.attempt ?? 0));
  const transcribeAudioFn = deps.transcribeAudioFn ?? transcribeAudio;
  const openRouterChatCompletionFn = deps.openRouterChatCompletionFn ?? openRouterChatCompletion;

  const session = await ctx.runQuery(internal.listeningSessions.getForProcessing, {
    sessionId: args.sessionId,
  });

  if (!session) return;
  if (session.status === "complete" || session.status === "failed") return;
  if (session.status === "recording" || session.status === "review") return;

  const entitled = await ctx.runQuery(internal.subscriptions.checkAccessForUser, {
    userId: session.userId,
  });
  if (!entitled) {
    await ctx.runMutation(internal.listeningSessions.failInternal, {
      sessionId: args.sessionId,
      message: "Subscription required for voice session processing",
    });
    return;
  }

  const retryCount = session.retryCount ?? 0;
  if (retryCount >= MAX_RETRIES) {
    await ctx.runMutation(internal.listeningSessions.failInternal, {
      sessionId: args.sessionId,
      message: "Listening session exceeded retry limit",
    });
    return;
  }

  try {
    let transcript = typeof session.transcript === "string" ? session.transcript.trim() : "";
    let transcriptProvider =
      typeof session.transcriptProvider === "string" ? session.transcriptProvider.trim() : "";

    if (!transcript) {
      if (!session.audioUrl) {
        await ctx.runMutation(internal.listeningSessions.failInternal, {
          sessionId: args.sessionId,
          message: "No audio URL",
        });
        return;
      }

      try {
        const transcription = await transcribeAudioFn(
          session.audioUrl,
          process.env.DEEPGRAM_API_KEY,
          process.env.ELEVENLABS_API_KEY,
        );
        transcript = transcription.transcript;
        transcriptProvider = transcription.provider;

        await ctx.runMutation(internal.listeningSessions.transitionSynthesizingInternal, {
          sessionId: args.sessionId,
          transcript,
          transcriptProvider,
        });
      } catch (error) {
        await retryOrFail(ctx, {
          sessionId: args.sessionId,
          message: error instanceof Error ? error.message : "Transcription failed",
          retryCount,
          attempt,
        });
        return;
      }
    }

    const transcriptClamped =
      transcript.length > MAX_SYNTHESIS_TRANSCRIPT_CHARS
        ? transcript.slice(0, MAX_SYNTHESIS_TRANSCRIPT_CHARS)
        : transcript;

    let synthesis: SynthesisArtifacts = EMPTY_SYNTHESIS_ARTIFACTS;
    let hasSynthesis = false;

    const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (openRouterApiKey) {
      let context: SynthesisContext | undefined;
      try {
        context = await ctx.runQuery(internal.listeningSessions.getSynthesisContextForSession, {
          sessionId: args.sessionId,
        });
      } catch {
        context = undefined;
      }

      try {
        const config = getListeningSynthesisConfig();
        const { content } = await openRouterChatCompletionFn({
          apiKey: openRouterApiKey,
          timeoutMs: 90_000,
          referer: process.env.NEXT_PUBLIC_APP_URL || "https://bibliomnomnom.app",
          title: "bibliomnomnom-listening-session",
          request: {
            model: config.model,
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            top_p: config.topP,
            seed: config.seed,
            models: config.fallbackModels.length > 0 ? config.fallbackModels : undefined,
            provider: { require_parameters: true },
            plugins: [{ id: "response-healing" }],
            include_reasoning: config.reasoningEffort ? false : undefined,
            reasoning: config.reasoningEffort
              ? { effort: config.reasoningEffort, exclude: true }
              : undefined,
            response_format: {
              type: "json_schema",
              json_schema: RESPONSE_SCHEMA,
            },
            messages: [
              {
                role: "system",
                content:
                  "You transform spoken reading notes into useful, concrete artifacts for future reading and recall.",
              },
              {
                role: "user",
                content: buildListeningSynthesisPrompt({
                  transcript: transcriptClamped,
                  context,
                }),
              },
            ],
          },
        });

        const parsed = JSON.parse(content) as unknown;
        synthesis = clampArtifacts(normalizeArtifacts(parsed));
        hasSynthesis = true;
      } catch {
        hasSynthesis = false;
      }
    }

    await ctx.runMutation(internal.listeningSessions.completeInternal, {
      sessionId: args.sessionId,
      transcript,
      transcriptProvider: transcriptProvider || undefined,
      synthesis: hasSynthesis ? synthesis : undefined,
    });
  } catch (error) {
    await retryOrFail(ctx, {
      sessionId: args.sessionId,
      message: error instanceof Error ? error.message : "Listening session processing failed",
      retryCount,
      attempt,
    });
  }
}

export const run = internalAction({
  args: {
    sessionId: v.id("listeningSessions"),
    attempt: v.optional(v.number()),
  },
  handler: processListeningSessionHandler,
});
