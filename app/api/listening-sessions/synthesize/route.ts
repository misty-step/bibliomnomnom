import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { log, withObservability } from "@/lib/api/withObservability";
import { OpenRouterApiError, openRouterChatCompletion } from "@/lib/ai/openrouter";
import {
  clampArtifacts,
  EMPTY_SYNTHESIS_ARTIFACTS,
  type SynthesisArtifacts,
  type SynthesisContext,
} from "@/lib/listening-sessions/synthesis";
import { getListeningSynthesisConfig } from "@/lib/listening-sessions/synthesisConfig";
import { buildListeningSynthesisPrompt } from "@/lib/listening-sessions/synthesisPrompt";

type SynthesizeRequest = {
  transcript: string;
  context?: SynthesisContext;
};

const RESPONSE_SCHEMA = {
  name: "listening_session_artifacts",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      insights: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            content: { type: "string" },
          },
          required: ["title", "content"],
        },
      },
      openQuestions: {
        type: "array",
        items: { type: "string" },
      },
      quotes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            source: { type: "string" },
          },
          required: ["text"],
        },
      },
      followUpQuestions: {
        type: "array",
        items: { type: "string" },
      },
      contextExpansions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            content: { type: "string" },
          },
          required: ["title", "content"],
        },
      },
    },
    required: ["insights", "openQuestions", "quotes", "followUpQuestions", "contextExpansions"],
  },
} as const;

function normalizeArtifacts(raw: unknown): SynthesisArtifacts {
  if (!raw || typeof raw !== "object") return EMPTY_SYNTHESIS_ARTIFACTS;
  const candidate = raw as Partial<SynthesisArtifacts>;

  const insights = Array.isArray(candidate.insights)
    ? candidate.insights
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const { title, content } = item as { title?: string; content?: string };
          if (typeof title !== "string" || typeof content !== "string") return null;
          return { title, content };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  const toStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

  const quotes = Array.isArray(candidate.quotes)
    ? candidate.quotes
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const { text, source } = item as { text?: string; source?: string };
          if (typeof text !== "string") return null;
          return { text, source: typeof source === "string" ? source : undefined };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  const contextExpansions = Array.isArray(candidate.contextExpansions)
    ? candidate.contextExpansions
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const { title, content } = item as { title?: string; content?: string };
          if (typeof title !== "string" || typeof content !== "string") return null;
          return { title, content };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  return clampArtifacts({
    insights,
    openQuestions: toStringArray(candidate.openQuestions),
    quotes,
    followUpQuestions: toStringArray(candidate.followUpQuestions),
    contextExpansions,
  });
}

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

export const POST = withObservability(async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Please sign in to synthesize notes." },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  let body: SynthesizeRequest;
  try {
    const parsed = (await request.json()) as Partial<SynthesizeRequest>;
    if (!parsed.transcript || typeof parsed.transcript !== "string") {
      return NextResponse.json(
        { error: "transcript is required." },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
    body = {
      transcript: parsed.transcript.trim(),
      context:
        parsed.context && typeof parsed.context === "object"
          ? (parsed.context as SynthesisContext)
          : undefined,
    };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  if (!body.transcript) {
    return NextResponse.json(
      { artifacts: EMPTY_SYNTHESIS_ARTIFACTS, source: "empty-transcript" },
      { headers: { "x-request-id": requestId } },
    );
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!openRouterApiKey) {
    return NextResponse.json(
      { artifacts: makeFallbackArtifacts(body.transcript, body.context), source: "fallback" },
      { headers: { "x-request-id": requestId } },
    );
  }

  const config = getListeningSynthesisConfig();
  try {
    const { content } = await openRouterChatCompletion({
      apiKey: openRouterApiKey,
      timeoutMs: 60_000,
      referer: process.env.NEXT_PUBLIC_APP_URL || "https://bibliomnomnom.app",
      title: "bibliomnomnom-listening-session",
      request: {
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        top_p: config.topP,
        seed: config.seed,
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
              transcript: body.transcript,
              context: body.context,
            }),
          },
        ],
      },
    });

    const parsed = JSON.parse(content) as unknown;
    const artifacts = normalizeArtifacts(parsed);
    log("info", "listening_session_synthesized", {
      requestId,
      userIdSuffix: userId.slice(-6),
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      insightCount: artifacts.insights.length,
      quoteCount: artifacts.quotes.length,
    });
    return NextResponse.json(
      { artifacts, source: "openrouter", model: config.model },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    const isRateLimited = error instanceof OpenRouterApiError && error.status === 429;
    const fallback = makeFallbackArtifacts(body.transcript, body.context);
    log(isRateLimited ? "warn" : "error", "listening_session_synthesis_fallback", {
      requestId,
      userIdSuffix: userId.slice(-6),
      model: config.model,
      error: error instanceof Error ? error.message : String(error),
      isRateLimited,
    });
    return NextResponse.json(
      { artifacts: fallback, source: "fallback" },
      { headers: { "x-request-id": requestId } },
    );
  }
}, "listening-session-synthesize");
