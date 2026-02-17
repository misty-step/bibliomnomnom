# Listening Sessions Flow (Voice Notes + Synthesis)

Voice-first note capture for readers who want to keep reading while talking through reactions, ideas, and questions.

## Goals

- One-tap recording from book detail.
- Clear active-recording UI.
- Long-session support (30+ min) with cap warning + forced rollover.
- Always save raw transcript.
- Generate useful artifacts in book context.

## Current MVP Implementation

### End-to-End Pipeline

1. **Record**
   - UI + orchestration: `components/notes/ListeningSessionRecorder.tsx` + `components/notes/useListeningSessionRecorder.ts`
   - Capture: `MediaRecorder` chunks to memory (1s slices).
   - Optional live transcript: best-effort browser `SpeechRecognition` / `webkitSpeechRecognition`.

2. **Upload audio**
   - Client: `@vercel/blob/client` `upload()` with `handleUploadUrl=/api/blob/upload-audio`
   - Server: `app/api/blob/upload-audio/route.ts` uses `handleUpload()` to mint an upload token.
   - Gotcha: audio codec content-types are normalized and explicitly allowed.

3. **Transcribe (batch STT)**
   - Route: `app/api/listening-sessions/transcribe/route.ts`
   - Audio bytes are fetched from the blob URL, then sent to:
     - Deepgram (preferred if `DEEPGRAM_API_KEY` is set; `DEEPGRAM_STT_MODEL` default `nova-3`)
     - ElevenLabs (fallback if `ELEVENLABS_API_KEY` is set; `ELEVENLABS_STT_MODEL` default `scribe_v2`)

4. **Synthesize (LLM)**
   - Route: `app/api/listening-sessions/synthesize/route.ts`
   - Provider: OpenRouter (`OPENROUTER_API_KEY`)
   - Request: `{ bookId, transcript }` (context is fetched server-side from Convex)
   - Output: strict JSON schema via `response_format=json_schema`
   - Prompt template: `lib/listening-sessions/synthesisPrompt.ts`
   - Model + knobs: `lib/listening-sessions/synthesisConfig.ts` (env-driven)

5. **Persist**
   - Convex: `convex/listeningSessions.ts`
   - Always writes/updates a **raw transcript note**.
   - Writes **one synthesized note** plus **quote notes** (note types are `note` or `quote`).

## Server Session Status

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> recording: listeningSessions.create + start MediaRecorder
    recording --> transcribing: stop/cap -> upload + markTranscribing
    transcribing --> synthesizing: STT ok -> markSynthesizing
    synthesizing --> complete: complete() (artifacts may be empty on degraded synthesis)
    recording --> failed: capture/upload error -> fail()
    transcribing --> failed: STT error -> fail()
    complete --> idle
    failed --> idle
```

## Processing Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant UI as ListeningSessionRecorder
    participant CVX as Convex
    participant Blob as Vercel Blob
    participant STT as /api/listening-sessions/transcribe
    participant LLM as /api/listening-sessions/synthesize

    U->>UI: Start
    UI->>CVX: listeningSessions.create(bookId)
    UI->>UI: Record audio (MediaRecorder)
    UI->>UI: Optional live transcript (SpeechRecognition)

    U->>UI: Stop (or cap auto-stop)
    UI->>Blob: upload(audio) via /api/blob/upload-audio
    UI->>CVX: markTranscribing(audioUrl, durationMs, capReached, transcriptLive?)
    UI->>STT: POST { audioUrl }
    STT-->>UI: { transcript, provider }

    UI->>CVX: markSynthesizing(sessionId)
    UI->>LLM: POST { bookId, transcript }
    LLM-->>UI: { artifacts } (or fallback)

    UI->>CVX: complete(sessionId, transcript, provider, artifacts?)
    CVX-->>UI: raw transcript note upserted + synthesized notes inserted
```

## Future (Not Shipped)

- Durable server-side orchestration + retries (tab close shouldn’t strand sessions).
- Private audio blobs (avoid “public URL = access”).
- Review/publish workflow (choose which artifacts become canonical notes).
