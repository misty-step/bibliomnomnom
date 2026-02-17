import { mutation, action } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { requireAuth, requireAuthAction } from "./auth";
import { parsedBookSchema, ParseError, ParsedBook, LLM_TOKEN_CAP } from "../lib/import/types";
import { dedupHelpers } from "../lib/import/dedup";
import { matchBooks } from "../lib/import/dedup/core";
import {
  llmExtract,
  createOpenRouterExtractionProvider,
  createOpenRouterVerificationProvider,
} from "../lib/import/llm";
import { DEFAULT_IMPORT_MODEL } from "../lib/ai/models";
import { ConvexImportRunRepository } from "../lib/import/repository/convex";
import { checkImportRateLimits, shouldSkipRateLimits } from "../lib/import/rateLimit";
import { createConvexRepositories } from "../lib/import/repository/convex";
import type { Doc } from "./_generated/dataModel";
import { logImportEvent } from "../lib/import/metrics";

const preparePreviewArgs = {
  importRunId: v.string(),
  sourceType: v.union(
    v.literal("goodreads-csv"),
    v.literal("csv"),
    v.literal("txt"),
    v.literal("md"),
    v.literal("unknown"),
  ),
  rows: v.optional(v.array(parsedBookSchema)),
  rawText: v.optional(v.string()),
  page: v.number(),
  totalPages: v.optional(v.number()),
};

export const preparePreview = mutation({
  args: preparePreviewArgs,
  handler: async (ctx, args) => preparePreviewHandler(ctx, args),
});

const commitImportArgs = {
  importRunId: v.string(),
  page: v.number(),
  decisions: v.array(
    v.object({
      tempId: v.string(),
      action: v.union(v.literal("skip"), v.literal("merge"), v.literal("create")),
      fieldsToMerge: v.optional(v.array(v.string())),
      existingBookId: v.optional(v.id("books")),
    }),
  ),
};

export const commitImport = mutation({
  args: commitImportArgs,
  handler: async (ctx, args) => commitImportHandler(ctx, args),
});

export const cleanupStuckImports = mutation({
  handler: async (ctx) => {
    const userId = (await requireAuth(ctx)) as Id<"users">;

    const stuck = await ctx.db
      .query("importRuns")
      .withIndex("by_user_run", (q: any) => q.eq("userId", userId))
      .collect();

    const previewed = stuck.filter((r) => r.status === "previewed");

    for (const run of previewed) {
      await ctx.db.delete(run._id);
    }

    return { deleted: previewed.length };
  },
});

// Admin-only cleanup for all users (use carefully in development)
export const adminCleanupAllStuckImports = mutation({
  handler: async (ctx) => {
    // Restrict to authenticated callers and non-production environments to avoid accidental mass deletes.
    const userId = (await requireAuth(ctx)) as Id<"users">;
    if (process.env.NODE_ENV === "production") {
      throw new Error("adminCleanupAllStuckImports is disabled in production");
    }

    const allStuck = await ctx.db
      .query("importRuns")
      .filter((q) => q.eq(q.field("status"), "previewed"))
      .collect();

    for (const run of allStuck) {
      await ctx.db.delete(run._id);
    }

    return { deleted: allStuck.length, requestedBy: userId };
  },
});

// Action to extract books from text using LLM (fetch allowed here)
export const extractBooks = action({
  args: {
    rawText: v.string(),
    sourceType: v.union(v.literal("txt"), v.literal("md"), v.literal("unknown")),
    importRunId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthAction(ctx);

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return {
        books: [],
        warnings: [],
        errors: [
          {
            message:
              "No LLM provider configured. Set OPENROUTER_API_KEY in Convex env vars (or run `bun run convex:env:sync`) to enable TXT/MD imports.",
          },
        ] as ParseError[],
      };
    }

    const model = process.env.OPENROUTER_IMPORT_MODEL || DEFAULT_IMPORT_MODEL;
    const verifierModel = process.env.OPENROUTER_IMPORT_VERIFIER_MODEL;

    const provider = createOpenRouterExtractionProvider({ apiKey: openrouterKey, model });
    const verifierProvider = verifierModel
      ? createOpenRouterVerificationProvider({ apiKey: openrouterKey, model: verifierModel })
      : undefined;

    try {
      const llmResult = await llmExtract(args.rawText ?? "", {
        tokenCap: LLM_TOKEN_CAP,
        provider,
        verifierProvider,
      });

      return {
        books: llmResult.rows,
        warnings: llmResult.warnings,
        errors: llmResult.errors,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown extraction error";
      return {
        books: [],
        warnings: [],
        errors: [{ message }] as ParseError[],
      };
    }
  },
});

