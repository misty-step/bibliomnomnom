import {
  collapseWhitespace,
  makeTempId,
  normalizeIsbn,
  normalizeOptionalText,
  ParsedBook,
  ParseError,
} from "../types";
import { mapShelfToStatus } from "../status";

export type InferCsvResult = {
  sourceType: "csv";
  rows: ParsedBook[];
  warnings: string[];
  errors: ParseError[];
};

type HeaderLookup = Record<string, number>;

const TITLE_ALIASES = ["title", "book title", "book_title", "name"];
const AUTHOR_ALIASES = ["author", "writer", "authors"];
const ISBN_ALIASES = ["isbn", "isbn13", "isbn_13"];
const PAGE_ALIASES = ["pages", "page count", "number of pages", "num pages", "num of pages"];
const YEAR_ALIASES = [
  "year",
  "year published",
  "published year",
  "publication year",
  "published",
  "original year",
  "original publication year",
];
const EDITION_ALIASES = ["edition", "edition info"];
const STATUS_ALIASES = ["status", "shelf", "bookshelf", "bookshelves", "exclusive shelf"];
const AUDIOBOOK_ALIASES = ["audiobook", "is audiobook", "is_audiobook", "format"];
const FAVORITE_ALIASES = ["favorite", "favourite", "is favorite", "is_favorite"];
const COVER_ALIASES = ["cover", "cover url", "cover image url", "image", "image url"];
const PRIVACY_ALIASES = ["privacy", "visibility"];

const stripBom = (text: string) => text.replace(/^\uFEFF/, "");

const buildHeaderLookup = (headers: string[]): HeaderLookup => {
  return headers.reduce<HeaderLookup>((acc, header, index) => {
    acc[header.trim().toLowerCase()] = index;
    return acc;
  }, {});
};

const findColumn = (lookup: HeaderLookup, aliases: string[]): number => {
  for (const alias of aliases) {
    const column = lookup[alias];
    if (column !== undefined) return column;
  }
  return -1;
};

const getValue = (row: string[], column: number): string | undefined =>
  column >= 0 ? (row[column] ?? undefined) : undefined;

const toNumber = (value?: string): number | undefined => {
  const cleaned = normalizeOptionalText(value);
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
};

const toBoolean = (value?: string): boolean | undefined => {
  const cleaned = normalizeOptionalText(value)?.toLowerCase();
  if (!cleaned) return undefined;
  if (["true", "yes", "y", "1"].includes(cleaned)) return true;
  if (["false", "no", "n", "0"].includes(cleaned)) return false;
  return undefined;
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

export const inferGenericCsv = (fileText: string): InferCsvResult => {
  const warnings: string[] = [];
  const errors: ParseError[] = [];

  const cleaned = stripBom(fileText);
  const parsedRows = parseCsv(cleaned);

  if (!parsedRows.length) {
    return {
      sourceType: "csv",
      rows: [],
      warnings: ["Empty CSV file"],
      errors: [],
    };
  }

  const headerRow = parsedRows[0].map((h) => h.trim());
  const lookup = buildHeaderLookup(headerRow);

  const titleCol = findColumn(lookup, TITLE_ALIASES);
  const authorCol = findColumn(lookup, AUTHOR_ALIASES);

  if (titleCol === -1 || authorCol === -1) {
    errors.push({
      message: "Missing required columns: title and/or author",
      line: 1,
    });
    return { sourceType: "csv", rows: [], warnings, errors };
  }

  const isbnCol = findColumn(lookup, ISBN_ALIASES);
  const pagesCol = findColumn(lookup, PAGE_ALIASES);
  const yearCol = findColumn(lookup, YEAR_ALIASES);
  const editionCol = findColumn(lookup, EDITION_ALIASES);
  const statusCol = findColumn(lookup, STATUS_ALIASES);
  const audiobookCol = findColumn(lookup, AUDIOBOOK_ALIASES);
  const favoriteCol = findColumn(lookup, FAVORITE_ALIASES);
  const coverCol = findColumn(lookup, COVER_ALIASES);
  const privacyCol = findColumn(lookup, PRIVACY_ALIASES);

  const usedColumns = new Set(
    [
      titleCol,
      authorCol,
      isbnCol,
      pagesCol,
      yearCol,
      editionCol,
      statusCol,
      audiobookCol,
      favoriteCol,
      coverCol,
      privacyCol,
    ].filter((i) => i >= 0),
  );

  const unusedHeaders = headerRow.filter((_, index) => !usedColumns.has(index));
  if (unusedHeaders.length) {
    warnings.push(`Ignored columns: ${unusedHeaders.join(", ")}`);
  }

  const dataRows = parsedRows.slice(1);
  const books: ParsedBook[] = [];

  dataRows.forEach((row, idx) => {
    const lineNumber = idx + 2;
    const rawTitle = getValue(row, titleCol);
    const rawAuthor = getValue(row, authorCol);

    const title = normalizeOptionalText(rawTitle);
    const author = normalizeOptionalText(rawAuthor);

    if (!title || !author) {
      errors.push({
        message: "Missing title or author in row",
        line: lineNumber,
      });
      return;
    }

    const statusRaw = getValue(row, statusCol);
    const statusResolution = mapShelfToStatus(statusRaw ?? undefined);
    if (statusResolution.warning) {
      warnings.push(`Row ${lineNumber}: ${statusResolution.warning}`);
    }

    const isbn = normalizeIsbn(getValue(row, isbnCol));
    const pageCount = toNumber(getValue(row, pagesCol));
    const publishedYear = toNumber(getValue(row, yearCol));
    const edition = normalizeOptionalText(getValue(row, editionCol));
    const coverUrl = normalizeOptionalText(getValue(row, coverCol));
    const isAudiobook = toBoolean(getValue(row, audiobookCol));
    const isFavorite = toBoolean(getValue(row, favoriteCol));

    const rawPrivacy = normalizeOptionalText(getValue(row, privacyCol))?.toLowerCase();
    const privacy: "private" | "public" = rawPrivacy === "public" ? "public" : "private";

    books.push({
      tempId: makeTempId("csv"),
      title: collapseWhitespace(title),
      author: collapseWhitespace(author),
      status: statusResolution.status,
      isbn,
      edition,
      publishedYear,
      pageCount,
      isAudiobook,
      isFavorite,
      coverUrl,
      privacy,
    });
  });

  return {
    sourceType: "csv",
    rows: books,
    warnings,
    errors,
  };
};

export default inferGenericCsv;
