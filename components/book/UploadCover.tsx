"use client";

import { useState, ChangeEvent } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

type UploadCoverProps = {
  bookId: Id<"books">;
  coverUrl?: string | null;
  apiCoverUrl?: string | null;
  onChange?: (url: string) => void;
};

export function UploadCover({
  bookId,
  coverUrl,
  apiCoverUrl,
  onChange,
}: UploadCoverProps) {
  const [preview, setPreview] = useState(coverUrl ?? apiCoverUrl ?? "");
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateBook = useMutation(api.books.update);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
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
    setIsUploading(true);
    setProgress(0);

    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });

      await updateBook({
        id: bookId,
        coverUrl: blob.url,
      });

      setPreview(blob.url);
      onChange?.(blob.url);
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setProgress(0);
      event.target.value = "";
    }
  };

  const handleRemove = async () => {
    if (!preview) return;
    setIsUploading(true);
    setError(null);
    try {
      await updateBook({
        id: bookId,
        coverUrl: undefined,
      });
      setPreview("");
      onChange?.("");
    } catch (err) {
      console.error(err);
      setError("Unable to remove cover right now.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-paper-secondary/70 p-4">
      <div className="flex items-start gap-4">
        <div className="relative h-40 w-28 overflow-hidden rounded-lg border border-border bg-paper">
          {preview ? (
            <Image
              src={preview}
              alt="Book cover preview"
              fill
              className="object-cover"
              sizes="112px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-ink-faded">
              No cover
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <label
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-paper px-4 py-3 text-sm font-medium transition hover:border-leather",
              isUploading && "pointer-events-none opacity-60"
            )}
          >
            <input
              type="file"
              accept={ALLOWED_TYPES.join(",")}
              onChange={handleFileChange}
              className="hidden"
            />
            {isUploading ? "Uploading…" : "Upload new cover"}
          </label>
          {preview ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isUploading}
              className="font-sans text-sm text-inkMuted hover:text-ink hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Remove cover
            </button>
          ) : null}
          <p className="text-xs text-ink-faded">
            JPG, PNG, or WebP up to 5MB. Uploads are stored securely via Vercel Blob.
          </p>
        </div>
      </div>
      {isUploading && (
        <div className="relative h-2 overflow-hidden rounded-full bg-border">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-leather transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}
