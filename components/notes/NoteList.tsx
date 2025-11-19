"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { NoteCard } from "./NoteCard";
import { useAuthedQuery } from "@/lib/hooks/useAuthedQuery";

type NoteListProps = {
  bookId: Id<"books">;
};

export function NoteList({ bookId }: NoteListProps) {
  const notes = useAuthedQuery(api.notes.list, { bookId });

  if (notes === undefined) {
    return <NoteListSkeleton />;
  }

  if (!notes.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-text-inkSubtle">No notes yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <NoteCard key={note._id} note={note} />
      ))}
    </div>
  );
}

function NoteListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-2xl border border-line-ghost bg-canvas-bone p-5"
        >
          <div className="mb-3 h-4 w-24 rounded bg-line-ghost" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-line-ghost" />
            <div className="h-4 w-5/6 rounded bg-line-ghost" />
            <div className="h-4 w-2/3 rounded bg-line-ghost" />
          </div>
        </div>
      ))}
    </div>
  );
}