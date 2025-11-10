"use client";

import { motion } from "framer-motion";
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
    <motion.span
      layout
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        meta.className
      )}
    >
      {meta.label}
    </motion.span>
  );
}
