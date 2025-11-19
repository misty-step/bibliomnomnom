"use client";

import { useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Editor } from "./Editor";
import { NoteTypeSelector, NoteType } from "./NoteTypeSelector";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Loader2, X, Check } from "lucide-react";

type NoteCardProps = {
  note: Doc<"notes">;
};

const TYPE_STYLES: Record<
  NoteType,
  { label: string; className: string }
> = {
  note: {
    label: "Note",
    className: "bg-leather/10 text-leather",
  },
  quote: {
    label: "Quote",
    className: "bg-ink/10 text-ink",
  },
  reflection: {
    label: "Reflection",
    className: "bg-primary/10 text-primary",
  },
};

export function NoteCard({ note }: NoteCardProps) {
  const updateNote = useMutation(api.notes.update);
  const deleteNote = useMutation(api.notes.remove);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit State
  const [content, setContent] = useState(note.content);
  const [type, setType] = useState<NoteType>(note.type ?? "note");
  const [page, setPage] = useState(note.page ?? "");

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      await updateNote({
        id: note._id,
        content,
        type,
        page: page || undefined,
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update note:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    setIsSaving(true); // visually indicate work
    try {
      await deleteNote({ id: note._id });
    } catch (err) {
      console.error("Failed to delete note:", err);
      setIsSaving(false);
    }
  };

  const displayContent = useMemo(() => {
    const raw = marked.parse(note.content ?? "", { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [note.content]);

  const meta = TYPE_STYLES[note.type ?? "note"];
  const updatedAt = new Date(note.updatedAt);

  if (isEditing) {
    return (
      <article className="rounded-xl border border-line-ghost bg-surface-dawn p-4 shadow-sm ring-1 ring-primary/10">
        <div className="mb-4">
          <Editor
            initialContent={content}
            onChange={setContent}
            className="min-h-[5rem]"
            autoFocus
          />
        </div>
        
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
             <NoteTypeSelector value={type} onChange={setType} />
             <div className="h-4 w-px bg-line-ghost" />
             <input
                value={page}
                onChange={(e) => setPage(e.target.value)}
                placeholder="Page #"
                className="w-20 rounded-md bg-canvas-boneMuted px-2 py-1 text-sm font-medium text-text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
             />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-accent-ember hover:bg-accent-ember/10 hover:text-accent-ember mr-auto sm:mr-0"
              title="Delete note"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-line-ghost hidden sm:block" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setContent(note.content); // Revert
                setType(note.type ?? "note");
                setPage(note.page ?? "");
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !content.trim()}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative space-y-3 rounded-xl border border-transparent bg-transparent p-5 transition-all hover:bg-canvas-boneMuted">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
              meta.className,
              "bg-opacity-10 ring-opacity-20" // Subtle background and border
            )}
          >
            {meta.label}
          </span>
          {note.page ? (
            <span className="text-xs font-medium text-text-inkSubtle">
              Page {note.page}
            </span>
          ) : null}
        </div>
        
        <button
          onClick={() => setIsEditing(true)}
          className="opacity-0 transition-opacity group-hover:opacity-100 p-1 text-text-inkMuted hover:text-text-ink"
          title="Edit note"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </header>
      
      <div
        className="prose prose-sm max-w-none text-text-ink/90"
        dangerouslySetInnerHTML={{ __html: displayContent }}
      />
      
      <footer className="text-xs text-text-inkSubtle/60">
        {updatedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </footer>
    </article>
  );
}