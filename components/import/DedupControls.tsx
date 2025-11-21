import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
      <Select
        value={decision}
        onValueChange={(val) => onChange(tempId, val as DedupControlProps["decision"])}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 w-32 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="skip">Skip</SelectItem>
          <SelectItem value="merge">Merge</SelectItem>
          <SelectItem value="create">Create</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
