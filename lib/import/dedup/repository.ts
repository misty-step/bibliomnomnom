import type { DatabaseReader } from "../../convex/_generated/server";
import type { Doc, Id } from "../../convex/_generated/dataModel";

type DbReader = Pick<DatabaseReader, "query">;

export const fetchUserBooks = async (
  db: DbReader,
  userId: Id<"users">
): Promise<Doc<"books">[]> => {
  return db
    .query("books")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
};
