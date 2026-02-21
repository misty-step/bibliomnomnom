/**
 * Fallback artifact generation when LLM synthesis is unavailable.
 *
 * Used when OpenRouter API key is missing or synthesis fails. Extracts
 * basic structure from the transcript using regex heuristics rather
 * than LLM inference.
 */

import { clampArtifacts, type SynthesisArtifacts, type SynthesisContext } from "./synthesis";

export function makeFallbackArtifacts(
  transcript: string,
  context?: SynthesisContext,
): SynthesisArtifacts {
  const cleaned = transcript.replace(/\s+/g, " ").trim();
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const questionSentences = sentences.filter((sentence) => sentence.includes("?"));
  const quoted = Array.from(cleaned.matchAll(/["""']([^"""']{12,200})["""']/g)).map(
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
