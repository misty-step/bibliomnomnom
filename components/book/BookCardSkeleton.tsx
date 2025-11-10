export function BookCardSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="h-48 w-full animate-pulse rounded-xl bg-paper-secondary/80" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-paper-secondary/80" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-paper-secondary/80" />
    </div>
  );
}
