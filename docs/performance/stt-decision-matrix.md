# STT Provider Decision Matrix — bibliomnomnom

**Date**: 2026-02-20
**Context**: Voice note sessions for book annotation. Default session: 30 min. Max: 4 hours.
**Workflow**: Batch (post-session). Audio recorded → uploaded to blob → transcribed → synthesized.

## Candidates

| Provider   | Model               | Mode                       | Languages | Max Duration |
| ---------- | ------------------- | -------------------------- | --------- | ------------ |
| ElevenLabs | Scribe v2           | Batch (file upload)        | 90+       | Unlimited    |
| Deepgram   | Nova-3              | Batch + Streaming          | Multiple  | Unlimited    |
| AssemblyAI | Universal-Streaming | Streaming only (WebSocket) | 6         | **3 hours**  |

## Scoring Matrix

| Dimension                  | ElevenLabs Scribe v2     | Deepgram Nova-3           | AssemblyAI Universal-Streaming          |
| -------------------------- | ------------------------ | ------------------------- | --------------------------------------- |
| **Accuracy (WER)**         | ⭐⭐⭐⭐⭐ Best-in-class | ⭐⭐⭐⭐ Good             | ⭐⭐⭐ Good (2-3% streaming penalty)    |
| **Cost per 30 min**        | ~$0.11 ($0.00367/min)    | ~$0.13 ($0.0043/min)      | ~$0.075 (base only)                     |
| **Cost per 4 hours**       | ~$0.88                   | ~$1.03                    | ❌ Exceeds 3-hr session cap             |
| **Session duration**       | Unlimited                | Unlimited                 | **Hard cap: 3 hours**                   |
| **Integration model**      | REST (file upload)       | REST (file upload)        | WebSocket + token auth                  |
| **Operational complexity** | Low                      | Low                       | High (persistent connection, keepalive) |
| **API stability**          | Good                     | Excellent (market leader) | Good                                    |
| **Language support**       | 90+                      | Multiple                  | 6 languages only                        |
| **Book domain accuracy**   | ⭐⭐⭐⭐⭐               | ⭐⭐⭐⭐                  | ⭐⭐⭐                                  |
| **Long-form stability**    | ⭐⭐⭐⭐⭐ Optimized     | ⭐⭐⭐⭐                  | ❌ Broken at 4hr max                    |

## Decision

**Primary: ElevenLabs Scribe v2**

Rationale:

