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

export type PreparePreviewArgs = Parameters<typeof preparePreview>[0]["args"];

export const preparePreviewHandler = async (
  ctx: any,
  args: PreparePreviewArgs
) => {
  const userId = (await requireAuth(ctx)) as Id<"users">;

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
