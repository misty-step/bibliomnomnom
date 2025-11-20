import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { requireAuth } from "./auth";
import {
  parsedBookSchema,
  ParseError,
  ParsedBook,
  LLM_TOKEN_CAP,
} from "../lib/import/types";
import { dedupHelpers } from "../lib/import/dedup";
import { llmExtract } from "../lib/import/llm";
import type { Doc } from "./_generated/dataModel";
import { logImportEvent } from "../lib/import/metrics";

type Decision = {
  tempId: string;
  action: "skip" | "merge" | "create";
  fieldsToMerge?: string[];
};

const isCsvSource = (source: string) =>
  source === "goodreads-csv" || source === "csv";

export const preparePreview = mutation({
  args: {
    importRunId: v.string(),
    sourceType: v.union(
      v.literal("goodreads-csv"),
      v.literal("csv"),
      v.literal("txt"),
      v.literal("md"),
      v.literal("unknown")
    ),
    rows: v.optional(v.array(parsedBookSchema)),
    rawText: v.optional(v.string()),
    page: v.number(),
    totalPages: v.optional(v.number()),
  },
  handler: async (ctx, args) => preparePreviewHandler(ctx, args),
});

export const commitImport = mutation({
  args: {
    importRunId: v.string(),
    page: v.number(),
    decisions: v.array(
      v.object({
        tempId: v.string(),
        action: v.union(
          v.literal("skip"),
          v.literal("merge"),
          v.literal("create")
        ),
        fieldsToMerge: v.optional(v.array(v.string())),
        existingBookId: v.optional(v.id("books")),
      })
    ),
  },
  handler: async (ctx, args) => commitImportHandler(ctx, args),
});

export type PreparePreviewArgs = Parameters<typeof preparePreview>[0]["args"];

export const preparePreviewHandler = async (
  ctx: any,
  args: PreparePreviewArgs
) => {
  const userId = (await requireAuth(ctx)) as Id<"users">;

  await enforceRateLimits(ctx, userId);

  let books: ParsedBook[] = args.rows ?? [];
  const warnings: string[] = [];
  const errors: ParseError[] = [];

  if (!isCsvSource(args.sourceType)) {
    const llmResult = await llmExtract(args.rawText ?? "", {
      tokenCap: LLM_TOKEN_CAP,
    });
    books = llmResult.rows;
    warnings.push(...llmResult.warnings);
    errors.push(...llmResult.errors);
  }

  const dedupMatches = await dedupHelpers.findMatches(ctx.db, userId, books);

  // Store latest preview payload for commit validation/idempotency.
  await ctx.db.insert("importPreviews", {
    importRunId: args.importRunId,
    userId,
    books,
    page: args.page,
    createdAt: Date.now(),
  });

  await upsertImportRun(ctx, {
    userId,
    importRunId: args.importRunId,
    sourceType: args.sourceType,
    page: args.page,
    totalPages: args.totalPages ?? 1,
    rowCount: books.length,
    errors: errors.length,
  });

  return {
    sourceType: args.sourceType,
    books,
    warnings,
    dedupMatches,
    errors,
    importRunId: args.importRunId,
  };

  logImportEvent({
    phase: "preview",
    importRunId: args.importRunId,
    sourceType: args.sourceType,
    counts: { rows: books.length, errors: errors.length },
    tokenUsage: 0, // llmExtract returns usage internally if needed later
    page: args.page,
  });
};

