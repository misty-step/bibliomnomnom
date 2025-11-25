import { Button } from "@/components/ui/button";

type CommitSummaryProps = {
  counts: { created: number; merged: number; skipped: number };
  onRetry?: () => void;
  onClose?: () => void;
};

export function CommitSummary({ counts, onRetry, onClose }: CommitSummaryProps) {
  return (
    <div className="space-y-3 rounded-lg border border-line-ghost bg-canvas-bone p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg text-text-ink">Import complete</p>
          <p className="text-sm text-text-inkMuted">
            Created {counts.created}, merged {counts.merged}, skipped {counts.skipped}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {onClose && (
          <Button size="sm" onClick={onClose}>
            Back to Library
          </Button>
        )}
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Import another file
          </Button>
        )}
      </div>
    </div>
  );
}
