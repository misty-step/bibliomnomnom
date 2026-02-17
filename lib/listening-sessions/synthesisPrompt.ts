import type { SynthesisContext } from "@/lib/listening-sessions/synthesis";

function formatBookList(
  label: string,
  books: Array<{ title: string; author: string }>,
  maxItems: number,
): string[] {
  const trimmed = books.slice(0, maxItems);
  if (trimmed.length === 0) return [];
  return [
    `${label}:`,
    ...trimmed.map((book) => `- ${book.title}${book.author ? ` (${book.author})` : ""}`),
    "",
  ];
}

function formatRecentNotes(context: SynthesisContext, maxNotes: number): string[] {
  const notes = context.recentNotes.slice(0, maxNotes);
  if (notes.length === 0) return [];

  return [
    "Recent notes (latest first, truncated):",
    ...notes.map((note) => `- [${note.bookTitle}] (${note.type}) ${note.content}`),
    "",
  ];
}

export function buildListeningSynthesisPrompt(params: {
  transcript: string;
  context?: SynthesisContext;
}): string {
  const lines: string[] = [
    "You are a reading companion. Turn a messy spoken transcript into high-signal reading notes.",
    "",
    "Rules:",
    "- Ground every artifact in the transcript and the provided context.",
    "- Do not invent quotes or facts. If unsure, phrase as a hypothesis.",
    "- Prefer fewer, better artifacts: max 6 insights, 6 open questions, 6 follow-ups, 4 context expansions, 6 quotes.",
    "- Titles must be specific (avoid 'Session insight 1', 'Interesting point', etc).",
    "- Avoid plot summary unless the reader explicitly recaps plot.",
    "- Quotes: only include verbatim text that appears in the transcript. If paraphrased, do not include as a quote.",
    "- Context expansions: keep them useful and safe; suggest what to look up rather than asserting shaky details.",
    "",
    "Output:",
    "- Return ONLY JSON matching the schema (no markdown fences).",
    "",
  ];

  if (params.context) {
    const context = params.context;
    lines.push("Reading context:", "");
    lines.push(
      `Book: ${context.book.title}${context.book.author ? ` (${context.book.author})` : ""}`,
    );
    if (context.book.description) {
      lines.push(`Description: ${context.book.description}`);
    }
    lines.push("");
    lines.push(...formatBookList("Currently reading", context.currentlyReading, 10));
    lines.push(...formatBookList("Want to read", context.wantToRead, 10));
    lines.push(...formatBookList("Read", context.read, 15));
    lines.push(...formatRecentNotes(context, 12));
  }

  lines.push("Transcript:", params.transcript.trim());
  return lines.join("\n").trim();
}
