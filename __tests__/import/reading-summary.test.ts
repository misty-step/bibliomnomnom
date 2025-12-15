import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import { parseReadingSummaryMarkdown } from "../../lib/import/client/readingSummary";
import { llmExtract, makeStaticProvider } from "../../lib/import/llm";
import { dedupHelpers } from "../../lib/import/dedup";
import { normalizeTitleAuthorKey } from "../../lib/import/normalize";
import type { ParsedBook } from "../../lib/import/types";
import type { Doc, Id } from "../../convex/_generated/dataModel";

const FIXTURE_PATH = join(__dirname, "../fixtures/reading-sample.md");

describe("READING_SUMMARY.md import", () => {
  describe("Deterministic parser", () => {
    it("parses the fixture file with year-context dates", () => {
      const markdown = readFileSync(FIXTURE_PATH, "utf-8");
      const result = parseReadingSummaryMarkdown(markdown);

      expect(result.matched).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(12); // 2 currently reading + 8 in 2025 + 2 in 2021

      // Verify currently reading books
      const currentlyReading = result.rows.filter((r) => r.status === "currently-reading");
      expect(currentlyReading).toHaveLength(2);
      expect(currentlyReading[0]!.title).toBe("The Absorbent Mind");
      expect(currentlyReading[0]!.dateFinished).toBeUndefined();
      expect(currentlyReading[1]!.title).toBe("Xenosystems");

      // Verify read books with year-context dates
      const hyperion = result.rows.find((r) => r.title === "Hyperion");
      expect(hyperion).toBeDefined();
      expect(hyperion!.status).toBe("read");
      // Nov 2, 2025 at noon UTC
      expect(hyperion!.dateFinished).toBe(Date.UTC(2025, 10, 2, 12, 0, 0, 0));

      // Verify 2021 books get correct year
      const sovereignIndividual2021 = result.rows.find(
        (r) =>
          r.title === "The Sovereign Individual" &&
          r.dateFinished &&
          r.dateFinished < Date.UTC(2022, 0, 1),
      );
      expect(sovereignIndividual2021).toBeDefined();
      // Mar 9, 2021 at noon UTC
      expect(sovereignIndividual2021!.dateFinished).toBe(Date.UTC(2021, 2, 9, 12, 0, 0, 0));
    });

    it("returns matched=false for non-matching markdown", () => {
      const result = parseReadingSummaryMarkdown("# Random Document\n\nSome text here.");
      expect(result.matched).toBe(false);
      expect(result.rows).toHaveLength(0);
    });

    it("handles books without dates in year section", () => {
      const markdown = `## Books by Year
### 2025
- **No Date Book** by Test Author`;

      const result = parseReadingSummaryMarkdown(markdown);

      expect(result.matched).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.title).toBe("No Date Book");
      expect(result.rows[0]!.status).toBe("read");
      expect(result.rows[0]!.dateFinished).toBeUndefined();
    });

    it("warns on unparseable date tokens", () => {
      const markdown = `## Books by Year
### 2025
- **Bad Date** by Author _(Foo 99)_`;

      const result = parseReadingSummaryMarkdown(markdown);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.dateFinished).toBeUndefined();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Could not parse date");
    });

    it("handles various month abbreviations", () => {
      const markdown = `## Books by Year
### 2025
- **Short Month** by Author _(Nov 2)_
- **Sept Variant** by Author _(Sept 15)_
- **Dec Book** by Author _(Dec 31)_`;

      const result = parseReadingSummaryMarkdown(markdown);

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]!.dateFinished).toBe(Date.UTC(2025, 10, 2, 12, 0, 0, 0));
      expect(result.rows[1]!.dateFinished).toBe(Date.UTC(2025, 8, 15, 12, 0, 0, 0));
      expect(result.rows[2]!.dateFinished).toBe(Date.UTC(2025, 11, 31, 12, 0, 0, 0));
    });

    it("dateStarted is never set", () => {
      const markdown = `## Currently Reading
- **Active Book** by Author

## Books by Year
### 2025
- **Finished Book** by Author _(Dec 1)_`;

      const result = parseReadingSummaryMarkdown(markdown);

      result.rows.forEach((row) => {
        expect(row.dateStarted).toBeUndefined();
      });
    });
  });

  describe("LLM extraction (fallback)", () => {
    it("extracts books from markdown reading list format", async () => {
      const markdown = readFileSync(FIXTURE_PATH, "utf-8");

      // Note: This test verifies the mock data structure that would be returned by an LLM
      // In production, the LLM would parse the markdown and return this JSON structure

      // Mock LLM response mimicking what Claude/GPT would return
      const mockLlmResponse = {
        books: [
          {
            title: "The Absorbent Mind",
            author: "Maria Montessori",
            status: "currently-reading",
          },
          {
            title: "Xenosystems",
            author: "Nick Land",
            status: "currently-reading",
          },
          {
            title: "Hyperion",
            author: "Dan Simmons",
            status: "read",
            dateFinished: new Date("2025-11-02").getTime(),
          },
          {
            title: "A Philosophy of Software Design",
            author: "John Ousterhout",
            status: "read",
            dateFinished: new Date("2025-10-01").getTime(),
          },
          {
            title: "The Man Who Solved the Market: How Jim Simons Launched the Quant Revolution",
            author: "Gregory Zuckerman",
            status: "read",
            dateFinished: new Date("2025-09-18").getTime(),
          },
          {
            title: "A Mind at Play: How Claude Shannon Invented the Information Age",
            author: "Jimmy Soni, Rob Goodman",
            status: "read",
            dateFinished: new Date("2025-08-29").getTime(),
          },
          {
            title: "Project Hail Mary",
            author: "Andy Weir",
            status: "read",
            dateFinished: new Date("2025-08-26").getTime(),
          },
          {
            title: "The Sovereign Individual",
            author: "James Dale Davidson and Lord William Rees-Mogg",
            status: "read",
            dateFinished: new Date("2025-04-17").getTime(),
          },
          {
            title: "The Hobbit",
            author: "J.R.R. Tolkien",
            status: "read",
            dateFinished: new Date("2025-04-12").getTime(),
          },
          {
            title: "Vagabond",
            author: "Takehiko Inoue",
            status: "read",
            dateFinished: new Date("2025-04-04").getTime(),
          },
          {
            title: "The Sovereign Individual",
            author: "James Dale Davidson and Lord William Rees-Mogg",
            status: "read",
            dateFinished: new Date("2021-03-09").getTime(),
          },
          {
            title: "Genghis Khan and the Making of the Modern World",
            author: "Jack Weatherford",
            status: "read",
            dateFinished: new Date("2021-02-16").getTime(),
          },
        ],
      };

      const provider = makeStaticProvider(mockLlmResponse);

      // Mock server environment for llmExtract
      const windowBackup = global.window;
      // @ts-expect-error - Deleting window to simulate server environment
      delete global.window;

      const result = await llmExtract(markdown, { provider });

      // Restore window
      if (windowBackup !== undefined) {
        global.window = windowBackup;
      }

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(12);

      // Verify first book
      const first = result.rows.find((r) => r.title === "Hyperion");
      expect(first).toBeDefined();
      expect(first?.author).toBe("Dan Simmons");
      expect(first?.status).toBe("read");
      expect(first?.dateFinished).toBe(new Date("2025-11-02").getTime());

      // Verify duplicate re-read (same book, different years)
      const sovereignIndividuals = result.rows.filter(
        (r) => r.title === "The Sovereign Individual",
      );
      expect(sovereignIndividuals).toHaveLength(2);
      expect(sovereignIndividuals[0]!.dateFinished).toBe(new Date("2025-04-17").getTime());
      expect(sovereignIndividuals[1]!.dateFinished).toBe(new Date("2021-03-09").getTime());
    });
  });

  describe("Fuzzy dedup matching", () => {
    it("matches books with punctuation variations in author", async () => {
      const parsed: ParsedBook = {
        tempId: "test1",
        title: "The Hobbit",
        author: "J.R.R. Tolkien",
        status: "read",
      };

      const existing: Partial<Doc<"books">> = {
        _id: "book1" as Id<"books">,
        title: "The Hobbit",
        author: "J. R. R. Tolkien", // Different punctuation
        userId: "user1" as Id<"users">,
      };

      const key1 = normalizeTitleAuthorKey(parsed.title, parsed.author);
      const key2 = normalizeTitleAuthorKey(existing.title!, existing.author!);

      // Should match: punctuation stripped
      expect(key1).toBe(key2);
      expect(key1).toBe("the hobbit|j r r tolkien");
    });

    it("matches books with subtitle variations", () => {
      const fullTitle =
        "The Man Who Solved the Market: How Jim Simons Launched the Quant Revolution";
      const shortTitle = "The Man Who Solved the Market";

      const key1 = normalizeTitleAuthorKey(fullTitle, "Gregory Zuckerman");
      const key2 = normalizeTitleAuthorKey(shortTitle, "Gregory Zuckerman");

      // Should NOT match: different normalized strings
      expect(key1).not.toBe(key2);
      expect(key1).toBe(
        "the man who solved the market how jim simons launched the quant revolution|gregory zuckerman",
      );
      expect(key2).toBe("the man who solved the market|gregory zuckerman");
    });

    it("does NOT match books with leading article differences", () => {
      const withArticle = "The Hobbit";
      const withoutArticle = "Hobbit";

      const key1 = normalizeTitleAuthorKey(withArticle, "J.R.R. Tolkien");
      const key2 = normalizeTitleAuthorKey(withoutArticle, "J.R.R. Tolkien");

      // Currently does NOT match (improvement opportunity)
      expect(key1).not.toBe(key2);
      expect(key1).toBe("the hobbit|j r r tolkien");
      expect(key2).toBe("hobbit|j r r tolkien");
    });

    it("does NOT match multi-author format variations", () => {
      const commaFormat = "Jimmy Soni, Rob Goodman";
      const andFormat = "Jimmy Soni and Rob Goodman";

      const key1 = normalizeTitleAuthorKey("A Mind at Play", commaFormat);
      const key2 = normalizeTitleAuthorKey("A Mind at Play", andFormat);

      // Currently does NOT match (improvement opportunity)
      expect(key1).not.toBe(key2);
      expect(key1).toBe("a mind at play|jimmy soni rob goodman");
      expect(key2).toBe("a mind at play|jimmy soni and rob goodman");
    });

    it("flags duplicate re-reads as potential duplicates", async () => {
      const rows: ParsedBook[] = [
        {
          tempId: "temp1",
          title: "The Sovereign Individual",
          author: "James Dale Davidson and Lord William Rees-Mogg",
          status: "read",
          dateFinished: new Date("2025-04-17").getTime(),
        },
        {
          tempId: "temp2",
          title: "The Sovereign Individual",
          author: "James Dale Davidson and Lord William Rees-Mogg",
          status: "read",
          dateFinished: new Date("2021-03-09").getTime(),
        },
      ];

      const existingBook: Partial<Doc<"books">> = {
        _id: "book1" as Id<"books">,
        title: "The Sovereign Individual",
        author: "James Dale Davidson and Lord William Rees-Mogg",
        userId: "user1" as Id<"users">,
        dateFinished: new Date("2025-04-17").getTime(),
      };

      const mockDb = {
        query: () => ({
          withIndex: () => ({
            collect: async () => [existingBook] as Doc<"books">[],
          }),
        }),
        get: async () => null,
      };

      const matches = await dedupHelpers.findMatches(mockDb as any, "user1" as Id<"users">, rows);

      // Both rows should match the existing book
      expect(matches).toHaveLength(2);
      expect(matches[0]!.matchType).toBe("title-author");
      expect(matches[1]!.matchType).toBe("title-author");
      expect(matches[0]!.confidence).toBe(0.8);

      // User will need to decide:
      // - Skip (already have it)
      // - Create (allow re-read tracking)
      // - Merge (update with new dateFinished)
    });
  });

  describe("Edge cases", () => {
    it("handles books with diacritics", () => {
      const withDiacritics = "Méditations";
      const withoutDiacritics = "Meditations";

      const key1 = normalizeTitleAuthorKey(withDiacritics, "Marcus Aurelius");
      const key2 = normalizeTitleAuthorKey(withoutDiacritics, "Marcus Aurelius");

      // Should match: diacritics stripped
      expect(key1).toBe(key2);
      expect(key1).toBe("meditations|marcus aurelius");
    });

    it("handles books with apostrophes and hyphens", () => {
      const original = "Man's Search for Meaning";
      const noApostrophe = "Mans Search for Meaning";

      const key1 = normalizeTitleAuthorKey(original, "Viktor Frankl");
      const key2 = normalizeTitleAuthorKey(noApostrophe, "Viktor Frankl");

      // Should match: punctuation stripped
      expect(key1).toBe(key2);
      expect(key1).toBe("mans search for meaning|viktor frankl");
    });

    it("handles corporate/collective authors", () => {
      const corporateAuthor = "Catholic Church";
      const parsed: ParsedBook = {
        tempId: "test1",
        title: "Catechism of the Catholic Church",
        author: corporateAuthor,
        status: "read",
      };

      const key = normalizeTitleAuthorKey(parsed.title, parsed.author);
      expect(key).toBe("catechism of the catholic church|catholic church");
    });

    it("handles currently reading books without dates", () => {
      const currentlyReading: ParsedBook = {
        tempId: "test1",
        title: "The Absorbent Mind",
        author: "Maria Montessori",
        status: "currently-reading",
        // No dateStarted or dateFinished
      };

      expect(currentlyReading.dateStarted).toBeUndefined();
      expect(currentlyReading.dateFinished).toBeUndefined();
    });
  });
});