- Highest accuracy in published benchmarks — critical for capturing book titles, author names, and academic vocabulary
- Cheapest among the candidates for batch processing ($0.22/hr vs Deepgram's $0.258/hr)
- Unlimited session duration — handles the 4-hour maximum without session management complexity
- REST file-upload model matches the existing blob-upload architecture exactly
- Speaker diarization and keyterm prompting available for future enhancement

Required env var: `ELEVENLABS_API_KEY`
API endpoint: `POST https://api.elevenlabs.io/v1/speech-to-text`
Model: `scribe_v2`

**Fallback: Deepgram Nova-3 (batch)**

Trigger conditions:

- ElevenLabs returns 5xx error
- ElevenLabs latency exceeds 120s timeout
- ElevenLabs API key exhausted / rate limited

Rationale:

- Proven API stability as market leader in STT
- Same batch workflow — drop-in fallback with minimal code divergence
- Good accuracy, slightly below ElevenLabs but acceptable
- Handles unlimited duration like the primary

Required env var: `DEEPGRAM_API_KEY`
API endpoint: `POST https://api.deepgram.com/v1/listen?model=nova-3`

**Kill switch: blob preservation + retry queue**

If both providers fail:

1. Audio blob already persisted in Vercel Blob (from upload step)
2. Session status stays `failed` with `retryCount` incremented
3. Cron job retries up to `MAX_PROCESSING_RETRIES` (currently 3) with exponential backoff
4. Alert fires after 3 failures (Sentry + PostHog event)

## Why AssemblyAI Universal-Streaming is Rejected

AssemblyAI Universal-Streaming was evaluated and rejected on three grounds:

1. **Session duration cap**: Hard limit of 3 hours (WebSocket close code 3005). The app allows sessions up to 4 hours. Supporting this would require session-splitting logic that adds complexity and creates transcript seam artifacts.

2. **Streaming-only model**: The app's architecture is batch (audio recorded → uploaded to blob → transcribed). Universal-Streaming requires a persistent WebSocket connection maintained throughout the recording, meaning the transcription infra must be running browser-side during capture. This contradicts the existing server-side processing model.

3. **Language restriction**: 6 supported languages vs 90+ for ElevenLabs. Readers are international.

Note: AssemblyAI's **Universal-2** (async batch) is a separate product that avoids these issues. It can be reconsidered as a tertiary fallback if needed. The benchmark script (`scripts/stt-eval.py`) tests Universal-2 batch, not Universal-Streaming.

## Failure Handling Policy

```
Session uploaded → Attempt ElevenLabs Scribe v2
  ├─ Success → proceed to synthesis
  └─ Failure (5xx, timeout, quota) →
       Attempt Deepgram Nova-3
       ├─ Success → proceed to synthesis
       └─ Failure →
            Mark session status: failed
            Preserve audio blob (do NOT delete)
            Increment retryCount
            Sentry.captureException (stt_both_providers_failed)
            PostHog event: stt_failure {provider, error, bookId, sessionId}
            Cron retries with exponential backoff (1h, 4h, 24h)
            Alert after 3 consecutive failures
```

## Session Length Behavior (≥30 min)

ElevenLabs Scribe v2 is optimized for long-form audio and maintains accuracy without drift. Testing in related projects (vox) confirms stable transcription on 1-hour+ recordings.

For sessions approaching the 30-minute default cap:

- Session rolls over (existing mechanism in `listeningSessions.ts`)
- Each rolled-over chunk uploaded and transcribed independently
- Transcripts concatenated before synthesis
- No special handling required for the STT layer

For 4-hour sessions (MAX_CAP_DURATION_MS):

- Same chunk-and-concatenate approach
- ElevenLabs and Deepgram both handle individual file sizes well within their limits
- Monitor cost: 4hr @ $0.22/hr = $0.88 per session — acceptable

## Cost Projections

| Session Length   | ElevenLabs (primary) | Deepgram (fallback) |
| ---------------- | -------------------- | ------------------- |
| 10 min           | $0.037               | $0.043              |
| 30 min (default) | $0.110               | $0.129              |
| 60 min           | $0.220               | $0.258              |
| 4 hours (max)    | $0.880               | $1.032              |

At 1,000 sessions/month (growth target):

- All 30 min: ~$110/month
- Mix of lengths: ~$150-200/month estimated

Pricing updated 2026-02-20. Verify against current provider dashboards before launch.

## Running the Benchmark

```bash
# Prerequisites
pip install requests

# Set API keys in .env.local:
# ELEVENLABS_API_KEY=...
# DEEPGRAM_API_KEY=...
# ASSEMBLYAI_API_KEY=...  (optional, tests Universal-2 batch)

# Evaluate an existing audio file
python3 scripts/stt-eval.py path/to/sample.wav

# Record and evaluate (macOS)
python3 scripts/stt-eval.py --record 30    # 30-second sample
python3 scripts/stt-eval.py --record 300   # 5-minute sample (more representative)

# Multiple iterations for latency stability
python3 scripts/stt-eval.py sample.wav --iterations 3

# Output written to:
# docs/performance/stt-eval-YYYY-MM-DD.md
# docs/performance/stt-eval-raw-YYYY-MM-DD.json
```

Recommended test samples for realistic results:

- **Short thought** (30s): single observation about a book
- **Rambling monologue** (5 min): stream-of-consciousness reading notes
- **Technical passage** (2 min): academic/dense text, proper nouns, author names
- **Long-form session** (30 min): full reading session simulation
