import type { Doc, Id } from "@/convex/_generated/dataModel";

import type { BookRepository, ImportPreviewRepository, ImportRunRepository } from "./interfaces";

const now = () => Date.now();

const makeId = (prefix: string, counter: () => number) => `${prefix}_${counter()}` as Id<any>;

const createCounter = () => {
  let value = 1;
  return () => value++;
};

export class InMemoryBookRepository implements BookRepository {
  private books = new Map<Id<"books">, Doc<"books">>();
  private next = createCounter();

  async findByUser(userId: Id<"users">): Promise<Doc<"books">[]> {
    return Array.from(this.books.values()).filter((b) => b.userId === userId);
  }

  async findById(id: Id<"books">): Promise<Doc<"books"> | null> {
    return this.books.get(id) ?? null;
  }

  async create(book: Omit<Doc<"books">, "_id" | "_creationTime">): Promise<Id<"books">> {
    const _id = makeId("book", this.next) as Id<"books">;
    const doc: Doc<"books"> = { ...book, _id, _creationTime: now() };
    this.books.set(_id, doc);
    return _id;
  }

  async update(id: Id<"books">, patch: Partial<Doc<"books">>): Promise<void> {
    const current = this.books.get(id);
    if (!current) throw new Error(`Book ${id} not found`);
    this.books.set(id, { ...current, ...patch });
  }

  async delete(id: Id<"books">): Promise<void> {
    this.books.delete(id);
  }

  seed(docs: Doc<"books">[]): void {
    docs.forEach((doc) => this.books.set(doc._id, doc));
  }

  clear(): void {
    this.books.clear();
  }
}

export class InMemoryImportRunRepository implements ImportRunRepository {
  private runs = new Map<Id<"importRuns">, Doc<"importRuns">>();
  private next = createCounter();

  async findByUserAndRun(userId: Id<"users">, runId: string): Promise<Doc<"importRuns"> | null> {
    return (
      Array.from(this.runs.values()).find(
        (run) => run.userId === userId && run.importRunId === runId,
      ) ?? null
    );
  }

  async findRecentByUser(userId: Id<"users">, sinceMs: number): Promise<Doc<"importRuns">[]> {
    const cutoff = now() - sinceMs;
    return Array.from(this.runs.values()).filter(
      (run) => run.userId === userId && (run.createdAt ?? run._creationTime) >= cutoff,
    );
  }

  async create(run: Omit<Doc<"importRuns">, "_id" | "_creationTime">): Promise<Id<"importRuns">> {
    const _id = makeId("importRun", this.next) as Id<"importRuns">;
    const doc: Doc<"importRuns"> = { ...run, _id, _creationTime: now() };
    this.runs.set(_id, doc);
    return _id;
  }

  async update(id: Id<"importRuns">, patch: Partial<Doc<"importRuns">>): Promise<void> {
    const current = this.runs.get(id);
    if (!current) throw new Error(`ImportRun ${id} not found`);
    this.runs.set(id, { ...current, ...patch });
  }

  seed(docs: Doc<"importRuns">[]): void {
    docs.forEach((doc) => this.runs.set(doc._id, doc));
  }

  clear(): void {
    this.runs.clear();
  }
}

export class InMemoryImportPreviewRepository implements ImportPreviewRepository {
  private previews = new Map<string, Doc<"importPreviews">>();
  private next = createCounter();

  private key(userId: Id<"users">, runId: string, page: number) {
    return `${userId}|${runId}|${page}`;
  }

  async findByUserRunPage(
    userId: Id<"users">,
    runId: string,
    page: number,
  ): Promise<Doc<"importPreviews"> | null> {
    return this.previews.get(this.key(userId, runId, page)) ?? null;
  }

  async create(
    preview: Omit<Doc<"importPreviews">, "_id" | "_creationTime">,
  ): Promise<Id<"importPreviews">> {
    const _id = makeId("importPreview", this.next) as Id<"importPreviews">;
    const doc: Doc<"importPreviews"> = { ...preview, _id, _creationTime: now() };
    this.previews.set(this.key(preview.userId, preview.importRunId, preview.page), doc);
    return _id;
  }

  seed(docs: Doc<"importPreviews">[]): void {
    docs.forEach((doc) => this.previews.set(this.key(doc.userId, doc.importRunId, doc.page), doc));
  }

  clear(): void {
    this.previews.clear();
  }
}

export const createInMemoryRepositories = () => ({
  books: new InMemoryBookRepository(),
  importRuns: new InMemoryImportRunRepository(),
  importPreviews: new InMemoryImportPreviewRepository(),
});
