"use client";

type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center text-sm text-destructive">
      <p>{message ?? "Something went wrong."}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-full border border-destructive px-4 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive hover:text-white"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
