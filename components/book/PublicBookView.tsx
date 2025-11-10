"use client";

import Image from "next/image";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatusBadge } from "./StatusBadge";

type PublicBookViewProps = {
  bookId: Id<"books">;
};

export function PublicBookView({ bookId }: PublicBookViewProps) {
  const book = useQuery(api.books.getPublic, { id: bookId });

  if (book === undefined) {
    return <PublicSkeleton />;
  }

  if (!book) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-border bg-paper-secondary/70 p-10 text-center">
        <h1 className="font-serif text-2xl text-leather">This book is private.</h1>
        <p className="text-sm text-ink-faded">
          The owner hasn&apos;t published it yet. Try another public link.
        </p>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6 rounded-3xl border border-border bg-paper-secondary/70 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-8 lg:flex-row">
        <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-border bg-paper sm:h-72 lg:max-w-xs">
          {book.coverUrl || book.apiCoverUrl ? (
            <Image
              src={(book.coverUrl ?? book.apiCoverUrl) as string}
              alt={`${book.title} cover`}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-ink-faded">
              No cover available
            </div>
          )}
        </div>
        <div className="flex-1 space-y-4">
          <StatusBadge status={book.status} />
          <div>
            <h1 className="font-serif text-4xl text-leather">{book.title}</h1>
            <p className="text-lg text-ink-faded">{book.author}</p>
          </div>
          {book.description ? (
            <p className="text-sm text-ink">{book.description}</p>
          ) : (
            <p className="text-sm text-ink-faded">No description available.</p>
          )}
        </div>
      </header>
      <dl className="grid gap-4 rounded-2xl border border-border bg-paper p-6 sm:grid-cols-2">
        {book.publishedYear ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-faded">Published</dt>
            <dd className="text-sm text-ink">{book.publishedYear}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-faded">Format</dt>
          <dd className="text-sm text-ink">{book.isAudiobook ? "Audiobook" : "Print / eBook"}</dd>
        </div>
      </dl>
      <div className="rounded-2xl border border-dashed border-border bg-paper p-8 text-center text-sm text-ink-faded">
        Public notes coming soon. For now, enjoy this glimpse into the book.
      </div>
    </section>
  );
}

function PublicSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="h-6 w-48 animate-pulse rounded bg-paper-secondary" />
      <div className="h-80 animate-pulse rounded-3xl border border-border bg-paper-secondary" />
    </div>
  );
}
