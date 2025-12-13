# TODO.md
Last updated: 2025-12-13

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

