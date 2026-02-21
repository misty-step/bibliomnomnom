import type { SynthesisContext } from "@/lib/listening-sessions/synthesis";

export type ContextPackBookInput = {
  id: string;
  title: string;
  author: string;
  description?: string;
  privacy: "public" | "private";
};

export type ContextPackNoteInput = {
  id: string;
  bookId: string;
  bookTitle: string;
  type: "note" | "quote";
  content: string;
  updatedAt: number;
};

export type ContextPackLibraryBook = {
  id: string;
  title: string;
  author: string;
  status: "currently-reading" | "want-to-read" | "read";
  updatedAt: number;
  privacy: "public" | "private";
};

export type ContextPackInput = {
  currentBook: ContextPackBookInput;
  books: ContextPackLibraryBook[];
  notes: ContextPackNoteInput[];
};

export type ContextPackOptions = {
  tokenBudget?: number;
  maxNotesFromCurrentBook?: number;
  maxNotesPerOtherBook?: number;
  noteMaxChars?: number;
  bookDescMaxChars?: number;
};

export type ContextPackSummary = {
  tokenBudget: number;
  tokensUsed: number;
  currentBook: {
    title: string;
    author: string;
    descriptionIncluded: boolean;
    privacyRedacted: boolean;
  };
  booksIncluded: {
    currentlyReading: number;
    wantToRead: number;
    read: number;
  };
  notesConsidered: number;
  notesIncluded: number;
  privacyRedactions: number;
  rankingStrategy: "recency+currentBook+diversity";
};

export type ContextPack = SynthesisContext & {
  summary: ContextPackSummary;
};

const DEFAULT_OPTIONS: Required<ContextPackOptions> = {
  tokenBudget: 4_000,
  maxNotesFromCurrentBook: 6,
  maxNotesPerOtherBook: 3,
  noteMaxChars: 600,
  bookDescMaxChars: 800,
};

const BOOK_STATUS_ORDER: Array<ContextPackLibraryBook["status"]> = [
  "currently-reading",
  "want-to-read",
  "read",
];

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function normalizeText(input: string | undefined): string {
  if (!input) return "";
  return input.replace(/\s+/g, " ").trim();
}

function truncateChars(input: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  if (input.length <= maxChars) return input;
  if (maxChars <= 3) return input.slice(0, maxChars);
  return `${input.slice(0, maxChars - 3)}...`;
}

function toNonNegativeInt(input: number | undefined, fallback: number): number {
  if (input === undefined) return fallback;
  if (!Number.isFinite(input)) return fallback;
  return Math.max(0, Math.floor(input));
}

function compareByUpdatedAtDescThenIdAsc(
  a: { updatedAt: number; id: string },
  b: { updatedAt: number; id: string },
): number {
  if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
  return a.id.localeCompare(b.id);
}

function estimateBookItemTokens(book: { title: string; author: string }): number {
  return estimateTokens(`${book.title} ${book.author}`.trim());
}

function formatNoteForTokenEstimate(note: {
  bookTitle: string;
  type: "note" | "quote";
  content: string;
}): string {
  return `[${note.bookTitle}] (${note.type}) ${note.content}`;
}

function fitNoteContentToBudget(
  note: { bookTitle: string; type: "note" | "quote"; content: string },
  remainingTokens: number,
): string | null {
  if (remainingTokens <= 0) return null;
  const prefix = `[${note.bookTitle}] (${note.type}) `;
  if (estimateTokens(prefix) > remainingTokens) return null;

  const maxCharsByRemainingBudget = Math.max(1, remainingTokens * 4 - prefix.length);
  const absoluteMaxChars = Math.min(note.content.length, maxCharsByRemainingBudget);

  for (let chars = absoluteMaxChars; chars >= 1; chars -= 1) {
    const candidateContent = truncateChars(note.content, chars);
    if (!candidateContent) continue;
    const candidateTokens = estimateTokens(
      formatNoteForTokenEstimate({
        bookTitle: note.bookTitle,
        type: note.type,
        content: candidateContent,
      }),
    );
    if (candidateTokens <= remainingTokens) return candidateContent;
  }

  return null;
}

/**
 * Packs synthesis context using deterministic ranking:
 * 1) Score each note with `recencyScore + currentBookBonus` where recencyScore is normalized to [0, 1]
 *    across all notes and currentBookBonus is +0.5 for notes from the current book.
 * 2) Sort notes by score DESC, then updatedAt DESC, then id ASC for deterministic output.
 * 3) Enforce diversity caps per book (current vs non-current limits).
 * 4) Truncate note content to `noteMaxChars` before token estimation and truncate further to fit budget.
 */
