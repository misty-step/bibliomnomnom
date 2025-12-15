# Import Library: Proper Date Handling

## Problem Statement

When importing books from Goodreads CSV or markdown reading logs, the import flow mishandles dates and read counts:
1. **Goodreads CSV**: `Date Added` is incorrectly mapped to `dateStarted` (it's actually when the book was added to *any* shelf, not when reading began)
2. **LLM extraction**: Fails to parse `dateFinished` from formats like `*(Nov 21)*` where the year is implicit from section headers (e.g., `### 2025`)
3. **Both paths**: Books imported with status "read" have `timesRead: 0` instead of `1`

**Principle**: Empty data is better than false data. We should never synthesize dates when actual dates aren't available — but we should extract dates that ARE available in the source.

## User Personas

### Primary: Reader with Personal Markdown Reading Log
- **Context**: Importing 300-400 books from a structured markdown file (READING_SUMMARY.md format) with books grouped by year
- **Pain Point**: Dates like `*(Nov 21)*` under a `### 2025` header aren't being parsed — LLM doesn't combine the partial date with the section year
- **Goal**: Extract `dateFinished` by combining month/day with the section year
- **Success**: All books import with correct finish dates; "Currently Reading" section has no dates

### Secondary: Voracious Reader Migrating from Goodreads
- **Context**: Importing 100-400 books from Goodreads CSV export
- **Pain Point**: Goodreads "Date Added" is mapped to `dateStarted` (wrong — it's when book was shelved, not when reading began)
- **Goal**: Preserve accurate reading history; dates should reflect reality or be blank
- **Success**: `dateStarted` is blank (not fabricated); `dateFinished` preserved from "Date Read" column

## User Stories & Acceptance Criteria

### Story 1: Goodreads CSV imports don't fabricate `dateStarted`

As a reader importing from Goodreads, I want `dateStarted` to be empty rather than incorrectly set to `Date Added`, so that my reading statistics aren't corrupted.

**Acceptance Criteria**:
- [ ] `Date Added` column is NOT mapped to `dateStarted`
- [ ] `dateStarted` is `undefined` for all Goodreads imports (the CSV doesn't export start dates)
- [ ] Existing behavior for `dateFinished` (from `Date Read`) remains unchanged

### Story 2: LLM extraction parses year-contextual dates from markdown

As a reader importing from markdown, I want dates like `*(Nov 21)*` under a `### 2025` header to be correctly parsed as November 21, 2025.

**Acceptance Criteria**:
- [ ] LLM prompt explicitly instructs extraction of finish dates with year context from section headers
- [ ] Books under year headers (e.g., `### 2025`) have `dateFinished` set correctly
- [ ] Books in "Currently Reading" section have no `dateFinished`
- [ ] `dateStarted` remains empty (not available in this format)
- [ ] Test passes with actual READING_SUMMARY.md format from `../vanity/READING_SUMMARY.md`

### Story 3: Books with status "read" have `timesRead: 1`

As a reader importing finished books, I want `timesRead` set to 1 for "read" books, so my statistics correctly show I've read each book at least once.

**Acceptance Criteria**:
- [ ] Books created via import with `status: "read"` have `timesRead: 1`
- [ ] Books created via import with other statuses have `timesRead: 0`
- [ ] Merged books: if existing `timesRead` is 0 and incoming status is "read", set to 1

## UX Flow

No UI changes required. This is a data processing fix that affects:

```
[File Upload] → [Parse/Extract] → [Preview] → [Commit]
                      ↑
               Dates handled here
```

**Affected code paths**:
1. `lib/import/client/goodreads.ts:184` — Stop mapping `Date Added` to `dateStarted`
2. `lib/import/llm.ts:50-68` — Update prompt to extract year-contextual dates from markdown section headers
3. `lib/import/dedup.ts:77` — Set `timesRead: 1` for status "read" in `buildNewBook()`
4. `lib/import/dedup.ts:45-55` — Handle merge case for `timesRead`

## Success Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|--------------|
| Incorrect `dateStarted` values | ~100% of Goodreads imports | 0% | Test suite |
| `timesRead` for "read" books | 0 | 1 | Test suite |
| Date parsing from READING_SUMMARY.md | ~0% | >95% | Test with actual file |

## Non-Goals (Explicit Scope Boundaries)

- **Retroactive data fix**: Not fixing existing imported books (requires migration)
- **Start date inference**: We won't infer `dateStarted` from any heuristic
- **Goodreads scraping**: We won't add scraping to get richer data than the CSV provides
- **UI changes**: No preview warnings or date explanations
