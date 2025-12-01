import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const fetchMissingCoversMock = vi.fn();
const createBookMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => createBookMock,
  useAction: () => fetchMissingCoversMock,
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

// Stub vercel blob upload to avoid network
vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }));

import { AddBookSheet } from "../../components/book/AddBookSheet";

describe("AddBookSheet cover backfill", () => {
  beforeEach(() => {
    createBookMock.mockResolvedValue("book_123");
    fetchMissingCoversMock.mockResolvedValue({ processed: 1, updated: 1, failures: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("triggers fetchMissingCovers when no cover provided", async () => {
    const { getByRole } = render(<AddBookSheet isOpen onOpenChange={() => {}} />);

    // Get inputs by position (search, title, author, isbn)
    const inputs = document.querySelectorAll('input[type="text"]');
    const titleInputEl = inputs[1] as HTMLInputElement; // Title is second input (after search)
    const authorInputEl = inputs[2] as HTMLInputElement; // Author is third input

    fireEvent.change(titleInputEl, { target: { value: "Test Title" } });
    fireEvent.change(authorInputEl, { target: { value: "Test Author" } });

    // Click submit button specifically
    fireEvent.click(getByRole("button", { name: /Add Book/i }));

    await waitFor(() => expect(createBookMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(fetchMissingCoversMock).toHaveBeenCalledWith({ bookIds: ["book_123"] }),
    );
  });
});
