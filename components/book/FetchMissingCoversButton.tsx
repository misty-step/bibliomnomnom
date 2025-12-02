"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { Loader2, RefreshCcw } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const COVER_BACKFILL_ENABLED = process.env.NEXT_PUBLIC_COVER_BACKFILL_ENABLED !== "false";

type Props = {
  hidden?: boolean;
};

export function FetchMissingCoversButton({ hidden }: Props) {
  const [running, setRunning] = useState(false);
  const { toast } = useToast();
  const fetchMissingCovers = useAction(api.books.fetchMissingCovers);

  if (!COVER_BACKFILL_ENABLED || hidden) return null;

  const handleClick = async () => {
    if (running) return;
    setRunning(true);

    try {
      let cursor: string | null | undefined;
      let totalProcessed = 0;
      let totalUpdated = 0;
      let totalFailures = 0;

      do {
        const res = await fetchMissingCovers({ cursor, limit: 20 });
        totalProcessed += res.processed;
        totalUpdated += res.updated;
        totalFailures += res.failures.length;
        cursor = res.nextCursor;
      } while (cursor);

      if (totalProcessed === 0) {
        toast({ title: "No missing covers found", description: "You're all set." });
      } else {
        const failureText = totalFailures ? `, ${totalFailures} failed` : "";
        toast({
          title: "Fetch complete",
          description: `Updated ${totalUpdated} of ${totalProcessed}${failureText}`,
        });
      }
    } catch (err) {
      console.error("Bulk cover backfill failed", err);
      toast({
        title: "Could not fetch covers",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={running}
      className="text-text-inkMuted hover:text-text-ink"
      title="Fetch missing covers"
      aria-label="Fetch missing covers"
    >
      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
    </Button>
  );
}
