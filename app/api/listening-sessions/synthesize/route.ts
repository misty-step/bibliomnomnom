import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { log, withObservability } from "@/lib/api/withObservability";
import { OpenRouterApiError, openRouterChatCompletion } from "@/lib/ai/openrouter";
import { requireListeningSessionEntitlement } from "@/lib/listening-sessions/entitlements";
import {
  EMPTY_SYNTHESIS_ARTIFACTS,
  normalizeArtifacts,
  type SynthesisContext,
} from "@/lib/listening-sessions/synthesis";
import { makeFallbackArtifacts } from "@/lib/listening-sessions/fallback-artifacts";
import { logSessionCostGuardrails } from "@/lib/listening-sessions/cost-guardrails";
import { estimateCostUsd, getUsageTokens } from "@/lib/listening-sessions/cost-estimation";
import { getListeningSynthesisConfig } from "@/lib/listening-sessions/synthesisConfig";
import { buildListeningSynthesisPrompt } from "@/lib/listening-sessions/synthesisPrompt";
import {
  MAX_SYNTHESIS_TRANSCRIPT_CHARS,
  SYNTHESIS_RESPONSE_SCHEMA,
} from "@/lib/listening-sessions/synthesisSchema";

type SynthesizeRequest = {
  transcript: string;
  bookId: Id<"books">;
  sessionId?: Id<"listeningSessions">;
};

export const POST = withObservability(async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Please sign in to synthesize notes." },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  let body: SynthesizeRequest;
  try {
    const parsed = (await request.json()) as Partial<{
      transcript: unknown;
      bookId: unknown;
      sessionId: unknown;
    }>;
    if (!parsed.transcript || typeof parsed.transcript !== "string") {
      return NextResponse.json(
        { error: "transcript is required." },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
    if (!parsed.bookId || typeof parsed.bookId !== "string" || !parsed.bookId.trim()) {
      return NextResponse.json(
        { error: "bookId is required." },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
    if (
      parsed.sessionId !== undefined &&
      (typeof parsed.sessionId !== "string" || !parsed.sessionId.trim())
    ) {
      return NextResponse.json(
        { error: "sessionId must be a non-empty string when provided." },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
    body = {
      transcript: parsed.transcript.trim(),
      bookId: parsed.bookId.trim() as Id<"books">,
      sessionId:
        typeof parsed.sessionId === "string"
          ? (parsed.sessionId.trim() as Id<"listeningSessions">)
          : undefined,
    };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  const entitlement = await requireListeningSessionEntitlement({
    requestId,
    clerkId: userId,
    getToken,
    rateLimit: {
      key: `listening-sessions:synthesize:${userId}`,
      limit: 60,
      windowMs: 24 * 60 * 60 * 1000,
      errorMessage: "Too many voice sessions today. Please try again later.",
    },
  });
  if (!entitlement.ok) {
    return NextResponse.json(
      { error: entitlement.error },
      { status: entitlement.status, headers: { "x-request-id": requestId } },
    );
  }

  if (!body.transcript) {
    return NextResponse.json(
      { artifacts: EMPTY_SYNTHESIS_ARTIFACTS, source: "empty-transcript" },
      { headers: { "x-request-id": requestId } },
    );
  }

  const transcriptRaw = body.transcript.trim();
  const transcript =
    transcriptRaw.length > MAX_SYNTHESIS_TRANSCRIPT_CHARS
      ? transcriptRaw.slice(0, MAX_SYNTHESIS_TRANSCRIPT_CHARS)
      : transcriptRaw;
  const synthesisStart = Date.now();

  let context: SynthesisContext | undefined;
  try {
    context = await entitlement.convex.query(api.listeningSessions.getSynthesisContext, {
      bookId: body.bookId,
    });
  } catch (error) {
    log("warn", "listening_session_synthesis_context_unavailable", {
      requestId,
      userIdSuffix: userId.slice(-6),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const config = getListeningSynthesisConfig();
  const patchSynthesisTelemetry = async (params: {
    synthesisLatencyMs: number;
    synthesisProvider: string;
    degradedMode: boolean;
    estimatedCostUsd: number;
  }) => {
    if (!body.sessionId) return;
    try {
      await entitlement.convex.mutation(api.listeningSessions.markSynthesizing, {
        sessionId: body.sessionId,
        synthesisLatencyMs: params.synthesisLatencyMs,
        synthesisProvider: params.synthesisProvider,
        degradedMode: params.degradedMode,
        estimatedCostUsd: params.estimatedCostUsd,
      });
    } catch (error) {
      log("warn", "listening_session_synthesizing_telemetry_update_failed", {
        requestId,
        userIdSuffix: userId.slice(-6),
        sessionId: body.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!openRouterApiKey) {
    const fallback = makeFallbackArtifacts(transcript, context);
    const synthesisLatencyMs = Date.now() - synthesisStart;
    void patchSynthesisTelemetry({
      synthesisLatencyMs,
      synthesisProvider: config.model,
      degradedMode: true,
      estimatedCostUsd: 0,
    });
    return NextResponse.json(
      { artifacts: fallback, source: "fallback", estimatedCostUsd: 0 },
      { headers: { "x-request-id": requestId } },
    );
  }

  try {
    const { content, raw } = await openRouterChatCompletion({
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
              transcript,
              context,
            }),
          },
        ],
      },
    });

    const parsed = JSON.parse(content) as unknown;
    const artifacts = normalizeArtifacts(parsed);
    const resolvedModel = raw.model ?? config.model;
    const { promptTokens, completionTokens } = getUsageTokens(raw.usage);
    const estimatedCostUsd = estimateCostUsd(resolvedModel, promptTokens, completionTokens);
    const synthesisLatencyMs = Date.now() - synthesisStart;

    logSessionCostGuardrails(
      { sessionId: body.sessionId, estimatedCostUsd, model: resolvedModel },
      log,
    );
    void patchSynthesisTelemetry({
      synthesisLatencyMs,
      synthesisProvider: resolvedModel,
      degradedMode: false,
      estimatedCostUsd,
    });

    log("info", "listening_session_synthesized", {
      requestId,
      userIdSuffix: userId.slice(-6),
      requestedModel: config.model,
      resolvedModel,
      fallbackModels: config.fallbackModels.length,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      usage: raw.usage,
      synthesisLatencyMs,
      estimatedCostUsd,
      transcriptChars: transcript.length,
      transcriptClamped: transcript.length !== transcriptRaw.length,
      insightCount: artifacts.insights.length,
      quoteCount: artifacts.quotes.length,
    });
    return NextResponse.json(
      {
        artifacts,
        source: "openrouter",
        model: resolvedModel,
        requestedModel: config.model,
        estimatedCostUsd,
      },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    const isRateLimited = error instanceof OpenRouterApiError && error.status === 429;
    const fallback = makeFallbackArtifacts(transcript, context);
    const synthesisLatencyMs = Date.now() - synthesisStart;

    void patchSynthesisTelemetry({
      synthesisLatencyMs,
      synthesisProvider: config.model,
      degradedMode: true,
      estimatedCostUsd: 0,
    });

    log(isRateLimited ? "warn" : "error", "listening_session_synthesis_fallback", {
      requestId,
      userIdSuffix: userId.slice(-6),
      model: config.model,
      error: error instanceof Error ? error.message : String(error),
      isRateLimited,
      synthesisLatencyMs,
    });
    return NextResponse.json(
      { artifacts: fallback, source: "fallback", estimatedCostUsd: 0 },
      { headers: { "x-request-id": requestId } },
    );
  }
}, "listening-session-synthesize");
