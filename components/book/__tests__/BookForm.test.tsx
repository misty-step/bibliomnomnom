import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookForm, sanitizeBookForm, type BookFormValues } from "../BookForm";

describe("sanitizeBookForm", () => {
  const baseValues: BookFormValues = {
    title: "  Dune  ",
    author: " Frank Herbert ",
    edition: " First ",
    isbn: " 9780441013593 ",
    publishedYear: "1965",
    pageCount: "412",
    isFavorite: true,
    status: "currently-reading",
    dateStarted: "",
    dateFinished: "",
  };

  it("trims whitespace and parses numbers", () => {
    const payload = sanitizeBookForm(baseValues);
    expect(payload).toEqual({
      title: "Dune",
      author: "Frank Herbert",
      edition: "First",
      isbn: "9780441013593",
      publishedYear: 1965,
      pageCount: 412,
      isFavorite: true,
      status: "currently-reading",
      dateStarted: null,
      dateFinished: null,
    });
  });

  it("returns null when required fields are missing", () => {
    const payload = sanitizeBookForm({
      ...baseValues,
      title: " ",
      author: "",
    });
    expect(payload).toBeNull();
  });

  it("drops invalid numeric values", () => {
    const payload = sanitizeBookForm({
      ...baseValues,
      publishedYear: "20xx",
      pageCount: "abc",
    });

    expect(payload).toMatchObject({
      publishedYear: null,
      pageCount: null,
    });
  });
});

describe("BookForm component", () => {
  it("submits sanitized values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <BookForm
        includeStatusField
        showFavoriteToggle
        submitLabel="Save Book"
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText(/Title/i), "  Dune ");
    await user.type(screen.getByLabelText(/Author/i), " Frank Herbert ");
    await user.type(screen.getByLabelText(/Edition/i), " Deluxe ");
    await user.type(screen.getByLabelText(/ISBN/i), " 9780441013593 ");

    const publishedField = screen.getByLabelText(/Published Year/i);
    await user.clear(publishedField);
    await user.type(publishedField, "1965");

    const pageField = screen.getByLabelText(/Page Count/i);
    await user.clear(pageField);
    await user.type(pageField, "412");

    await user.click(screen.getByRole("button", { name: "Save Book" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: "Dune",
        author: "Frank Herbert",
        edition: "Deluxe",
        isbn: "9780441013593",
        publishedYear: 1965,
        pageCount: 412,
        isFavorite: false,
        status: "want-to-read",
        dateStarted: null,
        dateFinished: null,
      });
    });
  });

  it("shows validation error when required fields missing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<BookForm includeStatusField submitLabel="Save Book" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Save Book" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Title and author are required.")).toBeInTheDocument();
  });

  it("disables submit until fields change when requireDirtyForSubmit enabled", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <BookForm
        submitLabel="Save Changes"
        onSubmit={onSubmit}
        requireDirtyForSubmit
        initialValues={{
          title: "Dune",
          author: "Frank Herbert",
          edition: "",
          isbn: "",
          publishedYear: "",
          pageCount: "",
          isFavorite: false,
          status: "want-to-read",
          dateStarted: "",
          dateFinished: "",
        }}
      />
    );

    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  });
});