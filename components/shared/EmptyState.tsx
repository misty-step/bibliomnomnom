"use client";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-paper-secondary/70 p-8 text-center">
      <h3 className="font-serif text-2xl text-leather">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm text-ink-faded">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
