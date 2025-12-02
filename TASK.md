# Mass Cover Autofill & Backfill PRD

## 1. Executive Summary
- Manual per-book cover fetch leaves imports and new books with blank tiles; bad aesthetics, wasted clicks.
- Solution: server-side batched cover autofill using existing `coverFetch` helper, triggered after import, after create-without-cover, and via a tucked-away bulk button.
- Value: fewer manual actions, libraries feel complete faster; target ≥90% of imported books show a cover within 2 minutes of commit.
- Success metrics: cover completion rate 5 minutes post-import; median backfill run <15s for 20 books; error rate <5% per run; manual bulk button usage with <1 retry on average.

## 2. User Context & Outcomes
- Users: migrants importing Goodreads/CSV/TXT libraries; fast adders who skip cover uploads.
- Pain: blank cover placeholders, remembering to click Fetch Cover per book.
- Outcomes: covers appear automatically after import/create; optional re-run tool; never overwrite user-uploaded covers.

## 3. Requirements
### Functional
- F1 Auto fetch on import commit: after commit finishes, start backfill for books (created or merged) missing `coverUrl` and `apiCoverUrl`; non-blocking; return counts/errors.
- F2 Auto fetch on book create/update: when `books.create` completes without `coverUrl/apiCoverUrl`, trigger backfill for that book ID.
- F3 Manual bulk backfill: tucked-away control (Library toolbar overflow or Settings → Tools) labeled “Fetch missing covers”; runs backfill once, shows toast/progress; safe to re-run.
- F4 Idempotent + no overwrite: only fill `apiCoverUrl`/`apiSource` when both cover fields are empty; never touch `coverUrl`.
- F5 Batching: default limit 20 (max 50) per call; sequential fetch with existing 5s timeout per lookup; return `nextCursor` so caller can continue.
- F6 Error handling: per-book failure list; skip Google Books path when API key absent; partial success allowed.
- F7 Ownership/privacy: only operate on caller’s books; exclude titles/authors from logs/UI errors.
### Non-functional
- N1 Performance: single batch completes <15s for 20 books; import UI remains responsive.
- N2 Reliability: safe to retry; duplicate writes avoided by skip rules.
- N3 Observability: structured logs per run `{processed, updated, failures, duration}`.
- N4 Accessibility: keyboardable button; status via toast/aria-live.
- N5 Feature flag optional (`NEXT_PUBLIC_COVER_BACKFILL_ENABLED`, default on).
### Infrastructure requirements
- Quality gates: keep `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test`, `pnpm build:local`, lefthook hooks green.
- Observability: reuse `withObservability` for any new API route; structured console logs only.
- Design consistency: reuse `Button`, `DropdownMenu`, `Surface`, `useToast`; adhere to design tokens.
- Security: honor ownership checks; no PII in logs; keep `BLOB_READ_WRITE_TOKEN` and `GOOGLE_BOOKS_API_KEY` secret.
- Deployment: avoid schema changes for MVP; if added, update `convex/schema.ts` and `pnpm convex:push`.

## 4. Architecture Decision
### Selected approach: server-side batched backfill writing `apiCoverUrl`
- Add Convex action `books.fetchMissingCovers`:
  - Args: `{ limit?: number, cursor?: string, bookIds?: Id<"books">[] }` (bookIds optional for scoped runs).
  - Uses new internal query `internal.books.listMissingCovers` to fetch up to `limit` user books where `coverUrl` and `apiCoverUrl` are empty, ordered for pagination.
  - For each book call `internal.actions.coverFetch.search`; on success patch `apiCoverUrl`, `apiSource`, `updatedAt`; never touch `coverUrl`.
  - Returns `{ processed, updated, failures: Array<{bookId: Id<"books">; reason: string}>, nextCursor? }`; idempotent, safe to rerun.
- Triggers:
  - Import flow: after `commitImport` success, client calls `fetchMissingCovers` with `bookIds` returned from commit (or falls back to full scan).
  - Manual create: `books.create` already returns `Id`; `AddBookSheet` calls `fetchMissingCovers({ bookIds: [id] })` when no cover provided.
  - Manual tool: new “Fetch missing covers” action runs `fetchMissingCovers`, looping while `nextCursor` exists (optional in hardening).
- Why: reuses existing cover search, minimizes interface surface, avoids client image download/upload, no new schedulers.

