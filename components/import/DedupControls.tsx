import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DedupMatch } from "@/lib/import/types";

type DedupControlProps = {
  tempId: string;
  decision: "skip" | "merge" | "create";
  onChange: (tempId: string, action: "skip" | "merge" | "create") => void;
  match?: DedupMatch;
  disabled?: boolean;
};

export function DedupControls({ tempId, decision, onChange, match, disabled }: DedupControlProps) {
  const existingBook = useQuery(
    api.books.get,
    match?.existingBookId ? { id: match.existingBookId } : "skip"
  );
  const isLoading = match?.existingBookId ? existingBook === undefined : false;
  const isMissing = match?.existingBookId ? existingBook === null : false;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          className="h-9 w-32 rounded-md border border-line-ghost bg-canvas-bone px-2 text-sm"
          value={decision}
          onChange={(e) => onChange(tempId, e.target.value as DedupControlProps["decision"])}
          disabled={disabled}
        >
          <option value="skip">Skip</option>
          <option value="merge">Merge</option>
          <option value="create">Create</option>
        </select>
      </div>

      {match && (
        <details className="text-xs text-text-inkMuted">
          <summary className="cursor-pointer hover:text-text-ink select-none">
            ↔ Matches existing book (click for details)
          </summary>
          {isLoading ? (
            <p className="mt-2 text-2xs text-text-inkMuted">Loading book details...</p>
          ) : isMissing ? (
            <p className="mt-2 text-2xs text-text-inkMuted">Book no longer exists or is inaccessible.</p>
          ) : existingBook ? (
            <div className="mt-2 p-2 bg-canvas-boneMuted rounded-md space-y-1">
              <p className="font-medium text-text-ink">{existingBook.title}</p>
              <p className="text-text-ink">by {existingBook.author}</p>
              <p className="text-2xs text-text-inkMuted">
                {match.matchType} match • {Math.round(match.confidence * 100)}% confidence
              </p>
              {existingBook.isbn && (
                <p className="text-2xs text-text-inkMuted">ISBN: {existingBook.isbn}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-2xs text-text-inkMuted">Loading book details...</p>
          )}
        </details>
      )}
    </div>
  );
}
