# ADR 0009: De-duplication Pattern for Race Conditions

## Status

Accepted

## Date

2025-12 (inferred from codebase patterns)

## Context

Convex mutations are not transactional across multiple reads and writes. When two requests arrive simultaneously:

```
Request A: Check exists? -> No -> Insert
Request B: Check exists? -> No -> Insert (duplicate!)
```

This affects:

- User creation (Clerk webhook vs lazy creation)
- Trial subscription creation (dashboard load race)
- Import run creation (multi-tab scenario)

### Considered Approaches

1. **Optimistic locking** - Version field, reject on conflict
2. **Unique constraints** - Let Convex enforce uniqueness
3. **De-duplicate after insert** - Detect and clean up duplicates

## Decision

**Accept that duplicates can occur, then detect and clean up. Keep earliest record, delete duplicates.**

### Implementation Pattern

```typescript
// Example from subscriptions.ts ensureTrialExists
let insertError: unknown;
try {
  const subscriptionId = await ctx.db.insert("subscriptions", { ... });
  return subscription;
} catch (err) {
  insertError = err;
  // Fall through to de-duplication
}

// Race condition: another request may have inserted
const matches = await ctx.db
  .query("subscriptions")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .collect();

if (matches.length > 0) {
  // Keep earliest (by _creationTime), delete rest
  const sorted = matches.sort((a, b) => a._creationTime - b._creationTime);
  const keeper = sorted[0]!;
  const duplicates = sorted.slice(1);

  for (const dupe of duplicates) {
    await ctx.db.delete(dupe._id);
  }

  return keeper;
}

// No match found and insert failed - bubble error
if (insertError) throw insertError;
```

### Why Earliest?

- Deterministic - Same decision regardless of which request runs cleanup
- Fair - First request "wins"
- Auditable - Creation time is immutable

## Consequences

### Positive

- **Eventually consistent** - Duplicates cleaned up automatically
- **No data loss** - Earliest record preserved
- **Simple** - No distributed locking needed

### Negative

- **Wasted work** - Duplicate inserts happen, then cleaned
- **Temporary inconsistency** - Brief window with duplicates
- **Query overhead** - Must re-query after insert failure

### Key Invariant

**Cleanup must be idempotent.** If two cleanup routines run simultaneously, they should converge to same state (single record).

### Applied In

1. `convex/auth.ts` - `ensureUserExists()` de-duplicates user records
2. `convex/subscriptions.ts` - `ensureTrialExists()` de-duplicates subscriptions
3. `convex/users.ts` - `createOrUpdateUser()` updates existing on conflict

## Alternatives Rejected

1. **Optimistic locking** - Requires schema change, retry logic
2. **Database constraints** - Convex doesn't support unique constraints (except indexes)
3. **Distributed lock** - Over-engineered, adds latency
4. **Accept duplicates** - Would break ownership queries, billing
