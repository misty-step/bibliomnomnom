/**
 * Shared OpenRouter JSON schema for listening session synthesis.
 *
 * Used by both the API route (synthesize/route.ts) and the background worker
 * (processListeningSession.ts). Extracted to prevent silent divergence — when
 * the artifact structure evolves, changes propagate to both code paths.
 */

/** Maximum transcript characters sent to the LLM for synthesis. */
export const MAX_SYNTHESIS_TRANSCRIPT_CHARS = 50_000;

/**
 * OpenRouter `response_format.json_schema` for synthesis artifacts.
 * Both the Next.js API route and the Convex background worker use this
 * identical schema to produce listening session artifacts.
 */
export const SYNTHESIS_RESPONSE_SCHEMA = {
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
