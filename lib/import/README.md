# Import Module

Book data import pipeline: parsing, deduplication, and batch commit.

## Entry Points

| File       | Purpose                                              |
| ---------- | ---------------------------------------------------- |
| `types.ts` | Shared types, schemas, constants                     |
| `llm.ts`   | LLM-based extraction for unstructured text (md, txt) |

## Submodules

### `client/` - Frontend Parsers

Pure functions that run in the browser. No network calls.

- `goodreads.ts` - Goodreads CSV export parser
- `csvInfer.ts` - Generic CSV column inference
- `readingSummary.ts` - Markdown reading list parser (disabled, LLM-only now)

### `dedup/` - Duplicate Detection

Matches incoming books against existing library.

- `core.ts` - Matching algorithm (ISBN, title-author, apiId)
- `repository.ts` - Fetch existing books for comparison

### `repository/` - Data Access

Repository pattern for database operations. Enables testing with in-memory implementations.

- `interfaces.ts` - `BookRepository`, `ImportRunRepository`, `ImportPreviewRepository`
- `convex.ts` - Convex implementations
- `memory.ts` - In-memory implementations for tests

## Data Flow

```
File Upload
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Client Parsers (browser)                       │
│  goodreads.ts / csvInfer.ts                     │
│  → ParsedBook[]                                 │
└─────────────────────────────────────────────────┘
    │                           │
    │ (structured CSV)          │ (unstructured text)
    ▼                           ▼
┌───────────────────┐   ┌─────────────────────────┐
│ Direct to preview │   │ LLM Extraction          │
│                   │   │ llm.ts (Convex action)  │
│                   │   │ → ParsedBook[]          │
└───────────────────┘   └─────────────────────────┘
    │                           │
    └───────────┬───────────────┘
                ▼
┌─────────────────────────────────────────────────┐
│  Dedup (dedup/core.ts)                          │
│  Match against existing books                   │
│  → DedupMatch[]                                 │
└─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│  Preview UI (components/import/)                │
│  User reviews matches, decides: skip/merge/create│
└─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│  Commit (convex/imports.ts)                     │
│  Apply decisions to database                    │
│  → CommitSummary                                │
└─────────────────────────────────────────────────┘
```

## Key Types

```typescript
// A book extracted from import source
type ParsedBook = {
  tempId: string; // Client-generated ID for tracking
  title: string;
  author: string;
  status?: ImportStatus;
  isbn?: string;
  // ... other optional fields
};

// A potential duplicate match
type DedupMatch = {
  tempId: string;
  existingBookId: Id<"books">;
  matchType: "isbn" | "title-author" | "apiId";
  confidence: number;
};

// User's decision for a duplicate
type DedupDecision = {
  tempId: string;
  action: "skip" | "merge" | "create";
  fieldsToMerge?: string[];
};
```

## Constants

- `IMPORT_PAGE_SIZE = 300` - Batch size for preview/commit
- `LLM_TOKEN_CAP = 500_000` - Max tokens for LLM extraction

## Related

- `hooks/useImportJob.ts` - React state machine for import flow
- `convex/imports.ts` - Server-side mutations/actions
- `components/import/` - UI components

## Depth Assessment

This module is **medium-deep**: moderate interface complexity (types, parsers, dedup) hiding significant implementation (LLM prompts, matching algorithms, repository pattern). The repository pattern adds abstraction but enables testability.

Consider refactoring if:

- LLM extraction moves to dedicated service
- More import formats added (would warrant format adapter pattern)
