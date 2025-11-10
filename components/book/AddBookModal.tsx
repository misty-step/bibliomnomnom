"use client";

import { useState, ReactNode } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

type StatusOption = "want-to-read" | "currently-reading" | "read";

type FormState = {
  title: string;
  author: string;
  status: StatusOption;
  description: string;
  publishedYear: string;
  pageCount: string;
  isAudiobook: boolean;
};

const STATUS_OPTIONS: Array<{ value: StatusOption; label: string }> = [
  { value: "want-to-read", label: "Want to read" },
  { value: "currently-reading", label: "Currently reading" },
  { value: "read", label: "Finished" },
];

const INITIAL_FORM: FormState = {
  title: "",
  author: "",
  status: "want-to-read",
  description: "",
  publishedYear: "",
  pageCount: "",
  isAudiobook: false,
};

export function AddBookModal({ triggerLabel = "Add Book" }: { triggerLabel?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const createBook = useMutation(api.books.create);

  const resetState = () => {
    setForm(INITIAL_FORM);
    setError(null);
    setSuccess(null);
  };

  const handleOpen = () => {
    resetState();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const parseOptionalNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const title = form.title.trim();
    const author = form.author.trim();

    if (!title || !author) {
      setError("Title and author are required.");
      return;
    }

    setIsSaving(true);
    try {
      await createBook({
        title,
        author,
        description: form.description.trim() || undefined,
        isbn: undefined,
        edition: undefined,
        publishedYear: parseOptionalNumber(form.publishedYear),
        pageCount: parseOptionalNumber(form.pageCount),
        status: form.status,
        isAudiobook: form.isAudiobook,
        coverUrl: undefined,
        apiCoverUrl: undefined,
        apiId: undefined,
        apiSource: "manual",
      });

      setSuccess("Book added to your library.");
      setTimeout(() => {
        setIsOpen(false);
        resetState();
      }, 800);
    } catch (submitError) {
      console.error("Failed to add book", submitError);
      setError("Unable to save this book. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button onClick={handleOpen}>{triggerLabel}</Button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-2xl rounded-2xl border border-border bg-paper p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-serif text-2xl text-leather">Add a Book</h2>
                <p className="text-sm text-ink-faded">
                  Enter the details manually—no external search required.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close add book modal"
                onClick={handleClose}
                className="rounded-full border border-border p-2 text-ink-faded transition hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Title" required>
                  <input
                    className="w-full rounded-xl border border-border bg-paper-secondary/70 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-leather"
                    value={form.title}
                    onChange={(event) => handleChange("title", event.target.value)}
                    placeholder="The Name of the Book"
                  />
                </FormField>
                <FormField label="Author" required>
                  <input
                    className="w-full rounded-xl border border-border bg-paper-secondary/70 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-leather"
                    value={form.author}
                    onChange={(event) => handleChange("author", event.target.value)}
                    placeholder="Author Name"
                  />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Status">
                  <select
                    className="w-full rounded-xl border border-border bg-paper-secondary/70 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-leather"
                    value={form.status}
                    onChange={(event) =>
                      handleChange("status", event.target.value as StatusOption)
                    }
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Published Year">
                  <input
                    className="w-full rounded-xl border border-border bg-paper-secondary/70 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-leather"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.publishedYear}
                    onChange={(event) => handleChange("publishedYear", event.target.value)}
                    placeholder="2024"
                  />
                </FormField>
                <FormField label="Page Count">
                  <input
                    className="w-full rounded-xl border border-border bg-paper-secondary/70 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-leather"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.pageCount}
                    onChange={(event) => handleChange("pageCount", event.target.value)}
                    placeholder="320"
                  />
                </FormField>
              </div>

              <FormField label="Description">
                <textarea
                  className="min-h-[96px] w-full rounded-2xl border border-border bg-paper-secondary/70 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-leather"
                  value={form.description}
                  onChange={(event) => handleChange("description", event.target.value)}
                  placeholder="Add notes, favorite passages, or why this book matters."
                />
              </FormField>

              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-leather focus:ring-leather"
                  checked={form.isAudiobook}
                  onChange={(event) => handleChange("isAudiobook", event.target.checked)}
                />
                Audiobook
              </label>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="text-sm text-leather" role="status">
                  {success}
                </p>
              ) : null}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSaving}
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save Book"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FormField({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-ink">
      <span className="font-medium text-ink">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
