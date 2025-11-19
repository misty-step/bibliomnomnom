"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { marked } from "marked";
import TurndownService from "turndown";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const turndown = new TurndownService({ headingStyle: "atx" });

type EditorProps = {
  initialContent?: string;
  onChange?: (content: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  editable?: boolean;
};

export function Editor({
  initialContent = "",
  onChange,
  onFocus,
  onBlur,
  placeholder = "Write something…",
  className,
  autoFocus = false,
  editable = true,
}: EditorProps) {
  const editor = useEditor({
    editable,
    autofocus: autoFocus,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: false, // Disable headings for simpler notes
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: markdownToHtml(initialContent),
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none min-h-[4rem] focus:outline-none text-text-ink placeholder:text-text-inkSubtle/50",
          className
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(htmlToMarkdown(editor.getHTML()));
    },
    onFocus,
    onBlur,
  });

  // Sync content if it changes externally (e.g. reset)
  // Note: we only set content if it's drastically different to avoid cursor jumping,
  // or strictly when initialContent changes and matches a "reset" pattern.
  // For now, simple sync.
  const isMounted = useRef(false);
  useEffect(() => {
    if (!editor) return;
    
    // Only update if the content is different from current editor state to avoid loops/cursor jumps
    const currentMarkdown = htmlToMarkdown(editor.getHTML());
    if (initialContent !== currentMarkdown) {
       // If initialContent is empty, it's likely a reset.
       if (!initialContent) {
         editor.commands.clearContent();
       } else if (!isMounted.current) {
         // Only set initial content on mount or strict reset
         editor.commands.setContent(markdownToHtml(initialContent));
       }
    }
    isMounted.current = true;
  }, [editor, initialContent]);

  return <EditorContent editor={editor} />;
}

function markdownToHtml(markdown: string) {
  if (!markdown) return "";
  return marked.parse(markdown, { async: false }) as string;
}

function htmlToMarkdown(html: string) {
  return turndown.turndown(html);
}
