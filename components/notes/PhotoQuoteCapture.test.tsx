import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const createNoteMock = vi.fn();
const toastMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => createNoteMock,
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

import { PhotoQuoteCapture } from "./PhotoQuoteCapture";

describe("PhotoQuoteCapture", () => {
  beforeEach(() => {
    createNoteMock.mockReset();
    toastMock.mockReset();

    // JSDOM lacks these.
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:preview"),
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      writable: true,
    });
  });

  it("runs OCR then saves quote", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
      },
      json: async () => ({ text: "Hello world" }),
    } as unknown as Response);

    createNoteMock.mockResolvedValue(undefined);

    const { getByRole, getByLabelText, queryByText } = render(
      <PhotoQuoteCapture bookId={"bookId" as never} />,
    );

    const input = getByLabelText(/Capture photo of book page/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["abc"], "page.jpg", { type: "image/jpeg" })] },
    });

    expect(getByRole("heading", { name: /Review Photo/i })).toBeTruthy();

    fireEvent.click(getByRole("button", { name: /Use Photo/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toContain("data:image/jpeg;base64,");

    await waitFor(() => expect(getByRole("heading", { name: /Quote Extracted/i })).toBeTruthy());

    fireEvent.change(getByLabelText(/Quote text/i), { target: { value: "Edited quote" } });

    fireEvent.click(getByRole("button", { name: /Save Quote/i }));

    await waitFor(() =>
      expect(createNoteMock).toHaveBeenCalledWith({
        bookId: "bookId",
        type: "quote",
        content: "Edited quote",
      }),
    );
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: "Quote saved" }));
    await waitFor(() => expect(queryByText(/Quote Extracted/i)).toBeNull());
  });

  it("shows error UI and toast when OCR fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      headers: {
        get: () => "application/json",
      },
      json: async () => ({ error: "OCR service not configured", code: "OCR_FAILED" }),
    } as unknown as Response);

    const { getByLabelText, getByRole } = render(<PhotoQuoteCapture bookId={"bookId" as never} />);

    fireEvent.change(getByLabelText(/Capture photo of book page/i), {
      target: { files: [new File(["abc"], "page.jpg", { type: "image/jpeg" })] },
    });

    fireEvent.click(getByRole("button", { name: /Use Photo/i }));

    await waitFor(() => expect(getByRole("heading", { name: /Couldn't Read Text/i })).toBeTruthy());
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "OCR failed",
          variant: "destructive",
        }),
      ),
    );
  });
});
