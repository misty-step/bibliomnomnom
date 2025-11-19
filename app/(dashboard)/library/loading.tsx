import { BookTileSkeleton } from "@/components/book/BookTile";

export default function LibraryLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 animate-pulse rounded bg-paper-secondary/80" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <BookTileSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
}
