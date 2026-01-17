# Flow Diagrams

Mermaid diagrams for complex state machines and data flows in bibliomnomnom.

## Documented Flows

### Complex State Machines (Diagrammed)

| Flow                                            | File                                      | States   | Bug Potential                          |
| ----------------------------------------------- | ----------------------------------------- | -------- | -------------------------------------- |
| [Import Flow](./import-flow.md)                 | `hooks/useImportJob.ts`                   | 7 states | High - async, pagination, LLM          |
| [Photo Quote Capture](./photo-quote-capture.md) | `components/notes/PhotoQuoteCapture.tsx`  | 5 states | Medium - OCR timeout, image processing |
| [Profile Generation](./profile-generation.md)   | `components/profile/ProfilePage.tsx`      | 6 states | Medium - long-running AI generation    |
| [User Provisioning](./user-provisioning.md)     | `app/ConvexClientProvider.tsx`            | 3 states | High - first-login race condition      |
| [Subscription Banner](./subscription-banner.md) | `components/subscription/TrialBanner.tsx` | 4 states | Low - display only                     |
| [Stripe Subscription](./stripe-subscription.md) | `convex/subscriptions.ts`, `api/stripe/*` | 6 states | High - payments, webhooks, race conds  |

### Complex Forms (Diagrammed)

| Flow                                          | File                                   | Complexity                             |
| --------------------------------------------- | -------------------------------------- | -------------------------------------- |
| [Add Book Sheet](./add-book-sheet.md)         | `components/book/AddBookSheet.tsx`     | 15+ state variables, multiple sources  |
| [Book Cover Manager](./book-cover-manager.md) | `components/book/BookCoverManager.tsx` | 4 cover sources, async upload/download |

## Undocumented (Simple Enough)

These components have state but follow simple patterns:

### Linear Async (idle -> loading -> success/error)

- `BookSearchInput` - debounced search with dropdown
- `CoverPicker` - search and select cover
- `FetchMissingCoversButton` - paginated background job
- `BookForm` - form validation and submit
- `CreateNote` - expand, edit, save

### Simple Boolean Flags

- `BookDetail` - `isTogglingFavorite`, `isTogglingAudiobook`, etc.
- `UploadDropzone` - `dragActive`, `error`
- `ThemeToggle` - dark/light toggle

## When to Add a Diagram

Add a flow diagram when:

1. More than 3 states with non-linear transitions
2. Race conditions or async coordination needed
3. Error recovery paths are non-obvious
4. New developer would struggle to trace the flow

## Mermaid Resources

- [State Diagram Docs](https://mermaid.js.org/syntax/stateDiagram.html)
- [Sequence Diagram Docs](https://mermaid.js.org/syntax/sequenceDiagram.html)
- [Flowchart Docs](https://mermaid.js.org/syntax/flowchart.html)
