type DedupControlProps = {
  tempId: string;
  decision: "skip" | "merge" | "create";
  onChange: (tempId: string, action: "skip" | "merge" | "create") => void;
  matchType?: string;
  disabled?: boolean;
};

export function DedupControls({ tempId, decision, onChange, matchType, disabled }: DedupControlProps) {
  return (
    <div className="flex items-center gap-2">
      {matchType && (
        <span className="rounded-full bg-canvas-boneMuted px-2 py-1 text-xs font-medium text-text-inkMuted">
          match: {matchType}
        </span>
      )}
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
  );
}
