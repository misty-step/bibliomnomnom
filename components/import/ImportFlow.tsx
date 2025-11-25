"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useMutation, useAction } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/Surface";
import { useToast } from "@/hooks/use-toast";
import { UploadDropzone } from "./UploadDropzone";
import { CommitSummary } from "./CommitSummary";
import { PreviewTable } from "./PreviewTable";
import { useImportJob } from "@/hooks/useImportJob";
import { logImportEvent } from "@/lib/import/metrics";

const IMPORT_ENABLED = process.env.NEXT_PUBLIC_IMPORT_ENABLED !== "false";

export function ImportFlow() {
  const router = useRouter();
  const { toast } = useToast();
  const extractBooks = useAction(api.imports.extractBooks);
  const preparePreview = useMutation(api.imports.preparePreview);
  const commitImport = useMutation(api.imports.commitImport);

  const startedAtRef = useRef<number | null>(null);
  const lastCommitRef = useRef<number | null>(null);
  const prevStatus = useRef<string>("idle");

  const job = useImportJob({
    extractBooks: async (params) => await extractBooks(params),
    preparePreview: async (params) => await preparePreview(params),
    commitImport: async (params) => await commitImport(params),
  });

  useEffect(() => {
    if (job.state.errors.length) {
      toast({
        title: "Import error",
        description: job.state.errors[0],
        variant: "destructive",
      });

      logImportEvent({
        phase: "preview",
        importRunId: job.state.importRunId ?? "unknown",
        sourceType: job.state.sourceType ?? "unknown",
        counts: { rows: job.state.pages.at(0)?.length ?? 0, errors: job.state.errors.length },
      });
    }
  }, [job.state.errors, job.state.importRunId, job.state.pages, job.state.sourceType, toast]);

  useEffect(() => {
    const status = job.state.status;
    const prev = prevStatus.current;

    if (status !== prev) {
      if (status === "parsing") {
        startedAtRef.current = Date.now();
        logImportEvent({ phase: "preview", importRunId: job.state.importRunId ?? "pending", sourceType: "detecting" });
      }

      if (status === "ready") {
        logImportEvent({
          phase: "preview",
          importRunId: job.state.importRunId ?? "unknown",
          sourceType: job.state.sourceType ?? "unknown",
          counts: { rows: job.state.pages.flat().length },
          durationMs: startedAtRef.current ? Date.now() - startedAtRef.current : undefined,
        });
      }

      if (status === "committing") {
        lastCommitRef.current = Date.now();
        logImportEvent({
          phase: "commit",
          importRunId: job.state.importRunId ?? "unknown",
          sourceType: job.state.sourceType ?? "unknown",
          page: job.state.page,
        });
      }

      if (status === "success") {
        logImportEvent({
          phase: "commit",
          importRunId: job.state.importRunId ?? "unknown",
          sourceType: job.state.sourceType ?? "unknown",
          counts: job.state.summary,
          durationMs: lastCommitRef.current ? Date.now() - lastCommitRef.current : undefined,
        });
      }

      prevStatus.current = status;
    }
  }, [job.state.importRunId, job.state.page, job.state.pages, job.state.sourceType, job.state.status, job.state.summary]);

  if (!IMPORT_ENABLED) {
    return (
      <Surface className="p-4">
        <p className="text-sm text-text-inkMuted">Imports are currently disabled.</p>
      </Surface>
    );
  }

  const isWorking = job.state.status === "parsing" || job.state.status === "previewing" || job.state.status === "committing";

  return (
    <div className="space-y-4">
      <Surface className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-xl text-text-ink">Import your library</p>
            <p className="text-sm text-text-inkMuted">Goodreads, StoryGraph, TXT, or Markdown. Up to 10MB.</p>
          </div>
          {isWorking && <Loader2 className="h-5 w-5 animate-spin text-text-ink" aria-label="Loading" />}
        </div>
      </Surface>

      {job.state.status === "success" ? (
        <CommitSummary
          counts={job.state.summary}
          onRetry={job.reset}
          onClose={() => router.push("/library")}
        />
      ) : (
        <Surface className="p-4 space-y-4">
          <UploadDropzone
            onFileSelected={(file) => job.start(file)}
            disabled={isWorking}
          />

          {/* Loading state */}
          {isWorking && (
            <div className="py-12 space-y-4 text-center motion-fade-in">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-text-ink" />
              <div>
                <p className="font-display text-lg text-text-ink">
                  {job.state.status === "parsing" && "Analyzing your file"}
                  {job.state.status === "previewing" && "Extracting books"}
                  {job.state.status === "committing" && "Importing books"}
                </p>
                <p className="text-sm text-text-inkMuted mt-1">
                  {job.state.status === "parsing" && "Reading and parsing content..."}
                  {job.state.status === "previewing" && "Using GPT-5.1-mini for extraction and Gemini 2.5 Flash for verification..."}
                  {job.state.status === "committing" && "Adding to your library..."}
                </p>
              </div>
              {job.state.pages.length > 0 && job.state.status === "previewing" && (
                <p className="text-xs text-status-positive">
                  {job.state.pages.flat().length} books found
                </p>
              )}
            </div>
          )}

          {/* Empty state: no books extracted */}
          {!isWorking && job.state.status === "ready" && job.state.pages.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-text-inkMuted">
                No books could be extracted from this file. Please check the format and try again.
              </p>
              {job.state.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {job.state.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={job.reset} className="mt-4">
                Try another file
              </Button>
            </div>
          )}

          {/* Preview table */}
          {job.state.pages.length > 0 && job.state.status !== "idle" && !isWorking && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-ink">Preview (page {job.state.page + 1} of {job.state.totalPages})</p>
                <div className="flex gap-2">
                  {job.state.page > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => job.setPage(job.state.page - 1)}>
                      Previous
                    </Button>
                  )}
                  {job.state.page + 1 < job.state.totalPages && (
                    <Button variant="ghost" size="sm" onClick={() => job.setPage(job.state.page + 1)}>
                      Next
                    </Button>
                  )}
                </div>
              </div>

              <PreviewTable
                rows={job.state.pages[job.state.page] ?? []}
                dedupMatches={job.state.dedupMatches}
                decisions={job.state.decisions}
                onDecisionChange={(tempId, action) => job.setDecision(tempId, { action })}
              />

              <div className="flex items-center justify-end gap-3">
                <p className="text-xs text-text-inkMuted">
                  Default action: skip. Choose merge or create for rows you want to keep.
                </p>
                <Button
                  size="sm"
                  onClick={() => job.commitPage()}
                  disabled={job.state.status === "committing"}
                >
                  {job.state.status === "committing" ? "Committing..." : "Commit page"}
                </Button>
              </div>
            </div>
          )}
        </Surface>
      )}
    </div>
  );
}
