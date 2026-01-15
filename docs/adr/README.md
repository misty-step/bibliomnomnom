# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for bibliomnomnom.

## What is an ADR?

An ADR captures a single architectural decision. It explains:

- **Context**: What situation prompted this decision?
- **Decision**: What did we decide?
- **Consequences**: What trade-offs did we accept?

## When to Write an ADR

Write an ADR when:

- Choosing between technologies or approaches
- Making irreversible or expensive-to-change decisions
- Establishing patterns that others should follow
- The decision would surprise a future developer

Skip ADRs for:

- Routine implementation choices
- Decisions that are easily reversible
- Standard industry practices

## Existing Decisions

Major architectural decisions are documented inline in [ARCHITECTURE.md](../../ARCHITECTURE.md):

- **ADR-001**: Convex as Backend (lines 553-602)
- **ADR-002**: Privacy Model - Private by Default (lines 605-658)
- **ADR-003**: Manual Book Entry - Defer API Integration (lines 661-713)

New decisions should be added to this folder using the template.

## How to Create a New ADR

```bash
cp docs/adr/template.md docs/adr/NNNN-short-title.md
```

Number sequentially starting from 0004 (0001-0003 are in ARCHITECTURE.md).

## Index

| #    | Title                                                                                                     | Status   | Date       |
| ---- | --------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| 0001 | [Convex as Backend](../../ARCHITECTURE.md#decision-1-convex-as-backend)                                   | Accepted | 2025-01-10 |
| 0002 | [Privacy Model (Private by Default)](../../ARCHITECTURE.md#decision-2-privacy-model-private-by-default)   | Accepted | 2025-01-15 |
| 0003 | [Manual Book Entry (Defer API)](../../ARCHITECTURE.md#decision-3-manual-book-entry-defer-api-integration) | Accepted | 2025-01-20 |
