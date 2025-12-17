# TODO.md
Last updated: 2025-12-16

## PR #25 — Import date handling + deterministic markdown

### Blockers
- [ ] Year header always flips to `books-by-year` (even from `currently-reading`); add regression test. — `lib/import/client/readingSummary.ts`, `__tests__/import/reading-summary.test.ts` (https://github.com/misty-step/bibliomnomnom/pull/25#discussion_r2621401942)
- [ ] No partial-parse short-circuit: only skip LLM when deterministic parse is complete (or prove no book-ish lines skipped); add mixed-format test. — `lib/import/client/readingSummary.ts`, `hooks/useImportJob.ts`, `__tests__/import/reading-summary.test.ts` (https://github.com/misty-step/bibliomnomnom/pull/25#discussion_r2621465465)

### In-scope
- [ ] SPEC.md fenced diagram uses language id (markdownlint). — `SPEC.md` (CodeRabbit nitpick)

## PR #20 — Photo → OCR → Quote

### Done
- [x] Fix modal unmount-on-click (Radix portal vs CreateNote outside-click collapse) — `components/notes/CreateNote.tsx`
- [x] OCR route: auth + validation + size limits + better errors — `app/api/ocr/route.ts`
- [x] OCR model default: `google/gemini-2.5-flash` — `app/api/ocr/route.ts`
- [x] Client: preview + transcode phone photos under 5MB before OCR — `components/notes/PhotoQuoteCapture.tsx`, `lib/ocr/limits.ts`
- [x] Preserve paragraph breaks (don’t keep line-wrap newlines) — `lib/ocr/format.ts`
- [x] UX: show photo + editable text before saving quote (mobile-first) — `components/notes/PhotoQuoteCapture.tsx`
- [x] Tests: UI regression + route formatting/errors — `components/notes/*.test.tsx`, `app/api/ocr/__tests__/route.test.ts`, `lib/ocr/*.test.ts`

### Follow-ups
- [ ] Server-side OCR rate limiting (durable store) — `BACKLOG.md#L721`
- [ ] Consider `useReducer` for PhotoQuoteCapture state machine (if callbacks/complexity grow) — `components/notes/PhotoQuoteCapture.tsx`
