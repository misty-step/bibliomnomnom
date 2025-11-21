import { useCallback, useMemo, useReducer } from "react";

import type {
  ParsedBook,
  PreviewResult,
  DedupDecisionAction,
  IMPORT_PAGE_SIZE,
} from "../lib/import/types";
import { IMPORT_PAGE_SIZE as PAGE_SIZE } from "../lib/import/types";
import { inferGenericCsv } from "../lib/import/client/csvInfer";
import { parseGoodreadsCsv } from "../lib/import/client/goodreads";
import { makeTempId } from "../lib/import/types";

type Status =
  | "idle"
  | "parsing"
  | "previewing"
  | "ready"
  | "committing"
  | "success"
  | "error";

type Decision = {
  action: DedupDecisionAction;
  existingBookId?: string;
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
        errors: [],
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
    existingBookId?: string;
  }>;
}) => Promise<{ created: number; merged: number; skipped: number; errors: any[] }>;

type UseImportJobOptions = {
  preparePreview: PreparePreviewFn;
  commitImport: CommitImportFn;
};

const slicePages = (rows: ParsedBook[], size: number) => {
  const pages: ParsedBook[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    pages.push(rows.slice(i, i + size));
  }
  return pages.length ? pages : [[]];
};

const detectSourceType = (fileName: string, mime?: string): PreviewResult["sourceType"] => {
  if (mime?.includes("csv") || fileName.toLowerCase().endsWith(".csv")) {
    return fileName.toLowerCase().includes("goodreads")
      ? "goodreads-csv"
      : "csv";
  }
  if (fileName.toLowerCase().endsWith(".md")) return "md";
  return "txt";
};

export const useImportJob = ({ preparePreview, commitImport }: UseImportJobOptions) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setDecision = useCallback(
    (tempId: string, decision: Decision) => {
      dispatch({ type: "SET_DECISION", tempId, decision });
    },
    []
  );

  const start = useCallback(
    async (file: File) => {
      dispatch({ type: "PARSE_START", fileName: file.name });

      const text = await file.text();
      const sourceType = detectSourceType(file.name, file.type);

      if (sourceType === "txt" || sourceType === "md" || sourceType === "unknown") {
        const importRunId = file.name + "-" + (crypto.randomUUID?.() ?? makeTempId("run"));
        try {
          dispatch({ type: "PREVIEW_SUCCESS", payload: {
            sourceType,
            importRunId,
            pages: [[]],
            dedupMatches: [],
            warnings: [],
          }});
          const preview = await preparePreview({
            importRunId,
            sourceType,
            rawText: text,
            page: 0,
            totalPages: 1,
          });

          dispatch({
            type: "PREVIEW_SUCCESS",
            payload: {
              sourceType: preview.sourceType,
              importRunId,
              pages: slicePages(preview.books, PAGE_SIZE),
              dedupMatches: preview.dedupMatches,
              warnings: preview.warnings,
            },
          });
        } catch (err: any) {
          dispatch({ type: "PREVIEW_ERROR", message: err?.message ?? "Preview failed" });
        }
        return;
      }

      // CSV path
      const parsedGoodreads = parseGoodreadsCsv(text);
      const useGoodreads = parsedGoodreads.rows.length > 0 || sourceType === "goodreads-csv";
      const parsedCsv = useGoodreads ? parsedGoodreads : inferGenericCsv(text);

      if (parsedCsv.errors.length) {
        dispatch({
          type: "PREVIEW_ERROR",
          message: parsedCsv.errors[0].message,
        });
        return;
      }

      const pages = slicePages(parsedCsv.rows, PAGE_SIZE);
      const importRunId = file.name + "-" + (crypto.randomUUID?.() ?? makeTempId("run"));

      try {
        const preview = await preparePreview({
          importRunId,
          sourceType: useGoodreads ? "goodreads-csv" : "csv",
          rows: pages[0],
          rawText: undefined,
          page: 0,
          totalPages: pages.length,
        });

        dispatch({
          type: "PREVIEW_SUCCESS",
          payload: {
            sourceType: preview.sourceType,
            importRunId,
            pages,
            dedupMatches: preview.dedupMatches,
            warnings: [...parsedCsv.warnings, ...preview.warnings],
          },
        });
      } catch (err: any) {
        dispatch({ type: "PREVIEW_ERROR", message: err?.message ?? "Preview failed" });
      }
    },
    [preparePreview]
  );

  const setPage = useCallback((page: number) => {
    dispatch({ type: "SET_PAGE", page });
  }, []);

  const commitPage = useCallback(async () => {
    if (!state.importRunId) return;
    dispatch({ type: "SET_PAGE", page: state.page });
    const pageRows = state.pages[state.page] ?? [];
    const decisions = pageRows.map((row) => {
      const decision = state.decisions[row.tempId] ?? { action: "skip" as DedupDecisionAction };
      return {
        tempId: row.tempId,
        action: decision.action,
        fieldsToMerge: decision.fieldsToMerge,
        existingBookId: decision.existingBookId as any,
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
  }, [commitImport, state.decisions, state.importRunId, state.page, state.pages]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return useMemo(
    () => ({
      state,
      start,
      setDecision,
      setPage,
      commitPage,
      reset,
      pageSize: PAGE_SIZE as typeof IMPORT_PAGE_SIZE,
    }),
    [commitPage, setDecision, setPage, start, state, reset]
  );
};

export type UseImportJobReturn = ReturnType<typeof useImportJob>;
