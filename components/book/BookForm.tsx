"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Star } from "lucide-react";
import { BOOK_STATUS_OPTIONS, type BookStatus } from "./constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BookFormValues = {
  title: string;
  author: string;
  edition: string;
  isbn: string;
  publishedYear: string;
  pageCount: string;
  isFavorite: boolean;
  status: BookStatus;
  dateStarted: string;
  dateFinished: string;
};

export type SanitizedBookFormValues = {
  title: string;
  author: string;
  edition?: string | null;
  isbn?: string | null;
  publishedYear?: number | null;
  pageCount?: number | null;
  isFavorite: boolean;
  status: BookStatus;
  dateStarted?: number | null;
  dateFinished?: number | null;
};

const DEFAULT_VALUES: BookFormValues = {
  title: "",
  author: "",
  edition: "",
  isbn: "",
  publishedYear: "",
  pageCount: "",
  isFavorite: false,
  status: "want-to-read",
  dateStarted: "",
  dateFinished: "",
};

type BookFormProps = {
  initialValues?: Partial<BookFormValues>;
  includeStatusField?: boolean;
  submitLabel: string;
  busyLabel?: string;
  onCancel?: () => void;
  onSubmit: (values: SanitizedBookFormValues) => Promise<void>;
  onSuccess?: () => void;
  resetOnSubmit?: boolean;
  requireDirtyForSubmit?: boolean;
  failureMessage?: string;
  showFavoriteToggle?: boolean;
};

