import { useCallback, useMemo, useReducer } from "react";
import type { Id } from "@/convex/_generated/dataModel";

import type {
  ParsedBook,
  PreviewResult,
  DedupDecisionAction,
  ParseError,
} from "../lib/import/types";
import { IMPORT_PAGE_SIZE as PAGE_SIZE } from "../lib/import/types";
import { inferGenericCsv } from "../lib/import/client/csvInfer";
import { parseGoodreadsCsv } from "../lib/import/client/goodreads";
// import { parseReadingSummaryMarkdown } from "../lib/import/client/readingSummary"; // DISABLED: Markdown uses LLM exclusively
import { makeTempId } from "../lib/import/types";

type Status = "idle" | "parsing" | "previewing" | "ready" | "committing" | "success" | "error";

type Decision = {
  action: DedupDecisionAction;
  existingBookId?: Id<"books">;
  fieldsToMerge?: string[];
};

type State = {
  status: Status;
  fileName?: string;
  sourceType?: PreviewResult["sourceType"];
  importRunId?: string;
  page: number;
  totalPages: number;
  pages: ParsedBook[][];
  dedupMatches: PreviewResult["dedupMatches"];
  warnings: string[];
  errors: string[];
  decisions: Record<string, Decision>;
  summary: { created: number; merged: number; skipped: number };
};

type Action =
  | { type: "RESET" }
  | { type: "PARSE_START"; fileName: string }
  | {
      type: "PREVIEW_SUCCESS";
      payload: {
        sourceType: PreviewResult["sourceType"];
        importRunId: string;
        pages: ParsedBook[][];
        dedupMatches: PreviewResult["dedupMatches"];
        warnings: string[];
        errors: string[];
      };
    }
  | { type: "PREVIEW_ERROR"; message: string }
  | { type: "SET_PAGE"; page: number }
  | {
      type: "SET_DECISION";
      tempId: string;
      decision: Decision;
    }
  | {
      type: "COMMIT_SUCCESS";
      page: number;
      counts: { created: number; merged: number; skipped: number };
    }
  | { type: "COMMIT_ERROR"; message: string };

const initialState: State = {
  status: "idle",
  page: 0,
  totalPages: 0,
  pages: [],
  dedupMatches: [],
  warnings: [],
  errors: [],
  decisions: {},
  summary: { created: 0, merged: 0, skipped: 0 },
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "RESET":
      return initialState;
    case "PARSE_START":
      return {
        ...initialState,
        status: "parsing",
        fileName: action.fileName,
      };
    case "PREVIEW_SUCCESS":
      return {
        ...state,
        status: "ready",
        sourceType: action.payload.sourceType,
        importRunId: action.payload.importRunId,
        pages: action.payload.pages,
        totalPages: action.payload.pages.length,
        page: 0,
        dedupMatches: action.payload.dedupMatches,
        warnings: action.payload.warnings,
        errors: action.payload.errors,
      };
    case "PREVIEW_ERROR":
      return { ...state, status: "error", errors: [action.message] };
    case "SET_PAGE":
      return { ...state, page: action.page };
    case "SET_DECISION":
      return {
        ...state,
        decisions: { ...state.decisions, [action.tempId]: action.decision },
      };
    case "COMMIT_SUCCESS": {
      const { created, merged, skipped } = action.counts;
      const isLastPage = action.page + 1 >= state.totalPages;
      return {
        ...state,
        status: isLastPage ? "success" : "ready",
        page: isLastPage ? state.page : state.page + 1,
        summary: {
          created: state.summary.created + created,
          merged: state.summary.merged + merged,
          skipped: state.summary.skipped + skipped,
        },
      };
    }
    case "COMMIT_ERROR":
      return { ...state, status: "error", errors: [action.message] };
    default:
      return state;
  }
};

type ExtractBooksFn = (params: {
  rawText: string;
  sourceType: "txt" | "md" | "unknown";
  importRunId: string;
}) => Promise<{
  books: ParsedBook[];
  warnings: string[];
  errors: ParseError[];
}>;

type PreparePreviewFn = (params: {
  importRunId: string;
  sourceType: PreviewResult["sourceType"];
  rows?: ParsedBook[];
  rawText?: string;
  page: number;
  totalPages: number;
}) => Promise<PreviewResult>;

type CommitImportFn = (params: {
  importRunId: string;
  page: number;
  decisions: Array<{
    tempId: string;
    action: DedupDecisionAction;
    fieldsToMerge?: string[];
    existingBookId?: Id<"books">;
  }>;
}) => Promise<{ created: number; merged: number; skipped: number; errors: any[] }>;

type UseImportJobOptions = {
  extractBooks: ExtractBooksFn;
  preparePreview: PreparePreviewFn;
  commitImport: CommitImportFn;
};

