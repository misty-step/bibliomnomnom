export const BOOK_STATUS_OPTIONS = [
  { value: "currently-reading", label: "Reading" },
  { value: "read", label: "Finished" },
  { value: "want-to-read", label: "To Read" },
] as const;

export type BookStatus = (typeof BOOK_STATUS_OPTIONS)[number]["value"];
