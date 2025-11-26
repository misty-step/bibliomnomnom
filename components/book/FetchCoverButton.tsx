"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { upload } from "@vercel/blob/client";
import { Loader2, ImageIcon } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type FetchCoverButtonProps = {
  bookId: Id<"books">;
  onSuccess?: () => void;
  className?: string;
};

/**
 * Convert a base64 data URL to a Blob object
 *
 * @param dataUrl - The base64 string (e.g., "data:image/jpeg;base64,...")
 * @returns A Blob object representing the image data
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*);base64/);
  const mime = mimeMatch?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Button component to trigger automatic cover fetching
 *
 * Handles the entire flow:
 * 1. Calls Convex action to fetch cover from Open Library/Google Books
 * 2. Converts returned data URL to Blob
 * 3. Uploads Blob to Vercel Blob storage
 * 4. Updates book record with new cover URL
 *
 * @param props - Component props
 * @param props.bookId - ID of the book to fetch cover for
 * @param props.onSuccess - Callback function invoked after successful update
 * @param props.className - Optional CSS classes
 */
export function FetchCoverButton({ bookId, onSuccess, className }: FetchCoverButtonProps) {
  const fetchCover = useAction(api.books.fetchCover);
  const updateCoverFromBlob = useMutation(api.books.updateCoverFromBlob);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleFetch = async () => {
    setIsLoading(true);
    try {
      const result = await fetchCover({ bookId });

      if (!result.success) {
        toast({
          title: "Cover not found",
          description: result.error ?? "Try uploading a cover manually.",
          variant: "destructive",
        });
        return;
      }

      const blob = dataUrlToBlob(result.coverDataUrl);
      const uploadResponse = await upload(`covers/${bookId}.jpg`, blob, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });

      await updateCoverFromBlob({
        bookId,
        blobUrl: uploadResponse.url,
        apiSource: result.apiSource,
        apiCoverUrl: result.apiCoverUrl,
      });

      toast({ title: "Cover found and saved" });
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast({
        title: "Failed to fetch cover",
        description: "Please try again or upload manually.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleFetch}
      disabled={isLoading}
      className={cn("gap-2", className)}
      variant="secondary"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Fetching cover...
        </>
      ) : (
        <>
          <ImageIcon className="h-4 w-4" aria-hidden />
          Fetch Cover
        </>
      )}
    </Button>
  );
}
