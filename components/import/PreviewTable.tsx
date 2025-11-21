import { DedupControls } from "./DedupControls";

import type { ParsedBook, DedupMatch } from "@/lib/import/types";

type PreviewTableProps = {
  rows: ParsedBook[];
  dedupMatches: DedupMatch[];
  decisions: Record<string, { action: "skip" | "merge" | "create" }>;
  onDecisionChange: (tempId: string, action: "skip" | "merge" | "create") => void;
};

export function PreviewTable({ rows, dedupMatches, decisions, onDecisionChange }: PreviewTableProps) {
  const matchByTemp = new Map<string, DedupMatch>();
  dedupMatches.forEach((m) => matchByTemp.set(m.tempId, m));

  return (
    <div className="overflow-hidden rounded-lg border border-line-ghost">
      <div className="grid grid-cols-[1fr,1fr,140px,140px] bg-canvas-boneMuted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-inkMuted">
        <span>Title</span>
        <span>Author</span>
        <span>Status</span>
        <span>Decision</span>
      </div>
      <div className="divide-y divide-line-ghost bg-canvas-bone">
        {rows.map((row) => {
          const match = matchByTemp.get(row.tempId);
          const decision = decisions[row.tempId]?.action ?? "skip";
          return (
            <div key={row.tempId} className="grid grid-cols-[1fr,1fr,140px,140px] items-center gap-2 px-3 py-3 text-sm">
              <div className="space-y-0.5">
                <p className="font-medium text-text-ink">{row.title}</p>
                <p className="text-xs text-text-inkMuted">ISBN {row.isbn ?? "—"}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-text-ink">{row.author}</p>
                <p className="text-xs text-text-inkMuted">{row.publishedYear ?? ""}</p>
              </div>
              <span className="text-xs font-medium text-text-inkMuted">{row.status ?? "want-to-read"}</span>
              <DedupControls
                tempId={row.tempId}
                decision={decision}
                matchType={match?.matchType}
                onChange={onDecisionChange}
              />
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="p-3 text-sm text-text-inkMuted">No rows.</p>
        )}
      </div>
    </div>
  );
}
