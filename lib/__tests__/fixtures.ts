import type { Doc, Id } from "@/convex/_generated/dataModel";

export const fakeBookId = (id: string): Id<"books"> => id as Id<"books">;
export const fakeUserId = (id: string): Id<"users"> => id as Id<"users">;
export const fakeNoteId = (id: string): Id<"notes"> => id as Id<"notes">;

export const makeBook = (overrides: Partial<Doc<"books">> = {}): Doc<"books"> => ({
  _id: fakeBookId("book_1"),
  _creationTime: 0,
  userId: fakeUserId("user_1"),
  title: "Dune",
  author: "Frank Herbert",
  description: undefined,
  isbn: undefined,
  edition: undefined,
  publishedYear: undefined,
  pageCount: undefined,
  status: "want-to-read",
  isFavorite: false,
  isAudiobook: false,
  privacy: "private",
  timesRead: 0,
  dateStarted: undefined,
  dateFinished: undefined,
  coverUrl: undefined,
  apiCoverUrl: undefined,
  apiId: undefined,
  apiSource: undefined,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

export const makeNote = (overrides: Partial<Doc<"notes">> = {}): Doc<"notes"> => ({
  _id: fakeNoteId("note_1"),
  _creationTime: 0,
  bookId: fakeBookId("book_1"),
  userId: fakeUserId("user_1"),
  type: "note",
  content: "A note",
  page: undefined,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});