const slicePages = (rows: ParsedBook[], size: number) => {
  const pages: ParsedBook[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    pages.push(rows.slice(i, i + size));
  }
  return pages;
};

const detectSourceType = (fileName: string, mime?: string): PreviewResult["sourceType"] => {
  if (mime?.includes("csv") || fileName.toLowerCase().endsWith(".csv")) {
    return fileName.toLowerCase().includes("goodreads") ? "goodreads-csv" : "csv";
  }
  if (fileName.toLowerCase().endsWith(".md")) return "md";
  return "txt";
};

export const useImportJob = ({
  extractBooks,
  preparePreview,
  commitImport,
}: UseImportJobOptions) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setDecision = useCallback((tempId: string, decision: Decision) => {
    dispatch({ type: "SET_DECISION", tempId, decision });
  }, []);

  const start = useCallback(
    async (file: File) => {
      console.log("[Import] Starting import for file:", file.name, "type:", file.type);
      dispatch({ type: "PARSE_START", fileName: file.name });

      const text = await file.text();
      const sourceType = detectSourceType(file.name, file.type);
      console.log("[Import] Detected source type:", sourceType);

      if (sourceType === "txt" || sourceType === "md" || sourceType === "unknown") {
        const importRunId = file.name + "-" + (crypto.randomUUID?.() ?? makeTempId("run"));
        try {
          // DISABLED: Deterministic markdown parser cannot handle arbitrary date formats
          // Markdown files must always use LLM to support arbitrary articulations
          // CSV imports continue to use deterministic parsing (works perfectly for that format)
          //
          // let deterministicWarnings: string[] = [];
          //
          // // For .md files, try deterministic parser first (no LLM needed)
          // if (sourceType === "md") {
          //   const deterministicResult = parseReadingSummaryMarkdown(text);
          //   if (deterministicResult.matched) {
          //     console.log("[Import] Deterministic parser matched, skipping LLM", {
          //       books: deterministicResult.rows.length,
          //       warnings: deterministicResult.warnings.length,
          //     });
          //
          //     const preview = await preparePreview({
          //       importRunId,
          //       sourceType: "md",
          //       rows: deterministicResult.rows,
          //       page: 0,
          //       totalPages: 1,
          //     });
          //
          //     dispatch({
          //       type: "PREVIEW_SUCCESS",
          //       payload: {
          //         sourceType: preview.sourceType,
          //         importRunId,
          //         pages: slicePages(preview.books, PAGE_SIZE),
          //         dedupMatches: preview.dedupMatches,
          //         warnings: [...deterministicResult.warnings, ...preview.warnings],
          //         errors: [...deterministicResult.errors, ...(preview.errors ?? [])].map((e) =>
          //           typeof e === "string" ? e : e.message || "Unknown error",
          //         ),
          //       },
          //     });
          //     return;
          //   }
          //   deterministicWarnings = deterministicResult.warnings;
          //   console.log("[Import] Deterministic parser did not match, falling back to LLM");
          // }

          console.log("[Import] Extracting books from text/md file via action");

          // Step 1: Extract books using LLM (Convex action - can use fetch)
          const extracted = await extractBooks({
            rawText: text,
            sourceType,
            importRunId,
          });

          console.log("[Import] Extraction result:", {
            books: extracted.books.length,
            warnings: extracted.warnings.length,
            errors: extracted.errors.length,
          });

          if (extracted.errors.length > 0) {
            console.error(
              "[Import] Extraction errors:",
              extracted.errors.map((e) => e.message).join(", "),
            );
            dispatch({
              type: "PREVIEW_ERROR",
              message: extracted.errors[0]?.message ?? "Extraction failed",
            });
            return;
          }

          // Step 2: Prepare preview with extracted books (Convex mutation - saves to DB)
          console.log("[Import] Calling preparePreview mutation with extracted books");
          const preview = await preparePreview({
            importRunId,
            sourceType,
            rows: extracted.books,
            page: 0,
            totalPages: 1,
          });

          console.log("[Import] Preview result:", {
            books: preview.books.length,
            dedupMatches: preview.dedupMatches.length,
          });

          dispatch({
            type: "PREVIEW_SUCCESS",
            payload: {
              sourceType: preview.sourceType,
              importRunId,
              pages: slicePages(preview.books, PAGE_SIZE),
              dedupMatches: preview.dedupMatches,
              warnings: [...extracted.warnings, ...preview.warnings],
              errors: [...extracted.errors, ...(preview.errors ?? [])].map((e) =>
                typeof e === "string" ? e : e.message || "Unknown error",
              ),
            },
          });
        } catch (err: any) {
          console.error("[Import] Error during preview:", err);
          dispatch({ type: "PREVIEW_ERROR", message: err?.message ?? "Preview failed" });
        }
        return;
      }

      // CSV path
      console.log("[Import] Processing CSV file");
      const parsedGoodreads = parseGoodreadsCsv(text);
      const useGoodreads = parsedGoodreads.rows.length > 0 || sourceType === "goodreads-csv";
      const parsedCsv = useGoodreads ? parsedGoodreads : inferGenericCsv(text);
      console.log("[Import] CSV parsed:", {
        useGoodreads,
        rows: parsedCsv.rows.length,
        errors: parsedCsv.errors.length,
      });

      if (parsedCsv.errors.length) {
        dispatch({
          type: "PREVIEW_ERROR",
          message: parsedCsv.errors[0]?.message ?? "Unknown parsing error",
        });
        return;
      }

      const pages = slicePages(parsedCsv.rows, PAGE_SIZE);
      const importRunId = file.name + "-" + (crypto.randomUUID?.() ?? makeTempId("run"));

      try {
        console.log("[Import] Calling preparePreview for CSV file");
        const preview = await preparePreview({
          importRunId,
          sourceType: useGoodreads ? "goodreads-csv" : "csv",
          rows: pages[0],
          rawText: undefined,
          page: 0,
          totalPages: pages.length,
        });

        console.log("[Import] CSV preview result:", {
          books: preview.books.length,
          warnings: preview.warnings.length,
          errors: preview.errors?.length ?? 0,
          totalPages: pages.length,
        });

        if (preview.errors && preview.errors.length > 0) {
          console.error("[Import] Errors from CSV preview:", preview.errors);
        }

        dispatch({
          type: "PREVIEW_SUCCESS",
          payload: {
            sourceType: preview.sourceType,
            importRunId,
            pages,
            dedupMatches: preview.dedupMatches,
            warnings: [...parsedCsv.warnings, ...preview.warnings],
            errors: (preview.errors ?? []).map((e) =>
              typeof e === "string" ? e : e.message || "Unknown error",
            ),
          },
        });
      } catch (err: any) {
        console.error("[Import] Error during CSV preview:", err);
        dispatch({ type: "PREVIEW_ERROR", message: err?.message ?? "Preview failed" });
      }
    },
    [extractBooks, preparePreview],
  );

  const setPage = useCallback((page: number) => {
    dispatch({ type: "SET_PAGE", page });
  }, []);

  const commitPage = useCallback(async () => {
    if (!state.importRunId) return;
    dispatch({ type: "SET_PAGE", page: state.page });
    const pageRows = state.pages[state.page] ?? [];

    // Build match map for intelligent defaults
    const matchMap = new Map(state.dedupMatches.map((m) => [m.tempId, m]));

    const decisions = pageRows.map((row) => {
      // If user set explicit decision, use it
      const explicitDecision = state.decisions[row.tempId];
      if (explicitDecision) {
        return {
          tempId: row.tempId,
          action: explicitDecision.action,
          fieldsToMerge: explicitDecision.fieldsToMerge,
          existingBookId: explicitDecision.existingBookId,
        };
      }

      // Otherwise compute intelligent default
      const match = matchMap.get(row.tempId);
      if (!match) {
        // No match → create new book
        return {
          tempId: row.tempId,
          action: "create" as DedupDecisionAction,
          fieldsToMerge: undefined,
          existingBookId: undefined,
        };
      }

      if (match.confidence > 0.85) {
        // High confidence → merge
        return {
          tempId: row.tempId,
          action: "merge" as DedupDecisionAction,
          fieldsToMerge: undefined,
          existingBookId: match.existingBookId,
        };
      }

      // Low confidence → skip (needs review)
      return {
        tempId: row.tempId,
        action: "skip" as DedupDecisionAction,
        fieldsToMerge: undefined,
        existingBookId: undefined,
      };
    });

    try {
      const result = await commitImport({
        importRunId: state.importRunId,
        page: state.page,
        decisions,
      });

      dispatch({
        type: "COMMIT_SUCCESS",
        page: state.page,
        counts: {
          created: result.created ?? 0,
          merged: result.merged ?? 0,
          skipped: result.skipped ?? 0,
        },
      });
    } catch (err: any) {
      dispatch({ type: "COMMIT_ERROR", message: err?.message ?? "Commit failed" });
    }
  }, [
    commitImport,
    state.decisions,
    state.dedupMatches,
    state.importRunId,
    state.page,
    state.pages,
  ]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return useMemo(
    () => ({
      state,
      start,
      setDecision,
      setPage,
      commitPage,
      reset,
      pageSize: PAGE_SIZE,
    }),
    [commitPage, setDecision, setPage, start, state, reset],
  );
};

export type UseImportJobReturn = ReturnType<typeof useImportJob>;
