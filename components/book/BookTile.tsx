"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useMutation } from "convex/react";
import { Star, Headphones } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

type BookTileProps = {
  book: Doc<"books">;
};

export function BookTile({ book }: BookTileProps) {
  const router = useRouter();
  const updateStatus = useMutation(api.books.updateStatus);
  const shouldReduce = useReducedMotion();
  const coverSrc = book.coverUrl ?? book.apiCoverUrl;
  const statusAction = getStatusAction(book.status);

  const hasMeta =
    typeof book.publishedYear === "number" || Boolean(book.isAudiobook) || Boolean(book.isFavorite);
  const hasFooter = hasMeta || statusAction;

  const isOptimizable = (src: string) => {
    if (src.startsWith("/")) return true;
    try {
      const url = new URL(src);
      return (
        [
          "books.googleusercontent.com",
          "books.google.com",
          "covers.openlibrary.org",
          "lh3.googleusercontent.com",
          "images.unsplash.com",
        ].includes(url.hostname) || url.hostname.endsWith(".public.blob.vercel-storage.com")
      );
    } catch {
      return false;
    }
  };

  const navigate = () => {
    router.push(`/library/books/${book._id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate();
    }
  };

  const handleStatusActionClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!statusAction) {
      return;
    }

    void updateStatus({
      id: book._id,
      status: statusAction.nextStatus,
    }).catch(() => undefined);
  };

  const footer = hasFooter ? (
    <div className="mt-2 flex w-full items-end justify-between border-t border-line-ghost/50 pt-2">
      <div className="flex items-center gap-2">
        {book.publishedYear ? (
          <span className="font-mono text-xs text-text-inkSubtle">{book.publishedYear}</span>
        ) : null}
        <div className="flex gap-2">
          {book.isAudiobook && <Headphones className="h-3.5 w-3.5 text-text-inkMuted" />}
          {book.isFavorite && (
            <Star className="h-3.5 w-3.5 fill-accent-favorite text-accent-favorite" />
          )}
        </div>
      </div>
      {statusAction ? (
        <button
          type="button"
          onClick={handleStatusActionClick}
          onKeyDown={(event) => event.stopPropagation()}
          className="text-xs font-sans font-medium text-text-inkMuted hover:text-text-ink transition-colors duration-fast"
        >
          {statusAction.label}
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={shouldReduce ? undefined : { y: -4 }}
      transition={{
        type: "spring",
        stiffness: 250,
        damping: 25,
        mass: 1,
      }}
      className="group relative cursor-pointer"
      onClick={navigate}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${book.title} by ${book.author}${book.isFavorite ? ", Favorite" : ""}${book.isAudiobook ? ", Audiobook" : ""}`}
    >
      {/* Cover Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm shadow-surface transition-shadow duration-300 group-hover:shadow-raised bg-canvas-boneMuted">
        {coverSrc ? (
          <>
            {/* Cover image with hover fade */}
            <div className="absolute inset-0 transition-opacity duration-300 ease-out group-hover:opacity-0 group-focus:opacity-0">
              {isOptimizable(coverSrc) ? (
                <Image
                  src={coverSrc}
                  alt={`${book.title} cover`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverSrc}
                  alt={`${book.title} cover`}
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            {/* Index card on hover */}
            <div className="absolute inset-0 m-1.5 flex flex-col justify-between rounded-sm bg-canvas-bone/90 p-5 opacity-0 shadow-sm ring-1 ring-inset ring-black/5 backdrop-blur-sm transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus:opacity-100">
              <div className="flex w-full flex-col items-start space-y-3">
                <h3 className="font-display text-lg font-medium leading-snug text-text-ink text-balance text-left line-clamp-5">
                  {book.title}
                </h3>
                {book.author ? (
                  <p className="font-mono text-xs uppercase tracking-wider text-text-inkMuted text-left line-clamp-2">
                    {book.author}
                  </p>
                ) : null}
              </div>
              {footer}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 m-1.5 flex flex-col justify-between rounded-sm border border-line-ghost/50 bg-canvas-bone p-5 shadow-sm ring-1 ring-inset ring-black/5">
            <div className="flex w-full flex-col items-start space-y-3">
              <h3 className="font-display text-lg font-medium leading-snug text-text-ink text-balance text-left line-clamp-5">
                {book.title}
              </h3>
              {book.author ? (
                <p className="font-mono text-xs uppercase tracking-wider text-text-inkMuted text-left line-clamp-2">
                  {book.author}
                </p>
              ) : null}
            </div>
            {footer}
          </div>
        )}
      </div>
    </motion.article>
  );
}

export function BookTileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] w-full rounded-sm bg-text-ink/5" />
    </div>
  );
}

function getStatusAction(
  status: Doc<"books">["status"],
): { label: string; nextStatus: Doc<"books">["status"] } | null {
  if (status === "want-to-read") {
    return { label: "Start Reading", nextStatus: "currently-reading" };
  }

  if (status === "currently-reading") {
    return { label: "Mark as Read", nextStatus: "read" };
  }

  return null;
}
