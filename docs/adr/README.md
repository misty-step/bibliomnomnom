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

## How to Create a New ADR

```bash
cp docs/adr/template.md docs/adr/00NN-short-title.md
```

Number sequentially starting from 0012 (0001-0011 exist).

## Index

### Foundational Decisions (in ARCHITECTURE.md)

These decisions are embedded in the main architecture document:

| Decision                                                                                      | Summary                                    |
| --------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [Convex as Backend](../../ARCHITECTURE.md#decision-1-convex-as-backend)                       | Real-time database, type safety, simple DX |
| [Privacy Model](../../ARCHITECTURE.md#decision-2-privacy-model-private-by-default)            | Private by default, explicit public opt-in |
| [Manual Book Entry](../../ARCHITECTURE.md#decision-3-manual-book-entry-defer-api-integration) | Defer Google Books API to post-MVP         |

### Standalone ADRs

| #    | Title                                                                              | Status   | Date    |
| ---- | ---------------------------------------------------------------------------------- | -------- | ------- |
| 0001 | [Dual User Provisioning](./0001-dual-user-provisioning-clerk-webhook-plus-lazy.md) | Accepted | 2025-12 |
| 0002 | [Internal Trial Before Stripe](./0002-internal-trial-before-stripe.md)             | Accepted | 2025-12 |
| 0003 | [Webhook Token Validation](./0003-webhook-token-validation-pattern.md)             | Accepted | 2025-12 |
| 0004 | [Repository Pattern for Import](./0004-repository-pattern-for-import.md)           | Accepted | 2025-12 |
| 0005 | [LLM Extraction in Actions](./0005-llm-extraction-in-action-not-mutation.md)       | Accepted | 2025-12 |
| 0006 | [Model Fallback with Deduplication](./0006-model-fallback-with-deduplication.md)   | Accepted | 2025-12 |
| 0007 | [Clerk-Next.js Auth Adapter](./0007-clerk-nextjs-auth-adapter.md)                  | Accepted | 2025-12 |
| 0008 | [Stripe Status Mapping](./0008-stripe-status-mapping.md)                           | Accepted | 2025-12 |
| 0009 | [De-duplication for Race Conditions](./0009-de-duplication-on-race-conditions.md)  | Accepted | 2025-12 |
| 0010 | [Past-Due Grace Period](./0010-past-due-grace-period.md)                           | Accepted | 2025-12 |
| 0011 | [Distributed Rate Limiting](./0011-distributed-rate-limiting.md)                   | Accepted | 2025-12 |
