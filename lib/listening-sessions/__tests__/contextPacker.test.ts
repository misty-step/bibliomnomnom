import { describe, expect, it } from "vitest";
import type { SynthesisContext } from "@/lib/listening-sessions/synthesis";
import {
  packContext,
  type ContextPackBookInput,
  type ContextPackInput,
  type ContextPackLibraryBook,
  type ContextPackNoteInput,
} from "@/lib/listening-sessions/contextPacker";

const BASE_TIME = Date.UTC(2026, 0, 1);

function makeCurrentBook(overrides: Partial<ContextPackBookInput> = {}): ContextPackBookInput {
  return {
    id: "book-current",
    title: "Current Book",
    author: "Current Author",
    description: "Current description",
    privacy: "public",
    ...overrides,
  };
}

function makeLibraryBook(
  id: string,
  status: ContextPackLibraryBook["status"],
  overrides: Partial<ContextPackLibraryBook> = {},
): ContextPackLibraryBook {
  return {
    id,
    title: `Title ${id}`,
    author: `Author ${id}`,
    status,
    updatedAt: BASE_TIME,
    privacy: "public",
    ...overrides,
  };
}

function makeNote(id: string, overrides: Partial<ContextPackNoteInput> = {}): ContextPackNoteInput {
  return {
    id,
    bookId: "book-current",
    bookTitle: "Current Book",
    bookPrivacy: "public",
    type: "note",
    content: `note content ${id}`,
    updatedAt: BASE_TIME,
    ...overrides,
  };
}

function makeInput(overrides: Partial<ContextPackInput> = {}): ContextPackInput {
  return {
    currentBook: makeCurrentBook(),
    books: [],
    notes: [],
    ...overrides,
  };
}