export function packContext(
  input: ContextPackInput,
  options: ContextPackOptions = {},
): ContextPack {
  const tokenBudget = toNonNegativeInt(options.tokenBudget, DEFAULT_OPTIONS.tokenBudget);
  const maxNotesFromCurrentBook = toNonNegativeInt(
    options.maxNotesFromCurrentBook,
    DEFAULT_OPTIONS.maxNotesFromCurrentBook,
  );
  const maxNotesPerOtherBook = toNonNegativeInt(
    options.maxNotesPerOtherBook,
    DEFAULT_OPTIONS.maxNotesPerOtherBook,
  );
  const noteMaxChars = toNonNegativeInt(options.noteMaxChars, DEFAULT_OPTIONS.noteMaxChars);
  const bookDescMaxChars = toNonNegativeInt(
    options.bookDescMaxChars,
    DEFAULT_OPTIONS.bookDescMaxChars,
  );

  let tokensUsed = 0;
  let privacyRedactions = 0;

  const currentBookTitle = normalizeText(input.currentBook.title);
  const currentBookAuthor = normalizeText(input.currentBook.author);

  let currentBookDescription: string | undefined;
  let descriptionIncluded = false;
  let privacyRedacted = false;

  const normalizedCurrentBookDescription = truncateChars(
    normalizeText(input.currentBook.description),
    bookDescMaxChars,
  );

  if (input.currentBook.privacy === "private") {
    privacyRedacted = normalizedCurrentBookDescription.length > 0;
    if (privacyRedacted) privacyRedactions += 1;
  } else if (normalizedCurrentBookDescription) {
    const descTokens = estimateTokens(normalizedCurrentBookDescription);
    if (tokensUsed + descTokens <= tokenBudget) {
      currentBookDescription = normalizedCurrentBookDescription;
      descriptionIncluded = true;
      tokensUsed += descTokens;
    }
  }

  const booksByStatus: Record<ContextPackLibraryBook["status"], ContextPackLibraryBook[]> = {
    "currently-reading": [],
    "want-to-read": [],
    read: [],
  };

  const sortedBooks = [...input.books].sort(compareByUpdatedAtDescThenIdAsc);
  for (const book of sortedBooks) {
    booksByStatus[book.status].push(book);
  }

  const currentlyReading: Array<{ title: string; author: string }> = [];
  const wantToRead: Array<{ title: string; author: string }> = [];
  const read: Array<{ title: string; author: string }> = [];

  const listByStatus: Record<
    ContextPackLibraryBook["status"],
    Array<{ title: string; author: string }>
  > = {
    "currently-reading": currentlyReading,
    "want-to-read": wantToRead,
    read,
  };

  for (const status of BOOK_STATUS_ORDER) {
    for (const book of booksByStatus[status]) {
      const title = normalizeText(book.title);
      const author = normalizeText(book.author);
      const tokensForBook = estimateBookItemTokens({ title, author });
      if (tokensForBook === 0) continue;
      if (tokensUsed + tokensForBook > tokenBudget) continue;
      listByStatus[status].push({ title, author });
      tokensUsed += tokensForBook;
    }
  }

  const notesConsidered = input.notes.length;
  const recentNotes: Array<{ bookTitle: string; type: "note" | "quote"; content: string }> = [];

  if (input.notes.length > 0) {
    const updatedValues = input.notes.map((note) => note.updatedAt);
    const minUpdatedAt = Math.min(...updatedValues);
    const maxUpdatedAt = Math.max(...updatedValues);
    const recencyRange = maxUpdatedAt - minUpdatedAt;

    const rankedNotes = input.notes
      .map((note) => {
        const normalizedContent = truncateChars(normalizeText(note.content), noteMaxChars);
        const recencyScore = recencyRange > 0 ? (note.updatedAt - minUpdatedAt) / recencyRange : 1;
        const currentBookBonus = note.bookId === input.currentBook.id ? 0.5 : 0;

        return {
          ...note,
          bookTitle: normalizeText(note.bookTitle),
          content: normalizedContent,
          score: recencyScore + currentBookBonus,
        };
      })
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
        return a.id.localeCompare(b.id);
      });

    const notesPerBook = new Map<string, number>();

    for (const note of rankedNotes) {
      if (note.content.length === 0) continue;

      const bookCount = notesPerBook.get(note.bookId) ?? 0;
      const isCurrentBookNote = note.bookId === input.currentBook.id;
      const limit = isCurrentBookNote ? maxNotesFromCurrentBook : maxNotesPerOtherBook;
      if (bookCount >= limit) continue;

      const remainingTokens = tokenBudget - tokensUsed;
      if (remainingTokens <= 0) break;

      const fittedContent = fitNoteContentToBudget(
        { bookTitle: note.bookTitle, type: note.type, content: note.content },
        remainingTokens,
      );
      if (!fittedContent) continue;

      const fittedNote = {
        bookTitle: note.bookTitle,
        type: note.type,
        content: fittedContent,
      } as const;
      const noteTokens = estimateTokens(formatNoteForTokenEstimate(fittedNote));
      if (tokensUsed + noteTokens > tokenBudget) continue;

      recentNotes.push(fittedNote);
      tokensUsed += noteTokens;
      notesPerBook.set(note.bookId, bookCount + 1);
    }
  }

  return {
    book: {
      title: currentBookTitle,
      author: currentBookAuthor,
      description: currentBookDescription,
    },
    currentlyReading,
    wantToRead,
    read,
    recentNotes,
    summary: {
      tokenBudget,
      tokensUsed,
      currentBook: {
        title: currentBookTitle,
        author: currentBookAuthor,
        descriptionIncluded,
        privacyRedacted,
      },
      booksIncluded: {
        currentlyReading: currentlyReading.length,
        wantToRead: wantToRead.length,
        read: read.length,
      },
      notesConsidered,
      notesIncluded: recentNotes.length,
      privacyRedactions,
      rankingStrategy: "recency+currentBook+diversity",
    },
  };
}
