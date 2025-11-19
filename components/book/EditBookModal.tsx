"use client";

import { useMemo, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { SideSheet } from "@/components/ui/SideSheet";
import { BookForm, type SanitizedBookFormValues } from "./BookForm";

type EditBookModalProps = {
  book: Doc<"books">;
};

export function EditBookModal({ book }: EditBookModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const updateBook = useMutation(api.books.update);
  const { toast } = useToast();

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  const initialValues = useMemo(
    () => ({
      title: book.title,
      author: book.author,
      description: book.description ?? "",
      edition: book.edition ?? "",
      isbn: book.isbn ?? "",
      publishedYear: book.publishedYear ? String(book.publishedYear) : "",
      pageCount: book.pageCount ? String(book.pageCount) : "",
      isAudiobook: book.isAudiobook ?? false,
      isFavorite: book.isFavorite ?? false,
      status: book.status,
    }),
    [
      book.title,
      book.author,
      book.description,
      book.edition,
      book.isbn,
      book.publishedYear,
      book.pageCount,
      book.isAudiobook,
      book.isFavorite,
      book.status,
    ]
  );

  const handleSubmit = async (values: SanitizedBookFormValues) => {
    await updateBook({
      id: book._id,
      title: values.title,
      author: values.author,
      description: values.description,
      edition: values.edition,
      isbn: values.isbn,
      publishedYear: values.publishedYear,
      pageCount: values.pageCount,
      isAudiobook: values.isAudiobook,
    });
  };

  return (
    <>
      <button onClick={handleOpen} className="font-sans text-sm text-inkMuted hover:text-ink hover:underline">
        Edit Details
      </button>
      <SideSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Edit Book"
        description="Update metadata, clean up typos, or note new editions."
      >
        <BookForm
          initialValues={initialValues}
          submitLabel="Save Changes"
          busyLabel="Saving…"
          onCancel={handleClose}
          onSubmit={handleSubmit}
          onSuccess={() => {
            toast({
              title: "Book updated",
              description: "Details saved.",
            });
            handleClose();
          }}
          requireDirtyForSubmit
        />
      </SideSheet>
    </>
  );
}
