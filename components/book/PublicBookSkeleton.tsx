export function PublicBookSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 rounded-3xl border border-border bg-paper-secondary/70 p-8">
      <div className="h-6 w-32 animate-pulse rounded bg-paper" />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-paper" />
        <div className="space-y-3">
          <div className="h-6 w-2/3 animate-pulse rounded bg-paper" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-paper" />
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-paper" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-paper" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-paper" />
          </div>
        </div>
      </div>
    </div>
  );
}
