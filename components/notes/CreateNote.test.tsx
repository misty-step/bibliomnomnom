import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const createNoteMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => createNoteMock,
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

vi.mock("./Editor", () => ({
  Editor: () => <div role="textbox" aria-label="Note editor" />,
}));

import { CreateNote } from "./CreateNote";

describe("CreateNote", () => {
  beforeEach(() => {
    createNoteMock.mockReset();
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

  it("does not collapse when PhotoQuoteCapture dialog is open", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
      },
      json: async () => ({ text: "Hello world" }),
    } as unknown as Response);

    const { getByRole, getByLabelText } = render(<CreateNote bookId={"bookId" as never} />);

    // Expand editor so the controls (including Photo) render.
    fireEvent.click(getByRole("textbox", { name: /Note editor/i }));

    // Select a file -> opens dialog (portal outside CreateNote container).
    fireEvent.change(getByLabelText(/Capture photo of book page/i), {
      target: { files: [new File(["abc"], "page.jpg", { type: "image/jpeg" })] },
    });

    // Clicking inside dialog should not trigger CreateNote "outside click" collapse.
    fireEvent.click(getByRole("button", { name: /Use Photo/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
