import type { Id } from "@/convex/_generated/dataModel";
import { v } from "convex/values";
import {
  coerceStatus,
  DEFAULT_STATUS,
  ImportStatus,
  mapShelfToStatus,
  statusOptions,
} from "./status";

export type ImportSourceType = "goodreads-csv" | "csv" | "txt" | "md" | "unknown";

export type PrivacyLevel = "private" | "public";

export type ApiSource = "google-books" | "open-library" | "manual";

export type ParsedBook = {
  tempId: string;
  title: string;
  author: string;
  status?: ImportStatus;
  isbn?: string;
  edition?: string;
  publishedYear?: number;
  pageCount?: number;
  isAudiobook?: boolean;
  isFavorite?: boolean;
  dateStarted?: number;
  dateFinished?: number;
  coverUrl?: string;
  apiSource?: ApiSource;
  apiId?: string;
  privacy?: PrivacyLevel;
};

export type DedupMatch = {
  tempId: string;
  existingBookId: Id<"books">;
  matchType: "isbn" | "title-author" | "apiId";
  confidence: number; // 0..1
};

export type DedupDecisionAction = "skip" | "merge" | "create";

export type DedupDecision = {
  tempId: string;
  action: DedupDecisionAction;
  fieldsToMerge?: string[];
};

export type ParseError = {
  message: string;
  line?: number;
  column?: number;
};

export type PreviewResult = {
  sourceType: ImportSourceType;
  books: ParsedBook[];
  warnings: string[];
  dedupMatches: DedupMatch[];
  errors?: ParseError[];
  importRunId: string;
};

export type CommitSummary = {
  created: number;
  merged: number;
  skipped: number;
  errors: ParseError[];
};

export const IMPORT_PAGE_SIZE = 300;
export const LLM_TOKEN_CAP = 500_000; // Gemini 2.5 Flash handles 1M; be conservative

export const collapseWhitespace = (value: string): string => value.trim().replace(/\s+/g, " ");

export const normalizeOptionalText = (value?: string | null): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const normalized = collapseWhitespace(value);
  return normalized.length ? normalized : undefined;
};

export const normalizeIsbn = (value?: string | null): string | undefined => {
  const normalized = normalizeOptionalText(value)?.replace(/[-\s]/g, "");
  return normalized?.length ? normalized : undefined;
};

export const makeTempId = (prefix = "tmp"): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
};

export const parsedBookSchema = v.object({
  tempId: v.string(),
  title: v.string(),
  author: v.string(),
  status: v.optional(
    v.union(v.literal("want-to-read"), v.literal("currently-reading"), v.literal("read")),
  ),
  isbn: v.optional(v.string()),
  edition: v.optional(v.string()),
  publishedYear: v.optional(v.number()),
  pageCount: v.optional(v.number()),
  isAudiobook: v.optional(v.boolean()),
  isFavorite: v.optional(v.boolean()),
  dateStarted: v.optional(v.number()),
  dateFinished: v.optional(v.number()),
  coverUrl: v.optional(v.string()),
  apiSource: v.optional(
    v.union(v.literal("google-books"), v.literal("open-library"), v.literal("manual")),
  ),
  apiId: v.optional(v.string()),
  privacy: v.optional(v.union(v.literal("private"), v.literal("public"))),
});

export const dedupMatchSchema = v.object({
  tempId: v.string(),
  existingBookId: v.id("books"),
  matchType: v.union(v.literal("isbn"), v.literal("title-author"), v.literal("apiId")),
  confidence: v.number(),
});

export const dedupDecisionSchema = v.object({
  tempId: v.string(),
  action: v.union(v.literal("skip"), v.literal("merge"), v.literal("create")),
  fieldsToMerge: v.optional(v.array(v.string())),
});

export const parseErrorSchema = v.object({
  message: v.string(),
  line: v.optional(v.number()),
  column: v.optional(v.number()),
});

export const previewResultSchema = v.object({
  sourceType: v.union(
    v.literal("goodreads-csv"),
    v.literal("csv"),
    v.literal("txt"),
    v.literal("md"),
    v.literal("unknown"),
  ),
  books: v.array(parsedBookSchema),
  warnings: v.array(v.string()),
  dedupMatches: v.array(dedupMatchSchema),
  errors: v.optional(v.array(parseErrorSchema)),
  importRunId: v.string(),
});

export const commitSummarySchema = v.object({
  created: v.number(),
  merged: v.number(),
  skipped: v.number(),
  errors: v.array(parseErrorSchema),
});

export const statusHelpers = {
  mapShelfToStatus,
  coerceStatus,
  DEFAULT_STATUS,
  statusOptions,
};

export type { ImportStatus, StatusResolution } from "./status";
