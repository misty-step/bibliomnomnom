"use client";

import { cn } from "@/lib/utils";

export type NoteType = "note" | "quote" | "reflection";

const TYPES: Array<{
  value: NoteType;
  label: string;
}> = [
  { value: "note", label: "Note" },
  { value: "quote", label: "Quote" },
  { value: "reflection", label: "Reflection" },
];

type NoteTypeSelectorProps = {
  value: NoteType;
  onChange: (value: NoteType) => void;
};

export function NoteTypeSelector({ value, onChange }: NoteTypeSelectorProps) {
  return (
    <div className="flex rounded-md bg-canvas-boneMuted p-1">
      {TYPES.map((type) => (
        <button
          key={type.value}
          type="button"
          onClick={() => onChange(type.value)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all duration-150",
            value === type.value
              ? "bg-text-ink text-canvas-bone shadow-sm"
              : "text-text-inkMuted hover:text-text-ink"
          )}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}
