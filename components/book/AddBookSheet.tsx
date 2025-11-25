"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { useMutation } from "convex/react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { Star, Headphones } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { SideSheet } from "@/components/ui/SideSheet";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BOOK_STATUS_OPTIONS, type BookStatus } from "./constants";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

// Curated list of exemplary books for form placeholders
const EXAMPLE_BOOKS = [
  { title: "The Divine Comedy", author: "Dante Alighieri" },
  { title: "The Fellowship of the Ring", author: "J.R.R. Tolkien" },
  { title: "No Country for Old Men", author: "Cormac McCarthy" },
  { title: "Tao Te Ching", author: "Lao-Tzu" },
  { title: "The Book of Five Rings", author: "Miyamoto Musashi" },
  { title: "The Imitation of Christ", author: "Thomas à Kempis" },
  { title: "Hyperion", author: "Dan Simmons" },
  { title: "Project Hail Mary", author: "Andy Weir" },
  { title: "A Philosophy of Software Design", author: "John Ousterhout" },
  { title: "Musashi", author: "Eiji Yoshikawa" },
  { title: "The Tempest", author: "William Shakespeare" },
  { title: "Dominion", author: "Tom Holland" },
  { title: "The Road", author: "Cormac McCarthy" },
  { title: "The Great Divorce", author: "C.S. Lewis" },
];

type AddBookSheetProps = {
  triggerLabel?: string;
  triggerClassName?: string;
  triggerVariant?: "primary" | "ghost";
  // Controlled mode
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

// Helper to get today's date in YYYY-MM-DD format
function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function AddBookSheet({
  triggerLabel = "Add Book",
  triggerClassName,
  triggerVariant,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: AddBookSheetProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = useCallback(
    (open: boolean) => {
      if (controlledOnOpenChange) {
        controlledOnOpenChange(open);
      } else {
        setInternalIsOpen(open);
      }
    },
    [controlledOnOpenChange],
  );
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<BookStatus>("currently-reading");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isAudiobook, setIsAudiobook] = useState(false);
  const [dateFinished, setDateFinished] = useState("");
  const [exampleBook, setExampleBook] = useState(
    () => EXAMPLE_BOOKS[Math.floor(Math.random() * EXAMPLE_BOOKS.length)],
  );

  const createBook = useMutation(api.books.create);
  const { toast } = useToast();

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    // Reset form
    setTitle("");
    setAuthor("");
    setStatus("currently-reading");
    setCoverFile(null);
    setCoverPreview(null);
    setError(null);
    setIsFavorite(false);
    setIsAudiobook(false);
    setDateFinished("");
  }, [setIsOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  // Pick new random example book when form opens
  useEffect(() => {
    if (isOpen) {
      setExampleBook(EXAMPLE_BOOKS[Math.floor(Math.random() * EXAMPLE_BOOKS.length)]);
    }
  }, [isOpen]);

  const handleStatusChange = (newStatus: BookStatus) => {
    setStatus(newStatus);
    // Set default date when switching to Finished
    if (newStatus === "read" && !dateFinished) {
      setDateFinished(getTodayString());
    }
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

      // Convert date string to timestamp if provided
      const dateFinishedTimestamp = dateFinished ? new Date(dateFinished).getTime() : undefined;

      // Create book
      await createBook({
        title: trimmedTitle,
        author: trimmedAuthor,
        status,
        coverUrl,
        isAudiobook,
        isFavorite,
        dateFinished: status === "read" ? dateFinishedTimestamp : undefined,
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
      {/* Only render trigger when not in controlled mode */}
      {controlledIsOpen === undefined &&
        (triggerVariant === "primary" ? (
          <Button onClick={handleOpen} className={triggerClassName}>
            {triggerLabel}
          </Button>
        ) : (
          <button
            type="button"
            onClick={handleOpen}
            className={
              triggerClassName ||
              "relative group cursor-pointer font-sans text-sm text-ink hover:text-inkMuted"
            }
          >
            {triggerClassName ? triggerLabel : `+ ${triggerLabel}`}
          </button>
        ))}

      <SideSheet open={isOpen} onOpenChange={setIsOpen} title="Add Book">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Cover Upload */}
          <div>
            <label className="mb-3 block font-mono text-xs uppercase tracking-wider text-text-inkMuted">
              Cover Image
            </label>
            {coverPreview ? (
              <div className="flex justify-center">
                <div className="group relative w-40">
                  {/* Cover Image */}
                  <div className="aspect-[2/3] overflow-hidden rounded-sm shadow-md">
                    <Image src={coverPreview} alt="Cover preview" fill className="object-cover" />
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-sm bg-black/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <label className="cursor-pointer rounded-md bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/30">
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
                      className="text-sm text-white/80 hover:text-white hover:underline disabled:pointer-events-none disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label
                className={cn(
                  "flex h-32 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-line-ghost bg-canvas-boneMuted transition hover:border-text-inkMuted hover:bg-canvas-bone",
                  isSubmitting && "pointer-events-none opacity-60",
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
            <label className="mb-3 block font-mono text-xs uppercase tracking-wider text-text-inkMuted">
              Title <span className="text-accent-ember">*</span>
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={exampleBook.title}
              disabled={isSubmitting}
              className="text-lg font-display"
            />
          </div>

          {/* Author */}
          <div>
            <label className="mb-3 block font-mono text-xs uppercase tracking-wider text-text-inkMuted">
              Author <span className="text-accent-ember">*</span>
            </label>
            <Input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder={exampleBook.author}
              disabled={isSubmitting}
            />
          </div>

          {/* Status - Segmented Control */}
          <div>
            <label className="mb-3 block font-mono text-xs uppercase tracking-wider text-text-inkMuted">
              Status
            </label>
            <div className="flex rounded-md bg-canvas-boneMuted p-1">
              {BOOK_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleStatusChange(option.value)}
                  className={cn(
                    "flex-1 rounded-md px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all duration-150",
                    status === option.value
                      ? "bg-text-ink text-canvas-bone shadow-sm"
                      : "text-text-inkMuted hover:text-text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Finished Date - Conditional */}
          {status === "read" && (
            <div>
              <label className="mb-3 block font-mono text-xs uppercase tracking-wider text-text-inkMuted">
                Finished On
              </label>
              <Input
                type="date"
                value={dateFinished}
                onChange={(e) => setDateFinished(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* Flags */}
          <div>
            <label className="mb-3 block font-mono text-xs uppercase tracking-wider text-text-inkMuted">
              Flags
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all duration-150",
                  isFavorite
                    ? "bg-text-ink text-canvas-bone shadow-sm"
                    : "bg-canvas-boneMuted text-text-inkMuted hover:text-text-ink",
                )}
              >
                <Star
                  className={cn("h-3.5 w-3.5", isFavorite && "fill-amber-400 text-amber-400")}
                />
                Favorite
              </button>
              <button
                type="button"
                onClick={() => setIsAudiobook(!isAudiobook)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all duration-150",
                  isAudiobook
                    ? "bg-text-ink text-canvas-bone shadow-sm"
                    : "bg-canvas-boneMuted text-text-inkMuted hover:text-text-ink",
                )}
              >
                <Headphones className="h-3.5 w-3.5" />
                Audiobook
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-accent-ember/20 bg-accent-ember/10 px-4 py-3 text-sm text-accent-ember">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="font-sans text-sm text-text-inkMuted hover:text-text-ink hover:underline disabled:pointer-events-none disabled:opacity-50"
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
