## TODO — Flexible Import System (2025-11-20)

- [x] Define shared import types & validators
  ```
  Files:
  - lib/import/types.ts
  - lib/import/status.ts (status mapping helper)
  Goal: Single source of truth for ParsedBook/PreviewResult/DedupDecision + status mapping + constants (pageSize=300, tokenCap≈60000).
  Approach:
  1. Declare TS interfaces per DESIGN.md Data & API Contracts; export normalization helpers (trim, collapse spaces, status map).
  2. Add Convex validators/zod schemas reused by client parsers, actions, and tests.
  3. Export factory for tempId (uuid) to keep consistent between client/server tests.
  Success Criteria:
  - [ ] No `any`; types compile across client/server.
  - [ ] Status map matches spec (read/currently-reading/to-read→want-to-read; unknown→want-to-read + warning hook ready).
  - [ ] Constants reused by downstream tasks (page size, token cap).
  Tests:
  - Unit: lib/import/types.test.ts covering status mapping + normalization helpers.
  Estimate: 0.75h
  ```

- [x] Add Convex importRuns table for idempotency/rate limits
  ```
  Files:
  - convex/schema.ts
  Goal: Persist importRunId status/counts with by_user_run index; ready for convex:push.
  Approach:
  1. Define importRuns table per DESIGN (status, page, totalPages, counts, errorMessage, timestamps).
  2. Add index by_user_run (userId, importRunId); ensure types generated.
  3. Document requirement to run `pnpm convex:push` post-change.
  Success Criteria:
  - [ ] Schema compiles; convex codegen runs locally.
  - [ ] Index present; types available to actions.
  - [ ] No breaking changes to existing tables.
  Tests:
  - Static: pnpm lint (schema) + codegen typecheck.
  Dependencies: Define shared import types & validators
  Estimate: 0.75h
  ```

- [x] Implement Goodreads CSV parser (client)
  ```
  Files:
  - lib/import/client/goodreads.ts
  - __tests__/import/goodreads.test.ts
  Goal: Deterministic Goodreads v2 CSV parser producing ParsedBookDraft[] with status mapping and warnings.
  Approach:
  1. Parse headers, validate required fields (title/author), normalize strings, strip BOM.
  2. Map shelves to statuses per spec; flag unknown shelves as warnings and default want-to-read.
  3. Emit tempIds, capture optional fields (isbn, edition, publishedYear, pageCount, isAudiobook, isFavorite, coverUrl, dates).
  Success Criteria:
  - [ ] 200-row sample parses <5s in test environment.
  - [ ] Unknown/empty required fields throw structured ParseError with line/column.
  - [ ] Warnings surfaced for unmapped shelves/columns.
  Tests:
  - Unit: happy path v2 CSV; malformed row; shelf mapping; unicode trim.
  Dependencies: Define shared import types & validators
  Estimate: 1.25h
  ```

- [x] Implement generic CSV inference parser
  ```
  Files:
  - lib/import/client/csvInfer.ts
  - __tests__/import/csvInfer.test.ts
  Goal: Infer columns from unknown CSV (title/author required) with fallback warnings; detect sourceType=csv vs unknown.
  Approach:
  1. Header sniffing for common aliases (name/book_title vs title, writer vs author, isbn13, year, pages, audiobook flag).
  2. Normalize strings, enforce required fields, paginate-friendly output with tempIds.
  3. Return warnings for missing required columns or extra fields ignored.
  Success Criteria:
  - [ ] Parses common aliases; fails fast on missing title/author with actionable message.
  - [ ] Marks sourceType=csv; passes normalized rows to preview.
  - [ ] Handles >300 rows without blocking main thread (chunked parse or async/worker-ready structure).
  Tests:
  - Unit: alias coverage, missing required, large row batch performance (mock timing), unicode handling.
  Dependencies: Define shared import types & validators
  Estimate: 1.25h
  ```

