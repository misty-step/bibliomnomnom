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
      <p className="text-xs uppercase tracking-wide text-ink-faded">Note Type</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={cn(
              "rounded-xl border border-border bg-paper px-4 py-3 text-left transition hover:border-leather",
              value === type.value && "border-leather shadow-inner"
            )}
          >
            <p className="font-semibold text-ink">{type.label}</p>
            <p className="text-xs text-ink-faded">{type.helper}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
