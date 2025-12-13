"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Editor } from "./Editor";
import { NoteTypeSelector, NoteType } from "./NoteTypeSelector";
import { PhotoQuoteCapture } from "./PhotoQuoteCapture";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type CreateNoteProps = {
  bookId: Id<"books">;
};

export function CreateNote({ bookId }: CreateNoteProps) {
  const createNote = useMutation(api.notes.create);
  const [content, setContent] = useState("");
  const [type, setType] = useState<NoteType>("note");
  const [page, setPage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Collapse on click outside if empty
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isModalOpen) return;
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (!content.trim()) {
          setIsExpanded(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [content, isModalOpen]);

  const handleSave = async () => {
    if (!content.trim()) return;

    setIsSaving(true);
    try {
      await createNote({
        bookId,
        content,
        type,
        page: page || undefined,
      });

      // Reset state completely
      setContent("");
      setPage("");
      setType("note");
      setIsExpanded(false);
    } catch (err) {
      console.error("Failed to create note:", err);
      // TODO: Toast error
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div ref={containerRef} className="relative z-10">
      <Surface
        elevation={isExpanded ? "raised" : "flat"}
        className={cn(
          "transition-all duration-200 ease-in-out",
          isExpanded
            ? "border-line-ghost bg-surface-dawn"
            : "cursor-text border-line-ghost/50 bg-canvas-boneMuted hover:bg-canvas-bone",
        )}
        padding="none"
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        <div className="px-4 py-3">
          <Editor
            initialContent={content}
            onChange={setContent}
            placeholder={isExpanded ? "What's on your mind?" : "Add a note, quote, or reflection…"}
            autoFocus={isExpanded}
            className={cn("min-h-[2.5rem]", isExpanded && "min-h-[6rem]")}
            editable={!isSaving}
          />
        </div>

        {/* Controls - Only visible when expanded */}
        {isExpanded && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200 border-t border-line-ghost/50 bg-surface-dawn/50 px-4 py-3">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <NoteTypeSelector value={type} onChange={setType} />
                <div className="h-4 w-px bg-line-ghost" />
                <PhotoQuoteCapture bookId={bookId} onDialogOpenChange={setIsModalOpen} />
                <div className="h-4 w-px bg-line-ghost" />
                <input
                  value={page}
                  onChange={(e) => setPage(e.target.value)}
                  placeholder="Page #"
                  className="w-20 rounded-md bg-transparent px-2 py-1 text-sm font-medium text-text-ink placeholder:text-text-inkSubtle/50 focus:bg-canvas-bone/70 focus:outline-none focus:ring-2 focus:ring-text-ink/30 focus:ring-offset-2 focus:ring-offset-canvas-bone dark:focus:bg-surface-dawn/80"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setContent("");
                    setIsExpanded(false);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!content.trim() || isSaving}
                  className="min-w-[4rem]"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Surface>
    </div>
  );
}
