## Planning Report

**Spec**: DESIGN.md — Search + Cover Backfill (v1.0, 2025-11-29)  
**Tasks Generated**: 8  
**Total Estimate**: ~7.5h  
**Critical Path**: ~4h (Tasks 1 → 2 → 4 → 6)

### Task Summary
| Phase | Tasks | Estimate | Dependencies |
|-------|-------|----------|--------------|
| Backend | 2 | 2.5h | None |
| Logging | 1 | 0.5h | Backend Task 2 |
| UI Integration | 3 | 2.75h | Backend Task 2 |
| Quality | 2 | 1.75h | All above |

### Critical Path
1. Task 1 (1h) → 2. Task 2 (1.5h) → 4. Task 4 (0.75h) → 6. Task 6 (0.75h) = ~4h

### Risks
- Confirmation pending on bulk button placement and apiCoverUrl-only stance; note in Task 6 (can stub location).
- Large libraries could slow batches; keep limit cap and test cursors.

---

## TODO

- [x] 1) Add internal query `listMissingCovers`
  ```
  Files:
  - convex/books.ts (or new internal module) — add internalQuery listMissingCovers
  Goal: Return user-owned books with empty coverUrl/apiCoverUrl, paginated or scoped to bookIds.
  Approach:
  1. Define internalQuery args { bookId?:, bookIds?: Id[], limit?: number, cursor?: string } -> default limit 20, cap 50.
  2. If bookIds provided: fetch via getMany, filter ownership + missing covers, slice 50.
  3. Else query by_user index, filter missing covers, paginate, return items + nextCursor.
  4. Add missing-cover predicate helper to avoid duplication.
  Success Criteria:
  - Returns only caller-owned missing-cover books.
  - Paginates with limit and nextCursor.
  - bookIds path ignores cursor/limit but caps at 50.
  Tests:
  - Unit: returns only missing-cover books; respects ownership; pagination path; bookIds path filters non-owned.
  Estimate: 1h
  ```

- [x] 2) Implement action `fetchMissingCovers`
  ```
  Files:
  - convex/books.ts — add action export and handler per DESIGN pseudocode
  Goal: Batch-fetch covers via existing internal.actions.coverFetch.search and patch apiCoverUrl/apiSource.
  Approach:
  1. Auth with requireAuthAction.
  2. Clamp limit; call listMissingCovers with cursor/bookIds.
  3. Loop sequentially over results; on success patch { apiCoverUrl, apiSource, updatedAt }; on failure collect reason.
  4. Return { processed, updated, failures[], nextCursor }.
  5. Export in _generated/api update via convex codegen (note for runner).
  Success Criteria:
  - Skips books already having coverUrl/apiCoverUrl.
  - Does not throw on per-book failure; returns failure entries.
  - Never writes coverUrl.
  Tests:
  - Unit: success updates apiCoverUrl/apiSource; failures propagated; limit cap enforced; cursor passthrough.
  - Integration: mock coverFetch returning success/failure mix.
  Estimate: 1.5h
  Depends: Task 1
  ```

- [x] 3) Add logging helper `logCoverEvent`
  ```
  Files:
  - lib/cover/metrics.ts (new)
  - Optional: import in action to emit structured console log
  Goal: Structured, PII-free logs for backfill runs.
  Approach:
  1. Mirror import metrics helper; fields { phase:"backfill", processed, updated, failures, durationMs, batchSize, source }.
  2. Call from fetchMissingCovers with duration + counts.
  Success Criteria:
  - Logs without titles/authors.
  Tests:
  - Unit: spy console.info called with expected shape.
  Estimate: 0.5h
  Depends: Task 2
  ```

- [x] 4) Wire ImportFlow post-commit backfill
  ```
  Files:
  - components/import/ImportFlow.tsx
  Goal: After successful commit, trigger fetchMissingCovers (scoped to created/merged IDs if available).
  Approach:
  1. Capture created/merged IDs from commit response (add optional plumb if absent; else fallback to scan).
  2. Call useAction(api.books.fetchMissingCovers) once; toast progress/result.
  3. Failures: log count, no PII; keep UI responsive.
  Success Criteria:
  - Backfill called exactly once per successful import session.
  - No crash if action unavailable/flag off; shows graceful message.
  Tests:
  - Component test with mocked action to assert call params and toast copy.
  Estimate: 0.75h
  Depends: Task 2
  ```

- [x] 5) Fire backfill after manual create without cover
  ```
  Files:
  - components/book/AddBookSheet.tsx
  Goal: If user saves without coverUrl/apiCoverUrl, trigger one-shot fetchMissingCovers({ bookIds:[id] }).
  Approach:
  1. Detect absence of coverFile and apiCoverUrl before submit; store flag.
  2. After create resolves, if flag true, call action; ignore result errors (toast optional).
  Success Criteria:
  - Does not run when a cover was provided.
  - Does not block closing sheet; handles errors silently or with subtle toast.
  Tests:
  - Component test with mocked mutation/action ensuring conditional call.
  Estimate: 0.5h
  Depends: Task 2
  ```

- [~] 6) Add manual “Fetch missing covers” control
  ```
  Files:
  - components/book/BookGrid.tsx (toolbar overflow) OR app/(dashboard)/settings/tools.tsx (confirm location)
  - components/book/FetchMissingCoversButton.tsx (new)
  Goal: Provide tucked-away bulk trigger with progress/toast loop until cursor exhausted.
  Approach:
  1. Create button component that loops calling fetchMissingCovers while nextCursor present; shows loading state and final toast with updated/processed counts.
  2. Insert button in chosen location; hide behind NEXT_PUBLIC_COVER_BACKFILL_ENABLED flag if set.
  3. Accessibility: aria-live for status, keyboardable.
  Success Criteria:
  - Handles multiple batches seamlessly.
  - UI remains usable during run; disables button while active.
  - No PII in toasts.
  Tests:
  - Component test mocking paginated responses; asserts multiple calls and final toast text.
  Estimate: 0.75h
  Depends: Task 2 (and placement decision)
  ```

- [ ] 7) Update generated Convex types and exports
  ```
  Files:
  - convex/_generated/api.d.ts (via pnpm convex:codegen) — not committed if auto-gen
  Goal: Ensure new action/internal query available to client.
  Approach:
  1. Run pnpm convex:codegen after backend changes.
  2. Verify type usage in hooks/components compiles.
  Success Criteria:
  - TypeScript passes on new api references.
  Tests:
  - tsc --noEmit (part of validate).
  Estimate: 0.5h
  Depends: Tasks 1-2
  ```

- [ ] 8) Quality gate + validation sweep
  ```
  Files:
  - n/a (commands)
  Goal: Ship-ready checks per repo standards.
  Approach:
  1. pnpm lint
  2. pnpm tsc --noEmit
  3. pnpm test (focus on new/affected tests)
  4. pnpm build:local if time
  Success Criteria:
  - All commands pass; failures triaged.
  Estimate: 1.25h
  Depends: all prior tasks
  ```

---

## Notes / Boundaries
- Not building Blob copy of api covers in this slice.
- No scheduler/cron introduced.
- UI placement for bulk button needs confirmation; choose Library toolbar overflow by default if no guidance.
