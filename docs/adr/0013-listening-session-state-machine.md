# ADR-0013: Listening Session State Machine

**Status**: Accepted

**Date**: 2026-01-15

## Context

Listening sessions involve a multi-stage pipeline: recording audio, uploading to blob storage, transcribing via STT providers, and synthesizing notes via LLM. Each stage can fail independently, and the system needs to handle partial progress, retries, and cost tracking.

A naive approach (fire-and-forget API calls) would lose user recordings on failure and provide no visibility into pipeline progress.

## Decision

Model listening sessions as an explicit state machine in Convex with these states:

`idle → recording → transcribing → synthesizing → review → complete`

Each transition is a separate Convex mutation that validates the current state before advancing. The state machine lives in `convex/listeningSessions.ts` with transitions enforced server-side.

`review` is present to support a future curate-before-publish workflow and can also be a no-op intermediate step once synthesis is complete.

Key design choices:

- **Server-side processing**: Audio is uploaded to Vercel Blob, then processing happens via Convex actions (not client-side) for reliability
- **Transcript + artifact persistence**: Completed sessions write a final transcript row to `listeningSessionTranscripts` and each synthesis artifact to `listeningSessionArtifacts` while still rendering the raw transcript/synthesized notes in legacy `notes` rows for display.
- **ElevenLabs primary STT, Deepgram fallback**: Based on benchmark evaluation (see `docs/performance/stt-decision-matrix.md`)
- **Cost estimation**: Each session records provider, model, duration, and estimated cost for observability
- **Session rollover**: Long recordings are capped and rolled over to prevent unbounded LLM costs
- **Guardrails in CI**: `scripts/session-guardrails.ts` runs in CI to catch cost regressions
- **Single active session invariant**: Create is blocked when a non-terminal session already exists for the same user and book (`recording`, `transcribing`, `synthesizing`, `review`).

## Consequences

**Good:**

- Failed sessions can be retried from the last successful state
- Users see real-time progress through state transitions
- Cost visibility prevents runaway LLM spending
- Server-side processing means recordings survive client disconnects

**Bad:**

- More complex than simple request/response
- State transitions require careful ordering (mutations must be idempotent)
- Dual STT provider configuration adds maintenance surface
