/**
 * Deterministic parser for READING_SUMMARY.md-style markdown files.
 *
 * Format assumptions:
 * - Contains sections like `## Currently Reading` and `## Books by Year`
 * - Year blocks like `### 2025` (optionally `### 2025 (N books)`)
 * - Book line like `- **Title** by Author _(Nov 2)_` (date optional; month/day only)
 *
 * Non-goals:
 * - Don't infer dateStarted (not available in this format)
 * - Don't invent year when no year header applies (leave dateFinished empty)
 */

import {
  collapseWhitespace,
  makeTempId,
  normalizeOptionalText,
  ParsedBook,
  ParseError,
} from "../types";

export type ReadingSummaryParseResult = {
  matched: boolean; // false => caller should fall back (LLM, etc)
  rows: ParsedBook[];
  warnings: string[];
  errors: ParseError[];
};

type Section = "currently-reading" | "books-by-year" | "other";

// Month name to 0-indexed month number
const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

/**
 * Parse date like "Nov 2" or "November 21" with a given year context.
 * Returns timestamp (ms since epoch) or undefined if unparseable.
 */
const parseDateWithYear = (dateStr: string, year: number): number | undefined => {
  // Match patterns like "Nov 2", "November 21", "Dec 31"
  const match = dateStr.match(/^([A-Za-z]+)\s*(\d{1,2})$/);
  if (!match) return undefined;

  const monthStr = match[1]!.toLowerCase();
  const day = parseInt(match[2]!, 10);

  const month = MONTHS[monthStr];
  if (month === undefined) return undefined;
  if (day < 1 || day > 31) return undefined;

  // Create date at noon UTC to avoid timezone issues
  const date = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));

  // Validate the date is real (e.g., Feb 30 would fail)
  if (date.getUTCMonth() !== month) return undefined;

  return date.getTime();
};

// Patterns for detecting expected headings
const CURRENTLY_READING_PATTERN = /^##\s+currently\s+reading/i;
const BOOKS_BY_YEAR_PATTERN = /^##\s+books\s+by\s+year/i;
const YEAR_HEADER_PATTERN = /^###\s+(\d{4})/;

// Book line pattern: - **Title** by Author _(date)_ or - **Title** by Author
// Captures: title, author, optional date wrapped in _()_
const BOOK_LINE_PATTERN = /^-\s+\*\*(.+?)\*\*\s+by\s+(.+?)(?:\s+_\(([A-Za-z]+\s*\d{1,2})\)_)?$/;

export const parseReadingSummaryMarkdown = (markdown: string): ReadingSummaryParseResult => {
  const warnings: string[] = [];
  const errors: ParseError[] = [];
  const rows: ParsedBook[] = [];

  let section: Section = "other";
  let currentYear: number | undefined;
  let sawCurrentlyReading = false;
  let sawBooksByYear = false;

  const lines = markdown.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    const lineNumber = index + 1;

    // Check for section headers
    if (CURRENTLY_READING_PATTERN.test(line)) {
      section = "currently-reading";
      currentYear = undefined;
      sawCurrentlyReading = true;
      return;
    }

    if (BOOKS_BY_YEAR_PATTERN.test(line)) {
      section = "books-by-year";
      sawBooksByYear = true;
      return;
    }

    // Check for year headers (only relevant in books-by-year section)
    const yearMatch = line.match(YEAR_HEADER_PATTERN);
    if (yearMatch) {
      if (section === "books-by-year" || section === "other") {
        section = "books-by-year";
        sawBooksByYear = true;
      }
      currentYear = parseInt(yearMatch[1]!, 10);
      return;
    }

    // Check for other H2 headers that reset section
    if (
      /^##\s+/.test(line) &&
      !CURRENTLY_READING_PATTERN.test(line) &&
      !BOOKS_BY_YEAR_PATTERN.test(line)
    ) {
      section = "other";
      currentYear = undefined;
      return;
    }

    // Check for book line
    const bookMatch = line.match(BOOK_LINE_PATTERN);
    if (bookMatch) {
      const title = normalizeOptionalText(bookMatch[1]);
      const author = normalizeOptionalText(bookMatch[2]);
      const dateToken = bookMatch[3] ? bookMatch[3].trim() : undefined;

      if (!title || !author) {
        errors.push({
          message: "Book line missing title or author",
          line: lineNumber,
        });
        return;
      }

      let status: ParsedBook["status"];
      let dateFinished: number | undefined;

      if (section === "currently-reading") {
        status = "currently-reading";
        // No dateFinished for currently reading books
      } else if (section === "books-by-year") {
        status = "read";

        // Parse date if available
        if (dateToken && currentYear) {
          dateFinished = parseDateWithYear(dateToken, currentYear);
          if (!dateFinished) {
            warnings.push(
              `Row ${lineNumber}: Could not parse date "${dateToken}" with year ${currentYear}`,
            );
          }
        } else if (dateToken && !currentYear) {
          warnings.push(
            `Row ${lineNumber}: Date "${dateToken}" found but no year context available`,
          );
        }
      } else {
        // Books in "other" sections get default status
        status = "want-to-read";
      }

      rows.push({
        tempId: makeTempId("rs"),
        title: collapseWhitespace(title),
        author: collapseWhitespace(author),
        status,
        dateFinished,
        privacy: "private",
      });
    }
  });

  // Determine if we matched the expected format
  const matched = rows.length > 0 && (sawCurrentlyReading || sawBooksByYear);

  return {
    matched,
    rows,
    warnings,
    errors,
  };
};

export default parseReadingSummaryMarkdown;
