import { useState } from "react";
import { Star } from "lucide-react";
import { DedupControls } from "./DedupControls";
import { Button } from "@/components/ui/button";

import type { ParsedBook, DedupMatch } from "@/lib/import/types";
import { DEFAULT_STATUS } from "@/lib/import/status";

type PreviewTableProps = {
  rows: ParsedBook[];
  dedupMatches: DedupMatch[];
  decisions: Record<string, { action: "skip" | "merge" | "create" }>;
  onDecisionChange: (tempId: string, action: "skip" | "merge" | "create") => void;
};

export function PreviewTable({
  rows,
  dedupMatches,
  decisions,
  onDecisionChange,
}: PreviewTableProps) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const matchByTemp = new Map<string, DedupMatch>();
  dedupMatches.forEach((m) => matchByTemp.set(m.tempId, m));

  // Helper to compute intelligent default decision
  const getDefaultDecision = (tempId: string): "skip" | "merge" | "create" => {
    const match = matchByTemp.get(tempId);
    if (!match) return "create"; // No match → create new book
    if (match.confidence >= 0.85) return "merge"; // High confidence → merge
    return "skip"; // Low confidence → needs review
  };

  const allSelected = rows.length > 0 && rows.every((r) => selectedRows.has(r.tempId));
  const someSelected = rows.some((r) => selectedRows.has(r.tempId));

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map((r) => r.tempId)));
    }
  };

  const handleToggleRow = (tempId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(tempId)) {
      newSelected.delete(tempId);
    } else {
      newSelected.add(tempId);
    }
    setSelectedRows(newSelected);
  };

  const handleBatchAction = (action: "skip" | "merge" | "create") => {
    selectedRows.forEach((tempId) => {
      onDecisionChange(tempId, action);
    });
    setSelectedRows(new Set()); // Clear selection after batch action
  };

  return (
    <div className="space-y-3">
      {/* Batch action bar - only show when rows are selected */}
      {someSelected && (
        <div className="sticky top-0 z-10 flex items-center gap-3 rounded-lg border border-line-ember bg-surface-dawn px-3 py-2 shadow-soft">
          <span className="text-sm font-medium text-text-ink">{selectedRows.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => handleBatchAction("create")}>
              Create All
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleBatchAction("merge")}>
              Merge All
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleBatchAction("skip")}>
              Skip All
            </Button>
          </div>
          <button
            onClick={() => setSelectedRows(new Set())}
            className="ml-auto text-xs text-text-inkMuted hover:text-text-ink"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-line-ghost">
        <div className="grid grid-cols-[auto,1fr,1fr,auto,auto,auto,auto,auto] bg-canvas-boneMuted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-inkMuted">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleSelectAll}
            className="mr-3"
            aria-label="Select all rows"
          />
          <span>Title</span>
          <span>Author</span>
          <span className="min-w-32">Status</span>
          <span className="min-w-28">Started</span>
          <span className="min-w-28">Finished</span>
          <span className="min-w-16 text-center">Favorite</span>
          <span className="min-w-32">Decision</span>
        </div>
        <div className="divide-y divide-line-ghost bg-canvas-bone">
          {rows.map((row) => {
            const match = matchByTemp.get(row.tempId);
            const decision = decisions[row.tempId]?.action ?? getDefaultDecision(row.tempId);
            const isSelected = selectedRows.has(row.tempId);
            return (
              <div
                key={row.tempId}
                className="grid grid-cols-[auto,1fr,1fr,auto,auto,auto,auto,auto] items-center gap-2 px-3 py-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleRow(row.tempId)}
                  className="mr-3"
                  aria-label={`Select ${row.title}`}
                />
                <div className="space-y-0.5">
                  <p className="font-medium text-text-ink">{row.title}</p>
                  {row.isbn && <p className="text-xs text-text-inkMuted">ISBN {row.isbn}</p>}
                </div>
                <div className="space-y-0.5">
                  <p className="text-text-ink">{row.author}</p>
                  {row.publishedYear && (
                    <p className="text-xs text-text-inkMuted">{row.publishedYear}</p>
                  )}
                </div>
                <span className="text-xs font-medium text-text-inkMuted">
                  {row.status ?? DEFAULT_STATUS}
                </span>
                <span className="text-xs text-text-ink">
                  {row.dateStarted
                    ? new Date(row.dateStarted).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </span>
                <span className="text-xs text-text-ink">
                  {row.dateFinished
                    ? new Date(row.dateFinished).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </span>
                <div className="flex justify-center">
                  {row.isFavorite && (
                    <Star className="h-4 w-4 fill-status-warning text-status-warning" />
                  )}
                </div>
                <DedupControls
                  tempId={row.tempId}
                  decision={decision}
                  match={match}
                  onChange={onDecisionChange}
                />
              </div>
            );
          })}
          {rows.length === 0 && <p className="p-3 text-sm text-text-inkMuted">No rows.</p>}
        </div>
      </div>
    </div>
  );
}
