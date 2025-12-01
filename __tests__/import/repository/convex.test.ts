import { describe, expect, it, vi } from "vitest";
import {
  ConvexBookRepository,
  ConvexImportRunRepository,
  ConvexImportPreviewRepository,
  createConvexRepositories,
} from "@/lib/import/repository/convex";
import type { Id } from "@/convex/_generated/dataModel";

const mockDb = {
  query: vi.fn(),
  get: vi.fn(),
  insert: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

const mockQuery = {
  withIndex: vi.fn().mockReturnThis(),
  collect: vi.fn(),
  first: vi.fn(),
  eq: vi.fn().mockReturnThis(),
};

describe("ConvexBookRepository", () => {
  const repo = new ConvexBookRepository(mockDb as any);

  it("findByUser queries books by user", async () => {
    mockDb.query.mockReturnValue(mockQuery);
    mockQuery.collect.mockResolvedValue([]);

    await repo.findByUser("u1" as Id<"users">);

    expect(mockDb.query).toHaveBeenCalledWith("books");
    expect(mockQuery.withIndex).toHaveBeenCalledWith("by_user", expect.any(Function));
  });

  it("findById returns null if not found", async () => {
    mockDb.get.mockResolvedValue(null);
    expect(await repo.findById("b1" as Id<"books">)).toBeNull();
  });

  it("findById returns doc if found", async () => {
    mockDb.get.mockResolvedValue({ _id: "b1" });
    expect(await repo.findById("b1" as Id<"books">)).toEqual({ _id: "b1" });
  });

  it("create inserts book", async () => {
    mockDb.insert.mockResolvedValue("b1");
    const id = await repo.create({ title: "Book" } as any);
    expect(id).toBe("b1");
    expect(mockDb.insert).toHaveBeenCalledWith("books", { title: "Book" });
  });

  it("update patches book", async () => {
    await repo.update("b1" as Id<"books">, { title: "New" });
    expect(mockDb.patch).toHaveBeenCalledWith("b1", { title: "New" });
  });

  it("delete removes book", async () => {
    await repo.delete("b1" as Id<"books">);
    expect(mockDb.delete).toHaveBeenCalledWith("b1");
  });
});

describe("ConvexImportRunRepository", () => {
  const repo = new ConvexImportRunRepository(mockDb as any);

  it("findByUserAndRun returns null if not found", async () => {
    mockDb.query.mockReturnValue(mockQuery);
    mockQuery.first.mockResolvedValue(null);
    expect(await repo.findByUserAndRun("u1" as Id<"users">, "r1")).toBeNull();
  });

  it("findByUserAndRun returns doc if found", async () => {
    mockDb.query.mockReturnValue(mockQuery);
    mockQuery.first.mockResolvedValue({ _id: "r1" });
    expect(await repo.findByUserAndRun("u1" as Id<"users">, "r1")).toEqual({ _id: "r1" });
  });

  it("findRecentByUser filters by time", async () => {
    mockDb.query.mockReturnValue(mockQuery);
    const now = Date.now();
    mockQuery.collect.mockResolvedValue([
      { createdAt: now }, // Recent
      { createdAt: now - 1000000 }, // Old
    ]);

    const runs = await repo.findRecentByUser("u1" as Id<"users">, 5000);
    expect(runs).toHaveLength(1);
  });

  it("findRecentByUser handles missing createdAt", async () => {
    mockDb.query.mockReturnValue(mockQuery);
    mockQuery.collect.mockResolvedValue([
      {}, // No createdAt -> 0
    ]);

    const runs = await repo.findRecentByUser("u1" as Id<"users">, 5000);
    expect(runs).toHaveLength(0); // 0 is very old
  });

  it("create inserts run", async () => {
    mockDb.insert.mockResolvedValue("r1");
    await repo.create({ status: "pending" } as any);
    expect(mockDb.insert).toHaveBeenCalledWith("importRuns", { status: "pending" });
  });

  it("update patches run", async () => {
    await repo.update("r1" as Id<"importRuns">, { status: "committed" });
    expect(mockDb.patch).toHaveBeenCalledWith("r1", { status: "committed" });
  });
});

describe("ConvexImportPreviewRepository", () => {
  const repo = new ConvexImportPreviewRepository(mockDb as any);

  it("findByUserRunPage returns null if not found", async () => {
    mockDb.query.mockReturnValue(mockQuery);
    mockQuery.first.mockResolvedValue(null);
    expect(await repo.findByUserRunPage("u1" as Id<"users">, "r1", 1)).toBeNull();
  });

  it("create inserts preview", async () => {
    mockDb.insert.mockResolvedValue("p1");
    await repo.create({ page: 1 } as any);
    expect(mockDb.insert).toHaveBeenCalledWith("importPreviews", { page: 1 });
  });
});

describe("createConvexRepositories", () => {
  it("creates all repositories", () => {
    const repos = createConvexRepositories(mockDb as any);
    expect(repos.books).toBeInstanceOf(ConvexBookRepository);
    expect(repos.importRuns).toBeInstanceOf(ConvexImportRunRepository);
    expect(repos.importPreviews).toBeInstanceOf(ConvexImportPreviewRepository);
  });
});
