export type STTProvider = "elevenlabs" | "deepgram" | "assemblyai";

/** Normalized partial transcript event for realtime streaming. Not yet used in v1 batch flow. */
export type PartialTranscriptEvent = {
  type: "partial";
  text: string;
  provider: STTProvider;
  /** false = interim, true = segment finalized */
  isFinal: boolean;
};

export type FinalTranscript = {
  provider: STTProvider;
  transcript: string;
  confidence?: number;
};

export type STTErrorCode =
  | "rate_limited"
  | "quota_exceeded"
  | "unauthorized"
  | "unsupported_format"
  | "audio_too_large"
  | "empty_transcript"
  | "provider_error"
  | "timeout"
  | "network_error";

export class STTError extends Error {
  readonly code: STTErrorCode;
  readonly provider: STTProvider;
  /** Whether a retry (with same or fallback provider) is sensible. */
  readonly retryable: boolean;

  constructor(opts: {
    code: STTErrorCode;
    provider: STTProvider;
    message: string;
    retryable?: boolean;
  }) {
    super(opts.message);
    this.name = "STTError";
    this.code = opts.code;
    this.provider = opts.provider;
    this.retryable = opts.retryable ?? false;
  }
}

export interface STTAdapter {
  readonly provider: STTProvider;
  /** Transcribe audio bytes. Throws STTError on failure. */
  transcribe(params: { audioBytes: ArrayBuffer; mimeType: string }): Promise<FinalTranscript>;
}

export type FallbackPolicy = {
  primary: STTProvider;
  secondary?: STTProvider;
};

/** Per-provider kill switches. Missing key → use default (elevenlabs/deepgram on, assemblyai off). */
export type ProviderFlags = {
  elevenlabs?: boolean;
  deepgram?: boolean;
  assemblyai?: boolean;
};
