import type { ComponentPropsWithoutRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Doc, Id } from "@/convex/_generated/dataModel";

const pushMock = vi.fn();
const updateStatusMock = vi.fn();
const toastMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => updateStatusMock,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    article: ({
      children,
      initial: _initial,
      animate: _animate,
      whileHover: _whileHover,
      transition: _transition,
      ...props
    }: ComponentPropsWithoutRef<"article"> & {
      initial?: unknown;
      animate?: unknown;
      whileHover?: unknown;
      transition?: unknown;
    }) => <article {...props}>{children}</article>,
  },
  useReducedMotion: () => true,
}));

import { BookTile } from "../BookTile";

const fakeBookId = (id: string): Id<"books"> => id as Id<"books">;
const fakeUserId = (id: string): Id<"users"> => id as Id<"users">;

const makeBook = (overrides: Partial<Doc<"books">> = {}): Doc<"books"> => ({
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

describe("BookTile status actions", () => {
  beforeEach(() => {
    pushMock.mockReset();
    updateStatusMock.mockReset();
    toastMock.mockReset();
  });

  it('shows "Start Reading" for want-to-read books', () => {
    render(<BookTile book={makeBook({ status: "want-to-read" })} />);

    expect(screen.getByRole("button", { name: "Start Reading" })).toBeInTheDocument();
  });

  it('shows "Mark as Read" for currently-reading books', () => {
    render(<BookTile book={makeBook({ status: "currently-reading" })} />);

    expect(screen.getByRole("button", { name: "Mark as Read" })).toBeInTheDocument();
  });

  it("shows no status action button for read books", () => {
    render(<BookTile book={makeBook({ status: "read" })} />);

    expect(screen.queryByRole("button", { name: "Start Reading" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as Read" })).not.toBeInTheDocument();
  });

  it("calls updateStatus mutation when action button is clicked", async () => {
    const user = userEvent.setup();
    updateStatusMock.mockResolvedValue(undefined);
    const book = makeBook({ _id: fakeBookId("book_42"), status: "want-to-read" });

    render(<BookTile book={book} />);
    await user.click(screen.getByRole("button", { name: "Start Reading" }));

    expect(updateStatusMock).toHaveBeenCalledWith({
      id: book._id,
      status: "currently-reading",
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows destructive toast when updateStatus mutation fails", async () => {
    const user = userEvent.setup();
    updateStatusMock.mockRejectedValue(new Error("network error"));
    const book = makeBook({ status: "want-to-read" });

    render(<BookTile book={book} />);
    await user.click(screen.getByRole("button", { name: "Start Reading" }));

    // Wait for the rejected promise to settle and toast to be called
    await vi.waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("does not navigate when keyboard event fires on action button", async () => {
    const user = userEvent.setup();
    updateStatusMock.mockResolvedValue(undefined);
    const book = makeBook({ status: "want-to-read" });

    render(<BookTile book={book} />);
    const actionButton = screen.getByRole("button", { name: "Start Reading" });

    // Keyboard events on the action button must not bubble up to the card's
    // keydown handler (which triggers navigation)
    await user.keyboard("[Tab]"); // focus into the component
    actionButton.focus();
    await user.keyboard("[Space]");

    // Navigation should NOT have fired — stopPropagation prevents card nav
    expect(pushMock).not.toHaveBeenCalled();
  });
});
