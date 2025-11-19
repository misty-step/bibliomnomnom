export const BOOK_STATUS_OPTIONS = [
  { value: "want-to-read", label: "Want to Read" },
  { value: "currently-reading", label: "Reading" },
  { value: "read", label: "Read" },
] as const;

export type BookStatus = (typeof BOOK_STATUS_OPTIONS)[number]["value"];
