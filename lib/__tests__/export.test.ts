import { describe, expect, it } from "vitest";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import { toCSV, toJSON, toMarkdown, type ExportData } from "@/lib/export";

const fakeBookId = (id: string): Id<"books"> => id as Id<"books">;
const fakeUserId = (id: string): Id<"users"> => id as Id<"users">;
const fakeNoteId = (id: string): Id<"notes"> => id as Id<"notes">;

const makeBook = (overrides: Partial<Doc<"books">> = {}): Doc<"books"> => ({
  _id: fakeBookId("book_1"),
  _creationTime: 0,
  userId: fakeUserId("user_1"),
  title: "Dune",
  author: "Frank Herbert",
  description: undefined,
  isbn: undefined,
  edition: undefined,
  publishedYear: undefined,
  pageCount: undefined,
  status: "want-to-read",
  isFavorite: false,
  isAudiobook: false,
  privacy: "private",
  timesRead: 0,
  dateStarted: undefined,
  dateFinished: undefined,
  coverUrl: undefined,
  apiCoverUrl: undefined,
  apiId: undefined,
  apiSource: undefined,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const makeNote = (overrides: Partial<Doc<"notes">> = {}): Doc<"notes"> => ({
  _id: fakeNoteId("note_1"),
  _creationTime: 0,
  bookId: fakeBookId("book_1"),
  userId: fakeUserId("user_1"),
  type: "note",
  content: "A note",
  page: undefined,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const sampleExportData = (): ExportData => {
  const currentlyReading = makeBook({
    _id: fakeBookId("book_reading"),
    title: "Dune",
    author: "Frank Herbert",
    status: "currently-reading",
    createdAt: Date.UTC(2024, 0, 5, 12),
  });

  const readBook = makeBook({
    _id: fakeBookId("book_read"),
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    status: "read",
    isFavorite: true,
    dateFinished: Date.UTC(2024, 1, 12, 12),
    createdAt: Date.UTC(2023, 11, 31, 12),
  });

  const wantToRead = makeBook({
    _id: fakeBookId("book_queue"),
    title: "Neuromancer",
    author: "William Gibson",
    status: "want-to-read",
    createdAt: Date.UTC(2024, 2, 1, 12),
  });

  return {
    version: "1.0",
    exportedAt: Date.UTC(2026, 0, 2, 12),
    books: [currentlyReading, readBook, wantToRead],
    notes: [
      makeNote({
        _id: fakeNoteId("note_quote"),
        bookId: readBook._id,
        type: "quote",
        content: "In a hole in the ground there lived a hobbit.",
      }),
      makeNote({
        _id: fakeNoteId("note_plain"),
        bookId: readBook._id,
        type: "note",
        content: "A comfort reread.",
      }),
    ],
  };
};

describe("export helpers", () => {
  it("toJSON returns parseable JSON with expected structure", () => {
    const data = sampleExportData();
    const output = toJSON(data);
    const parsed = JSON.parse(output) as ExportData;

    expect(parsed.version).toBe("1.0");
    expect(parsed.books).toHaveLength(3);
    expect(parsed.notes).toHaveLength(2);
    expect(parsed.exportedAt).toBe(data.exportedAt);
  });

  it("toCSV returns Goodreads-compatible headers and rows", () => {
    const data = sampleExportData();
    const output = toCSV(data);
    const [header, ...rows] = output.split("\n");

    expect(header).toBe("Title,Author,ISBN,My Rating,Date Read,Date Added,Bookshelves,My Review");
    expect(rows).toHaveLength(3);

    expect(rows[0]).toContain('"Dune"');
    expect(rows[0]).toContain(",currently-reading,");

    expect(rows[1]).toContain('"The Hobbit"');
    expect(rows[1]).toContain(",5,2024-02-12,");
    expect(rows[1]).toContain(",read,");

    expect(rows[2]).toContain('"Neuromancer"');
    expect(rows[2]).toContain(",to-read,");
  });

  it("toMarkdown renders status sections and notes", () => {
    const data = sampleExportData();
    const output = toMarkdown(data);

    expect(output).toContain("# My Library");
    expect(output).toContain("## Currently Reading");
    expect(output).toContain("## Read");
    expect(output).toContain("## Want to Read");
    expect(output).toContain("### The Hobbit");
    expect(output).toContain("**Notes:**");
    expect(output).toContain("- > In a hole in the ground there lived a hobbit.");
    expect(output).toContain("- A comfort reread.");
  });
});
