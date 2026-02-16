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
    type: "note" | "quote" | "reflection";
    content: string;
  }>;
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
      content: insight.content.trim().slice(0, 800),
    })),
    openQuestions: input.openQuestions.slice(0, 8).map((item) => item.trim().slice(0, 320)),
    quotes: input.quotes.slice(0, 8).map((quote) => ({
      text: quote.text.trim().slice(0, 500),
      source: quote.source?.trim().slice(0, 200),
    })),
    followUpQuestions: input.followUpQuestions.slice(0, 8).map((item) => item.trim().slice(0, 320)),
    contextExpansions: input.contextExpansions.slice(0, 6).map((item) => ({
      title: item.title.trim().slice(0, 140),
      content: item.content.trim().slice(0, 800),
    })),
  };
}
