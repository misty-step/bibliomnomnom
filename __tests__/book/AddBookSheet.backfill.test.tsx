import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const fetchMissingCoversMock = vi.fn();
const createBookMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => createBookMock,
  useAction: (fn: any) => {
    if (fn?.replace?.path === "books:fetchMissingCovers") return fetchMissingCoversMock;
    return vi.fn();
  },
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
    const { getByLabelText, getByText } = render(<AddBookSheet isOpen onOpenChange={() => {}} />);

    fireEvent.change(getByLabelText(/Title/i), { target: { value: "Test Title" } });
    fireEvent.change(getByLabelText(/Author/i), { target: { value: "Test Author" } });

    fireEvent.click(getByText(/Add Book/i));

    await waitFor(() => expect(createBookMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(fetchMissingCoversMock).toHaveBeenCalledWith({ bookIds: ["book_123"] }),
    );
  });
});
