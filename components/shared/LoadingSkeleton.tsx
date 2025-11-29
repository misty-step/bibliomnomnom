"use client";

type LoadingSkeletonProps = {
  lines?: number;
};

export function LoadingSkeleton({ lines = 3 }: LoadingSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, idx) => (
        <div key={idx} className="h-4 animate-pulse rounded bg-text-ink/10 dark:bg-text-ink/20" />
      ))}
    </div>
  );
}
