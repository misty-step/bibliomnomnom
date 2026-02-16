"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { upload } from "@vercel/blob/client";
import { AlertTriangle, Loader2, Mic, Sparkles, Square, Volume2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useAuthedQuery } from "@/lib/hooks/useAuthedQuery";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/Surface";
import { useToast } from "@/hooks/use-toast";
import {
  EMPTY_SYNTHESIS_ARTIFACTS,
  type SynthesisArtifacts,
  type SynthesisContext,
} from "@/lib/listening-sessions/synthesis";

const CAP_DURATION_MS = 30 * 60 * 1000;
const WARNING_DURATION_MS = 60 * 1000;
const LIVE_TRANSCRIPT_MAX_CHARS = 4_000;

type TranscribeResult = {
  transcript: string;
  provider: "deepgram" | "elevenlabs";
  confidence?: number;
};

type RecognitionAlternative = {
  transcript: string;
};

type RecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternative;
};

type RecognitionResultList = {
  length: number;
  [index: number]: RecognitionResult;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: RecognitionResultList;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    webkitAudioContext?: typeof AudioContext;
  }
}

type ListeningSessionRecorderProps = {
  bookId: Id<"books">;
};

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function normalizeContentType(mimeType: string | undefined): string | undefined {
  if (!mimeType) return undefined;
  const base = mimeType.split(";")[0]?.trim();
  return base || undefined;
}

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

