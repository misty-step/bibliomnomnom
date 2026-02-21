# ADR-0012: Audio Blob Privacy via Layered Defense

**Status**: Accepted

**Date**: 2026-02-21

**Authors**: PR #188 (closes #160)

## Context

Listening session audio was uploaded directly from the browser to Vercel Blob storage, exposing the blob URL to the client. Since `@vercel/blob` v2 only supports `access: "public"` at the per-blob level, anyone with the URL could access the audio without authentication.

Issue #160 flagged this as a privacy concern: user audio recordings should only be accessible to their owner.

## Decision

Adopt a defense-in-depth approach with three layers rather than waiting for Vercel Blob private stores:

1. **Server-side upload**: Audio is uploaded via `POST /api/listening-sessions/[sessionId]/upload`, which validates auth, entitlements, and session ownership before writing to blob storage. The blob URL is never sent to the client.

2. **Projection stripping**: All client-facing Convex queries pass through `toClientSession()`, which strips `audioUrl` from the response. The field only exists server-side.

3. **Auth-gated proxy**: Playback uses `GET /api/listening-sessions/[sessionId]/audio`, which authenticates the user, verifies session ownership via Convex, validates the blob URL against a trusted host allowlist, and streams the response with `Cache-Control: private`.

The blob URLs themselves use opaque paths (`listening-sessions/{sessionId}-{timestamp}.{ext}`) to resist enumeration.

## Consequences

### Positive

- Audio is inaccessible without authentication even though blob storage is technically public
- No dependency on unreleased Vercel Blob features
- Pre-flight validation prevents orphaned blobs (session must exist and be in `recording` state)
- Range requests forwarded for seeking without downloading entire file

### Negative

- Audio playback latency increases by one network hop (proxy)
- Blob URLs are technically guessable if someone knows sessionId + approximate timestamp (mitigated by projection stripping and auth proxy)
- `access: "public"` remains in code, which reads as a security concern without the NOTE comment

### Neutral

- Migrating to Vercel Blob private stores when available would replace layer 1's `access: "public"` but layers 2-3 should remain as defense-in-depth

## Alternatives Considered

### Option A: Wait for Vercel Blob private stores

- Pros: Single enforcement point, no proxy needed
- Cons: Unavailable in `@vercel/blob` v2, blocks the fix indefinitely
- Why rejected: Shipping three compensating controls now is better than waiting

### Option B: Store audio in Convex file storage

- Pros: Inherits Convex's auth model
- Cons: Convex file storage has size limits, no streaming, no Range request support
- Why rejected: Poor fit for audio playback UX

### Option C: Signed URLs with short TTL

- Pros: Standard pattern for private blob access
- Cons: Not supported by `@vercel/blob` v2 API
- Why rejected: API limitation

## References

- [Issue #160](https://github.com/misty-step/bibliomnomnom/issues/160)
- [PR #188](https://github.com/misty-step/bibliomnomnom/pull/188)
- [Vercel Blob docs — access modes](https://vercel.com/docs/storage/vercel-blob)
