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

const DEFAULT_CHUNK_TOKEN_SIZE = 100_000; // Large chunks for Gemini's 1M context
const TOKEN_ESTIMATE_DIVISOR = 4; // rough chars→tokens heuristic
const PARALLEL_CONCURRENCY = 3; // Process up to 3 chunks at once

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

const buildPrompt = (
  chunk: string,
) => `You are a strict data extractor. Parse books from the provided text.

ANTI-HALLUCINATION RULES (CRITICAL - HIGHEST PRIORITY):
1. Extract ONLY books that are EXPLICITLY LISTED in the source text below
2. Do NOT invent, infer, or suggest books that are not present in the source
3. Do NOT extract books mentioned in passing (e.g., "I want to read X someday") unless they appear in an actual book list
4. VERIFY each title and author appears verbatim in the source text
5. When in doubt about whether a book is in the source, OMIT IT ENTIRELY - empty data is better than false data
6. Do NOT fabricate dates, ISBNs, or other metadata not present in the source

EXTRACTION REQUIREMENTS:
- You MUST extract EVERY book from the explicit book list in the source
- Do not stop early - process the entire input completely
- Return one entry per unique book
- If a book appears multiple times with different dates (re-reads), include each instance

Return JSON array under key "books". Each book must include:
title, author, status (want-to-read|currently-reading|read), isbn?, edition?, publishedYear?, pageCount?, isAudiobook?, isFavorite?, dateStarted?, dateFinished?, coverUrl?, apiSource?, apiId?, privacy? (private by default).

FIELD EXTRACTION RULES:
- Default status to want-to-read when uncertain
- Include tempId from the source if provided
- ONLY include fields you can verify from the source text

DATE EXTRACTION RULES (critical):
- NEVER guess or infer dateStarted - only extract if explicitly stated as "started reading on X"
- For dateFinished: use year context from section headers (e.g., "### 2025" or "## 2024")
  - If a book has a partial date like "(Nov 2)" under a "### 2025" header, interpret as 2025-11-02
  - If a book is in a "Currently Reading" section, do NOT set dateFinished
- Return dates as Unix timestamps in milliseconds (e.g., 1730505600000 for Nov 2, 2025)
- When in doubt, omit the date field entirely - empty data is better than wrong data

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

const validateAndCollect = (
  rawRows: ParsedBook[],
): { rows: ParsedBook[]; warnings: string[]; errors: ParseError[] } => {
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

const MAX_RETRIES = 2;

const runProvider = async (
  provider: LlmProvider,
  prompt: string,
  retries = MAX_RETRIES,
): Promise<ParsedBook[]> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const content = await provider.call(prompt);
      return parseModelJson(content);
    } catch (err: any) {
      lastError = err;

      // Retry on AbortError (timeout) or network errors
      const isRetryable = err.name === "AbortError" || err.message?.includes("fetch");
      if (isRetryable && attempt < retries) {
        console.warn(
          `[LLM] ${provider.name} attempt ${attempt + 1} failed (${err.name}), retrying...`,
        );
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("LLM provider failed after retries");
};

const buildVerificationPrompt = (
  originalText: string,
  extractedBooks: ParsedBook[],
) => `You are a verification assistant. Review the extraction results for completeness and accuracy.

Original text contains book information. Extracted ${extractedBooks.length} books.

Check:
1. Are ALL books from the original text extracted?
2. Are the titles and authors accurate?
3. Is any book listed multiple times?

Original text:
"""
${originalText}
"""

Extracted books:
${extractedBooks.map((b, i) => `${i + 1}. "${b.title}" by ${b.author}`).join("\n")}

