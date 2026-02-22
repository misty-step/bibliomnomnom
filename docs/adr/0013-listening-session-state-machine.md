# ADR-0013: Listening Session State Machine

**Status**: Accepted

**Date**: 2026-01-15

## Context

Listening sessions involve a multi-stage pipeline: recording audio, uploading to blob storage, transcribing via STT providers, and synthesizing notes via LLM. Each stage can fail independently, and the system needs to handle partial progress, retries, and cost tracking.

A naive approach (fire-and-forget API calls) would lose user recordings on failure and provide no visibility into pipeline progress.

## Decision

Model listening sessions as an explicit state machine in Convex with these states:

`idle → recording → uploading → transcribing → synthesizing → complete`

Each transition is a separate Convex mutation that validates the current state before advancing. The state machine lives in `convex/listeningSessions.ts` with transitions enforced server-side.

Key design choices:

- **Server-side processing**: Audio is uploaded to Vercel Blob, then processing happens via Convex actions (not client-side) for reliability
- **ElevenLabs primary STT, Deepgram fallback**: Based on benchmark evaluation (see `docs/performance/stt-decision-matrix.md`)
- **Cost estimation**: Each session records provider, model, duration, and estimated cost for observability
- **Session rollover**: Long recordings are capped and rolled over to prevent unbounded LLM costs
- **Guardrails in CI**: `scripts/session-guardrails.ts` runs in CI to catch cost regressions

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
