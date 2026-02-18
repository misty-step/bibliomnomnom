// UI wrapper. Orchestration lives in `useListeningSessionRecorder`.
"use client";

import { AlertTriangle, Loader2, Mic, Sparkles, Square, Volume2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/Surface";
import type { SynthesisArtifacts } from "@/lib/listening-sessions/synthesis";
import { useListeningSessionRecorder } from "@/components/notes/useListeningSessionRecorder";

type ListeningSessionRecorderProps = {
  bookId: Id<"books">;
};

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function summarizeArtifacts(artifacts: SynthesisArtifacts): string {
  const parts: string[] = [];
  if (artifacts.insights.length > 0) parts.push(`${artifacts.insights.length} insights`);
  if (artifacts.openQuestions.length > 0) parts.push(`${artifacts.openQuestions.length} questions`);
  if (artifacts.quotes.length > 0) parts.push(`${artifacts.quotes.length} quotes`);
  if (artifacts.followUpQuestions.length > 0)
    parts.push(`${artifacts.followUpQuestions.length} follow-ups`);
  if (artifacts.contextExpansions.length > 0)
    parts.push(`${artifacts.contextExpansions.length} expansions`);
  return parts.join(" • ");
}

export function ListeningSessionRecorder({ bookId }: ListeningSessionRecorderProps) {
  const {
    sessions,
    isRecording,
    isProcessing,
    elapsedMs,
    warningActive,
    liveTranscript,
    capNotice,
    lastTranscript,
    lastProvider,
    lastArtifacts,
    speechRecognitionSupported,
    remainingSeconds,
    capRolloverReady,
    startSession,
    stopAndProcess,
  } = useListeningSessionRecorder(bookId);

  const recordButtonLabel = capRolloverReady ? "Record next session" : "Record";

  return (
    <>
      <Surface elevation="soft" className="border border-line-ghost/60 bg-paper">
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-accent-teal">
                Voice session
              </p>
              <p className="mt-1 text-sm text-text-inkMuted">
                Talk through thoughts while reading. Raw transcript and synthesized notes save
                automatically.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void startSession()}
              disabled={isRecording || isProcessing}
              className="min-w-[8rem]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  {recordButtonLabel}
                </>
              )}
            </Button>
          </div>

          {!speechRecognitionSupported ? (
            <div className="rounded-md border border-amber-400/40 bg-amber-100 px-3 py-2 text-xs text-amber-900">
              Live transcript is unavailable in this browser. Final transcript still processes after
              stop.
            </div>
          ) : null}

          {capNotice ? (
            <div className="rounded-md border border-amber-400/40 bg-amber-100 px-3 py-2 text-xs text-amber-900">
              {capNotice}
            </div>
          ) : null}

          {lastTranscript ? (
            <div className="rounded-md border border-line-ghost bg-surface-dawn px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-text-inkMuted">
                Last session
              </p>
              <p className="mt-2 line-clamp-4 text-sm text-text-ink">{lastTranscript}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-inkSubtle">
                {lastProvider ? <span>Provider: {lastProvider}</span> : null}
                {lastArtifacts ? (
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    {summarizeArtifacts(lastArtifacts) || "No synthesized artifacts"}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {sessions && sessions.length > 0 ? (
            <div className="rounded-md border border-line-ghost/70 bg-canvas-bone px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wider text-text-inkSubtle">
                  Recent sessions: {sessions.length}
                </p>
                {sessions[0]?.status && sessions[0]?.status !== "complete" ? (
                  <p className="text-xs text-text-inkMuted">Latest: {sessions[0].status}</p>
                ) : null}
              </div>
              {sessions[0]?.status === "failed" && sessions[0]?.lastError ? (
                <p className="mt-2 text-xs text-status-danger">{sessions[0].lastError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Surface>

      {isRecording ? (
        <div className="fixed inset-0 z-[60] bg-black/90 text-canvas-bone backdrop-blur-sm">
          <div className="mx-auto flex h-full w-full max-w-3xl min-h-0 flex-col px-6 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 animate-pulse rounded-full bg-accent-ember" />
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-canvas-bone/90">
                  Recording active
                </p>
              </div>
              <p className="font-mono text-xl text-canvas-bone">{formatDuration(elapsedMs)}</p>
            </div>

            <div
              className={cn(
                "mt-4 rounded-md border px-3 py-2 text-sm",
                warningActive
                  ? "border-amber-300 bg-amber-100 text-amber-900"
                  : "border-canvas-bone/20 bg-white/10 text-canvas-bone/80",
              )}
            >
              {warningActive ? (
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  <AlertTriangle className="h-4 w-4" />
                  <span>Session auto-processes in {remainingSeconds}s at cap.</span>
                </div>
              ) : (
                "Speak freely. Live transcript is best-effort and browser-dependent."
              )}
            </div>

            <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-canvas-bone/20 bg-white/5 px-4 py-4">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-canvas-bone/70">
                Live transcript
              </p>
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-base leading-relaxed text-canvas-bone/95">
                {liveTranscript || "Listening…"}
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <Button
                variant="destructive"
                size="lg"
                className="min-w-56"
                onClick={() => void stopAndProcess(false)}
              >
                <Square className="h-4 w-4" />
                Stop and process
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
