"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { upload } from "@vercel/blob/client";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { usePostHog } from "posthog-js/react";
import { useAuthedQuery } from "@/lib/hooks/useAuthedQuery";
import { useToast } from "@/hooks/use-toast";
import {
  EMPTY_SYNTHESIS_ARTIFACTS,
  type SynthesisArtifacts,
} from "@/lib/listening-sessions/synthesis";
import {
  DEFAULT_AUDIO_MIME_TYPE,
  extensionForAudioMimeType,
  normalizeAudioMimeType,
} from "@/lib/listening-sessions/mime";

const CAP_DURATION_MS = 30 * 60 * 1000;
const WARNING_DURATION_MS = 60 * 1000;
const LIVE_TRANSCRIPT_MAX_CHARS = 4_000;
const UPLOAD_MAX_ATTEMPTS = 3;
const UPLOAD_BASE_DELAY_MS = 500;
const MIN_AUDIO_DURATION_MS = 1_000;
const EVENT_CAP_WARNING_SHOWN = "cap_warning_shown";
const EVENT_CAP_REACHED = "cap_reached";
const EVENT_SESSION_ROLLOVER_STARTED = "session_rollover_started";
const EVENT_AUDIO_UPLOAD_ATTEMPT_FAILED = "audio_upload_attempt_failed";

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

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
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