Return JSON with:
{
  "complete": true/false,
  "estimatedTotal": <number>,
  "missingBooks": [{ "title": "...", "author": "..." }],
  "issues": ["..."]
}`;

const verifyExtraction = async (
  verifier: LlmProvider | undefined,
  chunk: string,
  extracted: ParsedBook[],
): Promise<{ complete: boolean; estimatedTotal: number; issues: string[] }> => {
  if (!verifier || !extracted.length) {
    return { complete: true, estimatedTotal: extracted.length, issues: [] };
  }

  try {
    const prompt = buildVerificationPrompt(chunk, extracted);
    const content = await verifier.call(prompt);
    const result = JSON.parse(content);

    return {
      complete: result.complete ?? true,
      estimatedTotal: result.estimatedTotal ?? extracted.length,
      issues: result.issues ?? [],
    };
  } catch (err: any) {
    // Verification failed, assume extraction is complete
    return { complete: true, estimatedTotal: extracted.length, issues: [] };
  }
};

export const llmExtract = async (
  rawText: string,
  opts: LlmExtractOptions = {},
): Promise<LlmExtractResult> => {
  if (typeof window !== "undefined") {
    throw new Error("llmExtract is server-only");
  }

  const tokenCap = opts.tokenCap ?? LLM_TOKEN_CAP;
  const chunkSize = opts.chunkTokenSize ?? DEFAULT_CHUNK_TOKEN_SIZE;

  if (!opts.provider && !opts.fallbackProvider) {
    return {
      rows: [],
      warnings: [],
      errors: [{ message: "No LLM provider supplied" }],
      tokenUsage: 0,
    };
  }

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

  const provider = opts.provider;
  const fallback = opts.fallbackProvider;

  // Process a single chunk
  const processChunk = async (
    chunk: string,
  ): Promise<{ parsed: ParsedBook[]; error: Error | null }> => {
    const prompt = buildPrompt(chunk);

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

    return { parsed, error: providerError };
  };

  // Process chunks in parallel batches
  for (let i = 0; i < chunks.length; i += PARALLEL_CONCURRENCY) {
    const batch = chunks.slice(i, i + PARALLEL_CONCURRENCY);

    // Track token usage for this batch
    batch.forEach((chunk) => {
      tokenUsage += estimateTokens(buildPrompt(chunk));
    });

    // Process batch in parallel
    const results = await Promise.all(batch.map(processChunk));

    // Collect results from batch
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const chunk = batch[j];
      if (!result || !chunk) continue;
      const { parsed, error } = result;

      if (!parsed.length) {
        errors.push({ message: error?.message ?? "LLM returned no parsable data" });
        continue;
      }

      // Verify extraction completeness (sequential to avoid overloading)
      if (fallback && parsed.length > 0) {
        const verification = await verifyExtraction(fallback, chunk, parsed);

        if (!verification.complete) {
          warnings.push(
            `Chunk verification: Extracted ${parsed.length} books, but verifier estimates ${verification.estimatedTotal} total`,
          );
        }

        if (verification.issues.length > 0) {
          warnings.push(...verification.issues.map((issue) => `Verification: ${issue}`));
        }
      }

      const { rows, warnings: rowWarnings, errors: rowErrors } = validateAndCollect(parsed);
      warnings.push(...rowWarnings.map((w) => `Chunk: ${w}`));
      errors.push(...rowErrors.map((e) => ({ ...e, message: `Chunk row error: ${e.message}` })));
      collected.push(...rows);
    }
  }

  return { rows: collected, warnings, errors, tokenUsage };
};

// Minimal noop provider for tests or offline use
export const makeStaticProvider = (payload: any): LlmProvider => ({
  name: "openai",
  call: async () => JSON.stringify(payload),
});

// OpenAI provider using REST API
const PROVIDER_TIMEOUT_MS = 300_000; // 5 minutes

export const createOpenAIProvider = (apiKey: string): LlmProvider => ({
  name: "openai",
  call: async (prompt: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, PROVIDER_TIMEOUT_MS);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.0, // Deterministic extraction - prevents hallucinations
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content ?? "{}";
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`OpenAI request timed out after ${PROVIDER_TIMEOUT_MS / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },
});

// Gemini provider using REST API
export const createGeminiProvider = (apiKey: string): LlmProvider => ({
  name: "gemini",
  call: async (prompt: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, PROVIDER_TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.0, // Deterministic extraction - prevents hallucinations
              responseMimeType: "application/json",
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`Gemini request timed out after ${PROVIDER_TIMEOUT_MS / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },
});
