"use client";

/* eslint-disable design-tokens/no-raw-design-values */

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import Image from "next/image";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CoverCandidate = {
  url: string;
  source: "open-library" | "google-books";
  apiId?: string;
};

type CoverPickerProps = {
  title: string;
  author: string;
  isbn?: string;
  currentCoverUrl?: string;
  onSelect: (url: string, source: string, apiId?: string) => void;
};

export function CoverPicker({ title, author, isbn, currentCoverUrl, onSelect }: CoverPickerProps) {
  const [candidates, setCandidates] = useState<CoverCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchCovers = useAction(api.actions.coverFetch.searchCovers);

  const handleSearch = async () => {
    if (!title) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      // @ts-ignore - The types might not be fully generated yet
      const results = await searchCovers({ title, author, isbn });
      setCandidates(results);
    } catch (err) {
      console.error(err);
      setError("Failed to load covers. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-search on mount if no current cover, or explicitly requested?
  // Let's not auto-search to save API calls unless the user opens this picker.
  // But usually this component will be inside a Dialog/Popover that is opened when the user wants to pick.
  // So we can auto-search on mount.
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, author, isbn]); // Re-search if props change significantly
  // Actually, if title changes, we probably want new covers.

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-inkMuted uppercase tracking-wider font-mono">
          Select Cover
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSearch}
          disabled={isLoading}
          style={{ fontSize: 12 }}
        >
          <RefreshCw
            className={cn(isLoading && "animate-spin")}
            style={{ width: 12, height: 12, marginRight: 8 }}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="text-sm text-accent-ember bg-accent-ember/10 p-3 rounded-md">{error}</div>
      )}

      {isLoading && !candidates.length ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-text-inkSubtle" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {candidates.map((candidate, idx) => {
            const isSelected = currentCoverUrl === candidate.url;
            return (
              <button
                key={candidate.url + idx}
                type="button"
                onClick={() => onSelect(candidate.url, candidate.source, candidate.apiId)}
                className={cn(
                  "group relative aspect-[2/3] w-full overflow-hidden rounded-md border-2 transition-all hover:scale-[1.02]",
                  isSelected
                    ? "border-accent-ember ring-2 ring-accent-ember/20"
                    : "border-transparent hover:border-line-ember",
                )}
              >
                <Image
                  src={candidate.url}
                  alt={`Cover option ${idx + 1}`}
                  fill
                  className="object-cover"
                  unoptimized // External URLs might not be optimized by Next.js Image without config
                />

                {/* Source Badge */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-black/60 text-white backdrop-blur-[2px] opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}
                >
                  <span style={{ fontSize: 12 }}>
                    {candidate.source === "google-books" ? "Google Books" : "Open Library"}
                  </span>
                </div>

                {/* Selected Indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 rounded-full bg-accent-ember p-1 text-white shadow-sm">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                )}
              </button>
            );
          })}

          {!isLoading && candidates.length === 0 && hasSearched && (
            <div className="col-span-full py-8 text-center text-sm text-text-inkSubtle">
              No covers found. Try uploading one manually.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