describe("packContext", () => {
  it("enforces token budget and only includes budget-fitting notes", () => {
    const notes = [
      makeNote("n1", { content: "a".repeat(60), updatedAt: BASE_TIME + 3_000 }),
      makeNote("n2", { content: "b".repeat(60), updatedAt: BASE_TIME + 2_000 }),
      makeNote("n3", { content: "c".repeat(60), updatedAt: BASE_TIME + 1_000 }),
    ];

    const packed = packContext(makeInput({ notes }), {
      tokenBudget: 31,
      noteMaxChars: 60,
      bookDescMaxChars: 0,
    });

    expect(packed.summary.notesConsidered).toBe(3);
    expect(packed.summary.notesIncluded).toBeGreaterThan(0);
    expect(packed.summary.notesIncluded).toBeLessThan(3);
    expect(packed.summary.tokensUsed).toBeLessThanOrEqual(31);
  });

  it("prioritizes current-book notes before other books when budget is tight", () => {
    const sharedTime = BASE_TIME + 100_000;
    const notes = [
      makeNote("other", {
        bookId: "book-other",
        bookTitle: "Other Book",
        content: "z".repeat(48),
        updatedAt: sharedTime,
      }),
      makeNote("current", {
        bookId: "book-current",
        bookTitle: "Current Book",
        content: "y".repeat(48),
        updatedAt: sharedTime,
      }),
    ];

    const packed = packContext(makeInput({ notes }), {
      tokenBudget: 18,
      noteMaxChars: 60,
      bookDescMaxChars: 0,
    });

    expect(packed.recentNotes.length).toBeGreaterThan(0);
    expect(packed.recentNotes[0]?.bookTitle).toBe("Current Book");
  });

  it("applies diversity cap for non-current books", () => {
    const notes: ContextPackNoteInput[] = [];
    for (let i = 0; i < 8; i += 1) {
      notes.push(
        makeNote(`other-a-${i}`, {
          bookId: "book-a",
          bookTitle: "Book A",
          updatedAt: BASE_TIME + 10_000 - i,
        }),
      );
    }
    for (let i = 0; i < 4; i += 1) {
      notes.push(
        makeNote(`other-b-${i}`, {
          bookId: "book-b",
          bookTitle: "Book B",
          updatedAt: BASE_TIME + 9_000 - i,
        }),
      );
    }

    const packed = packContext(makeInput({ notes }), { tokenBudget: 2_000 });
    const countByBook = packed.recentNotes.reduce<Record<string, number>>((acc, note) => {
      acc[note.bookTitle] = (acc[note.bookTitle] ?? 0) + 1;
      return acc;
    }, {});

    expect(countByBook["Book A"] ?? 0).toBeLessThanOrEqual(3);
    expect(countByBook["Book B"] ?? 0).toBeLessThanOrEqual(3);
  });

  it("excludes current-book description when current book is private", () => {
    const packed = packContext(
      makeInput({
        currentBook: makeCurrentBook({
          privacy: "private",
          description: "Top-secret description",
        }),
      }),
      { tokenBudget: 2_000 },
    );

    expect(packed.book.description).toBeUndefined();
    expect(packed.summary.currentBook.descriptionIncluded).toBe(false);
    expect(packed.summary.currentBook.privacyRedacted).toBe(true);
    expect(packed.summary.privacyRedactions).toBe(1);
  });

  it("includes current-book description when current book is public", () => {
    const packed = packContext(
      makeInput({
        currentBook: makeCurrentBook({
          privacy: "public",
          description: "Publicly shareable description",
        }),
      }),
      { tokenBudget: 2_000 },
    );

    expect(packed.book.description).toBe("Publicly shareable description");
    expect(packed.summary.currentBook.descriptionIncluded).toBe(true);
    expect(packed.summary.currentBook.privacyRedacted).toBe(false);
    expect(packed.summary.privacyRedactions).toBe(0);
  });

  it("produces internally consistent summary counts", () => {
    const notes = [
      makeNote("n1", { updatedAt: BASE_TIME + 5_000 }),
      makeNote("n2", { updatedAt: BASE_TIME + 4_000 }),
      makeNote("n3", { updatedAt: BASE_TIME + 3_000 }),
      makeNote("n4", { updatedAt: BASE_TIME + 2_000 }),
    ];

    const packed = packContext(makeInput({ notes }), { tokenBudget: 25, bookDescMaxChars: 0 });

    expect(packed.summary.notesIncluded).toBeLessThanOrEqual(packed.summary.notesConsidered);
    expect(packed.summary.tokensUsed).toBeLessThanOrEqual(packed.summary.tokenBudget);
    expect(packed.summary.rankingStrategy).toBe("recency+currentBook+diversity");
  });

  it("is deterministic for identical inputs", () => {
    const notes = [
      makeNote("c", { bookId: "book-a", bookTitle: "Book A", updatedAt: BASE_TIME + 9_000 }),
      makeNote("a", { bookId: "book-a", bookTitle: "Book A", updatedAt: BASE_TIME + 9_000 }),
      makeNote("b", { bookId: "book-a", bookTitle: "Book A", updatedAt: BASE_TIME + 9_000 }),
    ];
    const input = makeInput({ notes });
    const options = { tokenBudget: 2_000 };

    const first = packContext(input, options);
    const second = packContext(input, options);

    expect(first).toEqual(second);

    const asSynthesisContext: SynthesisContext = first;
    expect(asSynthesisContext.book.title).toBe("Current Book");
  });

  it("handles empty books and notes", () => {
    const packed = packContext(
      makeInput({
        books: [],
        notes: [],
        currentBook: makeCurrentBook({ description: undefined }),
      }),
    );

    expect(packed.currentlyReading).toEqual([]);
    expect(packed.wantToRead).toEqual([]);
    expect(packed.read).toEqual([]);
    expect(packed.recentNotes).toEqual([]);
    expect(packed.summary.notesConsidered).toBe(0);
    expect(packed.summary.notesIncluded).toBe(0);
  });

  it("truncates very long notes to fit remaining budget instead of dropping entirely", () => {
    const longContent = "x".repeat(5_000);
    const packed = packContext(
      makeInput({
        currentBook: makeCurrentBook({ description: undefined }),
        notes: [makeNote("long", { content: longContent, updatedAt: BASE_TIME + 1_000 })],
      }),
      {
        tokenBudget: 20,
        noteMaxChars: 600,
        bookDescMaxChars: 0,
      },
    );

    expect(packed.recentNotes).toHaveLength(1);
    expect(packed.recentNotes[0]?.content.length).toBeLessThan(longContent.length);
    expect(packed.summary.tokensUsed).toBeLessThanOrEqual(20);
  });

  it("excludes notes from private non-current books", () => {
    const notes = [
      makeNote("private-other", {
        bookId: "book-other",
        bookTitle: "Private Other Book",
        bookPrivacy: "private",
        content: "sensitive note from private book",
        updatedAt: BASE_TIME + 1_000,
      }),
      makeNote("public-other", {
        bookId: "book-public",
        bookTitle: "Public Other Book",
        bookPrivacy: "public",
        content: "note from public book",
        updatedAt: BASE_TIME + 500,
      }),
      makeNote("current", {
        bookId: "book-current",
        bookTitle: "Current Book",
        bookPrivacy: "private",
        content: "note from current book (included even if private)",
        updatedAt: BASE_TIME,
      }),
    ];

    const packed = packContext(makeInput({ notes }), { tokenBudget: 2_000 });

    const bookTitles = packed.recentNotes.map((n) => n.bookTitle);
    expect(bookTitles).not.toContain("Private Other Book");
    expect(bookTitles).toContain("Public Other Book");
    expect(bookTitles).toContain("Current Book");
    expect(packed.summary.privacyRedactions).toBeGreaterThanOrEqual(1);
  });

  it("excludes private library books from AI context", () => {
    const books: ContextPackLibraryBook[] = [
      makeLibraryBook("pub", "currently-reading", { privacy: "public" }),
      makeLibraryBook("priv", "currently-reading", { privacy: "private" }),
    ];

    const packed = packContext(makeInput({ books }), { tokenBudget: 2_000 });

    const titles = packed.currentlyReading.map((b) => b.title);
    expect(titles).toContain("Title pub");
    expect(titles).not.toContain("Title priv");
    expect(packed.summary.privacyRedactions).toBeGreaterThanOrEqual(1);
  });

  it("accounts for current book title and author tokens in budget", () => {
    // "AAAAAAAAAAAAAAA BBBBBBBBBBBBBBB" = 31 chars = ceil(31/4) = 8 tokens for title+author
    const packed = packContext(
      makeInput({
        currentBook: makeCurrentBook({
          title: "AAAAAAAAAAAAAAA", // 15 chars
          author: "BBBBBBBBBBBBBBB", // 15 chars
          description: "some description", // 16 chars = 4 tokens
          privacy: "public",
        }),
        books: [],
        notes: [],
      }),
      { tokenBudget: 8, bookDescMaxChars: 2_000 },
    );

    // title+author exhaust the full 8-token budget; description must be excluded
    expect(packed.summary.currentBook.descriptionIncluded).toBe(false);
    expect(packed.summary.tokensUsed).toBeLessThanOrEqual(8);
  });

  it("reduces oversized book lists to fit budget", () => {
    const books: ContextPackLibraryBook[] = [];
    for (let i = 0; i < 60; i += 1) {
      books.push(makeLibraryBook(`cr-${i}`, "currently-reading", { title: `CR${i}`, author: "A" }));
      books.push(makeLibraryBook(`wtr-${i}`, "want-to-read", { title: `WTR${i}`, author: "A" }));
      books.push(makeLibraryBook(`read-${i}`, "read", { title: `R${i}`, author: "A" }));
    }

    const packed = packContext(
      makeInput({
        currentBook: makeCurrentBook({ description: undefined }),
        books,
      }),
      { tokenBudget: 45, bookDescMaxChars: 0 },
    );

    const totalIncludedBooks =
      packed.currentlyReading.length + packed.wantToRead.length + packed.read.length;

    expect(totalIncludedBooks).toBeGreaterThan(0);
    expect(totalIncludedBooks).toBeLessThan(books.length);
    expect(packed.summary.tokensUsed).toBeLessThanOrEqual(45);
    expect(packed.summary.booksIncluded.currentlyReading).toBe(packed.currentlyReading.length);
    expect(packed.summary.booksIncluded.wantToRead).toBe(packed.wantToRead.length);
    expect(packed.summary.booksIncluded.read).toBe(packed.read.length);
  });

  it("handles zero token budget gracefully (title+author always counted)", () => {
    const packed = packContext(
      makeInput({
        currentBook: makeCurrentBook({ description: "should be excluded" }),
        books: [makeLibraryBook("b1", "read")],
        notes: [makeNote("n1", { updatedAt: BASE_TIME + 1_000 })],
      }),
      { tokenBudget: 0 },
    );

    // tokensUsed includes title+author which exceeds zero budget
    expect(packed.summary.tokenBudget).toBe(0);
    expect(packed.book.description).toBeUndefined();
    expect(packed.currentlyReading).toEqual([]);
    expect(packed.wantToRead).toEqual([]);
    expect(packed.read).toEqual([]);
    expect(packed.recentNotes).toEqual([]);
  });

  it("skips notes with whitespace-only content", () => {
    const notes = [
      makeNote("ws", { content: "   \n\t  ", updatedAt: BASE_TIME + 1_000 }),
      makeNote("real", { content: "actual content", updatedAt: BASE_TIME }),
    ];

    const packed = packContext(makeInput({ notes }), { tokenBudget: 2_000 });

    // Whitespace-only note normalizes to empty string, gets skipped
    expect(packed.recentNotes).toHaveLength(1);
    expect(packed.recentNotes[0]?.content).toBe("actual content");
  });

  it("includes current-book notes even when current book is private", () => {
    const notes = [
      makeNote("mine", {
        bookId: "book-current",
        bookTitle: "Current Book",
        bookPrivacy: "private",
        content: "my private note",
        updatedAt: BASE_TIME + 1_000,
      }),
      makeNote("other-private", {
        bookId: "book-other",
        bookTitle: "Other Private",
        bookPrivacy: "private",
        content: "excluded",
        updatedAt: BASE_TIME,
      }),
    ];

    const packed = packContext(
      makeInput({
        currentBook: makeCurrentBook({ privacy: "private" }),
        notes,
      }),
      { tokenBudget: 2_000 },
    );

    expect(packed.recentNotes).toHaveLength(1);
    expect(packed.recentNotes[0]?.bookTitle).toBe("Current Book");
  });
});
