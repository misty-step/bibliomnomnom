import { describe, expect, it, vi } from "vitest";
import { fetchUserBooks } from "../../lib/import/dedup/repository";
import type { Id } from "../../convex/_generated/dataModel";

const mockDb = {
  query: vi.fn(),
};

const mockQuery = {
  withIndex: vi.fn().mockReturnThis(),
  collect: vi.fn(),
  eq: vi.fn().mockReturnThis(),
};

describe("fetchUserBooks", () => {
  it("queries books by user", async () => {
    mockDb.query.mockReturnValue(mockQuery);
    mockQuery.collect.mockResolvedValue([]);

    await fetchUserBooks(mockDb as any, "u1" as Id<"users">);

    expect(mockDb.query).toHaveBeenCalledWith("books");
    expect(mockQuery.withIndex).toHaveBeenCalledWith("by_user", expect.any(Function));

    // Verify the index filter function
    const filterFn = mockQuery.withIndex.mock.calls[0]![1] as (q: {
      eq: ReturnType<typeof vi.fn>;
    }) => void;
    const q = { eq: vi.fn().mockReturnThis() };
    filterFn(q);
    expect(q.eq).toHaveBeenCalledWith("userId", "u1");
  });
});
