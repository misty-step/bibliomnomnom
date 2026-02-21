import { describe, expect, it } from "vitest";

import { toCSV, toJSON, toMarkdown, type ExportData } from "@/lib/export";
import { fakeBookId, fakeNoteId, makeBook, makeNote } from "./fixtures";

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

describe("export edge cases", () => {
  const emptyData: ExportData = {
    version: "1.0",
    exportedAt: Date.UTC(2026, 0, 1),
    books: [],
    notes: [],
  };

  it("toJSON handles empty library", () => {
    const parsed = JSON.parse(toJSON(emptyData)) as ExportData;
    expect(parsed.books).toHaveLength(0);
    expect(parsed.notes).toHaveLength(0);
  });

  it("toCSV produces header-only output for empty library", () => {
    const output = toCSV(emptyData);
    const lines = output.split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Title,Author");
  });

  it("toMarkdown produces header-only output for empty library", () => {
    const output = toMarkdown(emptyData);
    expect(output).toContain("# My Library");
    expect(output).not.toContain("##");
  });

  it("toCSV escapes double quotes in title and author", () => {
    const data: ExportData = {
      ...emptyData,
      books: [makeBook({ title: "O'Brien's \"Finest\" Hour", author: 'She Said, "Run!"' })],
    };
    const output = toCSV(data);
    const [, row] = output.split("\n");

    // RFC 4180: double quotes inside quoted fields become ""
    expect(row).toContain('"O\'Brien\'s ""Finest"" Hour"');
    expect(row).toContain('"She Said, ""Run!"""');
  });

  it("toCSV wraps fields with commas in double quotes", () => {
    const data: ExportData = {
      ...emptyData,
      books: [makeBook({ title: "East of Eden, West of Nothing", author: "Steinbeck, John" })],
    };
    const output = toCSV(data);
    const [, row] = output.split("\n");

    // Commas in values are safe inside double-quoted fields
    expect(row).toContain('"East of Eden, West of Nothing"');
    expect(row).toContain('"Steinbeck, John"');
  });

  it("toMarkdown omits Notes section for books without notes", () => {
    const data: ExportData = {
      ...emptyData,
      books: [makeBook({ status: "read", title: "Solo Book" })],
    };
    const output = toMarkdown(data);
    expect(output).toContain("### Solo Book");
    expect(output).not.toContain("**Notes:**");
  });

  it("toMarkdown renders reflection notes as plain text (same as notes)", () => {
    const book = makeBook({ _id: fakeBookId("b_refl"), status: "read", title: "Reflective" });
    const data: ExportData = {
      ...emptyData,
      books: [book],
      notes: [makeNote({ bookId: book._id, type: "reflection", content: "Deep thought" })],
    };
    const output = toMarkdown(data);
    expect(output).toContain("- Deep thought");
  });
});