export function BookForm({
  initialValues,
  includeStatusField = false,
  submitLabel,
  busyLabel = "Saving…",
  onCancel,
  onSubmit,
  onSuccess,
  resetOnSubmit = false,
  requireDirtyForSubmit = false,
  failureMessage = "Unable to save changes. Please retry.",
  showFavoriteToggle = false,
}: BookFormProps) {
  const snapshot = useMemo(
    () => ({
      ...DEFAULT_VALUES,
      ...initialValues,
    }),
    [initialValues]
  );

  const [values, setValues] = useState<BookFormValues>(snapshot);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setValues(snapshot);
    setError(null);
  }, [snapshot]);

  const isDirty = useMemo(() => {
    return Object.entries(snapshot).some(([key]) => {
      const typedKey = key as keyof BookFormValues;
      return snapshot[typedKey] !== values[typedKey];
    });
  }, [snapshot, values]);

  const handleChange = <K extends keyof BookFormValues>(key: K, value: BookFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = sanitizeBookForm(values);

    if (!payload) {
      setError("Title and author are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(payload);
      if (resetOnSubmit) {
        setValues(snapshot);
      }
      onSuccess?.();
    } catch (err) {
      console.error(err);
      setError(failureMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      {/* Title */}
      <FormField label="Title" required>
        <input
          type="text"
          className="w-full rounded-md border border-line-ghost bg-canvas-boneMuted px-4 py-3 text-text-ink placeholder:text-text-inkSubtle focus:border-text-ink focus:bg-canvas-bone focus:outline-none"
          value={values.title}
          onChange={(event) => handleChange("title", event.target.value)}
          placeholder="The Name of the Wind"
          disabled={isSubmitting}
        />
      </FormField>

      {/* Author */}
      <FormField label="Author" required>
        <input
          type="text"
          className="w-full rounded-md border border-line-ghost bg-canvas-boneMuted px-4 py-3 text-text-ink placeholder:text-text-inkSubtle focus:border-text-ink focus:bg-canvas-bone focus:outline-none"
          value={values.author}
          onChange={(event) => handleChange("author", event.target.value)}
          placeholder="Patrick Rothfuss"
          disabled={isSubmitting}
        />
      </FormField>

      {/* Status - Segmented Control */}
      {includeStatusField && (
        <FormField label="Status">
          <div className="flex rounded-md bg-canvas-boneMuted p-1">
            {BOOK_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleChange("status", option.value)}
                className={cn(
                  "flex-1 rounded-md px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all duration-150",
                  values.status === option.value
                    ? "bg-text-ink text-canvas-bone shadow-sm"
                    : "text-text-inkMuted hover:text-text-ink"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FormField>
      )}

      {/* Favorite Toggle */}
      {showFavoriteToggle && (
        <FormField label="Favorite">
          <button
            type="button"
            onClick={() => handleChange("isFavorite", !values.isFavorite)}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all duration-150",
              values.isFavorite
                ? "bg-text-ink text-canvas-bone shadow-sm"
                : "bg-canvas-boneMuted text-text-inkMuted hover:text-text-ink"
            )}
          >
            <Star className={cn("h-3.5 w-3.5", values.isFavorite && "fill-amber-400 text-amber-400")} />
            Favorite
          </button>
        </FormField>
      )}

      {/* Dates */}
      <div className="grid gap-8 sm:grid-cols-2">
        <FormField label="Date Started">
          <input
            type="date"
            className="w-full rounded-md border border-line-ghost bg-canvas-boneMuted px-4 py-3 text-text-ink placeholder:text-text-inkSubtle focus:border-text-ink focus:bg-canvas-bone focus:outline-none"
            value={values.dateStarted}
            onChange={(event) => handleChange("dateStarted", event.target.value)}
            disabled={isSubmitting}
          />
        </FormField>
        <FormField label="Date Finished">
          <input
            type="date"
            className="w-full rounded-md border border-line-ghost bg-canvas-boneMuted px-4 py-3 text-text-ink placeholder:text-text-inkSubtle focus:border-text-ink focus:bg-canvas-bone focus:outline-none"
            value={values.dateFinished}
            onChange={(event) => handleChange("dateFinished", event.target.value)}
            disabled={isSubmitting}
          />
        </FormField>
      </div>

      {/* Metadata Fields */}
      <div className="space-y-8">
        <FormField label="Edition">
          <input
            type="text"
            className="w-full rounded-md border border-line-ghost bg-canvas-boneMuted px-4 py-3 text-text-ink placeholder:text-text-inkSubtle focus:border-text-ink focus:bg-canvas-bone focus:outline-none"
            value={values.edition}
            onChange={(event) => handleChange("edition", event.target.value)}
            placeholder="First, Deluxe…"
            disabled={isSubmitting}
          />
        </FormField>
        <FormField label="ISBN">
          <input
            type="text"
            className="w-full rounded-md border border-line-ghost bg-canvas-boneMuted px-4 py-3 text-text-ink placeholder:text-text-inkSubtle focus:border-text-ink focus:bg-canvas-bone focus:outline-none"
            value={values.isbn}
            onChange={(event) => handleChange("isbn", event.target.value)}
            placeholder="9780000000000"
            disabled={isSubmitting}
          />
        </FormField>
        <FormField label="Published Year">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-full rounded-md border border-line-ghost bg-canvas-boneMuted px-4 py-3 text-text-ink placeholder:text-text-inkSubtle focus:border-text-ink focus:bg-canvas-bone focus:outline-none"
            value={values.publishedYear}
            onChange={(event) => handleChange("publishedYear", event.target.value)}
            placeholder="2024"
            disabled={isSubmitting}
          />
        </FormField>
        <FormField label="Page Count">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-full rounded-md border border-line-ghost bg-canvas-boneMuted px-4 py-3 text-text-ink placeholder:text-text-inkSubtle focus:border-text-ink focus:bg-canvas-bone focus:outline-none"
            value={values.pageCount}
            onChange={(event) => handleChange("pageCount", event.target.value)}
            placeholder="320"
            disabled={isSubmitting}
          />
        </FormField>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-accent-ember/20 bg-accent-ember/10 px-4 py-3 text-sm text-accent-ember">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="font-sans text-sm text-text-inkMuted hover:text-text-ink hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || (requireDirtyForSubmit && !isDirty)}
        >
          {isSubmitting ? busyLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function sanitizeBookForm(values: BookFormValues): SanitizedBookFormValues | null {
  const title = values.title.trim();
  const author = values.author.trim();

  if (!title || !author) {
    return null;
  }

  return {
    title,
    author,
    edition: values.edition.trim() || null,
    isbn: values.isbn.trim() || null,
    publishedYear: toOptionalNumber(values.publishedYear),
    pageCount: toOptionalNumber(values.pageCount),
    isFavorite: values.isFavorite,
    status: values.status,
    dateStarted: toTimestamp(values.dateStarted),
    dateFinished: toTimestamp(values.dateFinished),
  };
}

function toOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTimestamp(value: string): number | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  // Create date at local noon to avoid timezone shifting issues when displaying back
  // or just create a "local date"
  return new Date(year, month - 1, day).getTime();
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
    <div>
      <label className="mb-3 block font-mono text-xs uppercase tracking-wider text-text-inkMuted">
        {label}
        {required && <span className="text-accent-ember"> *</span>}
      </label>
      {children}
    </div>
  );
}
