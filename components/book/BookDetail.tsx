"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMutation } from "convex/react";
import { upload } from "@vercel/blob/client";
import { Globe, Headphones, Lock, Pencil, Star, Trash2 } from "lucide-react";
import { FetchCoverButton } from "./FetchCoverButton";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useAuthedQuery } from "@/lib/hooks/useAuthedQuery";
import { CreateNote } from "@/components/notes/CreateNote";
import { NoteList } from "@/components/notes/NoteList";
import { BOOK_STATUS_OPTIONS } from "./constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { BookForm, type SanitizedBookFormValues } from "./BookForm";
import { SideSheet } from "@/components/ui/SideSheet";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

type BookDetailProps = {
  bookId: Id<"books">;
};

export function BookDetail({ bookId }: BookDetailProps) {
  const book = useAuthedQuery(api.books.get, { id: bookId });
  const notes = useAuthedQuery(api.notes.list, { bookId });
  const updateStatus = useMutation(api.books.updateStatus);
  const toggleFavorite = useMutation(api.books.toggleFavorite);
  const updatePrivacy = useMutation(api.books.updatePrivacy);
  const updateBook = useMutation(api.books.update);
  const removeBook = useMutation(api.books.remove);
  const router = useRouter();
  const { toast } = useToast();

  const [localStatus, setLocalStatus] = useState<Doc<"books">["status"]>("want-to-read");
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [isTogglingAudiobook, setIsTogglingAudiobook] = useState(false);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);
  const [localPrivacy, setLocalPrivacy] = useState<"private" | "public">("private");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverHovered, setCoverHovered] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetchSuccess, setIsFetchSuccess] = useState(false);

  const currentStatus = book?.status;
  const currentPrivacy = book?.privacy;

  useEffect(() => {
    if (currentStatus) {
      setLocalStatus(currentStatus);
    }
  }, [currentStatus]);

  useEffect(() => {
    if (currentPrivacy) {
      setLocalPrivacy(currentPrivacy);
    }
  }, [currentPrivacy]);

  if (book === undefined) {
    return <BookDetailSkeleton />;
  }

  if (!book) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-xl text-text-inkMuted">Book not found</p>
        <p className="mt-2 text-sm text-text-inkSubtle">
          This book may have been removed or you don&apos;t have access.
        </p>
      </div>
    );
  }

  const handleStatusChange = async (nextStatus: Doc<"books">["status"]) => {
    setLocalStatus(nextStatus);
    try {
      await updateStatus({ id: book._id, status: nextStatus });
    } catch (err) {
      console.error(err);
      setLocalStatus(book.status);
    }
  };

  const handleFavoriteToggle = async () => {
    setIsTogglingFavorite(true);
    try {
      await toggleFavorite({ id: book._id });
    } catch (err) {
      console.error(err);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleAudiobookToggle = async () => {
    setIsTogglingAudiobook(true);
    try {
      await updateBook({ id: book._id, isAudiobook: !book.isAudiobook });
    } catch (err) {
      console.error(err);
    } finally {
      setIsTogglingAudiobook(false);
    }
  };

  const handlePrivacyToggle = async () => {
    const nextPrivacy = localPrivacy === "private" ? "public" : "private";
    const previousPrivacy = localPrivacy;
    setIsTogglingPrivacy(true);
    setLocalPrivacy(nextPrivacy);
    try {
      await updatePrivacy({ id: book._id, privacy: nextPrivacy });
    } catch (err) {
      console.error(err);
      setLocalPrivacy(previousPrivacy);
    } finally {
      setIsTogglingPrivacy(false);
    }
  };

  const handleCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_BYTES) {
      toast({
        title: "File too large",
        description: "Images must be smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingCover(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });
      await updateBook({ id: book._id, coverUrl: blob.url });
      toast({ title: "Cover updated" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCover(false);
      event.target.value = "";
    }
  };

  const handleCoverRemove = async () => {
    setIsUploadingCover(true);
    try {
      await updateBook({ id: book._id, coverUrl: undefined });
      toast({ title: "Cover removed" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Remove failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await removeBook({ id: book._id });
      toast({
        title: "Book deleted",
        description: `"${book.title}" has been removed from your library`,
      });
      setShowDeleteDialog(false);
      router.push("/library");
    } catch (err) {
      console.error(err);
      toast({
        title: "Delete failed",
        description: "We couldn't delete this book. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to format date
  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  };

  const statusLabel = BOOK_STATUS_OPTIONS.find((option) => option.value === localStatus)?.label;

  const statusDate =
    localStatus === "read" && book.dateFinished
      ? `Finished ${formatDate(book.dateFinished)}`
      : localStatus === "currently-reading" && book.dateStarted
        ? `Started ${formatDate(book.dateStarted)}`
        : null;

  const noteCount = notes?.length ?? 0;
  const noteCountLabel =
    notes === undefined
      ? "all associated notes"
      : `${noteCount} ${noteCount === 1 ? "note" : "notes"}`;
  const coverSrc = book.coverUrl ?? book.apiCoverUrl;
  const showFetchCoverButton = !book.coverUrl && !isFetchSuccess;

  return (
    <motion.article
      className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-12"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Cover Column - Sticky */}
      <div className="flex justify-center lg:justify-start">
        <div className="lg:sticky lg:top-8 lg:self-start w-full">
          <div
            className="group relative w-full"
            onMouseEnter={() => setCoverHovered(true)}
            onMouseLeave={() => setCoverHovered(false)}
          >
            {/* Cover Image */}
            <div className="relative aspect-[2/3] overflow-hidden rounded-sm shadow-lg">
              {coverSrc ? (
                <Image
                  src={coverSrc}
                  alt={`${book.title} cover`}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full w-full flex-col justify-between rounded-sm border border-line-ghost/50 bg-canvas-bone p-8">
                  <div className="space-y-3">
                    <h2 className="font-display text-2xl leading-tight text-text-ink line-clamp-5">
                      {book.title}
                    </h2>
                    {book.author ? (
                      <p className="font-mono text-sm uppercase tracking-wider text-text-inkMuted line-clamp-2">
                        {book.author}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-4">
                    {book.publishedYear ? (
                      <span className="font-mono text-xs text-text-inkSubtle">
                        {book.publishedYear}
                      </span>
                    ) : null}
                    {showFetchCoverButton && (
                      <FetchCoverButton
                        bookId={book._id}
                        onSuccess={() => setIsFetchSuccess(true)}
                        className="w-full justify-center"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Hover Overlay for Cover Edit */}
              <motion.div
                initial={false}
                animate={{ opacity: coverHovered ? 1 : 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70"
              >
                <label
                  className={cn(
                    "cursor-pointer rounded-md bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/30",
                    isUploadingCover && "pointer-events-none opacity-50",
                  )}
                >
                  <input
                    type="file"
                    accept={ALLOWED_TYPES.join(",")}
                    onChange={handleCoverUpload}
                    className="hidden"
                    disabled={isUploadingCover}
                  />
                  {isUploadingCover ? "Uploading…" : "Change"}
                </label>
                {coverSrc && (
                  <button
                    onClick={handleCoverRemove}
                    disabled={isUploadingCover}
                    className="text-sm text-white/80 hover:text-white hover:underline disabled:pointer-events-none disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Column */}
      <div className="space-y-8">
        {/* Title & Author */}
        <div>
          <h1 className="font-display text-3xl leading-tight text-text-ink md:text-4xl">
            {book.title}
          </h1>
          <p className="mt-2 text-lg text-text-inkMuted">{book.author}</p>
        </div>

        {/* Status & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Badge */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 rounded-full bg-canvas-boneMuted px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-text-inkMuted transition hover:bg-line-ghost hover:text-text-ink">
                {statusLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <div className="flex flex-col">
                {BOOK_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    className={cn(
                      "px-4 py-2 text-left text-sm text-text-ink hover:bg-canvas-boneMuted",
                      localStatus === option.value && "bg-canvas-boneMuted",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Action Icons */}
          <div className="flex items-center gap-1">
            {/* Favorite */}
            <button
              onClick={handleFavoriteToggle}
              disabled={isTogglingFavorite}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition",
                book.isFavorite
                  ? "bg-amber-100 text-amber-600"
                  : "text-text-inkMuted hover:bg-canvas-boneMuted hover:text-text-ink",
              )}
              title={book.isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className={cn("h-4 w-4", book.isFavorite && "fill-current")} />
            </button>

            {/* Audiobook */}
            <button
              onClick={handleAudiobookToggle}
              disabled={isTogglingAudiobook}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition",
                book.isAudiobook
                  ? "bg-purple-100 text-purple-600"
                  : "text-text-inkMuted hover:bg-canvas-boneMuted hover:text-text-ink",
              )}
              title={book.isAudiobook ? "Mark as physical book" : "Mark as audiobook"}
            >
              <Headphones className="h-4 w-4" />
            </button>

            {/* Edit Details */}
            <EditBookModalIcon book={book} />

            {/* Privacy Toggle */}
            <button
              onClick={handlePrivacyToggle}
              disabled={isTogglingPrivacy}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition",
                localPrivacy === "public"
                  ? "bg-blue-100 text-blue-600"
                  : "text-text-inkMuted hover:bg-canvas-boneMuted hover:text-text-ink",
              )}
              title={localPrivacy === "private" ? "Make public" : "Make private"}
            >
              {localPrivacy === "private" ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
            </button>

            {/* Delete Book */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <button
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-accent-ember transition hover:bg-accent-ember/10 hover:text-accent-ember",
                    isDeleting && "pointer-events-none opacity-60",
                  )}
                  title="Delete book"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {book.title}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {`This will delete this book and its ${noteCountLabel}.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? "Deleting…" : "Delete Forever"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Status Date */}
        {statusDate && <p className="text-sm text-text-inkSubtle">{statusDate}</p>}

        {/* Description */}
        {book.description && (
          <p className="text-sm leading-relaxed text-text-inkMuted">{book.description}</p>
        )}

        {/* Metadata Details */}
        {(book.edition || book.isbn || book.pageCount || book.publishedYear) && (
          <div className="border-t border-line-ghost pt-6">
            <BookMetadata book={book} />
          </div>
        )}

        {/* Notes Section */}
        <div className="border-t border-line-ghost pt-6">
          <h2 className="mb-6 font-mono text-xs uppercase tracking-wider text-text-inkMuted">
            Notes
          </h2>
          <div className="space-y-6">
            <CreateNote bookId={book._id} />
            <NoteList bookId={book._id} notes={notes} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

// Icon-only edit button that opens the edit sheet
function EditBookModalIcon({ book }: { book: Doc<"books"> }) {
  const [isOpen, setIsOpen] = useState(false);
  const updateBook = useMutation(api.books.update);
  const { toast } = useToast();

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  // Helper to format timestamp for date input (YYYY-MM-DD)
  const timestampToDateInput = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const initialValues = {
    title: book.title,
    author: book.author,
    edition: book.edition ?? "",
    isbn: book.isbn ?? "",
    publishedYear: book.publishedYear ? String(book.publishedYear) : "",
    pageCount: book.pageCount ? String(book.pageCount) : "",
    isFavorite: book.isFavorite ?? false,
    status: book.status,
    dateStarted: timestampToDateInput(book.dateStarted),
    dateFinished: timestampToDateInput(book.dateFinished),
  };

  const handleSubmit = async (values: SanitizedBookFormValues) => {
    await updateBook({
      id: book._id,
      title: values.title,
      author: values.author,
      edition: values.edition,
      isbn: values.isbn,
      publishedYear: values.publishedYear,
      pageCount: values.pageCount,
      dateStarted: values.dateStarted,
      dateFinished: values.dateFinished,
    });
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex h-8 w-8 items-center justify-center rounded-full text-text-inkMuted transition hover:bg-canvas-boneMuted hover:text-text-ink"
        title="Edit details"
      >
        <Pencil className="h-4 w-4" />
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

function BookMetadata({ book }: { book: Doc<"books"> }) {
  const items = [
    { label: "Edition", value: book.edition },
    { label: "ISBN", value: book.isbn },
    { label: "Pages", value: book.pageCount?.toString() },
    { label: "Published", value: book.publishedYear?.toString() },
  ].filter((item) => item.value);

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <p className="font-mono text-xs uppercase tracking-wider text-text-inkSubtle">
            {item.label}
          </p>
          <p className="mt-0.5 text-sm text-text-ink">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function BookDetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-12">
      {/* Cover skeleton */}
      <div className="flex justify-center lg:justify-start">
        <div className="aspect-[2/3] w-full animate-pulse rounded-sm bg-text-ink/5" />
      </div>
      {/* Content skeleton */}
      <div className="space-y-6">
        <div className="h-10 w-3/4 animate-pulse rounded bg-text-ink/5" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-text-ink/5" />
        <div className="flex gap-2">
          <div className="h-8 w-24 animate-pulse rounded-full bg-text-ink/5" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-text-ink/5" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-text-ink/5" />
        </div>
        <div className="h-32 animate-pulse rounded bg-text-ink/5" />
      </div>
    </div>
  );
}
