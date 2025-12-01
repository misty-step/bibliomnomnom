import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const fetchMissingCoversMock = vi.fn();
const toastMock = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => fetchMissingCoversMock,
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

import { FetchMissingCoversButton } from "../../components/book/FetchMissingCoversButton";

describe("FetchMissingCoversButton", () => {
  beforeEach(() => {
    fetchMissingCoversMock.mockReset();
    toastMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loops through pages until cursor is exhausted", async () => {
    fetchMissingCoversMock
      .mockResolvedValueOnce({ processed: 2, updated: 1, failures: [], nextCursor: "next" })
      .mockResolvedValueOnce({ processed: 1, updated: 1, failures: [], nextCursor: null });

    const { getByText } = render(<FetchMissingCoversButton />);

    fireEvent.click(getByText(/Fetch missing covers/i));

    await waitFor(() => expect(fetchMissingCoversMock).toHaveBeenCalledTimes(2));
    expect(fetchMissingCoversMock).toHaveBeenNthCalledWith(1, { cursor: undefined, limit: 20 });
    expect(fetchMissingCoversMock).toHaveBeenNthCalledWith(2, { cursor: "next", limit: 20 });

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: "Fetch complete",
        description: "Updated 2 of 3",
      }),
    );
  });

  it("shows no-op toast when nothing processed", async () => {
    fetchMissingCoversMock.mockResolvedValue({
      processed: 0,
      updated: 0,
      failures: [],
      nextCursor: null,
    });

    const { getByText } = render(<FetchMissingCoversButton />);
    fireEvent.click(getByText(/Fetch missing covers/i));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: "No missing covers found",
        description: "You're all set.",
      }),
    );
  });
});
