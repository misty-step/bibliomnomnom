"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

type Privacy = "private" | "public";

type PrivacyToggleProps = {
  bookId: Id<"books">;
  privacy: Privacy;
};

export function PrivacyToggle({ bookId, privacy }: PrivacyToggleProps) {
  const [currentPrivacy, setCurrentPrivacy] = useState<Privacy>(privacy);
  const [isLoading, setIsLoading] = useState(false);
  const updatePrivacy = useMutation(api.books.updatePrivacy);

  const handleToggle = async () => {
    const nextPrivacy: Privacy = currentPrivacy === "private" ? "public" : "private";
    const previousPrivacy = currentPrivacy;
    setIsLoading(true);
    setCurrentPrivacy(nextPrivacy);
    try {
      await updatePrivacy({
        id: bookId,
        privacy: nextPrivacy,
      });
    } catch (err) {
      console.error(err);
      setCurrentPrivacy(previousPrivacy);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-paper-secondary/70 p-4">
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-ink">
          {currentPrivacy === "private" ? "Private" : "Public"}
        </p>
        <p className="text-xs text-ink-faded">
          {currentPrivacy === "private"
            ? "Only you can see this book."
            : "Anyone with the link can view this book."}
        </p>
      </div>
      <Button
        variant="outline"
        onClick={handleToggle}
        disabled={isLoading}
      >
        {isLoading ? "Saving…" : currentPrivacy === "private" ? "Make Public" : "Make Private"}
      </Button>
    </div>
  );
}
