# Listening Sessions Flow (Voice Notes + Synthesis)

Voice-first note capture for readers who want to keep reading while talking through reactions, ideas, and questions.

Current backlog focus for this flow is tracked under pillar epic #166:

1. Security and trust first (`#160` private audio blobs)
2. Durability and retry (`#159` server-side recoverability)
3. Capture and UX reliability (`#147`, `#146`, `#145`)

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
     - ElevenLabs (primary if `ELEVENLABS_API_KEY` is set; `ELEVENLABS_STT_MODEL` default `scribe_v2`)
     - Deepgram (fallback if `DEEPGRAM_API_KEY` is set; `DEEPGRAM_STT_MODEL` default `nova-3`)

4. **Synthesize (LLM)**
   - Route: `app/api/listening-sessions/synthesize/route.ts`
   - Provider: OpenRouter (`OPENROUTER_API_KEY`)
   - Request: `{ bookId, transcript }` (context is fetched server-side from Convex)
   - Output: strict JSON schema via `response_format=json_schema`
   - Prompt template: `lib/listening-sessions/synthesisPrompt.ts`
   - Model + knobs: `lib/listening-sessions/synthesisConfig.ts` (env-driven)

5. **Persist**
   - Convex: `convex/listeningSessions.ts`
   - Always writes/updates a **raw transcript note** in `notes`.
   - Writes each synthesis artifact into **`listeningSessionArtifacts`** (kinded `insight`, `openQuestion`, `quote`, `followUpQuestion`, `contextExpansion`).
   - Also persists a final normalized transcript row in **`listeningSessionTranscripts`**.
   - Single active session guard: creation is rejected if a `recording|transcribing|synthesizing|review` session already exists for the same user and book.

## Server Session Status

Note: `review` exists in the Convex state machine to support a future “curate before saving notes” workflow. The MVP currently goes straight from `synthesizing` → `complete`.

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> recording: listeningSessions.create + start MediaRecorder
    recording --> transcribing: stop/cap -> upload + markTranscribing
    transcribing --> synthesizing: STT ok -> markSynthesizing
    synthesizing --> complete: MVP: complete() (artifacts may be empty on degraded synthesis)
    synthesizing --> review: Future: manual review step
    review --> complete: Future: publish curated artifacts
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
    CVX-->>UI: raw transcript note upserted + synthesized notes inserted + artifacts/transcript persisted
```

## Future (Not Shipped)

- Durable server-side orchestration + retries (tab close shouldn’t strand sessions).
- Private audio blobs (avoid “public URL = access”).
- Review/publish workflow (choose which artifacts become canonical notes).
