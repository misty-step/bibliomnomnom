export type InsightArtifact = {
  title: string;
  content: string;
};

export type QuoteArtifact = {
  text: string;
  source?: string;
};

export type ContextExpansionArtifact = {
  title: string;
  content: string;
};

export type SynthesisArtifacts = {
  insights: InsightArtifact[];
  openQuestions: string[];
  quotes: QuoteArtifact[];
  followUpQuestions: string[];
  contextExpansions: ContextExpansionArtifact[];
};

export type SynthesisContext = {
  book: {
    title: string;
    author: string;
    description?: string;
  };
  currentlyReading: Array<{ title: string; author: string }>;
  wantToRead: Array<{ title: string; author: string }>;
  read: Array<{ title: string; author: string }>;
  recentNotes: Array<{
    bookTitle: string;
    type: "note" | "quote";
    content: string;
  }>;
  /** Deterministic summary of what was included in this context pack (for debugging). */
  packSummary?: import("./contextPacker").ContextPackSummary;
};

export const EMPTY_SYNTHESIS_ARTIFACTS: SynthesisArtifacts = {
  insights: [],
  openQuestions: [],
  quotes: [],
  followUpQuestions: [],
  contextExpansions: [],
};

export function clampArtifacts(input: SynthesisArtifacts): SynthesisArtifacts {
  return {
    insights: input.insights.slice(0, 8).map((insight) => ({
      title: insight.title.trim().slice(0, 140),
      content: insight.content.trim().slice(0, 1200),
    })),
    openQuestions: input.openQuestions.slice(0, 8).map((item) => item.trim().slice(0, 320)),
    quotes: input.quotes.slice(0, 8).map((quote) => ({
      text: quote.text.trim().slice(0, 500),
      source: quote.source?.trim().slice(0, 200),
    })),
    followUpQuestions: input.followUpQuestions.slice(0, 8).map((item) => item.trim().slice(0, 320)),
    contextExpansions: input.contextExpansions.slice(0, 6).map((item) => ({
      title: item.title.trim().slice(0, 140),
      content: item.content.trim().slice(0, 1200),
    })),
  };
}

export function normalizeArtifacts(raw: unknown): SynthesisArtifacts {
  if (!raw || typeof raw !== "object") return EMPTY_SYNTHESIS_ARTIFACTS;
  const candidate = raw as Partial<SynthesisArtifacts>;

  const toStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

  const mapArray = <T>(value: unknown, mapper: (item: unknown) => T | null): T[] => {
    if (!Array.isArray(value)) return [];
    const out: T[] = [];
    for (const item of value) {
      const mapped = mapper(item);
      if (mapped) out.push(mapped);
    }
    return out;
  };

  const insights = mapArray(candidate.insights, (item) => {
    if (!item || typeof item !== "object") return null;
    const { title, content } = item as { title?: string; content?: string };
    if (typeof title !== "string" || typeof content !== "string") return null;
    return { title, content };
  });

  const quotes = mapArray(candidate.quotes, (item) => {
    if (!item || typeof item !== "object") return null;
    const { text, source } = item as { text?: string; source?: string };
    if (typeof text !== "string") return null;
    return { text, source: typeof source === "string" ? source : undefined };
  });

  const contextExpansions = mapArray(candidate.contextExpansions, (item) => {
    if (!item || typeof item !== "object") return null;
    const { title, content } = item as { title?: string; content?: string };
    if (typeof title !== "string" || typeof content !== "string") return null;
    return { title, content };
  });

  return clampArtifacts({
    insights,
    openQuestions: toStringArray(candidate.openQuestions),
    quotes,
    followUpQuestions: toStringArray(candidate.followUpQuestions),
    contextExpansions,
  });
}