### Alternatives (weighted: user value 40, simplicity 30, explicitness 20, risk 10; higher risk score = lower risk)
| Approach | User (x0.4) | Simplicity (x0.3) | Explicitness (x0.2) | Risk (x0.1) | Score | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| A) Selected: server action fills `apiCoverUrl` in batches | 9 | 8 | 8 | 8 | 8.4 | Chosen |
| B) Client batch uploads to Blob using existing button | 8 | 6 | 7 | 6 | 7.1 | Reject: heavy client bandwidth, token exposure, slower |
| C) Full job queue + scheduler + attempt tracking field | 9 | 4 | 6 | 5 | 6.5 | Reject: new infra for marginal gain |

Module boundaries: `internal.books.listMissingCovers` hides DB query/filter; `books.fetchMissingCovers` orchestrates fetching/writes; UI layers only call the action; logging lives in a tiny helper (extend `lib/import/metrics` or new `lib/cover/metrics`).

## 5. Data & API Contracts
- `books.fetchMissingCovers` (action): args above; returns `{ processed, updated, failures, nextCursor? }`.
- `internal.books.listMissingCovers` (internal query): args `{ userId, limit, cursor? }` or `{ bookIds }`; returns ordered books lacking covers.
- Import mutation (optional) returns `createdBookIds: Id[]` to scope backfill; additive, backward compatible.
- UI contract: “Fetch missing covers” button shows toast with `{updated}/{processed}`; if `nextCursor`, prompt to continue.

## 6. Implementation Phases
- MVP: implement action + internal query; add Library/Settings button; call action after `books.create` when no cover; hook Import success to run one batch (full-scan fallback).
- Hardening: auto-loop batches until `nextCursor` empty; add optional `lastCoverFetchAt` to reduce thrash; progress UI; per-book error surfacing.
- Future: optional Blob upload for permanence; scheduled refresh for stale `apiCoverUrl`; telemetry dashboard.

## 7. Testing & Observability
- Strategy: unit tests for `books.fetchMissingCovers` (mock coverFetch); integration for import flow auto-run; UI test for bulk button; regression for per-book `FetchCoverButton`.
- Coverage: 80%+ on new code, focus on branches around skip/overwrite rules.
- Observability: structured logs `{ processed, updated, failures, duration }`; no titles/authors; reuse `logImportEvent` style or new `logCoverEvent`.
- Alerting: none yet; log failure rate >10% as warning for manual follow-up.

```
## Test Scenarios
### Happy Path
- [ ] Import completes and backfill fills apiCoverUrl for new books lacking covers
- [ ] Manual add without cover triggers backfill and fills apiCoverUrl
- [ ] Bulk button runs backfill and returns counts to UI
### Edge Cases
- [ ] Books with existing coverUrl/apiCoverUrl are skipped (no overwrite)
- [ ] Batch limit respected; nextCursor returned when more remain
- [ ] Book without title/author/ISBN yields graceful failure entry
- [ ] Google Books API key missing falls back to Open Library without error
- [ ] Concurrent backfill calls do not double-write or throw
### Error Conditions
- [ ] External fetch timeout recorded as failure entry, others continue
- [ ] Unauthorized user access is blocked on action/query
- [ ] Import commit returns zero books; backfill no-ops cleanly
```

## 8. Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation | Owner |
| - | - | - | - | - |
| Large libraries → long action runtime | Med | Med | Batch + cursor; client loops batches | Eng |
| API coverage gaps | Med | Low | Fallbacks already present; surface failures; manual upload stays | Eng |
| Google Books quota/API key missing | High | Low | Treat as optional path; rely on Open Library | Eng |
| Remote URLs can break | Med | Med | Keep user-upload `coverUrl`; consider Blob copy later | Eng |
| Repeated failed attempts thrash APIs | Med | Low | Hardening: add `lastCoverFetchAt` + backoff | Eng |

## 9. Open Questions / Assumptions
- Where should the bulk button live—Library toolbar overflow vs Settings → Tools?
- Is storing `apiCoverUrl` (no Blob upload) sufficient, or do we need Blob for permanence?
- For import auto-run, is a full missing-cover scan acceptable, or must we target newly created IDs (requires mutation response change)?
- Should we add `lastCoverFetchAt/attempts` now to avoid repeated failures, or defer to hardening?
- Expected max library size? (drives batch size/defaults and UI progress affordance)
- Should this ship behind `NEXT_PUBLIC_COVER_BACKFILL_ENABLED` or always on?
