import { Suspense } from "react";
import { SearchModal } from "@/components/search/SearchModal";
import { LibraryView } from "@/components/book/LibraryView";

export default function LibraryPage() {
  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl text-leather">Your Library</h1>
          <p className="text-ink-faded">
            Browse every book you&apos;re dreaming about, reading, or remembering.
          </p>
        </div>
        <SearchModal triggerLabel="Add Book" />
      </div>

      <Suspense fallback={<Placeholder />}>
        <LibraryView />
      </Suspense>
    </section>
  );
}

function Placeholder() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-full animate-pulse rounded-lg bg-paper-secondary" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="space-y-3 rounded-2xl border border-border p-4">
            <div className="h-48 rounded-xl bg-paper animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-paper" />
            <div className="h-3 w-1/2 rounded bg-paper" />
          </div>
        ))}
      </div>
    </div>
  );
}