// Each retry hits the upload-audio API route which enforces a 30/day rate limit.
// With 3 attempts max, worst case is 3x rate limit consumption per session.
// At typical usage (1-5 sessions/day) this leaves ample headroom.
async function uploadAudioWithRetry(
  filename: string,
  blob: Blob,
  contentType: string,
  onAttemptFailed?: (attempt: number, error: Error) => void,
): Promise<{ url: string }> {
  let lastError: Error = new Error("Upload failed");
  for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
    try {
      return await upload(filename, blob, {
        access: "public",
        contentType,
        handleUploadUrl: "/api/blob/upload-audio",
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Upload failed");
      onAttemptFailed?.(attempt, lastError);
      if (attempt < UPLOAD_MAX_ATTEMPTS) {
        // Exponential backoff with jitter to avoid thundering herd
        const exponentialDelay = UPLOAD_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const jitter = Math.random() * (UPLOAD_BASE_DELAY_MS / 2);
        await new Promise<void>((resolve) => window.setTimeout(resolve, exponentialDelay + jitter));
      }
    }
  }
  throw new Error(`Upload failed after ${UPLOAD_MAX_ATTEMPTS} attempts: ${lastError.message}`);
}

export function useListeningSessionRecorder(bookId: Id<"books">) {
  const { toast } = useToast();
  const posthog = usePostHog();
  const createSession = useMutation(api.listeningSessions.create);
  const markTranscribing = useMutation(api.listeningSessions.markTranscribing);
  const markSynthesizing = useMutation(api.listeningSessions.markSynthesizing);
  const completeSession = useMutation(api.listeningSessions.complete);
  const failSession = useMutation(api.listeningSessions.fail);

  const sessions = useAuthedQuery(api.listeningSessions.listByBook, { bookId });

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [warningActive, setWarningActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastProvider, setLastProvider] = useState<string>("");
  const [lastArtifacts, setLastArtifacts] = useState<SynthesisArtifacts | null>(null);
  const [capNotice, setCapNotice] = useState<string | null>(null);
  const [capRolloverReady, setCapRolloverReady] = useState(false);

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

  const trackSessionEvent = (
    event: string,
    properties: Record<string, string | number | boolean> = {},
  ) => {
    posthog?.capture(event, { bookId, ...properties });
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

  const requestTranscription = async (audioUrl: string): Promise<TranscribeResult> => {
    const response = await fetch("/api/listening-sessions/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioUrl }),
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

  const requestSynthesis = async (transcript: string): Promise<SynthesisArtifacts> => {
    const response = await fetch("/api/listening-sessions/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, bookId }),
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
            const mimeType = recorder.mimeType || DEFAULT_AUDIO_MIME_TYPE;
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
        const mimeType = recorder.mimeType || DEFAULT_AUDIO_MIME_TYPE;
        blob = new Blob(chunksRef.current, { type: mimeType });
        stopMediaStream();
      }

      const durationMs = Math.max(0, Date.now() - (startTimestampRef.current ?? Date.now()));
      if (!blob.size) {
        throw new Error("Captured audio was empty.");
      }
      if (durationMs < MIN_AUDIO_DURATION_MS) {
        throw new Error(
          `Recording too short (${(durationMs / 1000).toFixed(1)}s). Speak for at least ${MIN_AUDIO_DURATION_MS / 1000} second.`,
        );
      }

      const contentType =
        normalizeAudioMimeType(blob.type || recorder.mimeType) ?? DEFAULT_AUDIO_MIME_TYPE;
      const extension = extensionForAudioMimeType(contentType);
      const filename = `listening-sessions/${bookId}-${Date.now()}.${extension}`;
      const uploaded = await uploadAudioWithRetry(filename, blob, contentType, (attempt, error) => {
        trackSessionEvent(EVENT_AUDIO_UPLOAD_ATTEMPT_FAILED, {
          attempt,
          error: error.message,
          willRetry: attempt < UPLOAD_MAX_ATTEMPTS,
        });
      });

      await markTranscribing({
        sessionId,
        audioUrl: uploaded.url,
        durationMs,
        capReached,
        transcriptLive: liveTranscript.slice(0, LIVE_TRANSCRIPT_MAX_CHARS) || undefined,
      });

      const transcription = await requestTranscription(uploaded.url);
      await markSynthesizing({ sessionId });

      let synthesized = EMPTY_SYNTHESIS_ARTIFACTS;
      try {
        synthesized = await requestSynthesis(transcription.transcript);
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
      setCapRolloverReady(capReached);

      toast({
        title: "Session processed",
        description:
          synthesized.insights.length +
            synthesized.openQuestions.length +
            synthesized.quotes.length +
            synthesized.followUpQuestions.length +
            synthesized.contextExpansions.length >
          0
            ? "Transcript and synthesized artifacts saved."
            : "Raw transcript saved.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Listening session failed.";
      setCapRolloverReady(false);
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
      if (!capReached) {
        setCapRolloverReady(false);
      }
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
      const shouldTrackRolloverStart = capRolloverReady;
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

      if (shouldTrackRolloverStart) {
        setCapRolloverReady(false);
        trackSessionEvent(EVENT_SESSION_ROLLOVER_STARTED, {
          reason: "cap_reached",
          capDurationMs: CAP_DURATION_MS,
        });
      }

      startSpeechRecognition();

      elapsedIntervalRef.current = window.setInterval(() => {
        if (!startTimestampRef.current) return;
        setElapsedMs(Date.now() - startTimestampRef.current);
      }, 500);

      warningTimeoutRef.current = window.setTimeout(
        () => {
          setWarningActive(true);
          trackSessionEvent(EVENT_CAP_WARNING_SHOWN, {
            warningDurationMs: WARNING_DURATION_MS,
            capDurationMs: CAP_DURATION_MS,
          });
          playAlertTone("warning");
        },
        Math.max(0, CAP_DURATION_MS - WARNING_DURATION_MS),
      );

      capTimeoutRef.current = window.setTimeout(() => {
        setWarningActive(true);
        trackSessionEvent(EVENT_CAP_REACHED, {
          capDurationMs: CAP_DURATION_MS,
          warningDurationMs: WARNING_DURATION_MS,
        });
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
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    if (!isRecording) return;
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isRecording]);

  useEffect(() => {
    const previousSessionId = sessionIdRef.current;

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

    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      } catch {
        // no-op
      }
    }

    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startTimestampRef.current = null;
    finalTranscriptRef.current = "";
    sessionIdRef.current = null;
    isRecordingRef.current = false;
    isStoppingRef.current = false;

    if (previousSessionId) {
      void failSession({
        sessionId: previousSessionId,
        message: "Session ended because book context changed.",
      }).catch(() => {});
    }

    setIsRecording(false);
    setIsProcessing(false);
    setElapsedMs(0);
    setWarningActive(false);
    setLiveTranscript("");
    setCapNotice(null);
    setCapRolloverReady(false);
    setLastTranscript("");
    setLastProvider("");
    setLastArtifacts(null);
  }, [bookId, failSession]);

  useEffect(() => {
    return () => {
      const sessionId = sessionIdRef.current;
      const wasRecording = isRecordingRef.current;

      clearTiming();
      stopSpeechRecognition();
      stopMediaStream();
      mediaRecorderRef.current = null;
      sessionIdRef.current = null;
      isRecordingRef.current = false;

      if (wasRecording && sessionId) {
        void failSession({
          sessionId,
          message: "Session ended before processing completed.",
        }).catch(() => {});
      }
    };
  }, [failSession]);

  return {
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
  };
}