- [x] Build dedup engine + normalization helpers
  ```
  Files:
  - lib/import/dedup.ts
  - lib/import/normalize.ts
  - __tests__/import/dedup.test.ts
  Goal: Match incoming rows to existing books and apply merge/skip/create safely (fill blanks only).
  Approach:
  1. Implement normalization (lowercase, ascii fold, strip punctuation/spaces, strip isbn dashes).
  2. findMatches(ctx, rows): query by isbn > normalized title+author > apiId; include confidence.
  3. applyDecision(existing, incoming, decision): merge only empty fields; never overwrite status/isFavorite/isAudiobook/cover.
  Success Criteria:
  - [ ] Priority order enforced; duplicate match returns deterministic best candidate.
  - [ ] Merge leaves existing non-empty fields untouched; skip is default.
  - [ ] Functions reusable by actions with no DB coupling in helpers.
  Tests:
  - Unit: normalization edge cases; merge behavior; match priority ordering.
  Dependencies: Define shared import types & validators; Add Convex importRuns table (for types)
  Estimate: 1.5h
  ```

- [x] Implement LLM extraction for TXT/MD/unknown CSV
  ```
  Files:
  - lib/import/llm.ts
  - __tests__/import/llm.test.ts (mocked providers)
  Goal: Chunked GPT-5.1/Gemini extraction to ParsedBookDraft[] with token cap and validation.
  Approach:
  1. Implement chunker (~8k tokens) and token budget enforcement (~60k); short-circuit with error on cap.
  2. Build prompt enforcing schema + no hallucinated fields; temperature 0.2; max tokens 1.5k/chunk.
  3. Post-validate with shared validators; drop invalid rows; emit warnings; provider fallback Gemini when OpenAI fails.
  Success Criteria:
  - [ ] Returns deterministic schema; errors include retry guidance for timeout/token cap.
  - [ ] Respects privacy: no raw file storage/logging; redacts emails/notes.
  - [ ] Can be invoked server-side only (tree-shaken from client bundle).
  Tests:
  - Unit: chunking/tokens math; error paths; provider fallback; schema validation with mocked responses.
  Dependencies: Define shared import types & validators
  Estimate: 1.5h
  ```

- [x] Add Convex preparePreview action
  ```
  Files:
  - convex/imports.ts (action section)
  - __tests__/import/imports.action.test.ts
  Goal: Action validates auth, enforces rate limits, routes parsing/LLM, runs dedup, persists importRuns preview state.
  Approach:
  1. Require auth; check daily/concurrent limits using importRuns and storage.
  2. If sourceType goodreads/csv: trust client rows (validated); else call llmExtract; collect warnings.
  3. Call findMatches; write/patch importRuns row (status=previewed, counts.rows, page/totalPages); return PreviewResult with warnings + dedupMatches + importRunId.
  Success Criteria:
  - [ ] Idempotent per importRunId/page; repeat call returns same preview.
  - [ ] Rate limit errors return ConvexError with user-safe message.
  - [ ] Structured log emitted (userId, importRunId, sourceType, counts, tokenUsage, ms) without PII.
  Tests:
  - Integration: preview happy path, rate limit, idempotent repeat, LLM failure fallback, warning passthrough.
  Dependencies: Add Convex importRuns table; Build dedup engine + normalization; Implement LLM extraction
  Estimate: 1.5h
  ```

- [x] Add Convex commitImport mutation
  ```
  Files:
  - convex/imports.ts (mutation section)
  - __tests__/import/imports.commit.test.ts
  Goal: Idempotent commit of decisions per page with merge/skip/create, counts, and progress update.
  Approach:
  1. Require auth; load importRun by userId/importRunId; reject if not previewed or page mismatch.
  2. Validate decisions tempIds exist; for merge/create applyDecision and insert/patch; skip default.
  3. Update counts + run.status=committed, page progress; emit summary; lock against parallel commits for same run.
  Success Criteria:
  - [ ] Re-running commit with same input is noop (idempotent by importRunId+page).
  - [ ] Merge never overwrites non-empty protected fields; skips when conflict.
  - [ ] Summary returns created/merged/skipped/errors as integers; errors collected not thrown.
  Tests:
  - Integration: merge respects blanks, create path, skip default, idempotency, concurrent commit guard.
  Dependencies: Add Convex preparePreview action
  Estimate: 1.5h
  ```

