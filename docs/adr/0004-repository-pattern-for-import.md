# ADR 0004: Repository Pattern for Import System

## Status

Accepted

## Date

2025-12 (inferred from codebase structure)

## Context

The import system needs to:

1. Parse CSV/TXT files (client-side for CSV, LLM for TXT)
2. Deduplicate against existing books
3. Preview changes before committing
4. Track import run state across multiple pages

This involves significant business logic (matching, merging, validation) that:

- Should be testable without Convex
- Needs to work with both real DB and in-memory mocks
- Crosses boundaries between client parsing and server storage

### Considered Approaches

1. **Direct Convex calls everywhere** - Convex-specific code in all components
2. **Repository abstraction** - Interface layer between business logic and storage
3. **Full ORM** - Heavyweight abstraction like Prisma

## Decision

**Implement a thin repository pattern with interfaces and multiple implementations.**

### Implementation

1. **Interfaces** (`lib/import/repository/interfaces.ts`):

   ```typescript
   export interface BookRepository {
     findByUser(userId: Id<"users">): Promise<Doc<"books">[]>;
     findById(id: Id<"books">): Promise<Doc<"books"> | null>;
     create(book: Omit<Doc<"books">, "_id" | "_creationTime">): Promise<Id<"books">>;
     update(id: Id<"books">, patch: Partial<Doc<"books">>): Promise<void>;
   }
   ```

2. **Convex Implementation** (`lib/import/repository/convex.ts`):
   - Wraps `ctx.db` calls
   - Used in production mutations/actions
   - `createConvexRepositories(db)` factory function

3. **Memory Implementation** (`lib/import/repository/memory.ts`):
   - In-memory arrays
   - Used in unit tests
   - Same interface, predictable behavior

4. **Core Logic** (`lib/import/dedup/core.ts`):
   - `matchBooks(existing, incoming)` - pure function
   - Takes arrays, returns match results
   - No knowledge of storage layer

### Usage Pattern

```typescript
// In Convex mutation
const repos = createConvexRepositories(ctx.db);
const existingBooks = await repos.books.findByUser(userId);
const matches = matchBooks(existingBooks, incomingBooks); // Pure logic

// In unit test
const repos = createMemoryRepositories();
repos.books.items = [mockBook1, mockBook2];
const matches = matchBooks(repos.books.items, testBooks);
```

## Consequences

### Positive

- **Testable** - Core dedup logic tested without Convex runtime
- **Portable** - Could swap storage (unlikely but possible)
- **Clean boundaries** - Business logic doesn't touch `ctx.db`

### Negative

- **Extra abstraction** - Repository interfaces are thin pass-throughs
- **Type gymnastics** - Doc types flow through multiple layers
- **Maintenance** - Must update interfaces when schema changes

### Why Not Full ORM?

Convex already provides:

- Type-safe queries (via schema)
- Reactive subscriptions
- Transaction semantics

An ORM would duplicate this and fight against Convex's design. The repository pattern is intentionally thin - just enough to enable testing.

## Alternatives Rejected

1. **Test against real Convex** - Slow, requires deployment, flaky
2. **Mock `ctx.db` directly** - Brittle, couples tests to Convex internals
3. **No abstraction** - Business logic scattered, untestable

## Related

- Import runs have similar pattern for tracking state across pages
- Import previews stored separately for idempotent commits
