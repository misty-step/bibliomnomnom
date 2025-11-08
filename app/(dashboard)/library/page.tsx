import { SearchModal } from "@/components/search/SearchModal";

export default function LibraryPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-leather">Your Library</h1>
        <p className="text-ink-faded">Track what you&apos;re reading and what comes next.</p>
      </div>
      <div className="rounded-lg border border-border bg-paper-secondary p-6 text-ink-faded">
        <p className="mb-4">
          Library features are on the way. Soon you&apos;ll see your books, filters, and quick actions
          right here.
        </p>
        <SearchModal />
      </div>
    </section>
  );
}