- [x] Wire observability + rate-limit counters
  ```
  Files:
  - convex/imports.ts
  - lib/import/metrics.ts (helper for structured logs/events)
  Goal: Logging/metrics for preview/commit + rate-limit counters per spec; optional Sentry hooks.
  Approach:
  1. Add helper to emit structured logs with importRunId/userId/sourceType/counts/tokenUsage/latency.
  2. Track daily + concurrent counters in Convex storage/importRuns; expose reusable guard used by action/mutation.
  3. Hook optional Sentry tags if env present; ensure redaction (no titles text).
  Success Criteria:
  - [ ] Logs produced on success/failure; cost/latency visible in dev console.
  - [ ] Rate limits shared between preview/commit; errors surfaced politely.
  - [ ] No PII in logs.
  Tests:
  - Unit: metrics helper redacts fields; rate-limit guard logic; integration reuse in preview/commit tests.
  Dependencies: Add Convex preparePreview action; Add Convex commitImport mutation
  Estimate: 0.75h
  ```

- [x] Implement import job hook (state machine)
  ```
  Files:
  - hooks/useImportJob.ts
  - __tests__/import/useImportJob.test.ts
  Goal: Client hook managing states (idle→parsing→previewing→ready→committing→success/error) with pagination and retry.
  Approach:
  1. Accept file; detect type; call client parser; slice pages (size 300); call preparePreview per page.
  2. Track decisions per tempId default skip; expose setters; keep raw file buffer for retries.
  3. Expose progress info and commitPage function calling commitImport; handle errors by keeping state.
  Success Criteria:
  - [ ] Hook API stable; no implicit globals; works without UI.
  - [ ] Supports >1 page; preserves decisions when moving pages.
  - [ ] Errors surface with retry info; cancel resets state.
  Tests:
  - Unit: state transitions, pagination, decision persistence, error handling (mock actions).
  Dependencies: Implement Goodreads CSV parser; Implement generic CSV inference parser; Add Convex preparePreview action; Add Convex commitImport mutation
  Estimate: 1h
  ```

- [x] Build import UI shell (Upload → flow scaffold)
  ```
  Files:
  - components/import/ImportFlow.tsx
  - components/import/UploadDropzone.tsx
  - components/import/CommitSummary.tsx
  Goal: Wizard scaffold with dropzone, stepper, spinner, summary; accessible and token-compliant.
  Approach:
  1. Dropzone: accept CSV/TXT/MD up to 10MB; keyboard operable; show file meta + errors.
  2. Flow: hook into useImportJob; manage steps; show progress bar and toasts; keep feature flag `IMPORT_ENABLED` gate.
  3. Summary: renders success/partial failure counts + retry button using hook API.
  Success Criteria:
  - [ ] Keyboard-only path; SR labels for buttons/inputs; focus management between steps.
  - [ ] Kill switch respected; UI hidden/disabled when flag off.
  - [ ] Uses shadcn primitives + Bone/Ink tokens; no new colors.
  Tests:
  - Component tests: dropzone accepts/rejects files; step transitions; feature flag gating.
  Dependencies: Implement import job hook (state machine)
  Estimate: 1.5h
  ```

