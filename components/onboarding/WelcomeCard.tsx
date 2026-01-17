"use client";

import { Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WelcomeCardProps = {
  daysRemaining: number;
  onImport: () => void;
  onAddBook: () => void;
  className?: string;
};

/**
 * Welcome card for first-time users with empty library.
 *
 * Emphasizes import as the primary action (most valuable for new users)
 * while providing manual add as a secondary option.
 */
export function WelcomeCard({ daysRemaining, onImport, onAddBook, className }: WelcomeCardProps) {
  return (
    <div className={cn("py-16", className)}>
      <div className="max-w-lg">
        {/* Welcome heading */}
        <h2 className="text-balance font-display text-4xl tracking-tight text-text-ink">
          Welcome to your library
        </h2>

        {/* Inviting description */}
        <p className="mt-4 text-pretty text-lg text-text-inkMuted">
          Every great collection begins with a single book. Let&apos;s add your first.
        </p>

        {/* Actions - import emphasized as primary */}
        <div className="mt-10 space-y-4">
          {/* Primary: Import from Goodreads */}
          <Button onClick={onImport} className="w-full justify-center gap-2" size="lg">
            <Upload className="size-4" />
            Import from Goodreads
          </Button>

          {/* Secondary: Manual add */}
          <button
            onClick={onAddBook}
            className="flex w-full items-center justify-center gap-2 py-3 font-sans text-sm text-text-inkMuted transition-colors hover:text-text-ink"
          >
            <Plus className="size-4" />
            or add a book manually
          </button>
        </div>

        {/* Trial reminder - subtle, non-urgent */}
        <p className="mt-10 text-sm text-text-inkSubtle">
          Your trial includes {daysRemaining} days of full access. No credit card required.
        </p>
      </div>
    </div>
  );
}