function playAlertTone(kind: "warning" | "cap") {
  if (typeof window === "undefined") return;
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) return;

  try {
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = kind === "warning" ? 880 : 540;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
    window.setTimeout(() => {
      void context.close();
    }, 450);
  } catch {
    // Best effort only.
  }
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
  const { toast } = useToast();
  const createSession = useMutation(api.listeningSessions.create);
  const markTranscribing = useMutation(api.listeningSessions.markTranscribing);
  const markSynthesizing = useMutation(api.listeningSessions.markSynthesizing);
  const completeSession = useMutation(api.listeningSessions.complete);
  const failSession = useMutation(api.listeningSessions.fail);

  const sessions = useAuthedQuery(api.listeningSessions.listByBook, { bookId });
  const synthesisContext = useAuthedQuery(api.listeningSessions.getSynthesisContext, { bookId });

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [warningActive, setWarningActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastProvider, setLastProvider] = useState<string>("");
  const [lastArtifacts, setLastArtifacts] = useState<SynthesisArtifacts | null>(null);
  const [capNotice, setCapNotice] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimestampRef = useRef<number | null>(null);
  const sessionIdRef = useRef<Id<"listeningSessions"> | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const isStoppingRef = useRef(false);
  const isRecordingRef = useRef(false);

  const warningTimeoutRef = useRef<number | null>(null);
  const capTimeoutRef = useRef<number | null>(null);
  const elapsedIntervalRef = useRef<number | null>(null);

  const speechRecognitionSupported = Boolean(getSpeechRecognitionConstructor());
  const remainingMs = Math.max(0, CAP_DURATION_MS - elapsedMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  const clearTiming = () => {
    if (warningTimeoutRef.current) {
      window.clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (capTimeoutRef.current) {
      window.clearTimeout(capTimeoutRef.current);
      capTimeoutRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      window.clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
  };

  const stopSpeechRecognition = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    try {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    } catch {
      // no-op
    }
  };

  const stopMediaStream = () => {
    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
  };

  const resetCaptureState = () => {
    clearTiming();
    stopSpeechRecognition();
    stopMediaStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startTimestampRef.current = null;
    finalTranscriptRef.current = "";
    setElapsedMs(0);
    setWarningActive(false);
    setLiveTranscript("");
  };

  const requestTranscription = async (
    audioUrl: string,
    mimeType: string,
  ): Promise<TranscribeResult> => {
    const response = await fetch("/api/listening-sessions/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioUrl, mimeType }),
    });
    const payload = (await response.json()) as Partial<TranscribeResult> & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Failed to transcribe recording.");
    }
    if (!payload.transcript || !payload.provider) {
      throw new Error("Transcription response was incomplete.");
    }
    return {
      transcript: payload.transcript,
      provider: payload.provider,
      confidence: payload.confidence,
    };
  };

  const requestSynthesis = async (
    transcript: string,
    context?: SynthesisContext,
  ): Promise<SynthesisArtifacts> => {
    const response = await fetch("/api/listening-sessions/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, context }),
    });
    const payload = (await response.json()) as {
      artifacts?: SynthesisArtifacts;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || "Failed to synthesize session notes.");
    }
    return payload.artifacts ?? EMPTY_SYNTHESIS_ARTIFACTS;
  };

  const startSpeechRecognition = () => {
    const Constructor = getSpeechRecognitionConstructor();
    if (!Constructor) return;

    try {
      const recognition = new Constructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let interim = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result) continue;
          const alternative = result[0];
          if (!alternative || !alternative.transcript) continue;
          if (result.isFinal) {
            finalTranscriptRef.current =
              `${finalTranscriptRef.current} ${alternative.transcript}`.trim();
          } else {
            interim = `${interim} ${alternative.transcript}`.trim();
          }
        }

        const combined = `${finalTranscriptRef.current} ${interim}`.trim();
        setLiveTranscript(combined.slice(0, LIVE_TRANSCRIPT_MAX_CHARS));
      };

      recognition.onerror = () => {
        // Keep recording even if speech recognition fails.
      };

      recognition.onend = () => {
        if (isRecordingRef.current && recognitionRef.current) {
          try {
            recognition.start();
          } catch {
            // no-op
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      // speech recognition is best effort; recording still works without it.
    }
  };

  const stopAndProcess = async (capReached: boolean) => {
    if (isStoppingRef.current) return;
    const recorder = mediaRecorderRef.current;
    const sessionId = sessionIdRef.current;
    if (!recorder || !sessionId) return;

    isStoppingRef.current = true;
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsProcessing(true);
    clearTiming();
    stopSpeechRecognition();

    try {
      let blob: Blob;
      if (recorder.state !== "inactive") {
        const stopPromise = new Promise<Blob>((resolve, reject) => {
          const finalizeBlob = () => {
            const mimeType = recorder.mimeType || "audio/webm";
            resolve(new Blob(chunksRef.current, { type: mimeType }));
          };

          recorder.addEventListener("stop", finalizeBlob, { once: true });
          recorder.addEventListener(
            "error",
            () => {
              reject(new Error("Recording stopped with an error."));
            },
            { once: true },
          );
        });

        recorder.stop();
        stopMediaStream();
        blob = await stopPromise;
      } else {
        const mimeType = recorder.mimeType || "audio/webm";
        blob = new Blob(chunksRef.current, { type: mimeType });
        stopMediaStream();
      }

      const durationMs = Math.max(0, Date.now() - (startTimestampRef.current ?? Date.now()));
      if (!blob.size) {
        throw new Error("Captured audio was empty.");
      }

      const contentType = normalizeContentType(blob.type || recorder.mimeType) || "audio/webm";
      const extension = extensionForMimeType(contentType);
      const filename = `listening-sessions/${bookId}-${Date.now()}.${extension}`;
      const uploaded = await upload(filename, blob, {
        access: "public",
        contentType,
        handleUploadUrl: "/api/blob/upload-audio",
      });

      await markTranscribing({
        sessionId,
        audioUrl: uploaded.url,
        durationMs,
        capReached,
        transcriptLive: liveTranscript.slice(0, LIVE_TRANSCRIPT_MAX_CHARS) || undefined,
      });

      const transcription = await requestTranscription(uploaded.url, contentType);
      await markSynthesizing({ sessionId });

      let synthesized = EMPTY_SYNTHESIS_ARTIFACTS;
      try {
        synthesized = await requestSynthesis(transcription.transcript, synthesisContext);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to synthesize transcript.";
        toast({
          title: "Synthesis degraded",
          description: `${message} Saved raw transcript only.`,
          variant: "destructive",
        });
      }

      await completeSession({
        sessionId,
        transcript: transcription.transcript,
        transcriptProvider: transcription.provider,
        synthesis: synthesized,
      });

      setLastTranscript(transcription.transcript);
      setLastProvider(transcription.provider);
      setLastArtifacts(synthesized);
      setCapNotice(
        capReached
          ? "Session reached the processing cap and was auto-processed. Start a new session to continue."
          : null,
      );

      toast({
        title: "Session processed",
        description:
          summarizeArtifacts(synthesized).length > 0
            ? "Transcript and synthesized artifacts saved."
            : "Raw transcript saved.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Listening session failed.";
      try {
        await failSession({ sessionId, message });
      } catch {
        // no-op
      }
      toast({
        title: "Session failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      sessionIdRef.current = null;
      resetCaptureState();
      setIsProcessing(false);
      isStoppingRef.current = false;
    }
  };

  const startSession = async () => {
    if (isRecording || isProcessing) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Microphone unavailable",
        description: "This browser does not support microphone capture.",
        variant: "destructive",
      });
      return;
    }

    try {
      setCapNotice(null);
      setLastTranscript("");
      setLastProvider("");
      setLastArtifacts(null);
      finalTranscriptRef.current = "";

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const sessionId = await createSession({
        bookId,
        capDurationMs: CAP_DURATION_MS,
        warningDurationMs: WARNING_DURATION_MS,
      });
      sessionIdRef.current = sessionId;

      const mimeType = pickSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.start(1_000);

      startTimestampRef.current = Date.now();
      setElapsedMs(0);
      setWarningActive(false);
      setIsRecording(true);
      isRecordingRef.current = true;

      startSpeechRecognition();

      elapsedIntervalRef.current = window.setInterval(() => {
        if (!startTimestampRef.current) return;
        setElapsedMs(Date.now() - startTimestampRef.current);
      }, 500);

      warningTimeoutRef.current = window.setTimeout(
        () => {
          setWarningActive(true);
          playAlertTone("warning");
        },
        Math.max(0, CAP_DURATION_MS - WARNING_DURATION_MS),
      );

      capTimeoutRef.current = window.setTimeout(() => {
        setWarningActive(true);
        playAlertTone("cap");
        void stopAndProcess(true);
      }, CAP_DURATION_MS);
    } catch (error) {
      const existingSessionId = sessionIdRef.current;
      if (existingSessionId) {
        try {
          await failSession({
            sessionId: existingSessionId,
            message: error instanceof Error ? error.message : "Failed to start session",
          });
        } catch {
          // no-op
        }
      }
      resetCaptureState();
      sessionIdRef.current = null;
      isRecordingRef.current = false;
      const message = error instanceof Error ? error.message : "Failed to start listening session.";
      toast({
        title: "Could not start recording",
        description: message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    return () => {
      clearTiming();
      stopSpeechRecognition();
      stopMediaStream();
      mediaRecorderRef.current = null;
      sessionIdRef.current = null;
      isRecordingRef.current = false;
    };
  }, []);

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
                  Record
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
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-6 py-8">
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

            <div className="mt-6 flex-1 overflow-hidden rounded-xl border border-canvas-bone/20 bg-white/5 px-4 py-4">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-canvas-bone/70">
                Live transcript
              </p>
              <p className="mt-3 h-full overflow-y-auto whitespace-pre-wrap text-base leading-relaxed text-canvas-bone/95">
                {liveTranscript || "Listening…"}
              </p>
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
