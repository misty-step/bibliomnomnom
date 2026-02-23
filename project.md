# Project: bibliomnomnom

## Vision

Private-first book tracking for voracious readers — capture thoughts on what you read, where you read it, and what it made you think.

**North Star:** The reading companion that serious readers reach for instinctively — capturing every thought in the moment and surfacing insights months later, across every form factor.

**Target User:** Heavy readers (50+ books/year) who currently use Goodreads but feel it's too social/shallow, or who use notes apps but lose the book context.

**Current Focus:** Complete the voice notes → synthesis → notes pipeline (Pillar: voice notes) and make the tracking UX first-class (Pillar: tracking). These two complete the core loop: track what you read, capture what you thought.

**Key Differentiators:**
- Voice notes while reading — speak your thoughts, get structured notes auto-saved
- Private-first — your library is yours, not a social feed
- Reader intelligence — synthesis from voice notes feeds profile/recommendations
- Import from Goodreads/CSV — don't start from scratch

## Domain Glossary

| Term | Definition |
|------|-----------|
| **Listening Session** | A recording event tied to a book: audio → transcription → synthesis → notes |
| **Synthesis** | LLM-generated structured output (quotes, insights, questions) from a session transcript |
| **Artifact** | A synthesis output stored in the `synthesisArtifacts` table |
| **STT** | Speech-to-text. ElevenLabs (primary), Deepgram (fallback), AssemblyAI (candidate) |
| **Context Packer** | `lib/listening-sessions/contextPacker.ts` — token-budgeted context assembly for synthesis |
| **Profile** | Reader intelligence: preferences, voice-note summaries, recommendation context |
| **Pillar** | A major product capability tracked as an epic. Current: voice-notes, tracking, profile-recs |
| **State Machine** | Listening session lifecycle: idle → recording → uploading → transcribing → synthesizing → review → complete/failed |
| **Triple-write** | Anti-pattern in current completion path: session patch + notes insert + artifacts insert done separately (not transactional) |

## Active Focus

- **Milestone:** Now: Current Sprint — voice notes + synthesis pipeline
- **Key Issues:** #166 (voice notes pillar), #149 (STT gateway), #146 (recording UX), #169 (tracking UX)
- **Theme:** Complete the core capture loop — record a thought while reading → auto-saved structured note

## Quality Bar

- [ ] Voice note → structured note flow works end-to-end without manual steps
- [ ] Session completion is idempotent (retry-safe, no duplicate notes)
- [ ] All synthesis writes are transactional or at minimum idempotent by index check
- [ ] STT provider fallback is observable — logs which provider was used and why
- [ ] Test coverage on all state transitions (the state machine is the core invariant)
- [ ] Listening session list + detail pages feel polished (not prototype-quality)

## Patterns to Follow

### State Machine Transitions (Convex)
```typescript
// convex/listeningSessions.ts
// Always validate current state before transitioning
if (session.status !== "transcribing") throw new ConvexError("invalid transition");
await ctx.db.patch(session._id, { status: "synthesizing", ... });
```

### Idempotency via Index Check
```typescript
// Before any insert, check the index first
const existing = await ctx.db.query("transcripts").withIndex("by_session", q => q.eq("sessionId", sessionId)).first();
if (existing) return; // already persisted, safe to skip
await ctx.db.insert("transcripts", { ... });
```

### STT Gateway Pattern
```typescript
// lib/stt/gateway.ts — provider waterfall with fallback
const result = await gateway.transcribe(audio, { fallback: true });
// Logs provider used, latency, and confidence
```

## Lessons Learned

| Decision | Outcome | Lesson |
|----------|---------|--------|
| Triple-write on session completion | Not transactional — retries create duplicates | Use idempotency checks on all writes; consolidate to coordinator |
| Session guardrails as standalone script | Hard to mock, runs outside test framework | Migrate to vitest suite with proper Convex mocking |
| Audio stored as public blobs | Security risk — any URL == access | Always private blobs + auth-gated proxy for user data |

---
*Last updated: 2026-02-23*
*Updated during: /groom session*
