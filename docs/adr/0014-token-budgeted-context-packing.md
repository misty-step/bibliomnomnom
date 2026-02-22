# ADR-0014: Token-Budgeted Context Packing for Synthesis

**Status**: Accepted

**Date**: 2026-01-20

## Context

When synthesizing listening session notes via LLM, we need to provide context about the user's current book, recent notes, and library. Naively sending everything would exceed token limits and inflate costs. Too little context produces shallow synthesis.

## Decision

Implement a token-budgeted context packer (`lib/listening-sessions/contextPacker.ts`) that:

1. Accepts a total token budget for context
2. Allocates budget across categories: current book → recent notes → library books
3. Prioritizes current book (always included), then most recent notes
4. Truncates note content to fit within per-item budgets
5. Caps maximum context expansion items at 4 (`MAX_CONTEXT_EXPANSION_ITEMS`)

Privacy is enforced during packing: private books and notes from non-current books are excluded from context.

## Consequences

**Good:**

- Predictable LLM costs — context size is bounded regardless of library size
- Privacy maintained — packer respects book privacy settings
- Quality synthesis — most relevant context prioritized

**Bad:**

- Large libraries get sampled, not fully represented
- Token counting adds latency (mitigated by using approximate counts)
- Budget constants need tuning as models and pricing change