export const preparePreviewHandler = async (
  ctx: any,
  args: {
    importRunId: string;
    sourceType: "goodreads-csv" | "csv" | "txt" | "md" | "unknown";
    rows?: ParsedBook[];
    rawText?: string;
    page: number;
    totalPages?: number;
  },
) => {
  const userId = (await requireAuth(ctx)) as Id<"users">;
  const repos = createConvexRepositories(ctx.db as any);
  const importRunRepo = repos.importRuns;

  const existingRun = await importRunRepo.findByUserAndRun(userId, args.importRunId);

  if (args.page !== 0 && !existingRun) {
    throw new Error("Preview required before preparing this page");
  }

  if (args.page === 0 && !existingRun && !shouldSkipRateLimits()) {
    await checkImportRateLimits(importRunRepo, userId);
  }

  // Note: LLM extraction now happens in extractBooks action (can use fetch)
  // This mutation only receives pre-extracted books from CSV or action
  const books: ParsedBook[] = args.rows ?? [];
  const warnings: string[] = [];
  const errors: ParseError[] = [];

  const existingBooks = await repos.books.findByUser(userId);
  const dedupMatches = matchBooks(existingBooks, books);

  // Store latest preview payload for commit validation/idempotency.
  await repos.importPreviews.create({
    importRunId: args.importRunId,
    userId,
    books,
    page: args.page,
    createdAt: Date.now(),
  });

  // Determine status: failed if errors OR no books extracted
  const importStatus = errors.length > 0 || books.length === 0 ? "failed" : "previewed";

  if (args.page === 0) {
    await upsertImportRun(importRunRepo, {
      userId,
      importRunId: args.importRunId,
      sourceType: args.sourceType,
      page: args.page,
      totalPages: args.totalPages ?? 1,
      rowCount: books.length,
      errors: errors.length,
      status: importStatus,
    });
  }

  logImportEvent({
    phase: "preview",
    importRunId: args.importRunId,
    sourceType: args.sourceType,
    counts: { rows: books.length, errors: errors.length },
    tokenUsage: 0,
    page: args.page,
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
  importRunRepo: ConvexImportRunRepository,
  params: {
    userId: Id<"users">;
    importRunId: string;
    sourceType: string;
    page: number;
    totalPages: number;
    rowCount: number;
    errors: number;
    status: "previewed" | "failed" | "committed";
  },
) => {
  const existing = await importRunRepo.findByUserAndRun(params.userId, params.importRunId);

  const now = Date.now();

  if (!existing) {
    await importRunRepo.create({
      userId: params.userId,
      importRunId: params.importRunId,
      status: params.status,
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

  await importRunRepo.update(existing._id, {
    status: params.status,
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

export const commitImportHandler = async (
  ctx: any,
  args: {
    importRunId: string;
    page: number;
    decisions: Array<{
      tempId: string;
      action: "skip" | "merge" | "create";
      fieldsToMerge?: string[];
      existingBookId?: Id<"books">;
    }>;
  },
) => {
  const userId = (await requireAuth(ctx)) as Id<"users">;
  const repos = createConvexRepositories(ctx.db as any);
  const importRunRepo = repos.importRuns;

  // Note: Rate limit check removed - already enforced during preparePreview,
  // and checking here would block the previewed import from committing itself.

  const run = await importRunRepo.findByUserAndRun(userId, args.importRunId);

  if (!run) {
    throw new Error("Preview required before commit");
  }

  if (run.status === "committed" && run.page >= args.page) {
    return {
      created: 0,
      merged: 0,
      skipped: 0,
      errors: [],
    } satisfies Summary;
  }

  const now = Date.now();

  const preview = await repos.importPreviews.findByUserRunPage(userId, args.importRunId, args.page);
  if (!preview || !Array.isArray(preview.books)) {
    return {
      created: 0,
      merged: 0,
      skipped: 0,
      errors: [{ message: `Preview required for page ${args.page + 1}` }],
    } satisfies Summary;
  }

  const incomingMap = new Map<string, ParsedBook>();
  preview.books.forEach((row: ParsedBook) => {
    incomingMap.set(row.tempId, row);
  });

  let created = 0;
  let merged = 0;
  let skipped = 0;
  const errors: ParseError[] = [];

  const mergeIds = new Set<Id<"books">>();

  for (const decision of args.decisions) {
    const incoming = incomingMap.get(decision.tempId);
    if (!incoming) {
      errors.push({ message: `Unknown tempId ${decision.tempId}` });
    }

    if (decision.action === "merge") {
      if (!decision.existingBookId) {
        errors.push({ message: `Missing existingBookId for merge ${decision.tempId}` });
      } else {
        mergeIds.add(decision.existingBookId);
      }
    }
  }

  if (errors.length) {
    return { created: 0, merged: 0, skipped: 0, errors } satisfies Summary;
  }

  const existingById = new Map<Id<"books">, Doc<"books">>();
  for (const id of mergeIds) {
    const existing = await repos.books.findById(id);
    if (!existing || existing.userId !== userId) {
      errors.push({ message: `Book not found for merge ${id}` });
      continue;
    }
    existingById.set(id, existing as Doc<"books">);
  }

  if (errors.length) {
    return { created: 0, merged: 0, skipped: 0, errors } satisfies Summary;
  }

  for (const decision of args.decisions) {
    const incoming = incomingMap.get(decision.tempId) as ParsedBook;

    if (decision.action === "skip") {
      skipped += 1;
      continue;
    }

    if (decision.action === "create") {
      await repos.books.create(dedupHelpers.buildNewBook(incoming, userId));
      created += 1;
      continue;
    }

    const existing = existingById.get(decision.existingBookId as Id<"books">) as Doc<"books">;

    const patch = dedupHelpers.applyDecision(existing as Doc<"books">, incoming, "merge");
    if (patch && Object.keys(patch).length) {
      await repos.books.update(existing._id, {
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
