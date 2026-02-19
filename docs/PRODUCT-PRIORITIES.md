# Product Priorities

Last updated: 2026-02-19

This is the source of truth for what we build next.

## Primary User Outcomes

1. Track books fast and accurately across three lists:
   - read
   - currently-reading
   - want-to-read
2. Capture reading notes by voice, then turn them into useful synthesized notes.
3. Generate genuinely insightful reader profiles and recommendations from:
   - reading history (read)
   - active momentum (currently-reading)
   - stated intent (want-to-read)
   - voice-note synthesis artifacts

## Pillar 1: Core Tracking (P1)

Epic: #165

### Goal

Make status tracking feel instant, obvious, and trustworthy.

### `now`

- #169 Tracking UX: first-class read/currently-reading/want-to-read lanes
- #36 External book search (Google Books API)
- #34 Export library to JSON/CSV/Markdown

### `next`

- #32 Queue sorting: date, alphabetical, shuffle
- #60 CMD+K command palette for library search
- #56 Improve form validation and error messages
- #54 Consolidate book filtering to single pass

## Pillar 2: Voice Notes + Synthesis (P1)

Epic: #166

### Goal

One-tap voice capture that is secure, durable, and useful.

### `now`

- #160 Listening sessions: make audio blobs private
- #159 Listening sessions: durable server-side processing + retry
- #147 [Listening Sessions] Implement resilient audio capture and chunk upload
- #146 [Listening Sessions] Build recording UX on book detail page
- #145 [Listening Sessions] Add Convex data model and state machine
- #144 [Listening Sessions] STT benchmark + provider decision matrix

### `next`

- #158 Add tests for listening session recorder lifecycle
- #155 [Listening Sessions] Add reliability test suite for long sessions and rollover
- #154 [Listening Sessions] Add observability, fallback telemetry, and cost guardrails
- #153 [Listening Sessions] Build synthesis review and publish workflow
- #152 [Listening Sessions] Build context packer for personalized synthesis
- #151 [Listening Sessions] Implement multi-stage synthesis pipeline with schema validation
- #150 [Listening Sessions] Persist transcripts and auto-save raw transcript notes
- #149 [Listening Sessions] Build STT gateway with provider adapters and fallback policy

## Pillar 3: Profile Intelligence + Recommendations (P1)

Epic: #167

### Goal

Recommendations should feel specific, personal, and explainable.

### `next`

- #170 Profile intelligence: weight read/currently-reading/want-to-read signals explicitly
- #168 Recommendations: incorporate voice-note synthesis artifacts into profile context
- #33 AI-powered reading recommendations
- #77 AI Features Phase 1: embeddings, semantic search, recommendations
- #59 Public user profiles
- #57 Reading analytics dashboard

## What Is Deprioritized

These stay in backlog until they support one of the three primary outcomes:

- launch channel tasks (#91, #92)
- monetization/packaging expansion (#82, #89)
- platform expansion (#78, #108)
- non-essential polish bundles (#72, #83)

## Backlog Policy

- `now`: directly unblocks one of the three primary outcomes in current sprint.
- `next`: important follow-up after current blockers land.
- `later`: not in active planning horizon.

If work does not clearly improve one of the three primary outcomes, default it to `later`.
