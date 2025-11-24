"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/utils";

type UploadDropzoneProps = {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  accept?: string;
  maxBytes?: number;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

export function UploadDropzone({
  onFileSelected,
  disabled,
  accept = ".csv,.txt,.md",
  maxBytes = 10 * 1024 * 1024,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const [error, setError] = useState<string | null>(null);

  const acceptsExtension = useCallback(
    (file: File) => {
      if (!accept) return true;
      const allowed = accept
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const name = file.name.toLowerCase();
      return allowed.some((pattern) => name.endsWith(pattern));
    },
    [accept]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !files.length) return;
      const file = files[0];
      if (file.size > maxBytes) {
        setError(`File too large (${formatBytes(file.size)}). Max ${formatBytes(maxBytes)}.`);
        return;
      }
      if (!acceptsExtension(file)) {
        setError(`Unsupported file type. Allowed: ${accept}`);
        return;
      }
      setError(null);
      onFileSelected(file);
    },
    [maxBytes, onFileSelected, acceptsExtension, accept]
  );

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    setDragActive(false);
    dragDepth.current = 0;
    handleFiles(event.dataTransfer.files);
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    setDragActive(true);
  };

  const onDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    dragDepth.current += 1;
    setDragActive(true);
  };

  const onDragLeave = () => {
    if (disabled) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setDragActive(false);
    }
  };

  return (
    <Surface
      role="button"
      tabIndex={0}
      aria-label="Upload reading list file"
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      className={cn(
        "border-dashed border-2 border-line-ghost bg-canvas-boneMuted/60 transition-colors",
        dragActive && "border-text-ink",
        disabled && "opacity-60 cursor-not-allowed",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-ink"
      )}
      padding="lg"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas-bone">
          <Upload className="h-6 w-6 text-text-ink" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="font-display text-lg text-text-ink">Drop CSV, TXT, or Markdown</p>
          <p className="text-sm text-text-inkMuted">
            Max {formatBytes(maxBytes)}. Goodreads or any CSV works.
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={disabled}>
          Choose file
        </Button>
        {error && <p className="text-sm text-accent-ember">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
    </Surface>
  );
}
