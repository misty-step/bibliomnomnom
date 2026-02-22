import { describe, expect, it } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { getVoiceNoteSummariesForProfileHandler } from "../../convex/profiles";

const userId = "user_1" as unknown as Id<"users">;
const bookId = (n: number) => `book_${n}` as unknown as Id<"books">;

type Artifact = {
  _id: Id<"listeningSessionArtifacts">;
  userId: Id<"users">;
  bookId: Id<"books">;
  sessionId: Id<"listeningSessions">;
  kind: "insight" | "openQuestion" | "quote" | "followUpQuestion" | "contextExpansion";
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

type Book = { _id: Id<"books">; title: string; author: string };

const makeArtifact = (
  n: number,
  bId: Id<"books">,
  overrides: Partial<Artifact> = {},
): Artifact => ({
  _id: `artifact_${n}` as unknown as Id<"listeningSessionArtifacts">,
  userId,
  bookId: bId,
  sessionId: "session_1" as unknown as Id<"listeningSessions">,
  kind: "insight",
  title: `Insight ${n}`,
  content: `Content ${n}`,
  createdAt: n,
  updatedAt: n,
  ...overrides,
});

const makeCtx = (artifacts: Artifact[], books: Book[]) => {
  const ctx = {
    db: {
      query: (_table: string) => {
        let filtered = [...artifacts];
        const handle = {
          withIndex: (_name: string, buildFn: (q: any) => any) => {
            buildFn({
              eq: (field: string, value: unknown) => {
                filtered = filtered.filter((a) => (a as Record<string, unknown>)[field] === value);
              },
            });
            return handle;
          },
          order: (_dir: string) => handle,
          take: async (n: number) => filtered.slice(0, n),
        };
        return handle;
      },
      get: async (id: Id<"books">) => books.find((b) => b._id === id) ?? null,
    },
  } as any;
  return ctx;
};

describe("getVoiceNoteSummariesForProfileHandler", () => {
  it("should return empty array when no artifacts exist", async () => {
    // Arrange
    const ctx = makeCtx([], []);
    // Act
    const result = await getVoiceNoteSummariesForProfileHandler(ctx, { userId });
    // Assert
    expect(result).toEqual([]);
  });

  it("should return summaries grouped by book when artifacts exist", async () => {
    // Arrange
    const b1 = bookId(1);
    const book: Book = { _id: b1, title: "Dune", author: "Frank Herbert" };
    const artifacts = [makeArtifact(1, b1), makeArtifact(2, b1)];
    const ctx = makeCtx(artifacts, [book]);
    // Act
    const result = await getVoiceNoteSummariesForProfileHandler(ctx, { userId });
    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      bookTitle: "Dune",
      bookAuthor: "Frank Herbert",
    });
    expect(result[0]!.artifacts).toHaveLength(2);
    expect(result[0]!.artifacts[0]).toMatchObject({
      kind: "insight",
      title: "Insight 1",
      content: "Content 1",
    });
  });

  it("should group artifacts from different books into separate summaries", async () => {
    // Arrange
    const b1 = bookId(1);
    const b2 = bookId(2);
    const books: Book[] = [
      { _id: b1, title: "Dune", author: "Frank Herbert" },
      { _id: b2, title: "Foundation", author: "Isaac Asimov" },
    ];
    const artifacts = [makeArtifact(1, b1), makeArtifact(2, b2), makeArtifact(3, b1)];
    const ctx = makeCtx(artifacts, books);
    // Act
    const result = await getVoiceNoteSummariesForProfileHandler(ctx, { userId });
    // Assert
    expect(result).toHaveLength(2);
    const duneEntry = result.find((r) => r.bookTitle === "Dune");
    const foundationEntry = result.find((r) => r.bookTitle === "Foundation");
    expect(duneEntry?.artifacts).toHaveLength(2);
    expect(foundationEntry?.artifacts).toHaveLength(1);
  });

  it("should cap at 20 distinct books", async () => {
    // Arrange — 25 distinct books, one artifact each
    const books: Book[] = Array.from({ length: 25 }, (_, i) => ({
      _id: bookId(i + 1),
      title: `Book ${i + 1}`,
      author: `Author ${i + 1}`,
    }));
    const artifacts = books.map((b, i) => makeArtifact(i + 1, b._id));
    const ctx = makeCtx(artifacts, books);
    // Act
    const result = await getVoiceNoteSummariesForProfileHandler(ctx, { userId });
    // Assert
    expect(result).toHaveLength(20);
  });

  it("should fall back to Unknown title/author when book is not found", async () => {
    // Arrange
    const missingId = bookId(99);
    const artifacts = [makeArtifact(1, missingId)];
    const ctx = makeCtx(artifacts, []); // no books in DB
    // Act
    const result = await getVoiceNoteSummariesForProfileHandler(ctx, { userId });
    // Assert
    expect(result[0]).toMatchObject({ bookTitle: "Unknown", bookAuthor: "Unknown" });
  });

  it("should preserve artifact kind through grouping", async () => {
    // Arrange
    const b1 = bookId(1);
    const book: Book = { _id: b1, title: "Dune", author: "Frank Herbert" };
    const artifacts = [
      makeArtifact(1, b1, { kind: "insight" }),
      makeArtifact(2, b1, { kind: "quote" }),
      makeArtifact(3, b1, { kind: "openQuestion" }),
    ];
    const ctx = makeCtx(artifacts, [book]);
    // Act
    const result = await getVoiceNoteSummariesForProfileHandler(ctx, { userId });
    // Assert
    const kinds = result[0]!.artifacts.map((a) => a.kind);
    expect(kinds).toContain("insight");
    expect(kinds).toContain("quote");
    expect(kinds).toContain("openQuestion");
  });

  it("should only return artifacts for the given userId", async () => {
    // Arrange
    const otherUserId = "user_2" as unknown as Id<"users">;
    const b1 = bookId(1);
    const book: Book = { _id: b1, title: "Dune", author: "Frank Herbert" };
    const artifacts = [
      makeArtifact(1, b1, { userId }),
      makeArtifact(2, b1, { userId: otherUserId }),
    ];
    const ctx = makeCtx(artifacts, [book]);
    // Act
    const result = await getVoiceNoteSummariesForProfileHandler(ctx, { userId });
    // Assert
    expect(result[0]!.artifacts).toHaveLength(1);
    expect(result[0]!.artifacts[0]!.title).toBe("Insight 1");
  });
});
