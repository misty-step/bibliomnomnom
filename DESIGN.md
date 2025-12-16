# Design: Import Library — Proper Date Handling

Source: `TASK.md`, `SPEC.md`.

## Architecture Overview
**Selected Approach**: Deterministic parsing for known markdown reading-log format + stricter import normalization.

**Rationale**: Markdown reading logs are structured; parsing them without LLM removes randomness + cost. LLM stays as fallback for unstructured text, with a prompt upgraded to handle “year header → month/day” context when used. Goodreads CSV fix is pure correctness (stop fabricating `dateStarted`). `timesRead` fix is a data integrity invariant for imported “read” books.

**Core Modules**
- `GoodreadsCsvParser` (`lib/import/client/goodreads.ts`) — parse Goodreads export; never infer start dates.
- `ReadingSummaryParser` (`lib/import/client/readingSummary.ts`) — parse `READING_SUMMARY.md`-style markdown with year-context dates.
- `LlmExtract` (`lib/import/llm.ts`) — fallback extractor; prompt explicitly describes year-context date rules.
- `DedupHelpers` (`lib/import/dedup.ts`) — enforces `timesRead` invariant on create/merge.

**Data Flow**
User → `ImportFlow` → `useImportJob` → (CSV parser | ReadingSummaryParser | LLM action) → `imports.preparePreview` → Preview UI → `imports.commitImport` → `books` table.

**Key Decisions**
1. **Empty > wrong**: never map Goodreads `Date Added` to `dateStarted`.
2. **Deterministic for known format**: parse year headers + `(Mon D)` dates ourselves; don’t ask an LLM to do algebra.
3. **Invariant**: `status:"read"` implies `timesRead >= 1` for imported books (create + merge repair).

## Module: GoodreadsCsvParser
Responsibility: parse Goodreads CSV into `ParsedBook[]` without fabricating dates.

Public Interface:
```ts
export type ClientParseResult = {
  sourceType: "goodreads-csv";
  rows: ParsedBook[];
  warnings: string[];
  errors: ParseError[];
};

export function parseGoodreadsCsv(fileText: string): ClientParseResult;
```

Changes
- Stop mapping `Date Added` → `dateStarted`.
- Keep mapping `Date Read` → `dateFinished`.

Error Handling
- Missing `title`/`author` → row error, skip row.
- Unknown shelf → warning + default status.

## Module: ReadingSummaryParser
Responsibility: parse the repo’s markdown reading-log format (see `__tests__/fixtures/reading-sample.md`) and extract finish dates using year headers.

Public Interface:
```ts
export type ReadingSummaryParseResult = {
  matched: boolean;          // true => safe/complete parse; false => caller should fall back (LLM, etc)
  rows: ParsedBook[];
  warnings: string[];
  errors: ParseError[];
};

export function parseReadingSummaryMarkdown(markdown: string): ReadingSummaryParseResult;
```

Format Assumptions (explicit)
- Contains sections like `## Currently Reading` and `## Books by Year`.
- Year blocks like `### 2025` (optionally `### 2025 (N books)`).
- Book line like `- **Title** by Author _(Nov 2)_` (date optional; month/day only).

Non-goals
- Don’t infer `dateStarted`.
- Don’t invent year when no year header applies (leave `dateFinished` empty).

## Module: LlmExtract (Fallback)
Responsibility: extract books from unstructured `.txt/.md` when deterministic parsing doesn’t match.

Prompt Requirements (new)
- Teach “year context”: if a book line has `(Nov 21)` under a `### 2025` header, interpret as `2025-11-21`.
- For “Currently Reading” section: don’t emit `dateFinished`.
- Never guess `dateStarted`.
- Keep output schema: `books: ParsedBook[]` with optional `dateFinished`.

Public Interface unchanged:
```ts
export async function llmExtract(rawText: string, opts?: LlmExtractOptions): Promise<LlmExtractResult>;
```

## Module: DedupHelpers (timesRead invariant)
Responsibility: apply import decisions and construct new `books` docs.

Public Interface (existing):
```ts
export function applyDecision(existing: Doc<"books">, incoming: ParsedBook, action: DedupDecisionAction): BookPatch | null;
export function buildNewBook(incoming: ParsedBook, userId: Id<"users">): Omit<Doc<"books">, "_id" | "_creationTime">;
```

Behavior Changes
- `buildNewBook`: set `timesRead = incoming.status === "read" ? 1 : 0`.
- `applyDecision` (merge): if `existing.timesRead === 0` and `incoming.status === "read"`, patch `{ timesRead: 1 }`.
  - Do not overwrite `timesRead > 0`.
  - Do not change status automatically (caller/user decision).

## Core Algorithms (Pseudocode)

### parseGoodreadsCsv row mapping (delta)
1. Parse CSV headers + rows (existing).
2. `dateFinished = parseDate(get("Date Read"))`.
3. `dateStarted = undefined` (never from `Date Added`).
4. Return `ParsedBook` with `status` from shelf resolution.

### parseReadingSummaryMarkdown(markdown)
1. Split into lines.
2. Track state:
   - `section`: `"currently-reading" | "books-by-year" | "other"`
   - `currentYear?: number`