const upsertImportRun = async (
  ctx: any,
  params: {
    userId: Id<"users">;
    importRunId: string;
    sourceType: string;
    page: number;
    totalPages: number;
    rowCount: number;
    errors: number;
  }
) => {
  const existing = await ctx.db
    .query("importRuns")
    .withIndex("by_user_run", (q: any) =>
      q.eq("userId", params.userId).eq("importRunId", params.importRunId)
    )
    .first();

  const now = Date.now();

  if (!existing) {
    await ctx.db.insert("importRuns", {
      userId: params.userId,
      importRunId: params.importRunId,
      status: "previewed",
      sourceType: params.sourceType,
      page: params.page,
      totalPages: params.totalPages,
      counts: {
        rows: params.rowCount,
        created: 0,
        merged: 0,
        skipped: 0,
        errors: params.errors,
      },
      errorMessage: undefined,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.patch(existing._id, {
    status: "previewed",
    sourceType: params.sourceType,
    page: params.page,
    totalPages: params.totalPages,
    counts: {
      ...existing.counts,
      rows: params.rowCount,
      errors: params.errors,
    },
    updatedAt: now,
    errorMessage: undefined,
  });
};

export type CommitImportArgs = Parameters<typeof commitImport>[0]["args"];

export const commitImportHandler = async (ctx: any, args: CommitImportArgs) => {
  const userId = (await requireAuth(ctx)) as Id<"users">;

  await enforceRateLimits(ctx, userId);

  const run = await ctx.db
    .query("importRuns")
    .withIndex("by_user_run", (q: any) =>
      q.eq("userId", userId).eq("importRunId", args.importRunId)
    )
    .first();

  if (!run) {
    throw new Error("Preview required before commit");
  }

  if (run.status === "committed" && run.page === args.page) {
    return {
      created: run.counts.created,
      merged: run.counts.merged,
      skipped: run.counts.skipped,
      errors: [],
    } satisfies Summary;
  }

  const now = Date.now();
  const decisionsByTempId = new Map<string, Decision>();
  args.decisions.forEach((d) => decisionsByTempId.set(d.tempId, d));

  const incomingMap = await loadPreviewRows(ctx, userId, args.importRunId, args.page);

  let created = 0;
  let merged = 0;
  let skipped = 0;
  const errors: ParseError[] = [];

  for (const decision of args.decisions) {
    const incoming = incomingMap.get(decision.tempId);
    if (!incoming) {
      errors.push({
        message: `Unknown tempId ${decision.tempId}`,
      });
      continue;
    }

    if (decision.action === "skip") {
      skipped += 1;
      continue;
    }

    if (decision.action === "create") {
      await ctx.db.insert("books", dedupHelpers.buildNewBook(incoming, userId));
      created += 1;
      continue;
    }

    if (!decision.existingBookId) {
      errors.push({ message: `Missing existingBookId for merge ${decision.tempId}` });
      continue;
    }

    const existing = await ctx.db.get(decision.existingBookId as Id<"books">);
    if (!existing || existing.userId !== userId) {
      errors.push({ message: `Book not found for merge ${decision.existingBookId}` });
      continue;
    }

    const patch = dedupHelpers.applyDecision(existing as Doc<"books">, incoming, "merge");
    if (patch && Object.keys(patch).length) {
      await ctx.db.patch(existing._id, {
        ...patch,
        updatedAt: now,
      });
      merged += 1;
    } else {
      skipped += 1;
    }
  }

  await ctx.db.patch(run._id, {
    status: "committed",
    page: args.page,
    counts: {
      ...run.counts,
      created: run.counts.created + created,
      merged: run.counts.merged + merged,
      skipped: run.counts.skipped + skipped,
      errors: run.counts.errors + errors.length,
    },
    updatedAt: now,
  });

  return {
    created,
    merged,
    skipped,
    errors,
  } satisfies Summary;
};

type Summary = { created: number; merged: number; skipped: number; errors: ParseError[] };

const loadPreviewRows = async (
  ctx: any,
  userId: Id<"users">,
  importRunId: string,
  page: number
): Promise<Map<string, ParsedBook>> => {
  const map = new Map<string, ParsedBook>();
  const preview = await ctx.db
    .query("importPreviews")
    .withIndex("by_user_run_page", (q: any) =>
      q.eq("userId", userId).eq("importRunId", importRunId).eq("page", page)
    )
    .first();

  if (!preview || !Array.isArray(preview.books)) {
    return map;
  }

  preview.books.forEach((row: ParsedBook) => {
    map.set(row.tempId, row);
  });

  return map;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_LIMIT = 5;
const CONCURRENT_LIMIT = 2;

const enforceRateLimits = async (ctx: any, userId: Id<"users">) => {
  const now = Date.now();
  const runs = await ctx.db
    .query("importRuns")
    .withIndex("by_user_run", (q: any) => q.eq("userId", userId))
    .collect();

  const recent = runs.filter((r: any) => now - r.createdAt < ONE_DAY_MS);
  if (recent.length >= DAILY_LIMIT) {
    throw new Error("Too many imports today. Please try again tomorrow.");
  }

  const inFlight = recent.filter((r: any) => r.status === "previewed");
  if (inFlight.length >= CONCURRENT_LIMIT) {
    throw new Error("Too many concurrent imports. Finish existing imports before starting another.");
  }
};
