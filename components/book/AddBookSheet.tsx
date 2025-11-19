"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { useMutation } from "convex/react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button"; // Keep Button for the submit button inside the form
import { SideSheet } from "@/components/ui/SideSheet"; // Import SideSheet
import { useToast } from "@/hooks/use-toast";
import { BOOK_STATUS_OPTIONS, type BookStatus } from "./constants";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function AddBookSheet({ triggerLabel = "Add Book" }: { triggerLabel?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<BookStatus>("want-to-read");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBook = useMutation(api.books.create);
  const { toast } = useToast();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    // Reset form
    setTitle("");
    setAuthor("");
    setStatus("want-to-read");
    setCoverFile(null);
    setCoverPreview(null);
    setError(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_BYTES) {
      setError("Images must be smaller than 5MB.");
      return;
    }

    setError(null);
    setCoverFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setCoverPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedAuthor = author.trim();

    if (!trimmedTitle || !trimmedAuthor) {
      setError("Title and author are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let coverUrl: string | undefined;

      // Upload cover if selected
      if (coverFile) {
        const blob = await upload(coverFile.name, coverFile, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
        });
        coverUrl = blob.url;
      }

      // Create book
      await createBook({
        title: trimmedTitle,
        author: trimmedAuthor,
        status,
        coverUrl,
        isAudiobook: false,
        isFavorite: false,
        apiSource: "manual",
      });

      toast({
        title: "Book added",
        description: "Added to your library.",
      });

      handleClose();
    } catch (err) {
      console.error(err);
      setError("Unable to add this book. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <span
        onClick={handleOpen}
        className="relative group cursor-pointer font-sans text-base text-ink hover:text-inkMuted"
      >
        + {triggerLabel}
        <span className="absolute bottom-0 left-0 w-full h-px bg-ink transform scaleX(0) group-hover:scaleX(1) transition-transform duration-150 ease-out origin-left"></span>
      </span>
      <SideSheet open={isOpen} onOpenChange={setIsOpen} title="ADD BOOK">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cover Upload */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-inkMuted">
              Cover Image
            </label>
            {coverPreview ? (
              <div className="flex gap-4">
                <div className="relative h-48 w-32 overflow-hidden rounded-lg">
                  <Image
                    src={coverPreview}
                    alt="Cover preview"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-line-ghost bg-canvas-bone px-4 py-2 text-sm font-medium text-text-ink transition hover:border-text-ink hover:bg-canvas-boneMuted">
                    <input
                      type="file"
                      accept={ALLOWED_TYPES.join(",")}
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={isSubmitting}
                    />
                    Change
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    disabled={isSubmitting}
                    className="font-sans text-sm text-inkMuted hover:text-ink hover:underline disabled:pointer-events-none disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label
                className={cn(
                  "flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line-ghost bg-canvas-boneMuted transition hover:border-text-inkMuted hover:bg-canvas-bone",
                  isSubmitting && "pointer-events-none opacity-60"
                )}
              >
                <input
                  type="file"
                  accept={ALLOWED_TYPES.join(",")}
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isSubmitting}
                />
                <span className="text-sm font-medium text-text-inkMuted">
                  Click to upload or drag and drop
                </span>
                <span className="mt-1 text-xs text-text-inkSubtle">
                  JPG, PNG, or WebP (max 5MB)
                </span>
              </label>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-inkMuted">
              Title <span className="text-accent-ember">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Name of the Wind"
              className="w-full border-b border-transparent bg-transparent px-4 py-3 text-text-ink placeholder:text-text-inkSubtle focus:border-line-ember focus:outline-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Author */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-inkMuted">
              Author <span className="text-accent-ember">*</span>
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Patrick Rothfuss"
              className="w-full border-b border-transparent bg-transparent px-4 py-3 text-text-ink placeholder:text-text-inkSubtle focus:border-line-ember focus:outline-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-3 block font-mono text-xs uppercase tracking-wider text-inkMuted">
              Reading Status
            </label>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {BOOK_STATUS_OPTIONS.map((option, index) => (
                <span
                  key={option.value}
                  onClick={() => setStatus(option.value)}
                  className={cn(
                    "group relative cursor-pointer font-mono text-sm uppercase tracking-wider",
                    status === option.value
                      ? "text-ink"
                      : "text-inkMuted hover:text-ink"
                  )}
                >
                  {option.label}
                  <span
                    className={cn(
                      "absolute inset-x-0 bottom-0 h-px bg-ink transition-transform duration-150 ease-out origin-left",
                      status === option.value ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    )}
                  />
                  {index < BOOK_STATUS_OPTIONS.length - 1 && <span className="mx-1 text-inkMuted">·</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-accent-ember/20 bg-accent-ember/10 px-4 py-3 text-sm text-accent-ember">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="font-sans text-sm text-inkMuted hover:text-ink hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Cancel
            </button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add Book"}
            </Button>
          </div>
        </form>
      </SideSheet>
    </>
  );
}