3. For each line:
   - If line matches `^##\\s+Currently Reading` → `section="currently-reading"`, `currentYear=undefined`.
   - If line matches `^##\\s+Books by Year` → `section="books-by-year"`.
   - If line matches `^###\\s+(\\d{4})` → `section="books-by-year"`, `currentYear = that year`.
   - If line matches a book bullet:
     - Extract `title`, `author`.
     - If `section==="currently-reading"`:
       - `status="currently-reading"`, no `dateFinished`.
     - Else if `section==="books-by-year"`:
       - `status="read"`.
       - If line has date token like `(Nov 2)` and `currentYear` set:
         - `dateFinished = timestampFor(currentYear, "Nov", 2)`.
       - Else `dateFinished=undefined`.
     - Push `ParsedBook` with `tempId` derived from line index.
4. `matched = rows.length>0 && sawExpectedHeadings && noSkippedBookLikeLines`.

### buildNewBook(incoming)
1. Map basic fields as today.
2. `timesRead = incoming.status === "read" ? 1 : 0`.
3. Keep `dateFinished` as provided; don’t auto-set.

### applyDecision(existing, incoming, "merge")
1. Patch empty mergeable fields (existing behavior).
2. If `existing.timesRead === 0 && incoming.status === "read"`: `patch.timesRead = 1`.
3. Return patch or null.

## File Organization

New
- `lib/import/client/readingSummary.ts` — deterministic parser.
- `__tests__/import/readingSummary.parser.test.ts` — verifies year-context date parsing from `__tests__/fixtures/reading-sample.md`.

Modify
- `lib/import/client/goodreads.ts` — remove `Date Added` → `dateStarted`.
- `lib/import/llm.ts` — prompt updates (year-context rules + “never guess dateStarted”).
- `lib/import/dedup.ts` — `timesRead` logic for create + merge.
- `hooks/useImportJob.ts` — for `.md`: attempt `ReadingSummaryParser` before calling `extractBooks` action.
- Tests:
  - `__tests__/import/goodreads.test.ts` — assert `dateStarted` is `undefined`.
  - `__tests__/import/imports.commit.test.ts` and/or `__tests__/import/dedup.test.ts` — assert `timesRead` fixes.
  - `__tests__/import/llm*.test.ts` — assert prompt contains year-context instructions (spy on provider call arg).

## Integration Points

External Services / Env Vars
- No new services.
- Existing LLM env vars remain (`OPENAI_API_KEY`, `GEMINI_API_KEY`), but markdown reading-summary imports should succeed without them (deterministic path).

Build / Deploy
- No schema changes.
- CI gates already cover: lint/typecheck/unit tests/e2e (`.github/workflows/ci.yml`, `lefthook.yml`).

Observability
- Keep using `logImportEvent` (no titles/authors).
- Add at most a new `warnings` entry when deterministic parser matched but had unparsed dates (optional; not user-facing UI change).

Security / PII
- Deterministic parser runs locally; no data leaves client.
- LLM fallback: continue avoiding logging titles/authors; do not include secrets in prompt logs.

## State Management
- No changes to UI state machine (`useImportJob` statuses stay).
- Only change is parser selection for `.md` inputs (deterministic first, LLM fallback).

## Error Handling Strategy
- Parsing errors stay non-throwing: return `{ warnings, errors }` and show first error via toast (current behavior).
- Year-context date missing: treat as “unknown date” (no error) unless the format is malformed (e.g., invalid month token).

## Testing Strategy

Targets (new/changed code)
- Critical import correctness: ~90% branch coverage (parser + dedup logic).

Unit tests
- Goodreads: `dateStarted` always `undefined`; `dateFinished` still parsed.
- ReadingSummaryParser:
  - “Currently Reading” rows: status set, no `dateFinished`.
  - Year section rows: correct `dateFinished` for `(Mon D)` using the section year.
- DedupHelpers:
  - Create: `timesRead` correct for read vs non-read.
  - Merge repair: `timesRead: 0 → 1` when incoming status is read.

Optional local-only test
- If `../vanity/READING_SUMMARY.md` exists, run the same parser assertions against it; skip in CI when missing.

## Performance & Security Notes
- Deterministic markdown parse is O(n) on text size; no network; no token budget issues.
- LLM fallback remains bounded by `LLM_TOKEN_CAP`.

## Alternative Architectures Considered

Scoring rubric: Simplicity 40%, Module depth 30%, Explicitness 20%, Robustness 10% → weighted score = `simplicity*4 + depth*3 + explicitness*2 + robustness`.

| Option | Summary | Pros | Cons | Score (S/D/E/R → weighted/100) |
|---|---|---|---|---|
| A | Prompt-only LLM fixes + timesRead/Goodreads patches | Small diff | Still stochastic; hard to test; costs tokens | 10/6/6/5 → 75 |
| B (chosen) | Deterministic reading-summary parse + improved LLM prompt fallback | Predictable; testable; no LLM needed for target persona | Slightly more code | 8/8/8/9 → 81 |
| C | Change LLM to output ISO dates, parse in code | Easier for LLM; less math | Contract churn; still stochastic | 7/6/7/6 → 66 |
| D | Full deterministic parser for all markdown/text; drop LLM | Max determinism | Big scope; undermines “txt import” goal | 4/7/8/9 → 62 |

## ADR
Not required (no costly-to-reverse architectural bet; no new vendor/system choice).

## Open Questions / Assumptions
- Timestamp semantics: do we treat finish dates as date-only (midnight UTC) or user-local? Current codebase mixes; keep consistent within import path for now.
- Merge semantics: should importing `status:"read"` ever upgrade an existing non-read book’s status? (Spec doesn’t require; default: no.)
- Markdown variants: if the log uses different punctuation (no bold, different “by”), expand parser or fall back to LLM.
