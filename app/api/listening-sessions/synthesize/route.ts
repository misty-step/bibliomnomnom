import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { log, withObservability } from "@/lib/api/withObservability";
import { OpenRouterApiError, openRouterChatCompletion } from "@/lib/ai/openrouter";
import { requireListeningSessionEntitlement } from "@/lib/listening-sessions/entitlements";
import {
  clampArtifacts,
  EMPTY_SYNTHESIS_ARTIFACTS,
  normalizeArtifacts,
  type SynthesisArtifacts,
  type SynthesisContext,
} from "@/lib/listening-sessions/synthesis";
import { ALERT_THRESHOLDS } from "@/lib/listening-sessions/alert-thresholds";
import { estimateCostUsd, getUsageTokens } from "@/lib/listening-sessions/cost-estimation";
import { getListeningSynthesisConfig } from "@/lib/listening-sessions/synthesisConfig";
import { buildListeningSynthesisPrompt } from "@/lib/listening-sessions/synthesisPrompt";

type SynthesizeRequest = {
  transcript: string;
  bookId: Id<"books">;
  sessionId?: Id<"listeningSessions">;
};

const MAX_SYNTHESIS_TRANSCRIPT_CHARS = 50_000;

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

function makeFallbackArtifacts(transcript: string, context?: SynthesisContext): SynthesisArtifacts {
  const cleaned = transcript.replace(/\s+/g, " ").trim();
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const questionSentences = sentences.filter((sentence) => sentence.includes("?"));
  const quoted = Array.from(cleaned.matchAll(/["“”']([^"“”']{12,200})["“”']/g)).map(
    (match) => match[1] || "",
  );
  const contextHint = context?.book?.title
    ? `How does this connect to other ideas in "${context.book.title}"?`
    : "What idea from this session should you revisit next reading block?";

  return clampArtifacts({
    insights: sentences.slice(0, 3).map((content, index) => ({
      title: `Session insight ${index + 1}`,
      content,
    })),
    openQuestions: questionSentences.slice(0, 4),
    quotes: quoted.slice(0, 4).map((text) => ({ text })),
    followUpQuestions: [contextHint],
    contextExpansions:
      context?.book?.title && context.book.author
        ? [
            {
              title: `Context for ${context.book.title}`,
              content: `Compare this session with themes in other ${context.book.author} works and adjacent books in your reading list.`,
            },
          ]
        : [],
  });
}

function logSessionCostGuardrails(params: {
  sessionId?: Id<"listeningSessions">;
  estimatedCostUsd: number;
  model: string;
}) {
  const sessionId = params.sessionId ?? "unknown";

  if (params.estimatedCostUsd > ALERT_THRESHOLDS.SESSION_COST_HARD_CAP_USD) {
    log("error", "listening_session_cost_cap_exceeded", {
      sessionId,
      estimatedCostUsd: params.estimatedCostUsd,
      model: params.model,
      hardCapUsd: ALERT_THRESHOLDS.SESSION_COST_HARD_CAP_USD,
    });
  } else if (params.estimatedCostUsd > ALERT_THRESHOLDS.SESSION_COST_WARN_USD) {
    log("warn", "listening_session_cost_elevated", {
      sessionId,
      estimatedCostUsd: params.estimatedCostUsd,
      model: params.model,
      warnThresholdUsd: ALERT_THRESHOLDS.SESSION_COST_WARN_USD,
    });
  }
}

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
    await patchSynthesisTelemetry({
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

    logSessionCostGuardrails({
      sessionId: body.sessionId,
      estimatedCostUsd,
      model: config.model,
    });
    await patchSynthesisTelemetry({
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

    await patchSynthesisTelemetry({
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
