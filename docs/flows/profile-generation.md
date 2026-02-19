# Profile Generation State Machine

The ProfilePage component (`components/profile/ProfilePage.tsx`) manages AI-powered profile generation with multiple states.

Current profile threshold in code is `20` books (`convex/profiles.ts`), not 5.

## State Machine

```mermaid
stateDiagram-v2
    [*] --> loading: Component mounts

    loading --> unauthenticated: No user
    loading --> below_threshold: < 20 books
    loading --> no_profile: User has no profile
    loading --> generating: Profile being generated
    loading --> failed: Previous generation failed
    loading --> ready: Profile exists

    no_profile --> generating: Generate clicked
    failed --> generating: Try Again clicked
    ready --> ready: Regenerate clicked (isRegenerating=true)

    generating --> ready: Generation succeeds
    generating --> failed: Generation fails

    note right of below_threshold
        Shows ProfileThreshold component
        with book count and target (20)
    end note

    note right of generating
        ProfileGenerating skeleton
        Usually 30-60 seconds
    end note

    note right of ready
        isRegenerating flag shows
        refresh indicator in header
    end note
```

## Input Signals (Current vs Next)

Current generation context includes:

- read books
- currently-reading books
- want-to-read books
- favorites, audiobook flags, rereads, recent completion timing

Next planned context expansion:

- voice-note synthesis artifacts (see #168)

## Query Response Shape

```typescript
type ProfileQueryResult =
  | { status: "unauthenticated" }
  | { status: "below_threshold"; bookCount: number; booksNeeded: number }
  | { status: "no_profile"; bookCount: number; stats: ProfileStats }
  | { status: "generating"; bookCount: number; profile?: ProfilePreview }
  | { status: "failed"; bookCount: number; error: string; profile: ProfilePreview }
  | {
      status: "ready";
      profile: Profile;
      isStale: boolean;
      isRegenerating: boolean;
      bookCount: number;
    };
```

## Optimistic State

The component uses `isPending` for immediate feedback:

```mermaid
sequenceDiagram
    participant User
    participant Component
    participant Convex

    User->>Component: Click Generate
    Component->>Component: isPending = true
    Component->>Convex: generateProfile()
    Note over Component: Button shows spinner
    Convex-->>Component: Mutation succeeds
    Note over Convex: Background job starts
    Component->>Convex: Query refetches
    Convex-->>Component: status: "generating"
    Note over Component: ProfileGenerating renders
    Convex-->>Component: status: "ready"
    Component->>Component: isPending = false
```

## Regeneration Flow

When regenerating an existing profile:

1. `handleRegenerate()` sets `isPending = true`
2. Calls `generateProfile()` mutation
3. Query updates with `isRegenerating: true`
4. Component shows refresh indicator in header
5. When complete, `isRegenerating` becomes false
6. Effect clears `isPending`

## Error Recovery

| State                       | Recovery Action                                 |
| --------------------------- | ----------------------------------------------- |
| `failed`                    | "Try Again" button -> calls `generateProfile()` |
| Network error in generation | Toast shown, `isPending` reset                  |
| Below threshold             | User must add more books (20 total required)    |
