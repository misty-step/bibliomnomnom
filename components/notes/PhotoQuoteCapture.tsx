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

type PhotoQuoteCaptureProps = {
  bookId: Id<"books">;
};

type CaptureState =
  | { step: "idle" }
  | { step: "preview"; image: string }
  | { step: "processing"; image: string }
  | { step: "success"; text: string }
  | { step: "error"; message: string; image: string };

const LOADING_MESSAGES = [
  { delay: 0, text: "Processing photo..." },
  { delay: 1500, text: "Reading text..." },
  { delay: 3000, text: "Almost done..." },
];

export function PhotoQuoteCapture({ bookId }: PhotoQuoteCaptureProps) {
  const [state, setState] = useState<CaptureState>({ step: "idle" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]!.text);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const createNote = useMutation(api.notes.create);
  const { toast } = useToast();

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

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const image = e.target?.result as string;
      setState({ step: "preview", image });
      setDialogOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    event.target.value = "";
  }, []);

  const handleConfirmPhoto = useCallback(async () => {
    if (state.step !== "preview") return;

    const image = state.image;
    setState({ step: "processing", image });

    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });

      const data = await response.json();

      if (data.error) {
        setState({ step: "error", message: data.error, image });
      } else if (data.text) {
        setState({ step: "success", text: data.text });
      } else {
        setState({ step: "error", message: "No text found in image.", image });
      }
    } catch {
      setState({ step: "error", message: "Network error. Check your connection.", image });
    }
  }, [state]);

  const handleSave = useCallback(async () => {
    if (state.step !== "success") return;

    setIsSaving(true);
    try {
      await createNote({
        bookId,
        type: "quote",
        content: state.text,
      });

      toast({ title: "Quote saved" });
      setDialogOpen(false);
      setState({ step: "idle" });
    } catch {
      toast({
        title: "Failed to save",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [state, bookId, createNote, toast]);

  const handleRetake = useCallback(() => {
    setState({ step: "idle" });
    setDialogOpen(false);
    // Slight delay to let dialog close before opening file picker
    setTimeout(() => fileInputRef.current?.click(), 100);
  }, []);

  const handleCancel = useCallback(() => {
    setDialogOpen(false);
    setState({ step: "idle" });
  }, []);

  const handleTryAgain = useCallback(() => {
    if (state.step === "error") {
      setState({ step: "preview", image: state.image });
    }
  }, [state]);

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
        className="hidden"
        aria-label="Capture photo of book page"
      />

      {/* Dialog for capture flow */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className={cn(
            // Mobile: full screen
            "fixed inset-0 h-full w-full max-w-none rounded-none border-0",
            // Desktop: centered modal
            "sm:inset-auto sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border",
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
                    src={state.image}
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
                    src={state.image}
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
                <DialogDescription>
                  Review the text below. You can edit it after saving.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-hidden py-4">
                <div className="h-full max-h-[50vh] overflow-y-auto rounded-md border border-line-ghost bg-canvas-boneMuted p-4 sm:max-h-[40vh]">
                  <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-text-ink">
                    {state.text}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="flex-1">
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

                <div className="relative mx-auto aspect-[3/4] max-h-[25vh] w-auto overflow-hidden rounded-md bg-canvas-boneMuted opacity-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.image}
                    alt="Failed to process"
                    className="h-full w-full object-contain"
                  />
                </div>
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
