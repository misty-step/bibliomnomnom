"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { Camera, Loader2, AlertCircle, Check, RotateCcw, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MAX_IMAGE_BYTES } from "@/lib/ocr/limits";

type PhotoQuoteCaptureProps = {
  bookId: Id<"books">;
  onDialogOpenChange?: (open: boolean) => void;
};

type CaptureState =
  | { step: "idle" }
  | { step: "preview"; previewUrl: string }
  | { step: "processing"; previewUrl: string }
  | { step: "success"; text: string; previewUrl: string }
  | { step: "error"; message: string; previewUrl?: string };

const LOADING_MESSAGES = [
  { delay: 0, text: "Preparing photo..." },
  { delay: 1500, text: "Reading text..." },
  { delay: 3000, text: "Almost done..." },
];

function makeRequestId(): string {
  try {
    return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)}MB`;
}

function looksLikeImageFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".heic") ||
    lower.endsWith(".heif")
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.onabort = () => reject(new Error("Image read aborted."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || result.length === 0) {
        reject(new Error("Invalid image data."));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(blob);
  });
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image."));
    img.src = url;
  });
}

async function transcodeToJpegUnderLimit(
  file: File,
  limitBytes: number,
): Promise<{ blob: Blob; dataUrl: string }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageFromUrl(objectUrl);

    const baseWidth = img.naturalWidth || img.width;
    const baseHeight = img.naturalHeight || img.height;
    if (!baseWidth || !baseHeight) {
      throw new Error("Invalid image dimensions.");
    }

    const candidates: Array<{ maxDimension: number; quality: number }> = [
      { maxDimension: 2400, quality: 0.85 },
      { maxDimension: 2048, quality: 0.82 },
      { maxDimension: 1792, quality: 0.78 },
      { maxDimension: 1536, quality: 0.72 },
      { maxDimension: 1280, quality: 0.68 },
      { maxDimension: 1024, quality: 0.62 },
    ];

    for (const { maxDimension, quality } of candidates) {
      const scale = Math.min(1, maxDimension / Math.max(baseWidth, baseHeight));
      const width = Math.max(1, Math.round(baseWidth * scale));
      const height = Math.max(1, Math.round(baseHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not available.");
      ctx.drawImage(img, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("JPEG encode failed."))),
          "image/jpeg",
          quality,
        );
      });

      if (blob.size <= limitBytes) {
        const dataUrl = await blobToDataUrl(blob);
        return { blob, dataUrl };
      }
    }

    throw new Error(`Image too large (${formatBytes(file.size)}). Try a closer crop.`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function PhotoQuoteCapture({ bookId, onDialogOpenChange }: PhotoQuoteCaptureProps) {
  const [state, setState] = useState<CaptureState>({ step: "idle" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]!.text);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const createNote = useMutation(api.notes.create);
  const { toast } = useToast();

  const setDialogOpenSafe = useCallback(
    (open: boolean) => {
      setDialogOpen(open);
      onDialogOpenChange?.(open);
    },
    [onDialogOpenChange],
  );

  // Multi-stage loading messages
  useEffect(() => {
    if (state.step !== "processing") {
      setLoadingMessage(LOADING_MESSAGES[0]!.text);
      return;
    }

    const timeouts = LOADING_MESSAGES.slice(1).map(({ delay, text }) =>
      setTimeout(() => setLoadingMessage(text), delay),
    );

    return () => timeouts.forEach(clearTimeout);
  }, [state.step]);

  const clearSelection = useCallback(() => {
    selectedFileRef.current = null;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const isImageType = file.type.startsWith("image/");
        const isLikelyImage =
          isImageType || (file.type.length === 0 && looksLikeImageFileName(file.name));
        if (!isLikelyImage) {
          toast({
            title: "Unsupported file",
            description: "Please choose an image (JPEG/PNG/WebP).",
            variant: "destructive",
          });
          event.target.value = "";
          return;
        }

        // Keep original file; preview via object URL for speed.
        clearSelection();
        selectedFileRef.current = file;
        const previewUrl = URL.createObjectURL(file);
        previewUrlRef.current = previewUrl;
        setState({ step: "preview", previewUrl });
        setDialogOpenSafe(true);
      } catch (err) {
        console.error("[PhotoQuoteCapture] File select failed:", err);
        toast({
          title: "Couldn’t open photo",
          description: "Please try again.",
          variant: "destructive",
        });
      }

      // Reset input so same file can be selected again
      event.target.value = "";
    },
    [clearSelection, toast, setDialogOpenSafe],
  );

  const handleConfirmPhoto = useCallback(async () => {
    if (state.step !== "preview") return;

    const previewUrl = state.previewUrl;
    const file = selectedFileRef.current;
    if (!file) {
      setState({ step: "error", message: "No image selected. Please try again.", previewUrl });
      return;
    }

    setState({ step: "processing", previewUrl });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const requestId = makeRequestId();

      let imageDataUrl: string;
      if (file.size <= MAX_IMAGE_BYTES && file.type === "image/jpeg") {
        imageDataUrl = await blobToDataUrl(file);
      } else {
        // Transcode to JPEG under server limit (handles typical phone photos).
        const prepared = await transcodeToJpegUnderLimit(file, MAX_IMAGE_BYTES);
        imageDataUrl = prepared.dataUrl;
      }

      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-request-id": requestId },
        body: JSON.stringify({ image: imageDataUrl }),
        signal: controller.signal,
      });

      const requestIdHeader = response.headers.get("x-request-id");
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Unexpected response from OCR service.");
      }

      const data = (await response.json()) as { text?: string; error?: string; code?: string };

      if (data.error) {
        setState({ step: "error", message: data.error, previewUrl });
        toast({
          title: "OCR failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      if (data.text) {
        setState({ step: "success", text: data.text, previewUrl });
        if (requestIdHeader && requestIdHeader !== requestId) {
          console.warn("[PhotoQuoteCapture] request id mismatch", { requestId, requestIdHeader });
        }
        return;
      }

      setState({ step: "error", message: "No text found in image.", previewUrl });
      toast({
        title: "No text found",
        description: "Try a clearer photo, closer crop, or better lighting.",
        variant: "destructive",
      });
      return;
    } catch (error) {
      const message =
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
          ? "Taking too long. Please try again."
          : error instanceof Error
            ? error.message
            : "Network error. Check your connection.";

      console.error("[PhotoQuoteCapture] OCR request failed:", error);
      setState({ step: "error", message, previewUrl });
      toast({
        title: "OCR failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }, [state, toast]);

  const handleSave = useCallback(async () => {
    if (state.step !== "success") return;
    if (!state.text.trim()) return;

    setIsSaving(true);
    try {
      await createNote({
        bookId,
        type: "quote",
        content: state.text.trim(),
      });

      toast({ title: "Quote saved" });
      setDialogOpenSafe(false);
      setState({ step: "idle" });
      clearSelection();
    } catch (error) {
      console.error("[PhotoQuoteCapture] Failed to save quote:", error);
      toast({
        title: "Failed to save",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [state, bookId, createNote, toast, clearSelection, setDialogOpenSafe]);

  const handleRetake = useCallback(() => {
    setState({ step: "idle" });
    setDialogOpenSafe(false);
    clearSelection();
    // Slight delay to let dialog close before opening file picker
    setTimeout(() => fileInputRef.current?.click(), 100);
  }, [clearSelection, setDialogOpenSafe]);

  const handleCancel = useCallback(() => {
    setDialogOpenSafe(false);
    setState({ step: "idle" });
    clearSelection();
  }, [clearSelection, setDialogOpenSafe]);

  const handleTryAgain = useCallback(() => {
    if (state.step === "error") {
      const previewUrl = state.previewUrl;
      if (!previewUrl) {
        setState({ step: "idle" });
        setDialogOpenSafe(false);
        clearSelection();
        return;
      }
      setState({ step: "preview", previewUrl });
    }
  }, [state, clearSelection, setDialogOpenSafe]);

  const triggerCapture = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <>
      {/* Camera trigger button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={triggerCapture}
        className="gap-1.5 text-text-inkMuted hover:text-text-ink"
      >
        <Camera className="h-4 w-4" />
        <span className="hidden sm:inline">Photo</span>
      </Button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="sr-only"
        aria-label="Capture photo of book page"
      />

      {/* Dialog for capture flow */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          // Prevent closing during processing or saving to avoid confusing state
          if (!open && (state.step === "processing" || isSaving)) return;
          setDialogOpenSafe(open);
          // Reset state when dialog closes
          if (!open) {
            setState({ step: "idle" });
            clearSelection();
          }
        }}
      >
        <DialogContent
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            // Mobile: full screen (reset translate from base DialogContent)
            "fixed inset-0 h-full w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0",
            // Mobile: safe area padding for notched devices
            "pb-[env(safe-area-inset-bottom)]",
            // Desktop: centered modal
            "sm:inset-auto sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:pb-6",
            // Flex layout for content
            "flex flex-col",
          )}
        >
          {/* Preview State */}
          {state.step === "preview" && (
            <>
              <DialogHeader>
                <DialogTitle>Review Photo</DialogTitle>
                <DialogDescription>Make sure the text is clear and readable.</DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-hidden py-4">
                <div className="relative mx-auto aspect-[3/4] max-h-[50vh] w-auto overflow-hidden rounded-md bg-canvas-boneMuted sm:max-h-[40vh]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.previewUrl}
                    alt="Captured book page"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={handleRetake} className="flex-1">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retake
                </Button>
                <Button onClick={handleConfirmPhoto} className="flex-1">
                  <Check className="mr-2 h-4 w-4" />
                  Use Photo
                </Button>
              </div>
            </>
          )}

          {/* Processing State */}
          {state.step === "processing" && (
            <>
              <DialogHeader>
                <DialogTitle>Reading Text...</DialogTitle>
                <DialogDescription aria-live="polite">{loadingMessage}</DialogDescription>
              </DialogHeader>

              <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
                <div className="relative mx-auto aspect-[3/4] max-h-[30vh] w-auto overflow-hidden rounded-md bg-canvas-boneMuted opacity-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.previewUrl}
                    alt="Processing"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-text-inkMuted" />
                  <span className="text-sm text-text-inkMuted">{loadingMessage}</span>
                </div>
              </div>
            </>
          )}

          {/* Success State */}
          {state.step === "success" && (
            <>
              <DialogHeader>
                <DialogTitle>Quote Extracted</DialogTitle>
                <DialogDescription>Edit the text below before saving.</DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-hidden py-4">
                <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden sm:flex-row">
                  {/* Mobile: give photo most of the vertical space for readability */}
                  <div className="min-h-0 flex-[3] sm:flex-none sm:w-[14rem]">
                    <div className="h-full w-full overflow-hidden rounded-md bg-canvas-boneMuted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={state.previewUrl}
                        alt="Captured book page"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-[2] flex-col gap-2">
                    <label
                      htmlFor="photo-quote-text"
                      className="text-xs font-mono uppercase tracking-wider text-text-inkMuted"
                    >
                      Quote text
                    </label>
                    <textarea
                      id="photo-quote-text"
                      value={state.text}
                      onChange={(e) =>
                        setState({
                          step: "success",
                          previewUrl: state.previewUrl,
                          text: e.target.value,
                        })
                      }
                      className={cn(
                        "min-h-0 flex-1 resize-none rounded-md border border-line-ghost bg-canvas-bone px-3 py-2 font-serif text-sm leading-relaxed text-text-ink",
                        "placeholder:text-text-inkSubtle/50 focus:outline-none focus:ring-2 focus:ring-text-ink/20 focus:ring-offset-2 focus:ring-offset-canvas-bone",
                      )}
                      placeholder="Edit the extracted quote…"
                      disabled={isSaving}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button variant="secondary" onClick={handleRetake} disabled={isSaving}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retake
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !state.text.trim()}
                  className="flex-1"
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Save Quote
                </Button>
              </div>
            </>
          )}

          {/* Error State */}
          {state.step === "error" && (
            <>
              <DialogHeader>
                <DialogTitle>Couldn&apos;t Read Text</DialogTitle>
              </DialogHeader>

              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
                <div
                  className="flex items-center gap-3 rounded-md border border-accent-ember/20 bg-accent-ember/10 px-4 py-3"
                  role="alert"
                >
                  <AlertCircle className="h-5 w-5 text-accent-ember" />
                  <span className="text-sm text-accent-ember">{state.message}</span>
                </div>

                {state.previewUrl && (
                  <div className="relative mx-auto aspect-[3/4] max-h-[25vh] w-auto overflow-hidden rounded-md bg-canvas-boneMuted opacity-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={state.previewUrl}
                      alt="Failed to process"
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="ghost" onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button variant="secondary" onClick={handleRetake}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retake
                </Button>
                <Button onClick={handleTryAgain} className="flex-1">
                  Try Again
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
