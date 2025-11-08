"use client";

import { cn } from "@/lib/utils";

const STATUS_MAP = {
  "want-to-read": {
    label: "Want to Read",
    className: "bg-ink/5 text-ink",
  },
  "currently-reading": {
    label: "Reading",
    className: "bg-primary/10 text-primary",
  },
  read: {
    label: "Read",
    className: "bg-leather/10 text-leather",
  },
};

type Status = keyof typeof STATUS_MAP;

type StatusBadgeProps = {
  status: Status;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_MAP[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}
