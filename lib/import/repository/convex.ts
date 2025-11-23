import type { DatabaseReader, DatabaseWriter } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

import type {
  BookRepository,
  ImportPreviewRepository,
  ImportRunRepository,
} from "./interfaces";

type Db = Pick<DatabaseReader & DatabaseWriter, "query" | "get" | "insert" | "patch" | "delete">;

export class ConvexBookRepository implements BookRepository {
  constructor(private readonly db: Db) {}

  async findByUser(userId: Id<"users">): Promise<Doc<"books">[]> {
    return this.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  }

  async findById(id: Id<"books">): Promise<Doc<"books"> | null> {
    return (await this.db.get(id)) ?? null;
  }

  async create(book: Omit<Doc<"books">, "_id" | "_creationTime">): Promise<Id<"books">> {
    return this.db.insert("books", book);
  }

  async update(id: Id<"books">, patch: Partial<Doc<"books">>): Promise<void> {
    await this.db.patch(id, patch);
  }

  async delete(id: Id<"books">): Promise<void> {
    await this.db.delete(id);
  }
}

export class ConvexImportRunRepository implements ImportRunRepository {
  constructor(private readonly db: Db) {}

  async findByUserAndRun(userId: Id<"users">, runId: string): Promise<Doc<"importRuns"> | null> {
    return (
      (await this.db
        .query("importRuns")
        .withIndex("by_user_run", (q) => q.eq("userId", userId).eq("importRunId", runId))
        .first()) ?? null
    );
  }

  async findRecentByUser(userId: Id<"users">, sinceMs: number): Promise<Doc<"importRuns">[]> {
    const now = Date.now();
    const runs = await this.db
      .query("importRuns")
      .withIndex("by_user_run", (q) => q.eq("userId", userId))
      .collect();

    return runs.filter((run) => now - (run.createdAt ?? 0) < sinceMs);
  }

  async create(run: Omit<Doc<"importRuns">, "_id" | "_creationTime">): Promise<Id<"importRuns">> {
    return this.db.insert("importRuns", run);
  }

  async update(id: Id<"importRuns">, patch: Partial<Doc<"importRuns">>): Promise<void> {
    await this.db.patch(id, patch);
  }
}

export class ConvexImportPreviewRepository implements ImportPreviewRepository {
  constructor(private readonly db: Db) {}

  async findByUserRunPage(
    userId: Id<"users">,
    runId: string,
    page: number
  ): Promise<Doc<"importPreviews"> | null> {
    return (
      (await this.db
        .query("importPreviews")
        .withIndex("by_user_run_page", (q) =>
          q.eq("userId", userId).eq("importRunId", runId).eq("page", page)
        )
        .first()) ?? null
    );
  }

  async create(preview: Omit<Doc<"importPreviews">, "_id" | "_creationTime">): Promise<Id<"importPreviews">> {
    return this.db.insert("importPreviews", preview);
  }
}

export const createConvexRepositories = (db: Db) => ({
  books: new ConvexBookRepository(db),
  importRuns: new ConvexImportRunRepository(db),
  importPreviews: new ConvexImportPreviewRepository(db),
});
