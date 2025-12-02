"use client";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

/**
 * Empty state with editorial left-aligned typography.
 * Clean, minimal, inviting.
 */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("py-16", className)}>
      <div className="max-w-md">
        {/* Title - elegant serif, left-aligned */}
        <h3 className="font-display text-3xl text-text-ink tracking-tight">{title}</h3>

        {/* Description - tight spacing */}
        {description ? (
          <p className="mt-3 font-sans text-base text-text-inkMuted leading-relaxed">
            {description}
          </p>
        ) : null}

        {/* Actions */}
        {action ? <div className="mt-8">{action}</div> : null}
      </div>
    </div>
  );
}