- [x] Build preview table + dedup controls
  ```
  Files:
  - components/import/PreviewTable.tsx
  - components/import/DedupControls.tsx
  Goal: Paginated table (300 rows/page) with decision selectors (skip/merge/create), warnings, badges for matches.
  Approach:
  1. Render paginated data from hook; table rows show title/author/status/isbn/edition/year/pageCount/isAudiobook/isFavorite/privacy/cover.
  2. Dedup controls per row: radio/select default skip; disable invalid merges; show match type/confidence badge.
  3. A11y: focus order, aria descriptions for warnings/errors; keyboard navigation.
  Success Criteria:
  - [ ] Performance: renders 300 rows smoothly; memoization where needed.
  - [ ] Decisions update hook state; pagination retains choices.
  - [ ] Warnings visible; error banner for malformed rows without breaking table.
  Tests:
  - Component tests with Testing Library: pagination, decision selection, warning visibility, performance smoke (virtualized render snapshot acceptable).
  Dependencies: Build import UI shell (Upload → flow scaffold)
  Estimate: 1.5h
  ```

- [ ] Document env/flags & limits
  ```
  Files:
  - README.md (import section)
  - .env.example
  Goal: Capture IMPORT_ENABLED flag, OPENAI_API_KEY/GEMINI_API_KEY, rate-limit defaults, and privacy notes.
  Approach:
  1. Add env vars with brief descriptions and required/optional markers.
  2. Document kill switch usage and rate-limit defaults; mention `pnpm convex:push` after schema change.
  3. Note privacy posture: client-side parsing for CSV; LLM redaction; no raw file storage.
  Success Criteria:
  - [ ] Env example aligns with code; no secrets committed.
  - [ ] Setup steps clear enough for new engineer to run import feature.
  Tests:
  - Documentation review only; verify lint does not fail on markdown (if lint rule exists).
  Dependencies: Add Convex importRuns table; Add Convex preparePreview action
  Estimate: 0.5h
  ```

- [ ] Wire analytics/observability in client flow
  ```
  Files:
  - components/import/ImportFlow.tsx
  - lib/import/metrics.ts (reuse) or new client logger
  Goal: Emit structured events (import_started/parse_failed/import_committed) without PII; surface error toasts.
  Approach:
  1. Hook into useImportJob transitions to log events with counts only (no titles) to console or Sentry if configured.
  2. Add progress duration capture (start→preview, commit duration) for SLA tracking.
  3. Ensure logs gated behind IMPORT_ENABLED and not emitted in tests unless mocked.
  Success Criteria:
  - [ ] Events fire once per stage; payload excludes titles/authors.
  - [ ] Errors show user-friendly toast, keep state for retry.
  - [ ] No crashes when Sentry absent.
  Tests:
  - Unit/component: spy on logger; ensure events sequence on happy path + error path.
  Dependencies: Build import UI shell (Upload → flow scaffold); Wire observability + rate-limit counters
  Estimate: 0.75h
  ```

- [ ] Add CI/quality gates for import modules
  ```
  Files:
  - .github/workflows/ci.yml (new or extend)
  - package.json (scripts if needed)
  - lefthook.yml (if present)
  Goal: Ensure lint+vitest run against new import codepaths.
  Approach:
  1. Add/extend CI workflow to run `pnpm lint` and `pnpm test -- --runInBand` (or suitable) covering import tests.
  2. If lefthook exists, ensure import tests included in git hooks; otherwise skip hook change.
  3. Document in README how to run tests locally.
  Success Criteria:
  - [ ] CI passes after implementing feature; failing tests block.
  - [ ] Scripts use pnpm and respect existing config.
  Tests:
  - CI workflow dry-run locally if possible; check lint/test commands succeed.
  Dependencies: All test suites added above
  Estimate: 0.5h
  ```

---

Critical path (time): types → schema → parsers → dedup → llm → preparePreview → commitImport → hook → UI shell → preview controls (≈14h). Non-critical: docs/client analytics/CI add ~2.5h.

Out of scope (explicit): ratings/reviews import, cover fetching from external APIs, import history UI, background jobs, overwriting user-edited fields, scheduled syncs.
