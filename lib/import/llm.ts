import {
  collapseWhitespace,
  IMPORT_PAGE_SIZE,
  LLM_TOKEN_CAP,
  makeTempId,
  normalizeIsbn,
  normalizeOptionalText,
  ParsedBook,
  ParseError,
} from "./types";
import { mapShelfToStatus } from "./status";

type ProviderName = "openai" | "gemini";

export type LlmProvider = {
  name: ProviderName;
  call: (prompt: string) => Promise<string>;
};

export type LlmExtractOptions = {
  tokenCap?: number;
  chunkTokenSize?: number;
  provider?: LlmProvider;
  fallbackProvider?: LlmProvider;
};

export type LlmExtractResult = {
  rows: ParsedBook[];
  warnings: string[];
  errors: ParseError[];
  tokenUsage: number;
};

const DEFAULT_CHUNK_TOKEN_SIZE = 8_000;
const TOKEN_ESTIMATE_DIVISOR = 4; // rough chars→tokens heuristic

const estimateTokens = (text: string): number => Math.ceil(text.length / TOKEN_ESTIMATE_DIVISOR);

const splitIntoChunks = (text: string, maxTokens: number): string[] => {
  if (!text) return [];
  const approxChunkChars = maxTokens * TOKEN_ESTIMATE_DIVISOR;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += approxChunkChars) {
    chunks.push(text.slice(i, i + approxChunkChars));
  }
  return chunks;
};

const buildPrompt = (chunk: string) => `You are a strict data extractor. Parse books from the provided text.
Return JSON array under key "books". Each book must include:
title, author, status (want-to-read|currently-reading|read), isbn?, edition?, publishedYear?, pageCount?, isAudiobook?, isFavorite?, dateStarted?, dateFinished?, coverUrl?, apiSource?, apiId?, privacy? (private by default).
Rules: never hallucinate; omit fields you cannot justify; default status to want-to-read when uncertain; include tempId from the source if provided.
Input:
"""
${chunk}
"""`;

const parseModelJson = (text: string): ParsedBook[] => {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.books)) {
      return parsed.books as ParsedBook[];
    }
    if (Array.isArray(parsed)) {
      return parsed as ParsedBook[];
    }
  } catch (_err) {
    // fallthrough to empty
  }
  return [];
};

const sanitizeRow = (row: Partial<ParsedBook>, index: number): ParsedBook | null => {
  const title = normalizeOptionalText(row.title);
  const author = normalizeOptionalText(row.author);
  if (!title || !author) return null;

  const statusResolution = mapShelfToStatus(row.status ?? undefined);

  return {
    tempId: row.tempId ?? makeTempId(`llm${index}`),
    title: collapseWhitespace(title),
    author: collapseWhitespace(author),
    status: statusResolution.status,
    isbn: normalizeIsbn(row.isbn),
    edition: normalizeOptionalText(row.edition),
    publishedYear: typeof row.publishedYear === "number" ? row.publishedYear : undefined,
    pageCount: typeof row.pageCount === "number" ? row.pageCount : undefined,
    isAudiobook: typeof row.isAudiobook === "boolean" ? row.isAudiobook : undefined,
    isFavorite: typeof row.isFavorite === "boolean" ? row.isFavorite : undefined,
    dateStarted: typeof row.dateStarted === "number" ? row.dateStarted : undefined,
    dateFinished: typeof row.dateFinished === "number" ? row.dateFinished : undefined,
    coverUrl: normalizeOptionalText(row.coverUrl),
    apiSource: row.apiSource as ParsedBook["apiSource"],
    apiId: normalizeOptionalText(row.apiId),
    privacy: row.privacy === "public" ? "public" : "private",
  } satisfies ParsedBook;
};

const validateAndCollect = (rawRows: ParsedBook[]): { rows: ParsedBook[]; warnings: string[]; errors: ParseError[] } => {
  const warnings: string[] = [];
  const errors: ParseError[] = [];
  const rows: ParsedBook[] = [];

  rawRows.forEach((row, idx) => {
    const sanitized = sanitizeRow(row, idx);
    if (!sanitized) {
      errors.push({ message: "Row missing required title or author", line: idx + 1 });
      return;
    }

    rows.push(sanitized);
  });

  if (rows.length > IMPORT_PAGE_SIZE) {
    warnings.push(`Parsed ${rows.length} rows; preview will paginate at ${IMPORT_PAGE_SIZE}.`);
  }

  return { rows, warnings, errors };
};

const runProvider = async (provider: LlmProvider, prompt: string): Promise<ParsedBook[]> => {
  const content = await provider.call(prompt);
  return parseModelJson(content);
};

export const llmExtract = async (
  rawText: string,
  opts: LlmExtractOptions = {}
): Promise<LlmExtractResult> => {
  if (typeof window !== "undefined") {
    throw new Error("llmExtract is server-only");
  }

  const tokenCap = opts.tokenCap ?? LLM_TOKEN_CAP;
  const chunkSize = opts.chunkTokenSize ?? DEFAULT_CHUNK_TOKEN_SIZE;

  const totalTokens = estimateTokens(rawText);
  if (totalTokens > tokenCap) {
    return {
      rows: [],
      warnings: [],
      errors: [
        {
          message: `Token budget exceeded (${totalTokens} > ${tokenCap}). Please trim file or split.`,
        },
      ],
      tokenUsage: 0,
    };
  }

  const chunks = splitIntoChunks(rawText, chunkSize);
  const warnings: string[] = [];
  const errors: ParseError[] = [];
  const collected: ParsedBook[] = [];
  let tokenUsage = 0;

  for (const chunk of chunks) {
    const prompt = buildPrompt(chunk);
    const estimated = estimateTokens(prompt);
    tokenUsage += estimated;

    const provider = opts.provider;
    const fallback = opts.fallbackProvider;

    let parsed: ParsedBook[] = [];
    let providerError: Error | null = null;

    if (provider) {
      try {
        parsed = await runProvider(provider, prompt);
      } catch (err: any) {
        providerError = err;
      }
    }

    if (!parsed.length && fallback) {
      try {
        parsed = await runProvider(fallback, prompt);
      } catch (err: any) {
        providerError = providerError ?? err;
      }
    }

    if (!parsed.length) {
      errors.push({ message: providerError?.message ?? "LLM returned no parsable data" });
      continue;
    }

    const { rows, warnings: rowWarnings, errors: rowErrors } = validateAndCollect(parsed);
    warnings.push(...rowWarnings.map((w) => `Chunk: ${w}`));
    errors.push(...rowErrors.map((e) => ({ ...e, message: `Chunk row error: ${e.message}` })));
    collected.push(...rows);
  }

  return { rows: collected, warnings, errors, tokenUsage };
};

// Minimal noop provider for tests or offline use
export const makeStaticProvider = (payload: any): LlmProvider => ({
  name: "openai",
  call: async () => JSON.stringify(payload),
});
