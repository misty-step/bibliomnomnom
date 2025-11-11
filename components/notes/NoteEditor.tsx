"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { marked } from "marked";
import TurndownService from "turndown";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { NoteTypeSelector, NoteType } from "./NoteTypeSelector";

type NoteEditorProps = {
  bookId: Id<"books">;
  note?: Doc<"notes"> | null;
  onSaved?: (payload: { id: Id<"notes">; content: string; type: NoteType; page?: string }) => void;
};

const PLACEHOLDERS: Record<NoteType, string> = {
  note: "Capture a moment, takeaway, or question…",
  quote: "Paste the exact phrasing that moved you…",
  reflection: "Connect the book to your life, other ideas, or lingering feelings…",
};

const turndown = new TurndownService({ headingStyle: "atx" });

export function NoteEditor({ bookId, note = null, onSaved }: NoteEditorProps) {
  const createNote = useMutation(api.notes.create);
  const updateNote = useMutation(api.notes.update);
  const deleteNote = useMutation(api.notes.remove);

  const [noteId, setNoteId] = useState<Id<"notes"> | null>(note?._id ?? null);
  const [type, setType] = useState<NoteType>(note?.type ?? "note");
  const [page, setPage] = useState(note?.page ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState(note?.content ?? "");
  const [dirty, setDirty] = useState(false);

  const typeRef = useRef(type);
  useEffect(() => {
    typeRef.current = type;
  }, [type]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: () => PLACEHOLDERS[typeRef.current],
      }),
    ],
    content: markdownToHtml(note?.content ?? ""),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[250px] rounded-2xl border border-border bg-paper px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      setContent(htmlToMarkdown(editor.getHTML()));
      setDirty(true);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(markdownToHtml(note?.content ?? ""));
  }, [editor, note?.content]);

  useEffect(() => {
    setContent(note?.content ?? "");
    setDirty(false);
    setPage(note?.page ?? "");
    setType(note?.type ?? "note");
    setNoteId(note?._id ?? null);
  }, [note?._id, note?.content, note?.page, note?.type]);

  const persist = useCallback(
    async (currentContent: string) => {
      if (!currentContent.trim()) return;
      setStatus("saving");
      setError(null);

      try {
        let savedId: Id<"notes"> | null = noteId;

        if (noteId) {
          await updateNote({
            id: noteId,
            content: currentContent,
            page: page || undefined,
            type,
          });
        } else {
          savedId = await createNote({
            bookId,
            content: currentContent,
            page: page || undefined,
            type,
          });
          setNoteId(savedId);
        }

        setStatus("saved");
        if (savedId) {
          onSaved?.({
            id: savedId,
            content: currentContent,
            type,
            page: page || undefined,
          });
        }

        setDirty(false);
        setTimeout(() => setStatus("idle"), 1200);
      } catch (err) {
        console.error(err);
        setStatus("error");
        setError("Unable to save note right now. Please retry.");
      }
    },
    [noteId, updateNote, createNote, bookId, page, type, onSaved]
  );

  useEffect(() => {
    if (!dirty || !content.trim()) return;
    const handle = setTimeout(() => {
      void persist(content);
    }, 1200);

    return () => clearTimeout(handle);
  }, [dirty, content, page, type, persist]);

  const handleDelete = async () => {
    if (!noteId) return;
    setStatus("saving");
    try {
      await deleteNote({ id: noteId });
      setStatus("idle");
      setNoteId(null);
      editor?.commands.clearContent(true);
      setContent("");
      setPage("");
      setDirty(false);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError("Failed to delete note.");
    }
  };

  const handleManualSave = () => {
    if (!content.trim()) {
      setError("Write something before saving.");
      return;
    }
    void persist(content);
  };

  const statusLabel = useMemo(() => {
    switch (status) {
      case "saving":
        return "Saving…";
      case "saved":
        return "Saved";
      case "error":
        return error ?? "Something went wrong.";
      default:
        return "Auto-save enabled";
    }
  }, [status, error]);

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-paper-secondary/70 p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <NoteTypeSelector
            value={type}
            onChange={(next) => {
              setType(next);
              setDirty(true);
            }}
          />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-48">
          <label className="text-xs uppercase tracking-wide text-ink-faded">Page / Location</label>
          <input
            value={page}
            onChange={(event) => {
              setPage(event.target.value);
              setDirty(true);
            }}
            placeholder="e.g. 123 or Chapter 5"
            className="rounded-lg border border-border bg-paper px-3 py-2 text-sm focus:border-leather focus:outline-none focus:ring-2 focus:ring-leather/40"
          />
        </div>
      </div>

      <div>{editor ? <EditorContent editor={editor} /> : <SkeletonEditor />}</div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-faded">{statusLabel}</p>
        <div className="flex items-center gap-3">
          {noteId ? (
            <Button variant="ghost" onClick={handleDelete}>
              Delete
            </Button>
          ) : null}
          <Button onClick={handleManualSave}>Save</Button>
        </div>
      </div>

      {error && status === "error" ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function SkeletonEditor() {
  return (
    <div className="flex min-h-[250px] animate-pulse flex-col gap-2 rounded-2xl border border-border bg-paper p-4">
      <div className="h-4 w-3/4 rounded bg-border" />
      <div className="h-4 w-full rounded bg-border" />
      <div className="h-4 w-5/6 rounded bg-border" />
      <div className="flex-1 rounded bg-border" />
    </div>
  );
}

function markdownToHtml(markdown: string) {
  if (!markdown) return "";
  return marked(markdown);
}

function htmlToMarkdown(html: string) {
  return turndown.turndown(html);
}
