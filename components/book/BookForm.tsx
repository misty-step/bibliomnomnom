"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BOOK_STATUS_OPTIONS, type BookStatus } from "./constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BookFormValues = {
  title: string;
  author: string;
  description: string;
  edition: string;
  isbn: string;
  publishedYear: string;
  pageCount: string;
  isAudiobook: boolean;
  isFavorite: boolean;
  status: BookStatus;
};

export type SanitizedBookFormValues = {
  title: string;
  author: string;
  description?: string;
  edition?: string;
  isbn?: string;
  publishedYear?: number;
  pageCount?: number;
  isAudiobook: boolean;
  isFavorite: boolean;
  status: BookStatus;
};

const DEFAULT_VALUES: BookFormValues = {
  title: "",
  author: "",
  description: "",
  edition: "",
  isbn: "",
  publishedYear: "",
  pageCount: "",
  isAudiobook: false,
  isFavorite: false,
  status: "want-to-read",
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
  showAudiobookToggle?: boolean;
  useCollapsibleMetadata?: boolean;
  metadataInitiallyCollapsed?: boolean;
  metadataToggleLabel?: string;
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
  showAudiobookToggle = true,
  useCollapsibleMetadata = false,
  metadataInitiallyCollapsed = false,
  metadataToggleLabel = "More details",
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
  const [metadataExpanded, setMetadataExpanded] = useState(
    useCollapsibleMetadata ? !metadataInitiallyCollapsed : true
  );

  useEffect(() => {
    setValues(snapshot);
    setError(null);
  }, [snapshot]);

  useEffect(() => {
    if (useCollapsibleMetadata) {
      setMetadataExpanded(!metadataInitiallyCollapsed);
    } else {
      setMetadataExpanded(true);
    }
  }, [useCollapsibleMetadata, metadataInitiallyCollapsed]);

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

  const renderMetadataFields = () => (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Edition">
          <input
            className="w-full border-b border-transparent bg-transparent px-4 py-3 text-sm text-ink focus:border-line-ember focus:outline-none"
            value={values.edition}
            onChange={(event) => handleChange("edition", event.target.value)}
            placeholder="First, Deluxe, Annotated…"
          />
        </FormField>
        <FormField label="ISBN">
          <input
            className="w-full border-b border-transparent bg-transparent px-4 py-3 text-sm text-ink focus:border-line-ember focus:outline-none"
            value={values.isbn}
            onChange={(event) => handleChange("isbn", event.target.value)}
            placeholder="9780000000000"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Published Year">
          <input
            className="w-full border-b border-transparent bg-transparent px-4 py-3 text-sm text-ink focus:border-line-ember focus:outline-none"
            inputMode="numeric"
            pattern="[0-9]*"
            value={values.publishedYear}
            onChange={(event) => handleChange("publishedYear", event.target.value)}
            placeholder="2024"
          />
        </FormField>
        <FormField label="Page Count">
          <input
            className="w-full border-b border-transparent bg-transparent px-4 py-3 text-sm text-ink focus:border-line-ember focus:outline-none"
            inputMode="numeric"
            pattern="[0-9]*"
            value={values.pageCount}
            onChange={(event) => handleChange("pageCount", event.target.value)}
            placeholder="320"
          />
        </FormField>
      </div>

      <FormField label="Description">
        <textarea
          className="min-h-[var(--space-form-field-min)] w-full border-b border-transparent bg-transparent px-4 py-3 text-sm text-ink focus:border-line-ember focus:outline-none"
          value={values.description}
          onChange={(event) => handleChange("description", event.target.value)}
          placeholder="Add notes, favorite passages, or why this book matters."
        />
      </FormField>
    </>
  );

  const metadataSection = useCollapsibleMetadata ? (
    <div className="rounded-2xl border border-border/80 bg-paper-secondary/60 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between font-mono text-xs uppercase tracking-wider text-inkMuted"
        onClick={() => setMetadataExpanded((prev) => !prev)}
        aria-expanded={metadataExpanded}
      >
        <span>{metadataToggleLabel}</span>
        <span className="text-xs uppercase tracking-wide text-ink-faded">
          {metadataExpanded ? "Hide" : "Show"}
        </span>
      </button>
      {metadataExpanded ? <div className="mt-4 space-y-4">{renderMetadataFields()}</div> : null}
    </div>
  ) : (
    <div className="space-y-4">{renderMetadataFields()}</div>
  );

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Title" required>
          <input
            className="w-full border-b border-transparent bg-transparent px-4 py-3 text-sm text-ink focus:border-line-ember focus:outline-none"
            value={values.title}
            onChange={(event) => handleChange("title", event.target.value)}
            placeholder="The Name of the Book"
          />
        </FormField>
        <FormField label="Author" required>
          <input
            className="w-full border-b border-transparent bg-transparent px-4 py-3 text-sm text-ink focus:border-line-ember focus:outline-none"
            value={values.author}
            onChange={(event) => handleChange("author", event.target.value)}
            placeholder="Author Name"
          />
        </FormField>
      </div>

      {includeStatusField ? (
        <FormField label="Reading Status">
          <select
            className="w-full border-b border-transparent bg-transparent px-4 py-3 text-sm text-ink focus:border-line-ember focus:outline-none"
            value={values.status}
            onChange={(event) => handleChange("status", event.target.value as BookStatus)}
          >
            {BOOK_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
      ) : null}

      <div className="flex flex-wrap gap-4">
        {showAudiobookToggle ? (
          <ToggleField
            label="Audiobook"
            checked={values.isAudiobook}
            onChange={(checked) => handleChange("isAudiobook", checked)}
          />
        ) : null}
        {showFavoriteToggle ? (
          <ToggleField
            label="Favorite"
            checked={values.isFavorite}
            onChange={(checked) => handleChange("isFavorite", checked)}
          />
        ) : null}
      </div>

      {metadataSection}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="font-sans text-sm text-inkMuted hover:text-ink hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
        ) : null}
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
    description: values.description.trim() || undefined,
    edition: values.edition.trim() || undefined,
    isbn: values.isbn.trim() || undefined,
    publishedYear: toOptionalNumber(values.publishedYear),
    pageCount: toOptionalNumber(values.pageCount),
    isAudiobook: values.isAudiobook,
    isFavorite: values.isFavorite,
    status: values.status,
  };
}

function toOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
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
    <label className="flex flex-col gap-2">
      <span className="font-mono text-xs uppercase tracking-wider text-inkMuted">
        {label}
        {required ? <span className="text-accent-ember"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 rounded-full border border-border bg-paper-secondary/70 px-4 py-2 font-mono text-xs uppercase tracking-wider text-inkMuted transition",
        checked ? "border-leather text-leather" : null
      )}
    >
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border text-leather focus:ring-leather"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
