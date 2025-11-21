"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/Surface";
import { useToast } from "@/hooks/use-toast";
import { UploadDropzone } from "./UploadDropzone";
import { CommitSummary } from "./CommitSummary";
import { useImportJob } from "@/hooks/useImportJob";

const IMPORT_ENABLED = process.env.NEXT_PUBLIC_IMPORT_ENABLED !== "false";

export function ImportFlow() {
  const { toast } = useToast();
  const preparePreview = useMutation(api.imports.preparePreview);
  const commitImport = useMutation(api.imports.commitImport);

  const job = useImportJob({
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
    }
  }, [job.state.errors, toast]);

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
        />
      ) : (
        <Surface className="p-4 space-y-4">
          <UploadDropzone
            onFileSelected={(file) => job.start(file)}
            disabled={isWorking}
          />

          {job.state.pages.length > 0 && job.state.status !== "idle" && (
            <div className="space-y-2">
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
              <Surface className="divide-y divide-line-ghost border border-line-ghost">
                {job.state.pages[job.state.page]?.slice(0, 5).map((row) => (
                  <div key={row.tempId} className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium text-text-ink">{row.title}</p>
                      <p className="text-sm text-text-inkMuted">{row.author}</p>
                    </div>
                    <span className="text-xs text-text-inkMuted">{row.status ?? "want-to-read"}</span>
                  </div>
                ))}
                {job.state.pages[job.state.page]?.length === 0 && (
                  <p className="p-3 text-sm text-text-inkMuted">No rows on this page.</p>
                )}
              </Surface>
              <div className="flex justify-end">
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
