"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { useMutation, useAction } from "convex/react";
import { upload } from "@vercel/blob/client";
import { Loader2, Upload, Search, Trash2, ImageIcon, Globe } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CoverPicker } from "./CoverPicker";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

type BookCoverManagerProps = {
  bookId: Id<"books">;
  title: string;
  author: string;
  isbn?: string;
  coverUrl?: string | null;
  apiCoverUrl?: string | null;
  className?: string;
};

/**
 * Convert a base64 data URL to a Blob object
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header = "", base64 = ""] = dataUrl.split(",");
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

export function BookCoverManager({
  bookId,
  title,
  author,
  isbn,
  coverUrl,
  apiCoverUrl,
  className,
}: BookCoverManagerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const updateBook = useMutation(api.books.update);
  const updateCoverFromBlob = useMutation(api.books.updateCoverFromBlob);
  const downloadImage = useAction(api.actions.coverFetch.downloadImage);
  const fetchBestCover = useAction(api.books.fetchCover); // Legacy "I'm feeling lucky"

  const activeCover = coverUrl ?? apiCoverUrl;

  // 1. Handle File Upload (Manual)
  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
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

    setIsUploading(true);
    try {
      // Upload to Vercel Blob
      const blob = await upload(`covers/${bookId}-${Date.now()}.jpg`, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });

      // Update Book
      await updateBook({ id: bookId, coverUrl: blob.url });

      toast({ title: "Cover updated" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 2. Handle Remove
  const handleRemove = async () => {
    setIsUploading(true);
    try {
      await updateBook({ id: bookId, coverUrl: null, apiCoverUrl: null });
      toast({ title: "Cover removed" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Remove failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // 3. Handle "I'm Feeling Lucky" (Auto-fetch best)
  const handleAutoFetch = async () => {
    setIsUploading(true);
    try {
      const result = await fetchBestCover({ bookId });

      if (!result.success) {
        toast({
          title: "No cover found",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      const blob = dataUrlToBlob(result.coverDataUrl);
      const uploadResponse = await upload(`covers/${bookId}-auto.jpg`, blob, {
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
    } catch (err) {
      console.error(err);
      toast({
        title: "Auto-fetch failed",
        description: "Try searching manually.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // 4. Handle Selection from Picker
  const handlePickerSelect = async (
    url: string,
    source: "open-library" | "google-books",
    apiId?: string,
  ) => {
    setShowPicker(false);
    setIsUploading(true);
    try {
      // Download image server-side to bypass CORS and get base64
      const { dataUrl, error } = await downloadImage({ url });

      if (error || !dataUrl) {
        throw new Error(error || "Failed to download image");
      }

      const blob = dataUrlToBlob(dataUrl);
      const uploadResponse = await upload(`covers/${bookId}-web.jpg`, blob, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });

      await updateCoverFromBlob({
        bookId,
        blobUrl: uploadResponse.url,
        apiSource: source,
        apiCoverUrl: url,
      });

      toast({ title: "Cover updated" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to save cover",
        description: "Could not download image from source.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Hidden Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={handleFileUpload}
        className="hidden"
        disabled={isUploading}
      />

      <div
        className="group relative aspect-[2/3] w-full overflow-hidden rounded-sm shadow-lg bg-canvas-bone focus-within:ring-2 focus-within:ring-accent-ember"
        tabIndex={0}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setIsHovered(false);
        }}
      >
        {activeCover ? (
          <>
            <Image
              src={activeCover}
              alt={`${title} cover`}
              fill
              className="object-cover transition duration-500 group-hover:scale-105"
              priority
              unoptimized
            />

            {/* Hover Overlay */}
            <AnimatePresence>
              {(isHovered || isUploading) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-4 backdrop-blur-sm"
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2 text-white">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-xs font-medium">Updating...</span>
                    </div>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        onClick={() => setShowPicker(true)}
                      >
                        <Search className="w-3.5 h-3.5 mr-2" />
                        Search Web
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-3.5 h-3.5 mr-2" />
                        Upload File
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full mt-2 bg-accent-ember/20 hover:bg-accent-ember/40 text-surface-dawn border border-accent-ember/50"
                        onClick={handleRemove}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Remove
                      </Button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex h-full w-full flex-col justify-between border border-line-ghost/50 bg-canvas-bone p-6">
            <div className="space-y-3">
              <h2 className="font-display text-2xl leading-tight text-text-ink line-clamp-4">
                {title}
              </h2>
              {author && (
                <p className="font-mono text-sm uppercase tracking-wider text-text-inkMuted line-clamp-2">
                  {author}
                </p>
              )}
            </div>

            <div className="space-y-2">
              {isUploading ? (
                <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-line-ember bg-canvas-boneMuted">
                  <Loader2 className="h-5 w-5 animate-spin text-text-inkMuted" />
                </div>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={handleAutoFetch}
                  >
                    <ImageIcon className="w-3.5 h-3.5 mr-2" />
                    Auto-Fetch
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => setShowPicker(true)}
                  >
                    <Globe className="w-3.5 h-3.5 mr-2" />
                    Search Web
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start border border-dashed border-line-ember bg-transparent text-text-inkMuted hover:bg-canvas-boneMuted hover:text-text-ink"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 mr-2" />
                    Upload File
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select Cover</DialogTitle>
          </DialogHeader>
          <CoverPicker
            title={title}
            author={author}
            isbn={isbn}
            currentCoverUrl={activeCover || undefined}
            onSelect={handlePickerSelect}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
