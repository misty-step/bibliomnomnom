"use client";

import { useQuery } from "convex/react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { NoteCard } from "./NoteCard";
import { EmptyState } from "@/components/shared/EmptyState";

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
      <EmptyState
        title="No notes yet"
        description="Use the editor on the right to capture your first thought."
      />
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
