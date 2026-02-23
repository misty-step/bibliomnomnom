"use node";

import { internalAction, type ActionCtx } from "../_generated/server";
import type { FunctionReference } from "convex/server";
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
import { estimateCostUsd, getUsageTokens } from "../../lib/listening-sessions/cost-estimation";
import {
  MAX_SYNTHESIS_TRANSCRIPT_CHARS,
  SYNTHESIS_RESPONSE_SCHEMA,
} from "../../lib/listening-sessions/synthesisSchema";

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000] as const;

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

  await ctx.scheduler.runAfter(getRetryDelayMs(params.attempt), processListeningSessionRun, {
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
        const transcription = await transcribeAudioFn(session.audioUrl);
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
    let estimatedCostUsd: number | undefined;

    const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (openRouterApiKey) {
      let context: SynthesisContext | undefined;
      try {
        context = await ctx.runQuery(internal.listeningSessions.getSynthesisContextForSession, {
          sessionId: args.sessionId,
        });
        if (context?.packSummary) {
          console.log(
            `[processListeningSession] context pack for session ${args.sessionId}:`,
            JSON.stringify(context.packSummary),
          );
        }
      } catch {
        context = undefined;
      }

      try {
        const config = getListeningSynthesisConfig();
        const synthesisStart = Date.now();
        const { content, raw } = await openRouterChatCompletionFn({
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
              json_schema: SYNTHESIS_RESPONSE_SCHEMA,
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
        const synthesisLatencyMs = Date.now() - synthesisStart;

        const resolvedModel = raw.model ?? config.model;
        const { promptTokens, completionTokens } = getUsageTokens(raw.usage);
        estimatedCostUsd = estimateCostUsd(resolvedModel, promptTokens, completionTokens);

        console.log(
          JSON.stringify({
            msg: "background_worker_synthesis_complete",
            sessionId: args.sessionId,
            synthesisLatencyMs,
            model: resolvedModel,
            promptTokens,
            completionTokens,
            estimatedCostUsd,
          }),
        );

        const parsed = JSON.parse(content) as unknown;
        synthesis = clampArtifacts(normalizeArtifacts(parsed));
        hasSynthesis = true;
      } catch (synthError) {
        console.error(
          `[processListeningSession] LLM synthesis failed for session ${args.sessionId}:`,
          synthError instanceof Error ? synthError.message : String(synthError),
        );
        hasSynthesis = false;
      }
    }

    await ctx.runMutation(internal.listeningSessions.completeInternal, {
      sessionId: args.sessionId,
      transcript,
      transcriptProvider: transcriptProvider || undefined,
      synthesis: hasSynthesis ? synthesis : undefined,
      estimatedCostUsd,
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
