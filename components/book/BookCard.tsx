import Image from "next/image";
import type { Doc } from "@/convex/_generated/dataModel";
import { StatusBadge } from "./StatusBadge";

type BookCardProps = {
  book: Doc<"books">;
};

export function BookCard({ book }: BookCardProps) {
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-paper p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative mb-4 h-48 w-full overflow-hidden rounded-xl border border-border bg-paper-secondary">
        {book.coverUrl || book.apiCoverUrl ? (
          <Image
            src={(book.coverUrl ?? book.apiCoverUrl) as string}
            alt={`${book.title} cover`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink-faded">
            No cover
          </div>
        )}
      </div>
      <div className="flex-1 space-y-2">
        <StatusBadge status={book.status} />
        <h3 className="font-serif text-xl text-leather">{book.title}</h3>
        <p className="text-sm text-ink-faded">{book.author}</p>
      </div>
    </article>
  );
}
