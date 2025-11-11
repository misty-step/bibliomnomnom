"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { NoteType } from "./NoteTypeSelector";
import { cn } from "@/lib/utils";

type NoteCardProps = {
  note: Doc<"notes">;
  onEdit?: (note: Doc<"notes">) => void;
};

const TYPE_STYLES: Record<
  NoteType,
  { label: string; className: string }
> = {
  note: {
    label: "Note",
    className: "bg-leather/10 text-leather",
  },
  quote: {
    label: "Quote",
    className: "bg-ink/10 text-ink",
  },
  reflection: {
    label: "Reflection",
    className: "bg-primary/10 text-primary",
  },
};

export function NoteCard({ note, onEdit }: NoteCardProps) {
  const content = useMemo(() => {
    const raw = marked.parse(note.content ?? "", { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [note.content]);

  const meta = TYPE_STYLES[note.type ?? "note"];
  const updatedAt = new Date(note.updatedAt);

  return (
    <article className="space-y-4 rounded-2xl border border-border bg-paper p-5 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
              meta.className
            )}
          >
            {meta.label}
          </span>
          {note.page ? (
            <p className="mt-1 text-xs uppercase tracking-wide text-ink-faded">
              Page {note.page}
            </p>
          ) : null}
        </div>
        {onEdit ? (
          <Button variant="ghost" size="sm" onClick={() => onEdit(note)}>
            Edit
          </Button>
        ) : null}
      </header>
      <div
        className="prose prose-sm max-w-none text-ink"
        dangerouslySetInnerHTML={{ __html: content }}
      />
      <footer className="text-xs text-ink-faded">
        Updated {updatedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </footer>
    </article>
  );
}
