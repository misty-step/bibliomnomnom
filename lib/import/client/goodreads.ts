import {
  collapseWhitespace,
  makeTempId,
  normalizeIsbn,
  normalizeOptionalText,
  ParsedBook,
  ParseError,
} from "../types";
import { mapShelfToStatus } from "../status";

export type ClientParseResult = {
  sourceType: "goodreads-csv";
  rows: ParsedBook[];
  warnings: string[];
  errors: ParseError[];
};

type HeaderLookup = Record<string, number>;

const REQUIRED_HEADERS = ["title", "author"] as const;

const OPTIONAL_HEADERS = {
  isbn: ["isbn", "isbn13"],
  pages: ["number of pages", "num pages"],
  yearPublished: ["year published"],
  originalYear: ["original publication year"],
  dateRead: ["date read"],
  dateAdded: ["date added"],
  bookshelves: ["bookshelves"],
  exclusiveShelf: ["exclusive shelf"],
  coverUrl: ["cover image url", "cover"],
  edition: ["edition"],
} as const;

const stripBom = (text: string) => text.replace(/^\uFEFF/, "");

const buildHeaderLookup = (headers: string[]): HeaderLookup => {
  return headers.reduce<HeaderLookup>((acc, header, index) => {
    acc[header.trim().toLowerCase()] = index;
    return acc;
  }, {});
};

const getValue = (
  row: string[],
  lookup: HeaderLookup,
  keys: readonly string[],
): string | undefined => {
  for (const key of keys) {
    const column = lookup[key];
    if (column !== undefined) {
      const value = row[column];
      if (value === undefined || value === null) continue;
      if (typeof value === "string" && value.trim() === "") continue;
      return value;
    }
  }
  return undefined;
};

const toNumber = (value?: string): number | undefined => {
  const cleaned = normalizeOptionalText(value);
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toDateTimestamp = (value?: string): number | undefined => {
  const cleaned = normalizeOptionalText(value);
  if (!cleaned) return undefined;
  const parsed = Date.parse(cleaned);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuote = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuote && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }

    if (char === "," && !inQuote) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuote) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  rows.push(row);
  return rows.filter((r) => r.length && !(r.length === 1 && r[0] === ""));
};

export const parseGoodreadsCsv = (fileText: string): ClientParseResult => {
  const warnings: string[] = [];
  const errors: ParseError[] = [];

  const cleaned = stripBom(fileText);
  const rows = parseCsv(cleaned);

  if (!rows.length) {
    return {
      sourceType: "goodreads-csv",
      rows: [],
      warnings: ["Empty CSV file"],
      errors: [],
    };
  }

  const headerRow = rows[0];
  const headerLookup = buildHeaderLookup(headerRow);

  for (const required of REQUIRED_HEADERS) {
    if (headerLookup[required] === undefined) {
      errors.push({
        message: `Missing required column: ${required}`,
        line: 1,
      });
    }
  }

  const dataRows = rows.slice(1);
  const parsed: ParsedBook[] = [];

  dataRows.forEach((row, index) => {
    const lineNumber = index + 2; // account for header row
    const title = normalizeOptionalText(getValue(row, headerLookup, ["title"]));
    const author = normalizeOptionalText(getValue(row, headerLookup, ["author"]));

    if (!title || !author) {
      errors.push({
        message: "Missing required title or author",
        line: lineNumber,
      });
      return;
    }

    const shelfRaw =
      getValue(row, headerLookup, OPTIONAL_HEADERS.exclusiveShelf) ??
      getValue(row, headerLookup, OPTIONAL_HEADERS.bookshelves);

    const shelfResolution = mapShelfToStatus(shelfRaw);
    if (shelfResolution.warning) {
      warnings.push(`Row ${lineNumber}: ${shelfResolution.warning}`);
    }

    const isbn = normalizeIsbn(getValue(row, headerLookup, OPTIONAL_HEADERS.isbn));

    const pageCount = toNumber(getValue(row, headerLookup, OPTIONAL_HEADERS.pages));

    const publishedYear =
      toNumber(getValue(row, headerLookup, OPTIONAL_HEADERS.yearPublished)) ??
      toNumber(getValue(row, headerLookup, OPTIONAL_HEADERS.originalYear));

    const dateFinished = toDateTimestamp(getValue(row, headerLookup, OPTIONAL_HEADERS.dateRead));

    const dateStarted = toDateTimestamp(getValue(row, headerLookup, OPTIONAL_HEADERS.dateAdded));

    const coverUrl = normalizeOptionalText(getValue(row, headerLookup, OPTIONAL_HEADERS.coverUrl));

    const edition = normalizeOptionalText(getValue(row, headerLookup, OPTIONAL_HEADERS.edition));

    const cleanAuthor = collapseWhitespace(author);
    const cleanTitle = collapseWhitespace(title);

    parsed.push({
      tempId: makeTempId("gr"),
      title: cleanTitle,
      author: cleanAuthor,
      status: shelfResolution.status,
      isbn,
      edition,
      publishedYear,
      pageCount,
      isAudiobook: undefined,
      isFavorite: undefined,
      dateStarted,
      dateFinished,
      coverUrl,
      privacy: "private",
    });
  });

  return {
    sourceType: "goodreads-csv",
    rows: parsed,
    warnings,
    errors,
  };
};

export default parseGoodreadsCsv;
