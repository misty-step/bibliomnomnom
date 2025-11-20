"use client";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="max-w-md space-y-4">
        <h3 className="font-display text-3xl font-medium text-text-ink">{title}</h3>
        {description ? (
          <p className="font-sans text-base text-text-inkMuted leading-relaxed max-w-sm mx-auto">
            {description}
          </p>
        ) : null}
        {action ? <div className="pt-6">{action}</div> : null}
      </div>
    </div>
  );
}
