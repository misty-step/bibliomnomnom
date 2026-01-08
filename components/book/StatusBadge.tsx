"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const STATUS_MAP = {
  "want-to-read": {
    label: "Want to Read",
    className: "bg-text-ink/5 text-text-ink",
  },
  "currently-reading": {
    label: "Reading",
    className: "bg-canvas-boneMuted text-text-ink",
  },
  read: {
    label: "Read",
    className: "bg-text-ink/10 text-text-ink",
  },
};

type Status = keyof typeof STATUS_MAP;

type StatusBadgeProps = {
  status: Status;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_MAP[status];

  return (
    <motion.span
      layout
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        meta.className,
      )}
    >
      {meta.label}
    </motion.span>
  );
}
