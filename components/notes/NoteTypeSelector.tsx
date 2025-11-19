"use client";

import { cn } from "@/lib/utils";

export type NoteType = "note" | "quote" | "reflection";

const TYPES: Array<{
  value: NoteType;
  label: string;
  helper: string;
}> = [
  {
    value: "note",
    label: "Note",
    helper: "General thoughts and reactions",
  },
  {
    value: "quote",
    label: "Quote",
    helper: "Verbatim text you want to remember",
  },
  {
    value: "reflection",
    label: "Reflection",
    helper: "Deeper synthesis and connections",
  },
];

type NoteTypeSelectorProps = {
  value: NoteType;
  onChange: (value: NoteType) => void;
};

export function NoteTypeSelector({ value, onChange }: NoteTypeSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-faded">Note Type</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {TYPES.map((type, index) => (
          <span
            key={type.value}
            onClick={() => onChange(type.value)}
            className={cn(
              "group relative cursor-pointer font-mono text-sm uppercase tracking-wider",
              value === type.value
                ? "text-ink"
                : "text-inkMuted hover:text-ink"
            )}
          >
            {type.label}
            <span
              className={cn(
                "absolute inset-x-0 bottom-0 h-px bg-ink transition-transform duration-150 ease-out origin-left",
                value === type.value ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
              )}
            />
            {index < TYPES.length - 1 && <span className="mx-1 text-inkMuted">·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
