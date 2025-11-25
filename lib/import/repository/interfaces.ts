import type { Doc, Id } from "@/convex/_generated/dataModel";

export interface BookRepository {
  findByUser(userId: Id<"users">): Promise<Doc<"books">[]>;
  findById(id: Id<"books">): Promise<Doc<"books"> | null>;
  create(book: Omit<Doc<"books">, "_id" | "_creationTime">): Promise<Id<"books">>;
  update(id: Id<"books">, patch: Partial<Doc<"books">>): Promise<void>;
  delete(id: Id<"books">): Promise<void>;
}

export interface ImportRunRepository {
  findByUserAndRun(userId: Id<"users">, runId: string): Promise<Doc<"importRuns"> | null>;
  findRecentByUser(userId: Id<"users">, sinceMs: number): Promise<Doc<"importRuns">[]>;
  create(run: Omit<Doc<"importRuns">, "_id" | "_creationTime">): Promise<Id<"importRuns">>;
  update(id: Id<"importRuns">, patch: Partial<Doc<"importRuns">>): Promise<void>;
}

export interface ImportPreviewRepository {
  findByUserRunPage(
    userId: Id<"users">,
    runId: string,
    page: number,
  ): Promise<Doc<"importPreviews"> | null>;
  create(
    preview: Omit<Doc<"importPreviews">, "_id" | "_creationTime">,
  ): Promise<Id<"importPreviews">>;
}
