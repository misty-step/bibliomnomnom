import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FetchCoverButton } from "../FetchCoverButton";
import { api } from "@/convex/_generated/api";

const useMutationMock = vi.hoisted(() => vi.fn());
const useActionMock = vi.hoisted(() => vi.fn());

const uploadMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@vercel/blob/client", () => ({
  upload: uploadMock,
}));

vi.mock("convex/react", () => ({
  useMutation: (...args: unknown[]) => useMutationMock(...(args as any)),
  useAction: (...args: unknown[]) => useActionMock(...(args as any)),
}));

vi.mock("@/hooks/use-toast", () => {
  return {
    useToast: () => ({ toast: toastMock }),
  };
});

const fetchCoverMock = vi.fn();
const updateCoverMock = vi.fn();

beforeEach(() => {
  useMutationMock.mockReset();
  useActionMock.mockReset();
  fetchCoverMock.mockReset();
  updateCoverMock.mockReset();
  uploadMock.mockReset();
  toastMock.mockReset();

  useActionMock.mockReturnValue(fetchCoverMock);
  useMutationMock.mockReturnValue(updateCoverMock);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("FetchCoverButton", () => {
  it("fetches, uploads, and updates cover on success", async () => {
    const user = userEvent.setup();

    fetchCoverMock.mockResolvedValue({
      success: true,
      coverDataUrl: "data:image/jpeg;base64,QQ==",
      apiSource: "open-library",
      apiCoverUrl: "https://covers.example/123",
    });
    uploadMock.mockResolvedValue({ url: "https://blob.example/covers/book1.jpg" });
    updateCoverMock.mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    render(<FetchCoverButton bookId={"book1" as any} onSuccess={onSuccess} />);

    await user.click(screen.getByRole("button", { name: /fetch cover/i }));

    await waitFor(() => {
      expect(fetchCoverMock).toHaveBeenCalledWith({ bookId: "book1" });
      expect(uploadMock).toHaveBeenCalled();
      expect(updateCoverMock).toHaveBeenCalledWith({
        bookId: "book1",
        blobUrl: "https://blob.example/covers/book1.jpg",
        apiSource: "open-library",
        apiCoverUrl: "https://covers.example/123",
      });
      expect(toastMock).toHaveBeenCalledWith({ title: "Cover found and saved" });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("shows error toast when cover not found", async () => {
    const user = userEvent.setup();

    fetchCoverMock.mockResolvedValue({ success: false, error: "not found" });

    render(<FetchCoverButton bookId={"book2" as any} />);

    await user.click(screen.getByRole("button", { name: /fetch cover/i }));

    await waitFor(() => {
      expect(updateCoverMock).not.toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalled();
      expect((toastMock.mock.calls.at(-1)?.[0]?.title as string) ?? "").toContain(
        "Cover not found",
      );
    });
  });

  it("handles exceptions and surfaces toast", async () => {
    const user = userEvent.setup();

    fetchCoverMock.mockRejectedValue(new Error("boom"));

    render(<FetchCoverButton bookId={"book3" as any} />);

    await user.click(screen.getByRole("button", { name: /fetch cover/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalled();
      expect((toastMock.mock.calls.at(-1)?.[0]?.title as string) ?? "").toContain(
        "Failed to fetch cover",
      );
    });
  });
});
