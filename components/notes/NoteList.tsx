"use client";

import { useQuery } from "convex/react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { NoteCard } from "./NoteCard";

type NoteListProps = {
  bookId: Id<"books">;
  onEdit?: (note: Doc<"notes">) => void;
};

export function NoteList({ bookId, onEdit }: NoteListProps) {
  const notes = useQuery(api.notes.list, { bookId });

  if (notes === undefined) {
    return <NoteListSkeleton />;
  }

  if (!notes.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-paper-secondary p-8 text-center text-sm text-ink-faded">
        No notes yet. Use the editor to capture your thoughts.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <NoteCard key={note._id} note={note} onEdit={onEdit} />
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
          className="animate-pulse rounded-2xl border border-border bg-paper p-5"
        >
          <div className="mb-3 h-4 w-24 rounded bg-border" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-border" />
            <div className="h-4 w-5/6 rounded bg-border" />
            <div className="h-4 w-2/3 rounded bg-border" />
          </div>
        </div>
      ))}
    </div>
  );
}
