"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
// import { Button } from "@/components/ui/button"; // No longer needed
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Assuming Popover component exists or will be created

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

  const currentStatusText = currentPrivacy === "private" ? "🔒 Private" : "🌐 Public";
  const nextActionText = currentPrivacy === "private" ? "Make Public" : "Make Private";
  const nextActionIcon = currentPrivacy === "private" ? "🌐" : "🔒";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          disabled={isLoading}
          className="font-sans text-sm text-inkMuted hover:text-ink hover:underline disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? "Saving…" : currentStatusText}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="flex flex-col">
          <button
            onClick={handleToggle}
            className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-canvas-boneMuted"
          >
            {nextActionIcon} {nextActionText}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
